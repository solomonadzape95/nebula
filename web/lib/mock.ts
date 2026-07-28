/**
 * The last placeholder data in the app.
 *
 * Everything else now reads from the contracts or the indexer. Feedback is the exception: it needs
 * somewhere to store submissions, and Nebula has no backend. When the feedback widget ships with a
 * form endpoint behind it, this file goes away entirely.
 */

export interface FeedbackRow {
  id: string;
  /** Wallet address, or null when someone answered without connecting. */
  address: string | null;
  succeeded: boolean;
  clarity: 1 | 2 | 3 | 4 | 5;
  wouldUseOnMainnet: "yes" | "no" | "maybe";
  confusedBy: string;
  wouldAdd: string;
  at: string;
  /** What actually changed because of this. The point of collecting it. */
  actioned?: string;
}

export const FEEDBACK: FeedbackRow[] = [
  {
    id: "f1",
    address: "GCXYOFNEKSMLS5JRDGOKLTHN6YE26TZGCQ3VN76K66AIHQXNKJPKJOU5",
    succeeded: true,
    clarity: 3,
    wouldUseOnMainnet: "maybe",
    confusedBy:
      "Took me a while to get that my nXLM number was supposed to stay the same. I thought the deposit had partly failed.",
    wouldAdd: "Show what my deposit is worth in the wallet, not just in the app.",
    at: "2026-07-27T18:12:00Z",
    actioned:
      "Added the 'never changes' label beside the nXLM row and the gold analogy to the landing page.",
  },
  {
    id: "f2",
    address: "GDPHDT44YGLSXXDHO7JFYPEUKVLNGT26PLYUE7LHOP7GPSPM23GDILPA",
    succeeded: true,
    clarity: 5,
    wouldUseOnMainnet: "yes",
    confusedBy: "Nothing really. The share price going up made it obvious.",
    wouldAdd: "An estimate of what I would earn over a month at the current rate.",
    at: "2026-07-27T21:04:00Z",
  },
];
