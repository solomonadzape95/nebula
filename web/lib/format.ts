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

/**
 * Abbreviated magnitude: `4.3k`, `1.25M`, `18`.
 *
 * For chart axes and tooltips, where the exact figure matters far less than the shape and every
 * character is width the plot does not get. `4,302.0512` in a tooltip is nine characters of
 * precision nobody is reading off a hover, and it forces the box wide enough to cover the line it
 * is describing.
 *
 * Precision scales down as magnitude goes up, which is how people say these numbers out loud:
 * "four thousand three hundred" carries the same information as "4,302.05" when you are looking at
 * a trend, and "1.0001611" keeps its decimals because for a share price those digits *are* the
 * story. Anything under a thousand is left alone for that reason.
 */
export function formatCompact(value: number, decimals = 4): string {
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (magnitude >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (magnitude >= 1_000) return `${trim(value / 1_000)}k`;

  // Small numbers keep their requested precision: this is also the share-price axis, where the
  // interesting movement lives in the fourth decimal place.
  return formatNumber(value, decimals);
}

/** Two decimals, minus any trailing zeros — `4.3k` rather than `4.30k`. */
function trim(value: number): string {
  return value
    .toFixed(2)
    .replace(/\.?0+$/, "");
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
