import { STROOPS } from "./config.js";
import type { Db } from "./db.js";

/**
 * Every read here is scoped to one vault, passed in by the caller from the deployment file.
 *
 * These tables outlive any single deployment. The contracts were redeployed on 2026-08-14 for the
 * security pass, and the retired vault's history is kept rather than deleted — it happened, and a
 * record that gets edited when it becomes inconvenient is not a record.
 *
 * Keeping it means the tables hold two vaults, and an unscoped SUM silently adds them together,
 * which is worse than either number alone. Every derived table foreign-keys to `events`, and
 * `events` carries `contract_id`, so this join is the whole fix.
 */
const scope = (alias: string, param: number) =>
  `JOIN events e ON e.id = ${alias}.event_id AND e.contract_id = $${param}`;

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

export async function stats(db: Db, vault: string): Promise<VaultStats> {
  const latest = await db.query<{ share_price: string; total_assets: string; at: Date }>(
    `SELECT vs.share_price, vs.total_assets, vs.ledger_closed_at AS at
       FROM vault_samples vs
       ${scope("vs", 1)}
      ORDER BY vs.ledger_closed_at DESC, vs.ledger DESC
      LIMIT 1`,
    [vault],
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
    `SELECT COUNT(DISTINCT ua.account) FILTER (WHERE ua.action = 'deposit') AS depositors,
            COUNT(*) FILTER (WHERE ua.action = 'deposit')                   AS deposits,
            COUNT(*) FILTER (WHERE ua.action = 'withdraw')                  AS withdrawals,
            COALESCE(SUM(ua.assets) FILTER (WHERE ua.action = 'deposit'), 0)  AS deposited,
            COALESCE(SUM(ua.assets) FILTER (WHERE ua.action = 'withdraw'), 0) AS withdrawn,
            MIN(ua.ledger_closed_at) AS first_at,
            MAX(ua.ledger_closed_at) AS last_at
       FROM user_actions ua
       ${scope("ua", 1)}`,
    [vault],
  );

  const yields = await db.query<{ count: string; gross: string; fee: string }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(h.gross), 0) AS gross,
            COALESCE(SUM(h.fee), 0)   AS fee
       FROM harvests h
       ${scope("h", 1)}`,
    [vault],
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

export async function sharePriceSeries(db: Db, vault: string, limit = 500): Promise<PricePoint[]> {
  const { rows } = await db.query<{ at: Date; share_price: string; total_assets: string }>(
    `SELECT vs.ledger_closed_at AS at, vs.share_price, vs.total_assets
       FROM vault_samples vs
       ${scope("vs", 2)}
      ORDER BY vs.ledger_closed_at ASC, vs.ledger ASC
      LIMIT $1`,
    [limit, vault],
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
  /**
   * How many distinct UTC days this address acted on.
   *
   * A batch of wallets scripted in one sitting all show 1. Someone who deposited, left, and came
   * back to check on it shows 2 or more. It is the cheapest available signal for the difference,
   * and it is reported rather than filtered on — the judgement belongs to whoever reads the file.
   */
  daysActive: number;
}

/**
 * One row per address that has ever deposited — the Level 4 proof-of-users evidence.
 *
 * `first_tx_hash` is carried through so each row is independently checkable on Stellar Expert
 * rather than something a reviewer has to take on trust.
 */
export async function depositors(db: Db, vault: string): Promise<Depositor[]> {
  const { rows } = await db.query<{
    account: string;
    deposits: string;
    withdrawals: string;
    total_deposited: string;
    first_seen: Date;
    last_seen: Date;
    first_tx_hash: string;
    days_active: string;
  }>(
    `SELECT ua.account,
            COUNT(*) FILTER (WHERE ua.action = 'deposit')  AS deposits,
            COUNT(*) FILTER (WHERE ua.action = 'withdraw') AS withdrawals,
            COALESCE(SUM(ua.assets) FILTER (WHERE ua.action = 'deposit'), 0) AS total_deposited,
            MIN(ua.ledger_closed_at) AS first_seen,
            MAX(ua.ledger_closed_at) AS last_seen,
            (ARRAY_AGG(ua.tx_hash ORDER BY ua.ledger_closed_at ASC))[1] AS first_tx_hash,
            COUNT(DISTINCT date_trunc('day', ua.ledger_closed_at)) AS days_active
       FROM user_actions ua
       ${scope("ua", 1)}
      GROUP BY ua.account
     HAVING COUNT(*) FILTER (WHERE ua.action = 'deposit') > 0
      ORDER BY MIN(ua.ledger_closed_at) ASC`,
    [vault],
  );

  return rows.map((r) => ({
    account: r.account,
    deposits: Number(r.deposits),
    withdrawals: Number(r.withdrawals),
    totalDeposited: BigInt(r.total_deposited),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    firstTxHash: r.first_tx_hash,
    daysActive: Number(r.days_active),
  }));
}

export interface UserAction {
  at: Date;
  account: string;
  action: string;
  assets: bigint;
  shares: bigint;
  txHash: string;
  ledger: number;
}

/**
 * Every deposit and withdrawal, one row each, oldest first.
 *
 * Unlike {@link depositors} this does not group, because the point of the exported record is that a
 * reviewer can check any single line against the ledger rather than trusting a total we computed.
 */
export async function userActions(db: Db, vault: string): Promise<UserAction[]> {
  const { rows } = await db.query<{
    at: Date;
    account: string;
    action: string;
    assets: string;
    shares: string;
    tx_hash: string;
    ledger: string;
  }>(
    `SELECT a.ledger_closed_at AS at, a.account, a.action, a.assets, a.shares, a.tx_hash,
            e.ledger
       FROM user_actions a
       JOIN events e ON e.id = a.event_id AND e.contract_id = $1
      ORDER BY a.ledger_closed_at ASC, e.ledger ASC`,
    [vault],
  );

  return rows.map((r) => ({
    at: r.at,
    account: r.account,
    action: r.action,
    assets: BigInt(r.assets),
    shares: BigInt(r.shares),
    txHash: r.tx_hash,
    ledger: Number(r.ledger),
  }));
}

export interface Harvest {
  at: Date;
  gross: bigint;
  fee: bigint;
  net: bigint;
  txHash: string;
}

/** Every harvest, one row each — the realized-yield record behind the APY figure. */
export async function harvestRows(db: Db, vault: string): Promise<Harvest[]> {
  const { rows } = await db.query<{
    at: Date;
    gross: string;
    fee: string;
    net: string;
    tx_hash: string;
  }>(
    `SELECT h.ledger_closed_at AS at, h.gross, h.fee, h.net, e.tx_hash
       FROM harvests h
       JOIN events e ON e.id = h.event_id AND e.contract_id = $1
      ORDER BY h.ledger_closed_at ASC`,
    [vault],
  );

  return rows.map((r) => ({
    at: r.at,
    gross: BigInt(r.gross),
    fee: BigInt(r.fee),
    net: BigInt(r.net),
    txHash: r.tx_hash,
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
export async function realizedApy(db: Db, vault: string): Promise<Apy | null> {
  const { rows } = await db.query<{ at: Date; share_price: string }>(
    `(SELECT vs.ledger_closed_at AS at, vs.share_price FROM vault_samples vs
       ${scope("vs", 1)}
       ORDER BY vs.ledger_closed_at ASC LIMIT 1)
     UNION ALL
     (SELECT vs.ledger_closed_at AS at, vs.share_price FROM vault_samples vs
       ${scope("vs", 1)}
       ORDER BY vs.ledger_closed_at DESC LIMIT 1)`,
    [vault],
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

export async function strategyFlows(db: Db, vault: string): Promise<StrategyFlow[]> {
  const { rows } = await db.query<{ strategy: string; allocated: string; unwound: string }>(
    `SELECT sf.strategy,
            COALESCE(SUM(sf.amount) FILTER (WHERE sf.direction = 'allocate'), 0) AS allocated,
            COALESCE(SUM(sf.amount) FILTER (WHERE sf.direction = 'unwind'), 0)   AS unwound
       FROM strategy_flows sf
       ${scope("sf", 1)}
      GROUP BY sf.strategy
      ORDER BY sf.strategy`,
    [vault],
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
