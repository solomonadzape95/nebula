import { query } from "@/lib/db";

/**
 * Reads. Plain async functions, deliberately **not** Server Actions.
 *
 * A file marked `"use server"` turns every export into an action, and invoking an action during a
 * Server Component's render makes Next treat it as a mutation: it refreshes the router, which
 * re-renders, which invokes it again. That is what put /admin in a redirect loop. Mutations live
 * in `profile-actions.ts`; anything a page awaits while rendering belongs here.
 */
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
