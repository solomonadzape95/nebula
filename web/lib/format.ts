/**
 * Stroop arithmetic and display formatting.
 *
 * Contract values arrive as `bigint` because i128 amounts routinely exceed `Number.MAX_SAFE_INTEGER`.
 * They stay `bigint` right up to the moment they are formatted, and conversion to `number` happens
 * once, for display only. A balance that has been through a float is a balance you cannot trust.
 */

export const STROOPS = 10_000_000n;

/** Stroops to a display number. Display only: never feed the result back into arithmetic. */
export function fromStroops(value: bigint): number {
  return Number(value) / 10_000_000;
}

export function toStroops(value: number): bigint {
  return BigInt(Math.round(value * 10_000_000));
}

/** Formats a stroop amount with a fixed number of decimals and thousands separators. */
export function formatStroops(value: bigint, decimals = 4): string {
  return fromStroops(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(value: number, decimals = 4): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function shortDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Percentage change between two share prices, both in stroops. */
export function growthPercent(from: bigint, to: bigint): number {
  if (from === 0n) return 0;
  return (Number(to - from) / Number(from)) * 100;
}
