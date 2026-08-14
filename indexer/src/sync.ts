import { rpc } from "@stellar/stellar-sdk";

import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { decode, jsonSafe, type IndexedEvent } from "./decode.js";

const PAGE_LIMIT = 200;


/**
 * Ledger sequence encoded in a paging cursor.
 *
 * The cursor is `<toid>-<index>`, where the toid packs the ledger into its high 32 bits. Reading
 * it is what lets the sync know when it has genuinely caught up: an empty page means "nothing
 * matched in the ledgers scanned this call", **not** "no more events". Treating a short page as
 * the end silently stops the indexer 100k ledgers short of the head.
 */
function cursorLedger(cursor: string): number {
  const toid = cursor.split("-")[0];
  if (!toid) return 0;
  try {
    return Number(BigInt(toid) >> 32n);
  } catch {
    return 0;
  }
}

export interface SyncResult {
  ingested: number;
  /** Events that arrived but could not be stored. Non-zero means the data set has holes in it. */
  skipped: number;
  /** How far the sync actually read — the cursor position, not where the last event happened. */
  syncedThrough: number;
  /** Ledger of the most recent event ingested, which may be far behind the head. */
  lastEventLedger: number;
  latestLedger: number;
  /** True when RPC has already discarded ledgers we had not yet read. */
  gapDetected: boolean;
}

interface SyncState {
  cursor: string | null;
  lastLedger: number;
}

async function readState(db: Db): Promise<SyncState> {
  const { rows } = await db.query<{ cursor: string | null; last_ledger: string }>(
    "SELECT cursor, last_ledger FROM sync_state WHERE id = 1",
  );
  const row = rows[0];
  return { cursor: row?.cursor ?? null, lastLedger: Number(row?.last_ledger ?? 0) };
}

async function writeState(
  db: Db,
  cursor: string | null,
  lastLedger: number,
  oldestAvailable: number,
): Promise<void> {
  // Upsert, not update. The row is seeded by migration 001, but a `DELETE FROM sync_state` — the
  // obvious way to reset an index by hand — removes it, and an UPDATE against a missing singleton
  // affects zero rows and reports success. The indexer then re-probes from the oldest retained
  // ledger on every single run, forever, while its logs read exactly like a healthy sync.
  //
  // Silent is the problem. Re-probing is survivable; not being able to tell is not.
  await db.query(
    `INSERT INTO sync_state (id, cursor, last_ledger, oldest_available, updated_at)
     VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE
        SET cursor = EXCLUDED.cursor,
            last_ledger = EXCLUDED.last_ledger,
            oldest_available = EXCLUDED.oldest_available,
            updated_at = now()`,
    [cursor, lastLedger, oldestAvailable],
  );
}

/**
 * Write one event and whatever derived rows it implies, atomically.
 *
 * Everything is `ON CONFLICT DO NOTHING` against the RPC's event id, so replaying an already
 * ingested range is harmless. That matters more than it sounds: a cron-driven indexer will
 * routinely re-read the tail of the last page.
 */
async function persist(db: Db, config: Config, event: IndexedEvent): Promise<boolean> {
  // The RPC request is filtered by contract id, so this should never fire. It is here because that
  // filter is the only thing standing between the dashboard and a copycat contract emitting
  // identically shaped events, and it is enforced by a server we do not run — RPC_URL is
  // configurable and defaults to a public endpoint. Checking what arrived costs one comparison.
  // It also stops a redeployed vault from silently merging its history with the old one.
  if (event.contractId !== config.deployment.vault) {
    console.warn(`  ! ignoring event ${event.id} from foreign contract ${event.contractId}`);
    return false;
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO events (id, ledger, ledger_closed_at, tx_hash, contract_id, kind, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.ledger,
        event.ledgerClosedAt,
        event.txHash,
        event.contractId,
        event.event.kind,
        JSON.stringify(jsonSafe(event.event)),
      ],
    );

    if (inserted.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const e = event.event;
    const at = event.ledgerClosedAt;

    if (e.kind === "deposit" || e.kind === "withdraw") {
      await client.query(
        `INSERT INTO user_actions
           (event_id, account, action, assets, shares, tx_hash, ledger_closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [event.id, e.account, e.kind, e.assets.toString(), e.shares.toString(), event.txHash, at],
      );
    }

    if (e.kind === "deposit" || e.kind === "withdraw" || e.kind === "harvest") {
      await client.query(
        `INSERT INTO vault_samples
           (event_id, ledger, ledger_closed_at, share_price, total_assets)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, event.ledger, at, e.sharePrice.toString(), e.totalAssets.toString()],
      );
    }

    if (e.kind === "harvest") {
      await client.query(
        `INSERT INTO harvests (event_id, gross, fee, net, ledger_closed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, e.gross.toString(), e.fee.toString(), e.net.toString(), at],
      );
    }

    if (e.kind === "allocate" || e.kind === "unwind" || e.kind === "strategy_loss") {
      // A loss is recorded as its own direction rather than as an unwind: no capital came back to
      // the reserve, which is exactly the distinction anyone reading the flow history needs.
      const direction = e.kind === "strategy_loss" ? "loss" : e.kind;
      await client.query(
        `INSERT INTO strategy_flows (event_id, strategy, direction, amount, ledger_closed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, e.strategy, direction, e.amount.toString(), at],
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Read every available event from where we left off, up to the current ledger. */
export async function sync(db: Db, config: Config): Promise<SyncResult> {
  const server = new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith("http://") });
  const state = await readState(db);
  const filters = [{ type: "contract" as const, contractIds: [config.deployment.vault] }];

  let cursor = state.cursor;
  let startLedger: number | undefined;
  let gapDetected = false;
  let oldestAvailable = 0;

  // A cursor older than RPC's retention window is not a resume point, it is a dead end.
  //
  // `getEvents` rejects a cursor it can no longer serve, and the rejection happens before anything
  // is ingested — so the run fails, the cursor is never advanced, and the next run fails in exactly
  // the same place. The indexer stops forever while still looking alive on a schedule.
  //
  // This is not hypothetical: after the 2026-08-14 redeploy, production held a cursor from July and
  // could not have ingested a single event from the new vault. Falling back to the ledger-range
  // path lets the sync resume at the oldest ledger RPC still holds. The events in between are
  // genuinely gone, which is what `gapDetected` is for — but losing the past is not a reason to
  // also lose the present.
  if (cursor && cursorLedger(cursor) > 0) {
    const latest = await server.getLatestLedger();
    const probe = await server.getEvents({
      startLedger: Math.max(latest.sequence - 1, 1),
      filters,
      limit: 1,
    });
    if (cursorLedger(cursor) < probe.oldestLedger) {
      console.warn(
        `  ! STALE CURSOR: at ledger ${cursorLedger(cursor)}, but RPC only retains from ` +
          `${probe.oldestLedger}. Restarting from the oldest retained ledger.`,
      );
      cursor = null;
      gapDetected = true;
    }
  }

  if (!cursor) {
    // Probe once to learn the RPC's retention window before asking for a range it cannot serve.
    const latest = await server.getLatestLedger();
    const probe = await server.getEvents({
      startLedger: Math.max(latest.sequence - 1, 1),
      filters,
      limit: 1,
    });
    oldestAvailable = probe.oldestLedger;

    // Resume just past the last ledger we indexed; on a genuinely fresh database fall back to the
    // oldest ledger RPC still holds.
    //
    // The floor is `oldestLedger` exactly. It used to be `oldestLedger + 120`, a margin meant to
    // absorb retention advancing mid-sync — but as a `Math.max` lower bound it moved the start
    // *forward*, so every backfill silently threw away the oldest ten minutes of vault history and
    // overrode an operator's explicit START_LEDGER while doing it. Those ledgers were never
    // requested, so idempotent ingestion could not recover them and RPC retention eventually made
    // the loss permanent. If retention does advance past us mid-run, the request fails loudly and
    // the next run re-probes, which is the better failure.
    const resumeFrom = state.lastLedger > 0 ? state.lastLedger + 1 : probe.oldestLedger;
    startLedger = Math.max(config.startLedger ?? resumeFrom, probe.oldestLedger);

    if (state.lastLedger > 0 && state.lastLedger + 1 < probe.oldestLedger) {
      gapDetected = true;
      console.warn(
        `  ! GAP: last indexed ledger ${state.lastLedger}, but RPC now only retains from ` +
          `${probe.oldestLedger}. Events in between are gone from RPC for good.`,
      );
    }
  }

  let ingested = 0;
  let skipped = 0;
  let lastEventLedger = state.lastLedger;
  let latestLedger = 0;

  for (;;) {
    const page: rpc.Api.GetEventsResponse = cursor
      ? await server.getEvents({ filters, cursor, limit: PAGE_LIMIT })
      : await server.getEvents({ filters, startLedger: startLedger!, limit: PAGE_LIMIT });

    latestLedger = page.latestLedger;
    oldestAvailable = page.oldestLedger;

    for (const raw of page.events) {
      const event = decode(raw);
      if (!event) continue;

      // One unwritable row must not take the sync down with it. The cursor is only saved after the
      // loop, so an exception escaping here meant the same page was refetched on the next run and
      // failed at the same row — forever, while `watch` mode logged a line and looked alive. Skip
      // it, say so, and keep moving; the event stays in RPC's window if it needs reprocessing.
      try {
        if (await persist(db, config, event)) {
          ingested += 1;
          console.log(
            `  + ${event.event.kind.padEnd(17)} ledger ${event.ledger}  ${event.txHash.slice(0, 12)}…`,
          );
        }
      } catch (cause) {
        skipped += 1;
        console.warn(`  ! could not store event ${event.id}: ${(cause as Error).message}`);
      }

      lastEventLedger = Math.max(lastEventLedger, event.ledger);
    }

    cursor = page.cursor;
    startLedger = undefined;

    // Stop only once the cursor itself has reached the head. Page size says nothing about
    // progress — RPC scans a bounded slice of ledgers per call and legitimately returns zero
    // matches for most of them.
    if (cursorLedger(cursor) >= page.latestLedger) break;
  }

  const syncedThrough = cursor ? cursorLedger(cursor) : lastEventLedger;
  await writeState(db, cursor, syncedThrough, oldestAvailable);
  return { ingested, skipped, syncedThrough, lastEventLedger, latestLedger, gapDetected };
}
