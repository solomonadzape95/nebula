"use server";

import { Keypair } from "@stellar/stellar-sdk";
import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_TTL, currentAddress } from "@/lib/session";
import { sign, verify } from "@/lib/signed-cookie";

/**
 * Proving that whoever is asking actually holds the wallet they name.
 *
 * The wallet signs a one-off nonce and the server checks that signature against the address's
 * public key. Stellar addresses *are* ed25519 public keys, so the check needs nothing stored and
 * nothing trusted: either the signature verifies under that key or the caller does not hold it.
 *
 * The nonce lives in a signed, short-lived cookie rather than a table. A database row would be a
 * second thing to expire and clean up, and the signature already carries its own integrity — the
 * only property the nonce needs is that the server issued it recently and has not seen it before,
 * both of which fit in the value itself.
 */

const CHALLENGE_COOKIE = "nebula_challenge";

/** Five minutes. Long enough to read the prompt and approve it, short enough to be a nonce. */
const CHALLENGE_TTL = 60 * 5;

/**
 * The text the wallet displays. Worth writing carefully: this is the only part of the exchange the
 * person actually reads, and a prompt full of hex is how users learn to approve things unread.
 */
function challengeText(nonce: string): string {
  return [
    "Sign in to Nebula",
    "",
    "This proves you control this wallet so nobody else can use your username or post reviews as you.",
    "",
    "It is not a transaction and moves no funds.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

export type Challenge = { ok: true; message: string } | { ok: false; error: string };

/** Issue a nonce and stash it, signed, for [`proveOwnership`] to check against. */
export async function requestChallenge(): Promise<Challenge> {
  const nonce = crypto.randomUUID();
  const value = await sign(nonce, CHALLENGE_TTL);

  if (!value) {
    return { ok: false, error: "This server is not configured to verify wallets." };
  }

  const store = await cookies();
  store.set(CHALLENGE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHALLENGE_TTL,
  });

  return { ok: true, message: challengeText(nonce) };
}

export type Proof = { ok: true; address: string } | { ok: false; error: string };

/**
 * Check the signature and, if it holds, open a session for that address.
 *
 * `signature` is base64 over the UTF-8 bytes of the message, which is what Stellar Wallets Kit
 * normalises its adapters to. Not every wallet implements message signing at all — Albedo throws
 * outright — so callers have to be ready for this step to be unavailable rather than merely
 * refused.
 */
export async function proveOwnership(address: string, signature: string): Promise<Proof> {
  const store = await cookies();
  const nonce = await verify(store.get(CHALLENGE_COOKIE)?.value);

  if (!nonce) {
    return { ok: false, error: "That sign-in request expired. Try again." };
  }

  // Burn the nonce before checking the signature, so a failed attempt cannot be retried against the
  // same challenge and a captured signature is worthless the moment it has been used once.
  store.delete(CHALLENGE_COOKIE);

  let verified = false;
  try {
    verified = Keypair.fromPublicKey(address).verify(
      Buffer.from(challengeText(nonce), "utf8"),
      Buffer.from(signature, "base64"),
    );
  } catch {
    // A malformed address or an unparseable signature is a failed proof, not an outage.
    verified = false;
  }

  if (!verified) {
    return { ok: false, error: "That signature does not match the wallet." };
  }

  const session = await sign(address, SESSION_TTL);
  if (!session) {
    return { ok: false, error: "This server is not configured to verify wallets." };
  }

  store.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });

  return { ok: true, address };
}

/** The address this browser has proven, so the client can skip the prompt when it already has one. */
export async function sessionAddress(): Promise<string | null> {
  return currentAddress();
}

/** Called on disconnect. A session outliving the wallet connection is a surprise nobody wants. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
