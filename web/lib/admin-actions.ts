"use server";

import { cookies } from "next/headers";

import { ADMIN_COOKIE, ADMIN_SESSION_TTL } from "@/lib/admin";
import { sign } from "@/lib/signed-cookie";

/**
 * The actual gate.
 *
 * The password is compared on the server and never reaches the browser. What the browser gets back
 * is a signed, expiring value rather than a flag: the previous version set the cookie to `"1"`, and
 * since `httpOnly` only constrains page JavaScript, anyone with curl could send that header and
 * walk in. Signing it means a valid cookie is evidence the server issued it.
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

  const value = await sign("admin", ADMIN_SESSION_TTL);
  if (!value) {
    return { ok: false, error: "No admin password is configured on the server." };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL,
  });

  return { ok: true };
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
