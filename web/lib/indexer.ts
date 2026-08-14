import { cache } from "react";

import { VAULT_ID } from "@/lib/contracts";
import { query } from "@/lib/db";

/**
 * Every read here is scoped to one vault.
 *
 * The indexer's tables outlive any single deployment: the contracts were redeployed on 2026-08-14
 * for the security pass, and the retired vault's history is deliberately kept rather than deleted —
 * it happened, and a record that gets edited when it becomes inconvenient is not a record.
 *
 * But keeping it means the tables now hold two vaults, and an unscoped `SUM` silently adds them
 * together. That is worse than either number alone: it produced a stats page showing a share price
 * from the live contract beside yield totals from a dead one, which is not a figure that describes
 * anything at all.
 *
 * Every derived table foreign-keys to `events`, and `events` carries `contract_id`, so the join
 * below is the whole fix — no schema change, and nothing thrown away.
 */
const VAULT_SCOPE = "JOIN events e ON e.id = %s.event_id AND e.contract_id = $%d";
const scope = (alias: string, param: number) =>
  VAULT_SCOPE.replace("%s", alias).replace("%d", String(param));


/* ────────────────────────────────────────────────────────────────── stats */

export interface IndexerStats {
  uniqueDepositors: number;
  depositCount: number;
  withdrawCount: number;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  harvestCount: number;
  grossYield: bigint;
  feesTaken: bigint;
  firstActivity: Date | null;
  lastActivity: Date | null;
}

export const getIndexerStats = cache(async (): Promise<IndexerStats | null> => {
  const users = await query<{
    depositors: string;
    deposits: string;
    withdrawals: string;
    deposited: string;
    withdrawn: string;
    first_at: Date | null;
    last_at: Date | null;
  }>(
    `SELECT COUNT(DISTINCT ua.account) FILTER (WHERE ua.action = 'deposit') AS depositors,
            COUNT(*) FILTER (WHERE ua.action = 'deposit')                   AS deposits,
            COUNT(*) FILTER (WHERE ua.action = 'withdraw')                  AS withdrawals,
            COALESCE(SUM(ua.assets) FILTER (WHERE ua.action = 'deposit'), 0)  AS deposited,
            COALESCE(SUM(ua.assets) FILTER (WHERE ua.action = 'withdraw'), 0) AS withdrawn,
            MIN(ua.ledger_closed_at) AS first_at,
            MAX(ua.ledger_closed_at) AS last_at
       FROM user_actions ua
       ${scope("ua", 1)}`,
    [VAULT_ID],
  );
  if (!users) return null;

  const yields = await query<{ count: string; gross: string; fee: string }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(h.gross), 0) AS gross,
            COALESCE(SUM(h.fee), 0)   AS fee
       FROM harvests h
       ${scope("h", 1)}`,
    [VAULT_ID],
  );

  const u = users[0];
  const y = yields?.[0];

  return {
    uniqueDepositors: Number(u?.depositors ?? 0),
    depositCount: Number(u?.deposits ?? 0),
    withdrawCount: Number(u?.withdrawals ?? 0),
    totalDeposited: BigInt(u?.deposited ?? 0),
    totalWithdrawn: BigInt(u?.withdrawn ?? 0),
    harvestCount: Number(y?.count ?? 0),
    grossYield: BigInt(y?.gross ?? 0),
    feesTaken: BigInt(y?.fee ?? 0),
    firstActivity: u?.first_at ?? null,
    lastActivity: u?.last_at ?? null,
  };
});

/* ───────────────────────────────────────────────────────────── depositors */

export interface Depositor {
  account: string;
  deposits: number;
  withdrawals: number;
  totalDeposited: bigint;
  firstSeen: Date;
  firstTxHash: string;
}

export const getDepositors = cache(async (): Promise<Depositor[]> => {
  const rows = await query<{
    account: string;
    deposits: string;
    withdrawals: string;
    total_deposited: string;
    first_seen: Date;
    first_tx_hash: string;
  }>(
    `SELECT ua.account,
            COUNT(*) FILTER (WHERE ua.action = 'deposit')  AS deposits,
            COUNT(*) FILTER (WHERE ua.action = 'withdraw') AS withdrawals,
            COALESCE(SUM(ua.assets) FILTER (WHERE ua.action = 'deposit'), 0) AS total_deposited,
            MIN(ua.ledger_closed_at) AS first_seen,
            (ARRAY_AGG(ua.tx_hash ORDER BY ua.ledger_closed_at ASC))[1] AS first_tx_hash
       FROM user_actions ua
       ${scope("ua", 1)}
      GROUP BY ua.account
     HAVING COUNT(*) FILTER (WHERE ua.action = 'deposit') > 0
      ORDER BY MIN(ua.ledger_closed_at) ASC`,
    [VAULT_ID],
  );

  return (rows ?? []).map((r) => ({
    account: r.account,
    deposits: Number(r.deposits),
    withdrawals: Number(r.withdrawals),
    totalDeposited: BigInt(r.total_deposited),
    firstSeen: r.first_seen,
    firstTxHash: r.first_tx_hash,
  }));
});

/* ─────────────────────────────────────────────────────────────── activity */

export interface ActivityEvent {
  kind: "deposit" | "withdraw" | "harvest";
  /** Underlying moved. For a harvest this is the net credited to the share price. */
  amount: bigint;
  shares: bigint | null;
  sharePrice: bigint;
  txHash: string;
  at: Date;
  account: string | null;
}

export const getActivity = cache(async (limit = 50): Promise<ActivityEvent[]> => {
  const rows = await query<{
    kind: string;
    amount: string;
    shares: string | null;
    share_price: string;
    tx_hash: string;
    at: Date;
    account: string | null;
  }>(
    `SELECT ua.action        AS kind,
            ua.assets        AS amount,
            ua.shares        AS shares,
            vs.share_price   AS share_price,
            ua.tx_hash       AS tx_hash,
            ua.ledger_closed_at AS at,
            ua.account       AS account
       FROM user_actions ua
       JOIN vault_samples vs ON vs.event_id = ua.event_id
       ${scope("ua", 2)}
     UNION ALL
     SELECT 'harvest', h.net, NULL, vs.share_price, e.tx_hash, h.ledger_closed_at, NULL
       FROM harvests h
       JOIN vault_samples vs ON vs.event_id = h.event_id
       ${scope("h", 2)}
      ORDER BY at DESC
      LIMIT $1`,
    [limit, VAULT_ID],
  );

  return (rows ?? []).map((r) => ({
    kind: r.kind as ActivityEvent["kind"],
    amount: BigInt(r.amount),
    shares: r.shares === null ? null : BigInt(r.shares),
    sharePrice: BigInt(r.share_price),
    txHash: r.tx_hash,
    at: r.at,
    account: r.account,
  }));
});

/* ─────────────────────────────────────────────────────────── price series */

export interface PricePoint {
  at: Date;
  sharePrice: bigint;
  totalAssets: bigint;
}

export const getPriceSeries = cache(async (limit = 200): Promise<PricePoint[]> => {
  const rows = await query<{ at: Date; share_price: string; total_assets: string }>(
    `SELECT vs.ledger_closed_at AS at, vs.share_price, vs.total_assets
       FROM vault_samples vs
       ${scope("vs", 2)}
      ORDER BY vs.ledger_closed_at ASC, vs.ledger ASC
      LIMIT $1`,
    [limit, VAULT_ID],
  );

  return (rows ?? []).map((r) => ({
    at: r.at,
    sharePrice: BigInt(r.share_price),
    totalAssets: BigInt(r.total_assets),
  }));
});

/* ──────────────────────────────────────────────────────────────────── apy */

export interface Apy {
  percent: number;
  windowHours: number;
}

/** Below this the annualized figure is arithmetically valid and completely misleading. */
const MIN_WINDOW_HOURS = 6;

/**
 * Realized APY, annualized from actual share-price movement.
 *
 * Returns null until there is enough history. Annualizing a few minutes of data produces numbers
 * in the thousands of percent, and a reviewer who spots one implausible APY stops believing every
 * other number on the page.
 */
export const getApy = cache(async (): Promise<Apy | null> => {
  const rows = await query<{ at: Date; share_price: string }>(
    `(SELECT vs.ledger_closed_at AS at, vs.share_price FROM vault_samples vs
       ${scope("vs", 1)}
       ORDER BY vs.ledger_closed_at ASC LIMIT 1)
     UNION ALL
     (SELECT vs.ledger_closed_at AS at, vs.share_price FROM vault_samples vs
       ${scope("vs", 1)}
       ORDER BY vs.ledger_closed_at DESC LIMIT 1)`,
    [VAULT_ID],
  );

  const first = rows?.[0];
  const last = rows?.[1];
  if (!first || !last) return null;

  const windowHours = (last.at.getTime() - first.at.getTime()) / 3_600_000;
  if (windowHours < MIN_WINDOW_HOURS) return null;

  const start = Number(first.share_price);
  const end = Number(last.share_price);
  if (start <= 0 || end <= start) return null;

  const periodsPerYear = (365 * 24) / windowHours;
  return { percent: (Math.pow(end / start, periodsPerYear) - 1) * 100, windowHours };
});

/** How far behind the chain the indexer currently is, for the freshness badge. */
export const getSyncState = cache(async (): Promise<{ lastLedger: number; updatedAt: Date } | null> => {
  const rows = await query<{ last_ledger: string; updated_at: Date }>(
    "SELECT last_ledger, updated_at FROM sync_state WHERE id = 1",
  );
  const row = rows?.[0];
  return row ? { lastLedger: Number(row.last_ledger), updatedAt: row.updated_at } : null;
});
