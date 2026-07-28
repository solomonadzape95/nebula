/**
 * Placeholder data for every screen that is not yet reading the chain.
 *
 * Kept in one file, and deliberately shaped like the real thing: figures taken from the live
 * testnet vault, addresses that resolve on Stellar Expert, amounts at realistic magnitudes. A
 * layout designed against tidy round numbers falls apart the first time a seven-decimal share
 * price arrives.
 *
 * Every screen that renders this also renders a visible "not live yet" marker. Replacing this
 * module with contract reads and indexer queries is the next milestone.
 */

export const IS_LIVE = false;

export const VAULT = {
  totalAssets: 130.0,
  sharePrice: 1.0001421,
  idle: 13.0,
  deployed: 117.0,
  depositors: 2,
  /** Null until the indexer has six hours of history, which is deliberate. */
  apyPercent: null as number | null,
  grossYield: 0.0203257,
  feesTaken: 0.0020324,
  harvests: 2,
  depositCap: 1_000_000,
  feeBps: 1000,
  reserveBps: 1000,
  depositsPaused: false,
};

export const POSITION = {
  connected: false,
  address: "GDPHDT44YGLSXXDHO7JFYPEUKVLNGT26PLYUE7LHOP7GPSPM23GDILPA",
  walletBalance: 9_842.61,
  shares: 100.0,
  get worth() {
    return this.shares * VAULT.sharePrice;
  },
  costBasis: 100.0,
};

export interface ActivityRow {
  kind: "deposit" | "withdraw" | "harvest";
  amount: number;
  shares: number | null;
  sharePrice: number;
  txHash: string;
  at: string;
}

export const ACTIVITY: ActivityRow[] = [
  {
    kind: "withdraw",
    amount: 100.0139478,
    shares: 99.9997313,
    sharePrice: 1.0001421,
    txHash: "588cad100e38f2e9c1a4b7d6e5f30a2b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f",
    at: "2026-07-27T20:59:08Z",
  },
  {
    kind: "harvest",
    amount: 0.0181322,
    shares: null,
    sharePrice: 1.0001421,
    txHash: "f802301e0c1c4b9a8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c",
    at: "2026-07-27T20:58:12Z",
  },
  {
    kind: "deposit",
    amount: 100.0,
    shares: 99.9997313,
    sharePrice: 1.0000026,
    txHash: "7fa7d58f8b6eaf2478aafb7f6348ebe34c997c2673529069e7f252701bbbe21c",
    at: "2026-07-27T20:56:41Z",
  },
  {
    kind: "harvest",
    amount: 0.0001611,
    shares: null,
    sharePrice: 1.0000026,
    txHash: "e75e47dd04a0c3b2a1908f7e6d5c4b3a29180f7e6d5c4b3a29180f7e6d5c4b3a",
    at: "2026-07-27T17:04:22Z",
  },
  {
    kind: "deposit",
    amount: 100.0,
    shares: 99.9999,
    sharePrice: 1.0,
    txHash: "87ad5e0fdf91466fd21dbfdff807c997d5f44da52d1e9492a20e14e31e54d01d",
    at: "2026-07-27T17:00:32Z",
  },
];

export interface DepositorRow {
  address: string;
  deposits: number;
  withdrawals: number;
  totalDeposited: number;
  firstSeen: string;
  firstTxHash: string;
}

export const DEPOSITORS: DepositorRow[] = [
  {
    address: "GCXYOFNEKSMLS5JRDGOKLTHN6YE26TZGCQ3VN76K66AIHQXNKJPKJOU5",
    deposits: 1,
    withdrawals: 2,
    totalDeposited: 100,
    firstSeen: "2026-07-27T17:00:32Z",
    firstTxHash: "87ad5e0fdf91466fd21dbfdff807c997d5f44da52d1e9492a20e14e31e54d01d",
  },
  {
    address: "GDPHDT44YGLSXXDHO7JFYPEUKVLNGT26PLYUE7LHOP7GPSPM23GDILPA",
    deposits: 1,
    withdrawals: 1,
    totalDeposited: 100,
    firstSeen: "2026-07-27T20:56:41Z",
    firstTxHash: "7fa7d58f8b6eaf2478aafb7f6348ebe34c997c2673529069e7f252701bbbe21c",
  },
];

/** Share price over time. Uneven steps, because it only moves when a harvest lands. */
export const PRICE_SERIES = [
  1.0, 1.0, 1.0002, 1.0002, 1.0002, 1.0009, 1.0009, 1.0009, 1.0014, 1.0014, 1.0021, 1.0021, 1.0021,
  1.0029, 1.0029, 1.0036, 1.0036, 1.0036, 1.0044, 1.0044, 1.0051, 1.0051, 1.0059, 1.0059, 1.0068,
  1.0068, 1.0068, 1.0077, 1.0086, 1.0086, 1.0094, 1.0103, 1.0103, 1.0112, 1.0122, 1.0122, 1.0131,
  1.0142,
];

export const TVL_SERIES = [
  0, 30, 30, 30, 60, 60, 60, 60, 90, 90, 90, 120, 120, 120, 130, 130, 130, 130, 130, 130,
];

/** Formats a number as XLM with sane precision for its magnitude. */
export function xlm(n: number, decimals = 4): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
