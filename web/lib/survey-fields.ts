/**
 * The survey's questions, as data — and nothing else.
 *
 * Deliberately free of any database import. `survey-form.tsx` is a client component and needs these
 * lists to render; if they lived alongside the queries in `survey.ts`, importing them would drag
 * `pg` into the browser bundle, which fails the build on `dns` and `fs`. One definition still drives
 * the form, the validator and the admin view, so a reworded option cannot mean one thing in the UI
 * and another in the database.
 *
 * `docs/USER_SURVEY.md` explains why each field earns its place; this file is that document made
 * executable.
 */

export const BACKGROUND = [
  "I hold XLM",
  "I use DeFi on another chain",
  "I build on Stellar",
  "I build on another chain",
  "I'm new to crypto",
  "Other",
] as const;

export const USED_YIELD = [
  "Yes, on Stellar (Blend, Aquarius, …)",
  "Yes, on another chain",
  "No, this was my first",
] as const;

export const HOLDS_XLM = ["Yes", "No", "Prefer not to say"] as const;

export const DID = [
  "Connected a wallet",
  "Deposited XLM",
  "Saw my nXLM balance",
  "Saw the share price move",
  "Redeemed back to XLM",
  "Read the docs or the landing page",
  "I got stuck before depositing",
] as const;

export const WALLETS = [
  "Freighter",
  "xBull",
  "Lobstr",
  "Rabet",
  "Hana",
  "Albedo",
  "Other",
] as const;

/**
 * Deliberately the same vocabulary as the `deposit_failed` phase property in `lib/analytics.ts`,
 * so the self-reported answer and the telemetry can be compared instead of merely coexisting.
 */
export const STUCK = [
  "I didn't get stuck",
  "Installing a wallet",
  "Getting testnet XLM",
  "Connecting the wallet",
  "Understanding what nXLM is",
  "The deposit form",
  "Signing the transaction",
  "The transaction failed",
  "Something else",
] as const;

export const MAINNET_SIZE = [
  "Nothing",
  "Under 100 XLM",
  "100–1,000 XLM",
  "1,000–10,000 XLM",
  "More than 10,000 XLM",
] as const;

export const CONSENT = [
  "Yes, with my name/handle and wallet address",
  "Yes, but anonymously — no name, no address",
  "No, keep it private",
] as const;

export interface SurveyInput {
  handle: string;
  contact: string;
  country: string;
  background: string;
  usedYield: string;
  holdsXlm: string;
  did: string[];
  wallet: string;
  stuckWhere: string;
  mainnetSize: string;
  requirements: string;
  clarity: number;
  issues: string;
  consent: string;
}
