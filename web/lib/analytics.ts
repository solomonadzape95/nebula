import posthog from "posthog-js";

/**
 * Product analytics, behind a typed door.
 *
 * Components call `track("deposit_confirmed", …)` and never touch PostHog directly. That is worth
 * one small file for two reasons. Analytics is the first thing to break silently — a missing key in
 * production means every call throws inside a click handler and takes the button with it, so
 * everything here no-ops when PostHog was never initialised. And an event name is a schema: once a
 * dashboard is built on `deposit_confirmed`, a typo in a fourth component quietly splits the funnel
 * in two. The union below is the schema, checked at compile time.
 *
 * What gets sent is deliberately narrow. Nebula is non-custodial and has no accounts, so there is
 * no email or name to leak — but a wallet address is still a real identity, joinable to the whole
 * of that person's on-chain history. Amounts are bucketed rather than exact for the same reason: a
 * precise figure plus a timestamp identifies a specific transaction on a public ledger, and knowing
 * the size distribution is all the product question actually needs.
 */

/**
 * Every event Nebula emits.
 *
 * The three that matter are `wallet_connected` → `deposit_submitted` → `deposit_confirmed`: the
 * gap between the last two is people whose deposit failed or who abandoned the wallet prompt, and
 * that number is the single most useful thing early testers can tell you.
 */
export type NebulaEvent =
  | "wallet_connect_started"
  | "wallet_connected"
  | "wallet_connect_failed"
  | "deposit_submitted"
  | "deposit_confirmed"
  | "deposit_failed"
  | "withdraw_submitted"
  | "withdraw_confirmed"
  | "withdraw_failed"
  | "username_set"
  | "review_submitted";

type Properties = Record<string, string | number | boolean | null | undefined>;

/** True once `instrumentation-client.ts` has initialised PostHog with a real key. */
function ready(): boolean {
  return typeof window !== "undefined" && Boolean(posthog.__loaded);
}

export function track(event: NebulaEvent, properties?: Properties): void {
  if (!ready()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never be the reason a deposit button stops working.
  }
}

/**
 * No `identify` — deliberately, and it should stay that way.
 *
 * Sending the wallet address as the distinct id would be tempting: it is the only stable identifier
 * Nebula has, it is already public on the ledger, and it would make cross-device funnels work. But
 * the privacy page tells people analytics "is not connected to your wallet address", and that
 * sentence was published before this file existed. Writing code that contradicts it would make the
 * page a lie, which is worse than losing a join.
 *
 * Little is actually lost. The question analytics is here to answer is where people fall out of the
 * deposit flow, and an anonymous distinct id answers it exactly as well. The other question —
 * whether ten real people deposited — is answered far better by the indexer, which reads it from
 * the chain rather than from a browser that may have blocked the script.
 *
 * If you ever do want address-level funnels, the privacy page has to change first.
 */

/**
 * Start a fresh anonymous id, called on disconnect.
 *
 * Two wallets used on one browser are two different people often enough — a shared laptop, someone
 * testing with a second account — that carrying the id across would merge them into one profile and
 * quietly understate how many people tried it.
 */
export function resetIdentity(): void {
  if (!ready()) return;
  try {
    posthog.reset();
  } catch {
    // As above.
  }
}

/**
 * Coarse size bands instead of an exact amount.
 *
 * "How many people deposit under 100 XLM" is the question a funnel actually answers; the exact
 * figure only adds a join key back to a specific public transaction. Boundaries are round numbers
 * so the buckets read sensibly on a chart axis.
 */
export function amountBucket(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount < 10) return "<10";
  if (amount < 100) return "10-100";
  if (amount < 1_000) return "100-1k";
  if (amount < 10_000) return "1k-10k";
  return "10k+";
}
