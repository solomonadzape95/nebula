import { STROOPS } from "./config.js";
import type { Db } from "./db.js";

export interface VaultStats {
  totalAssets: bigint;
  sharePrice: bigint;
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

const ZERO = "0";

export async function stats(db: Db): Promise<VaultStats> {
  const latest = await db.query<{ share_price: string; total_assets: string; at: Date }>(
    `SELECT share_price, total_assets, ledger_closed_at AS at
       FROM vault_samples
      ORDER BY ledger_closed_at DESC, ledger DESC
      LIMIT 1`,
  );

  const users = await db.query<{
    depositors: string;
    deposits: string;
    withdrawals: string;
    deposited: string;
    withdrawn: string;
    first_at: Date | null;
    last_at: Date | null;
  }>(
    `SELECT COUNT(DISTINCT account) FILTER (WHERE action = 'deposit') AS depositors,
            COUNT(*) FILTER (WHERE action = 'deposit')                AS deposits,
            COUNT(*) FILTER (WHERE action = 'withdraw')               AS withdrawals,
            COALESCE(SUM(assets) FILTER (WHERE action = 'deposit'), 0)  AS deposited,
            COALESCE(SUM(assets) FILTER (WHERE action = 'withdraw'), 0) AS withdrawn,
            MIN(ledger_closed_at) AS first_at,
            MAX(ledger_closed_at) AS last_at
       FROM user_actions`,
  );

  const yields = await db.query<{ count: string; gross: string; fee: string }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(gross), 0) AS gross,
            COALESCE(SUM(fee), 0)   AS fee
       FROM harvests`,
  );

  const u = users.rows[0];
  const y = yields.rows[0];

  return {
    totalAssets: BigInt(latest.rows[0]?.total_assets ?? ZERO),
    sharePrice: BigInt(latest.rows[0]?.share_price ?? STROOPS.toString()),
    uniqueDepositors: Number(u?.depositors ?? 0),
    depositCount: Number(u?.deposits ?? 0),
    withdrawCount: Number(u?.withdrawals ?? 0),
    totalDeposited: BigInt(u?.deposited ?? ZERO),
    totalWithdrawn: BigInt(u?.withdrawn ?? ZERO),
    harvestCount: Number(y?.count ?? 0),
    grossYield: BigInt(y?.gross ?? ZERO),
    feesTaken: BigInt(y?.fee ?? ZERO),
    firstActivity: u?.first_at ?? null,
    lastActivity: u?.last_at ?? null,
  };
}

export interface PricePoint {
  at: Date;
  sharePrice: bigint;
  totalAssets: bigint;
}

export async function sharePriceSeries(db: Db, limit = 500): Promise<PricePoint[]> {
  const { rows } = await db.query<{ at: Date; share_price: string; total_assets: string }>(
    `SELECT ledger_closed_at AS at, share_price, total_assets
       FROM vault_samples
      ORDER BY ledger_closed_at ASC, ledger ASC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    at: r.at,
    sharePrice: BigInt(r.share_price),
    totalAssets: BigInt(r.total_assets),
  }));
}

export interface Depositor {
  account: string;
  deposits: number;
  withdrawals: number;
  totalDeposited: bigint;
  firstSeen: Date;
  lastSeen: Date;
  firstTxHash: string;
}

/**
 * One row per address that has ever deposited — the Level 4 proof-of-users evidence.
 *
 * `first_tx_hash` is carried through so each row is independently checkable on Stellar Expert
 * rather than something a reviewer has to take on trust.
 */
export async function depositors(db: Db): Promise<Depositor[]> {
  const { rows } = await db.query<{
    account: string;
    deposits: string;
    withdrawals: string;
    total_deposited: string;
    first_seen: Date;
    last_seen: Date;
    first_tx_hash: string;
  }>(
    `SELECT account,
            COUNT(*) FILTER (WHERE action = 'deposit')  AS deposits,
            COUNT(*) FILTER (WHERE action = 'withdraw') AS withdrawals,
            COALESCE(SUM(assets) FILTER (WHERE action = 'deposit'), 0) AS total_deposited,
            MIN(ledger_closed_at) AS first_seen,
            MAX(ledger_closed_at) AS last_seen,
            (ARRAY_AGG(tx_hash ORDER BY ledger_closed_at ASC))[1] AS first_tx_hash
       FROM user_actions
      GROUP BY account
     HAVING COUNT(*) FILTER (WHERE action = 'deposit') > 0
      ORDER BY MIN(ledger_closed_at) ASC`,
  );

  return rows.map((r) => ({
    account: r.account,
    deposits: Number(r.deposits),
    withdrawals: Number(r.withdrawals),
    totalDeposited: BigInt(r.total_deposited),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    firstTxHash: r.first_tx_hash,
  }));
}

export interface Apy {
  percent: number;
  windowHours: number;
  from: Date;
  to: Date;
}

const MIN_WINDOW_HOURS = 6;

/**
 * Realized APY, annualized from actual share-price movement.
 *
 * Returns `null` until at least {@link MIN_WINDOW_HOURS} of history exists. Annualizing a few
 * minutes of data produces a number in the thousands of percent — technically the formula's
 * output, but a lie on a dashboard. Showing nothing is the honest answer until the window is
 * long enough to mean something.
 */
export async function realizedApy(db: Db): Promise<Apy | null> {
  const { rows } = await db.query<{ at: Date; share_price: string }>(
    `(SELECT ledger_closed_at AS at, share_price FROM vault_samples
       ORDER BY ledger_closed_at ASC LIMIT 1)
     UNION ALL
     (SELECT ledger_closed_at AS at, share_price FROM vault_samples
       ORDER BY ledger_closed_at DESC LIMIT 1)`,
  );

  const [first, last] = rows;
  if (!first || !last) return null;

  const windowHours = (last.at.getTime() - first.at.getTime()) / 3_600_000;
  if (windowHours < MIN_WINDOW_HOURS) return null;

  const start = Number(first.share_price);
  const end = Number(last.share_price);
  if (start <= 0 || end <= start) return null;

  const periodsPerYear = (365 * 24) / windowHours;
  const percent = (Math.pow(end / start, periodsPerYear) - 1) * 100;

  return { percent, windowHours, from: first.at, to: last.at };
}

export interface StrategyFlow {
  strategy: string;
  allocated: bigint;
  unwound: bigint;
  net: bigint;
}

export async function strategyFlows(db: Db): Promise<StrategyFlow[]> {
  const { rows } = await db.query<{ strategy: string; allocated: string; unwound: string }>(
    `SELECT strategy,
            COALESCE(SUM(amount) FILTER (WHERE direction = 'allocate'), 0) AS allocated,
            COALESCE(SUM(amount) FILTER (WHERE direction = 'unwind'), 0)   AS unwound
       FROM strategy_flows
      GROUP BY strategy
      ORDER BY strategy`,
  );
  return rows.map((r) => {
    const allocated = BigInt(r.allocated);
    const unwound = BigInt(r.unwound);
    return { strategy: r.strategy, allocated, unwound, net: allocated - unwound };
  });
}

/** Format a stroop amount as a human-readable decimal string. */
export function fmt(stroops: bigint, decimals = 7): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS;
  const frac = (abs % STROOPS).toString().padStart(7, "0").slice(0, decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}
