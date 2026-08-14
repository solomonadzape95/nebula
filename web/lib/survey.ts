import { VAULT_ID } from "@/lib/contracts";
import { query } from "@/lib/db";

/**
 * Survey reads.
 *
 * Reads only. Mutations live in `survey-actions.ts` — a file marked `"use server"` turns every
 * export into an action, and awaiting an action during a Server Component's render makes Next
 * treat it as a mutation and re-render in a loop.
 *
 * The question definitions live in `survey-fields.ts` and are re-exported here for convenience:
 * this module touches the database, so a client component must never import it directly.
 */
export * from "@/lib/survey-fields";

export interface SurveyResponse {
  id: string;
  address: string;
  handle: string;
  contact: string;
  country: string | null;
  background: string;
  usedYield: string;
  holdsXlm: string;
  did: string[];
  wallet: string;
  stuckWhere: string | null;
  mainnetSize: string | null;
  requirements: string;
  clarity: number;
  issues: string;
  consent: string;
  createdAt: Date;
  actioned: string | null;
  /**
   * Whether this address actually deposited into the live vault.
   *
   * Read from the chain's own record rather than asked. This is the entire reason the survey lives
   * in the app: a response claiming a deposit that never happened is visible on sight, and nobody
   * has to run a VLOOKUP to see it.
   */
  corroborated: boolean;
}

export async function getSurveyResponses(): Promise<SurveyResponse[]> {
  const rows = await query<{
    id: string;
    address: string;
    handle: string;
    contact: string;
    country: string | null;
    background: string;
    used_yield: string;
    holds_xlm: string;
    did: string[];
    wallet: string;
    stuck_where: string | null;
    mainnet_size: string | null;
    requirements: string;
    clarity: number;
    issues: string;
    consent: string;
    created_at: Date;
    actioned: string | null;
    corroborated: boolean;
  }>(
    `SELECT s.*,
            EXISTS (
              SELECT 1
                FROM user_actions ua
                JOIN events e ON e.id = ua.event_id AND e.contract_id = $1
               WHERE ua.account = s.address AND ua.action = 'deposit'
            ) AS corroborated
       FROM survey_responses s
      ORDER BY s.created_at DESC`,
    [VAULT_ID],
  );

  return (rows ?? []).map((r) => ({
    id: String(r.id),
    address: r.address,
    handle: r.handle,
    contact: r.contact,
    country: r.country,
    background: r.background,
    usedYield: r.used_yield,
    holdsXlm: r.holds_xlm,
    did: r.did ?? [],
    wallet: r.wallet,
    stuckWhere: r.stuck_where,
    mainnetSize: r.mainnet_size,
    requirements: r.requirements,
    clarity: r.clarity,
    issues: r.issues,
    consent: r.consent,
    createdAt: r.created_at,
    actioned: r.actioned,
    corroborated: r.corroborated,
  }));
}

/** Whether this wallet has already responded, so the form can say so instead of silently replacing. */
export async function hasResponded(address: string): Promise<boolean> {
  const rows = await query<{ n: string }>(
    "SELECT COUNT(*) AS n FROM survey_responses WHERE address = $1",
    [address],
  );
  return Number(rows?.[0]?.n ?? 0) > 0;
}
