"use server";

import { revalidatePath } from "next/cache";

import { query } from "@/lib/db";

export interface Profile {
  address: string;
  username: string;
  hue: number;
  createdAt: Date;
}

export interface Review {
  id: string;
  address: string;
  username: string | null;
  hue: number;
  rating: number;
  body: string;
  deposited: boolean;
  createdAt: Date;
  actioned: string | null;
}

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

export async function getProfile(address: string): Promise<Profile | null> {
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
export async function saveProfile(
  address: string,
  usernameInput: string,
  hue: number,
): Promise<SaveResult> {
  const username = usernameInput.trim();

  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "3 to 20 characters, using letters, numbers and underscores only.",
    };
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

  if (!rows) {
    return { ok: false, error: "That username is already taken." };
  }

  const row = rows[0]!;
  revalidatePath("/app/profile");
  revalidatePath("/app");

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
  address: string;
  rating: number;
  body: string;
  deposited: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const body = input.body.trim();
  if (body.length < 4) return { ok: false, error: "Tell us a little more than that." };
  if (body.length > 2000) return { ok: false, error: "That is longer than we can store." };
  if (input.rating < 1 || input.rating > 5) return { ok: false, error: "Pick a rating." };

  const rows = await query(
    "INSERT INTO reviews (address, rating, body, deposited) VALUES ($1, $2, $3, $4) RETURNING id",
    [input.address, Math.round(input.rating), body, input.deposited],
  );

  if (!rows) return { ok: false, error: "Could not save that. Try again in a moment." };

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  return { ok: true };
}

export async function getReviews(): Promise<Review[]> {
  const rows = await query<{
    id: string;
    address: string;
    username: string | null;
    hue: number | null;
    rating: number;
    body: string;
    deposited: boolean;
    created_at: Date;
    actioned: string | null;
  }>(
    `SELECT r.id::text, r.address, p.username, p.hue, r.rating, r.body, r.deposited,
            r.created_at, r.actioned
       FROM reviews r
       LEFT JOIN profiles p ON p.address = r.address
      ORDER BY r.created_at DESC
      LIMIT 200`,
  );

  return (rows ?? []).map((r) => ({
    id: r.id,
    address: r.address,
    username: r.username,
    hue: r.hue ?? 150,
    rating: r.rating,
    body: r.body,
    deposited: r.deposited,
    createdAt: r.created_at,
    actioned: r.actioned,
  }));
}
