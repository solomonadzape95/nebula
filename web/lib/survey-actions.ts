"use server";

import { revalidatePath } from "next/cache";

import { query } from "@/lib/db";
import { currentAddress } from "@/lib/session";
import {
  BACKGROUND,
  CONSENT,
  DID,
  HOLDS_XLM,
  MAINNET_SIZE,
  STUCK,
  USED_YIELD,
  WALLETS,
  type SurveyInput,
} from "@/lib/survey-fields";

const NEEDS_PROOF = "Connect your wallet and approve the signature first.";

/** Longest free-text answer we will store. Past this it is a support ticket, not a survey answer. */
const MAX_TEXT = 2000;

/**
 * Every choice field is checked against the same list the form renders from.
 *
 * A server action is a public HTTP endpoint — the options being a `<select>` in the UI constrains
 * nobody who is willing to post their own payload. Without this, "which wallet?" is a free-text
 * column and the breakdown it feeds is worthless.
 */
function oneOf(value: string, allowed: readonly string[]): string | null {
  return allowed.includes(value) ? value : null;
}

export async function submitSurvey(
  input: SurveyInput,
): Promise<{ ok: boolean; error?: string }> {
  // The address is never submitted, only derived from a session the wallet signed for. That is what
  // makes the join to `user_actions` mean something: a response cannot claim someone else's
  // deposits, and the field people most often mistype does not exist on the form at all.
  const address = await currentAddress();
  if (!address) return { ok: false, error: NEEDS_PROOF };

  const handle = input.handle.trim();
  const contact = input.contact.trim();
  const country = input.country.trim();
  const requirements = input.requirements.trim();
  const issues = input.issues.trim();

  if (handle.length < 2) return { ok: false, error: "Tell us what to call you." };
  if (contact.length < 3) return { ok: false, error: "Add an email, Telegram or X handle." };
  if (requirements.length < 4) {
    return { ok: false, error: "What would have to be true before you used real money?" };
  }
  if (issues.length < 4) {
    return { ok: false, error: "Anything confusing, broken or missing? Even 'nothing' helps." };
  }
  if (
    handle.length > 120 ||
    contact.length > 200 ||
    country.length > 120 ||
    requirements.length > MAX_TEXT ||
    issues.length > MAX_TEXT
  ) {
    return { ok: false, error: "That is longer than we can store." };
  }

  const background = oneOf(input.background, BACKGROUND);
  const usedYield = oneOf(input.usedYield, USED_YIELD);
  const holdsXlm = oneOf(input.holdsXlm, HOLDS_XLM);
  const wallet = oneOf(input.wallet, WALLETS);
  const consent = oneOf(input.consent, CONSENT);
  if (!background || !usedYield || !holdsXlm || !wallet || !consent) {
    return { ok: false, error: "Some answers are missing." };
  }

  // Optional single-choice fields: absent is fine, present-but-unrecognised is not.
  const stuckWhere = input.stuckWhere ? oneOf(input.stuckWhere, STUCK) : null;
  const mainnetSize = input.mainnetSize ? oneOf(input.mainnetSize, MAINNET_SIZE) : null;
  if ((input.stuckWhere && !stuckWhere) || (input.mainnetSize && !mainnetSize)) {
    return { ok: false, error: "Some answers are missing." };
  }

  const did = input.did.filter((d) => DID.includes(d as (typeof DID)[number]));
  if (did.length === 0) return { ok: false, error: "Tick at least one thing you got done." };

  const clarity = Math.round(input.clarity);
  if (clarity < 1 || clarity > 5) return { ok: false, error: "Rate how clear nXLM was." };

  // One response per wallet. A second submission replaces the first rather than inflating the
  // count — a response total is evidence, and evidence that double-counts is worth nothing.
  const rows = await query(
    `INSERT INTO survey_responses
       (address, handle, contact, country, background, used_yield, holds_xlm, did, wallet,
        stuck_where, mainnet_size, requirements, clarity, issues, consent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (address) DO UPDATE SET
       handle = EXCLUDED.handle,
       contact = EXCLUDED.contact,
       country = EXCLUDED.country,
       background = EXCLUDED.background,
       used_yield = EXCLUDED.used_yield,
       holds_xlm = EXCLUDED.holds_xlm,
       did = EXCLUDED.did,
       wallet = EXCLUDED.wallet,
       stuck_where = EXCLUDED.stuck_where,
       mainnet_size = EXCLUDED.mainnet_size,
       requirements = EXCLUDED.requirements,
       clarity = EXCLUDED.clarity,
       issues = EXCLUDED.issues,
       consent = EXCLUDED.consent,
       created_at = now()
     RETURNING id`,
    [
      address,
      handle,
      contact,
      country || null,
      background,
      usedYield,
      holdsXlm,
      did,
      wallet,
      stuckWhere,
      mainnetSize,
      requirements,
      clarity,
      issues,
      consent,
    ],
  );

  if (!rows) return { ok: false, error: "Could not save that. Try again in a moment." };

  revalidatePath("/asdfg/admin/feedback");
  return { ok: true };
}
