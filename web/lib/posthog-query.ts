import "server-only";

import { cache } from "react";

/**
 * Reading PostHog back out, server-side.
 *
 * This exists for one number that neither system holds alone. The indexer knows, from the chain,
 * exactly who deposited — it cannot know who arrived, connected a wallet, looked at the form and
 * left. PostHog knows that, and knows nothing about what settled on Stellar. The interesting figure
 * is the gap: the people who got far enough to connect and then did not go through. They never
 * complain and never come back, so nothing else will tell you they existed.
 *
 * `server-only` is load-bearing. The key used here is a *personal* API key with read access to the
 * whole project, unlike the `phc_` write key that ships to the browser. Importing this file from a
 * client component is meant to fail the build rather than quietly bundle a credential.
 */

const HOST = "https://us.posthog.com";

/** How far back the admin panel looks. Long enough to cover a whole testing round. */
export const WINDOW_DAYS = 30;

function credentials(): { key: string; projectId: string } | null {
  const key = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  return key && projectId ? { key, projectId } : null;
}

/** True when the server has been given a personal key, so the UI can explain itself when it has not. */
export function analyticsConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Run one HogQL query, or return null.
 *
 * Null rather than throwing, matching how `lib/db.ts` and `lib/stellar.ts` behave: an admin page
 * that renders with one panel missing is far more useful than an error page, and PostHog being
 * unreachable says nothing about whether the vault is healthy.
 */
async function hogql<T extends unknown[]>(query: string): Promise<T[] | null> {
  const creds = credentials();
  if (!creds) return null;

  try {
    const response = await fetch(`${HOST}/api/projects/${creds.projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      // The query endpoint allows 120 requests an hour. Next's fetch cache keeps a busy admin
      // session well inside that; without it, a few people refreshing would exhaust the budget and
      // the panel would start failing for everyone.
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.warn(`  ! posthog query failed: HTTP ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { results?: T[] };
    return body.results ?? [];
  } catch (cause) {
    console.warn(`  ! posthog unreachable: ${(cause as Error).message}`);
    return null;
  }
}

export interface Funnel {
  connectStarted: number;
  connected: number;
  depositStarted: number;
  deposited: number;
  depositFailures: number;
  connectFailures: number;
}

/**
 * The whole funnel in a single round trip.
 *
 * One query rather than six because the rate limit is per request, not per row, and because six
 * separate counts could be read at six slightly different moments — which is how a funnel ends up
 * showing more people at step three than at step two.
 *
 * Counted by `distinct_id`, not by event: someone who tries to deposit four times is one person
 * struggling, and the point of the panel is to notice them.
 */
export const getFunnel = cache(async (): Promise<Funnel | null> => {
  const rows = await hogql<[number, number, number, number, number, number]>(`
    SELECT
      countDistinctIf(distinct_id, event = 'wallet_connect_started') AS connect_started,
      countDistinctIf(distinct_id, event = 'wallet_connected')       AS connected,
      countDistinctIf(distinct_id, event = 'deposit_submitted')      AS deposit_started,
      countDistinctIf(distinct_id, event = 'deposit_confirmed')      AS deposited,
      countIf(event = 'deposit_failed')                              AS deposit_failures,
      countIf(event = 'wallet_connect_failed')                       AS connect_failures
    FROM events
    WHERE timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
  `);

  const row = rows?.[0];
  if (!row) return null;

  return {
    connectStarted: row[0],
    connected: row[1],
    depositStarted: row[2],
    deposited: row[3],
    depositFailures: row[4],
    connectFailures: row[5],
  };
});

export interface Breakdown {
  label: string;
  count: number;
}

/**
 * Where deposits died, by the phase they reached.
 *
 * `signing` means people are backing out at the wallet prompt, which is a trust or clarity problem.
 * `simulating` means the contract rejected them before they ever signed, which is ours to fix. They
 * look identical in a funnel and need opposite responses, which is why the phase is on the event.
 */
export const getFailurePhases = cache(async (): Promise<Breakdown[] | null> => {
  const rows = await hogql<[string | null, number]>(`
    SELECT properties.phase AS phase, count() AS n
    FROM events
    WHERE event = 'deposit_failed' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
    GROUP BY phase
    ORDER BY n DESC
    LIMIT 8
  `);

  return rows?.map(([label, count]) => ({ label: label ?? "unknown", count })) ?? null;
});

/** Which wallets people actually connect with, so the list on `/connect` can follow reality. */
export const getWallets = cache(async (): Promise<Breakdown[] | null> => {
  const rows = await hogql<[string | null, number]>(`
    SELECT properties.wallet AS wallet, count(DISTINCT distinct_id) AS n
    FROM events
    WHERE event = 'wallet_connected' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
    GROUP BY wallet
    ORDER BY n DESC
    LIMIT 8
  `);

  return rows?.map(([label, count]) => ({ label: label ?? "unknown", count })) ?? null;
});
