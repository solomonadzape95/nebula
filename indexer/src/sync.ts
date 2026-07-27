import { rpc } from "@stellar/stellar-sdk";

import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { decode, jsonSafe, type IndexedEvent } from "./decode.js";

const PAGE_LIMIT = 200;

/**
 * Ledgers of headroom above the RPC's reported oldest ledger.
 *
 * Retention advances while a sync is running, so a `startLedger` that was legal when it was
 * computed can be rejected moments later. The margin costs nothing — those ledgers are re-scanned,
 * and ingestion is idempotent.
 */
const RETENTION_MARGIN = 120;

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
  await db.query(
    `UPDATE sync_state
        SET cursor = $1, last_ledger = $2, oldest_available = $3, updated_at = now()
      WHERE id = 1`,
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
async function persist(db: Db, event: IndexedEvent): Promise<boolean> {
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

    if (e.kind === "allocate" || e.kind === "unwind") {
      await client.query(
        `INSERT INTO strategy_flows (event_id, strategy, direction, amount, ledger_closed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, e.strategy, e.kind, e.amount.toString(), at],
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
    const resumeFrom = state.lastLedger > 0 ? state.lastLedger + 1 : probe.oldestLedger;
    startLedger = Math.max(
      config.startLedger ?? resumeFrom,
      probe.oldestLedger + RETENTION_MARGIN,
    );

    if (state.lastLedger > 0 && state.lastLedger + 1 < probe.oldestLedger) {
      gapDetected = true;
      console.warn(
        `  ! GAP: last indexed ledger ${state.lastLedger}, but RPC now only retains from ` +
          `${probe.oldestLedger}. Events in between are gone from RPC for good.`,
      );
    }
  }

  let ingested = 0;
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
      if (await persist(db, event)) {
        ingested += 1;
        console.log(
          `  + ${event.event.kind.padEnd(17)} ledger ${event.ledger}  ${event.txHash.slice(0, 12)}…`,
        );
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
  return { ingested, syncedThrough, lastEventLedger, latestLedger, gapDetected };
}
