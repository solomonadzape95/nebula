"use server";

import { revalidatePath } from "next/cache";

import { query } from "@/lib/db";
import type { Profile } from "@/lib/profile";
import { currentAddress } from "@/lib/session";

/**
 * Mutations, and the one read a client component needs.
 *
 * Everything here is a Server Action, which is why the read functions in `profile.ts` are kept out
 * of this file: awaiting an action while a Server Component renders makes Next treat it as a
 * mutation and refresh the router, which re-renders and calls it again.
 *
 * Both writes take their address from the session rather than from an argument. They used to accept
 * one, and a Server Action is a plain HTTP endpoint whose id sits in the client bundle — so
 * anybody could POST a victim's address and rename their profile, or file a five-star review signed
 * with someone else's name. An address is a public identifier. Holding the key to it is the claim
 * that matters, and `session.ts` is where that gets established.
 */

/** Every write here needs a proven wallet, and says so the same way. */
const NEEDS_PROOF = "Verify your wallet before saving. Reconnect if this keeps happening.";

/** Letters, digits, underscore. Long enough to be distinct, short enough to fit a header. */
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const RESERVED = new Set([
  "nebula",
  "admin",
  "administrator",
  "support",
  "team",
  "official",
  "root",
  "system",
  "vault",
  "moderator",
]);

export type SaveResult = { ok: true; profile: Profile } | { ok: false; error: string };

/** Called from the browser after a wallet connects, so it has to be an action. */
export async function fetchProfile(address: string): Promise<Profile | null> {
  const rows = await query<{ address: string; username: string; hue: number; created_at: Date }>(
    "SELECT address, username, hue, created_at FROM profiles WHERE address = $1",
    [address],
  );
  const row = rows?.[0];
  return row
    ? { address: row.address, username: row.username, hue: row.hue, createdAt: row.created_at }
    : null;
}

/**
 * Create or rename a profile.
 *
 * Uniqueness is enforced by a case-insensitive unique index rather than a read-then-write check.
 * Two people claiming the same name in the same second would both pass a pre-check and one would
 * silently overwrite the other; letting the database reject it is the only version without that
 * race.
 */
export async function saveProfile(usernameInput: string, hue: number): Promise<SaveResult> {
  const address = await currentAddress();
  if (!address) return { ok: false, error: NEEDS_PROOF };

  const username = usernameInput.trim();

  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "3 to 20 characters, using letters, numbers and underscores only." };
  }
  if (RESERVED.has(username.toLowerCase())) {
    return { ok: false, error: "That name is reserved. Pick another." };
  }

  const safeHue = Number.isFinite(hue) ? Math.abs(Math.round(hue)) % 360 : 150;

  const rows = await query<{ address: string; username: string; hue: number; created_at: Date }>(
    `INSERT INTO profiles (address, username, hue)
          VALUES ($1, $2, $3)
     ON CONFLICT (address)
     DO UPDATE SET username = EXCLUDED.username, hue = EXCLUDED.hue, updated_at = now()
       RETURNING address, username, hue, created_at`,
    [address, username, safeHue],
    // A unique violation here is a taken name, not an outage, so it is expected rather than logged.
    { quiet: true },
  );

  if (!rows) return { ok: false, error: "That username is already taken." };

  const row = rows[0]!;
  revalidatePath("/app/profile");

  return {
    ok: true,
    profile: {
      address: row.address,
      username: row.username,
      hue: row.hue,
      createdAt: row.created_at,
    },
  };
}

export async function submitReview(input: {
  rating: number;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const address = await currentAddress();
  if (!address) return { ok: false, error: NEEDS_PROOF };

  const body = input.body.trim();
  if (body.length < 4) return { ok: false, error: "Tell us a little more than that." };
  if (body.length > 2000) return { ok: false, error: "That is longer than we can store." };
  if (input.rating < 1 || input.rating > 5) return { ok: false, error: "Pick a rating." };

  // Read whether they deposited off the chain's own record instead of asking. It used to arrive as
  // a checkbox in the payload, which meant the admin panel's "completed a deposit" count was
  // whatever the submitter typed. It is also one less question to answer in a feedback form.
  const deposits = await query<{ n: string }>(
    "SELECT COUNT(*) AS n FROM user_actions WHERE account = $1 AND action = 'deposit'",
    [address],
  );
  const deposited = Number(deposits?.[0]?.n ?? 0) > 0;

  const rows = await query(
    "INSERT INTO reviews (address, rating, body, deposited) VALUES ($1, $2, $3, $4) RETURNING id",
    [address, Math.round(input.rating), body, deposited],
  );

  if (!rows) return { ok: false, error: "Could not save that. Try again in a moment." };
  return { ok: true };
}
