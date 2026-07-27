import { scValToNative, type rpc, type xdr } from "@stellar/stellar-sdk";

/**
 * A decoded Nebula vault event.
 *
 * `unknown` is a deliberate member, not an oversight: a contract upgrade that adds an event must
 * not crash a running indexer. Unrecognized events are stored raw and can be backfilled into
 * derived tables later, because `events` keeps the decoded payload forever.
 */
export type VaultEvent =
  | {
      kind: "deposit";
      account: string;
      assets: bigint;
      shares: bigint;
      sharePrice: bigint;
      totalAssets: bigint;
    }
  | {
      kind: "withdraw";
      account: string;
      shares: bigint;
      assets: bigint;
      sharePrice: bigint;
      totalAssets: bigint;
    }
  | {
      kind: "harvest";
      gross: bigint;
      fee: bigint;
      net: bigint;
      sharePrice: bigint;
      totalAssets: bigint;
    }
  | { kind: "allocate"; strategy: string; amount: bigint }
  | { kind: "unwind"; strategy: string; amount: bigint }
  | { kind: "strategy_added"; strategy: string; weightBps: number; cap: bigint }
  | {
      kind: "strategy_updated";
      strategy: string;
      weightBps: number;
      cap: bigint;
      paused: boolean;
    }
  | { kind: "strategy_removed"; strategy: string; deployed: bigint }
  | { kind: "deposits_paused"; paused: boolean }
  | { kind: "unknown"; topic: string; raw: unknown };

export interface IndexedEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: Date;
  txHash: string;
  contractId: string;
  event: VaultEvent;
}

/** `scValToNative` yields BigInt for i128; nothing else in these payloads is 128-bit. */
function big(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  throw new Error(`expected an integer, got ${typeof value}: ${String(value)}`);
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  throw new Error(`expected a number, got ${typeof value}`);
}

function str(value: unknown): string {
  if (typeof value === "string") return value;
  throw new Error(`expected a string, got ${typeof value}`);
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new Error(`expected a boolean, got ${typeof value}`);
}

function decodeEvent(topics: xdr.ScVal[], value: xdr.ScVal): VaultEvent {
  const first = topics[0];
  if (!first) return { kind: "unknown", topic: "", raw: null };

  const name = String(scValToNative(first));
  // The second topic, where present, is the address the event is indexed by — the depositor for
  // user actions, the strategy for capital movements.
  const subject = topics[1] ? scValToNative(topics[1]) : undefined;
  const data = scValToNative(value) as Record<string, unknown> | bigint | boolean;

  const fields = (): Record<string, unknown> => {
    if (typeof data !== "object" || data === null) {
      throw new Error(`event "${name}" expected a map payload`);
    }
    return data as Record<string, unknown>;
  };

  switch (name) {
    case "deposit": {
      const f = fields();
      return {
        kind: "deposit",
        account: str(subject),
        assets: big(f.assets),
        shares: big(f.shares),
        sharePrice: big(f.share_price),
        totalAssets: big(f.total_assets),
      };
    }
    case "withdraw": {
      const f = fields();
      return {
        kind: "withdraw",
        account: str(subject),
        shares: big(f.shares),
        assets: big(f.assets),
        sharePrice: big(f.share_price),
        totalAssets: big(f.total_assets),
      };
    }
    case "harvest": {
      const f = fields();
      return {
        kind: "harvest",
        gross: big(f.gross),
        fee: big(f.fee),
        net: big(f.net),
        sharePrice: big(f.share_price),
        totalAssets: big(f.total_assets),
      };
    }
    // Allocate and Unwind use single-value payloads, so the amount is the data itself.
    case "allocate":
      return { kind: "allocate", strategy: str(subject), amount: big(data) };
    case "unwind":
      return { kind: "unwind", strategy: str(subject), amount: big(data) };
    case "strategy_added": {
      const f = fields();
      return {
        kind: "strategy_added",
        strategy: str(subject),
        weightBps: num(f.weight_bps),
        cap: big(f.cap),
      };
    }
    case "strategy_updated": {
      const f = fields();
      return {
        kind: "strategy_updated",
        strategy: str(subject),
        weightBps: num(f.weight_bps),
        cap: big(f.cap),
        paused: bool(f.paused),
      };
    }
    case "strategy_removed": {
      const f = fields();
      return { kind: "strategy_removed", strategy: str(subject), deployed: big(f.deployed) };
    }
    case "deposits_paused":
      return { kind: "deposits_paused", paused: bool(data) };
    default:
      return { kind: "unknown", topic: name, raw: jsonSafe(data) };
  }
}

/**
 * Decode one RPC event, or `null` if it cannot be understood at all.
 *
 * A malformed event must not stop the sync: it would block every later event behind it forever.
 */
export function decode(raw: rpc.Api.EventResponse): IndexedEvent | null {
  try {
    return {
      id: raw.id,
      ledger: raw.ledger,
      ledgerClosedAt: new Date(raw.ledgerClosedAt),
      txHash: raw.txHash,
      contractId: raw.contractId?.toString() ?? "",
      event: decodeEvent(raw.topic, raw.value),
    };
  } catch (error) {
    console.warn(`  ! skipping undecodable event ${raw.id}: ${(error as Error).message}`);
    return null;
  }
}

/** Recursively replace BigInt with its decimal string so a payload can go into `jsonb`. */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, jsonSafe(v)]),
    );
  }
  return value;
}
