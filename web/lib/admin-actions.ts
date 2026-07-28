"use server";

import { cookies } from "next/headers";

import { ADMIN_COOKIE } from "@/lib/admin";

/**
 * The actual gate.
 *
 * The password is compared on the server and never reaches the browser, and the resulting cookie is
 * `httpOnly` so client JavaScript cannot read or forge it. That is what makes this a real check
 * rather than the URL prefix, which is only obscurity.
 *
 * This is deliberately a shared password rather than per-account auth. Nebula has no user accounts
 * and no session store; adding either for one operator would be a lot of surface area to defend for
 * no benefit. It is appropriate for a testnet admin panel and would need replacing before anything
 * touched real money.
 */
export async function signInAdmin(password: string): Promise<{ ok: boolean; error?: string }> {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { ok: false, error: "No admin password is configured on the server." };
  }
  if (password !== expected) {
    return { ok: false, error: "That password is not right." };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return { ok: true };
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
