"use server";

import { Account, Operation, Transaction, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { cookies } from "next/headers";

import { NETWORK_PASSPHRASE } from "@/lib/contracts";
import { query } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL, currentAddress } from "@/lib/session";
import { sign, verify } from "@/lib/signed-cookie";

/**
 * Proving that whoever is asking actually holds the wallet they name.
 *
 * The wallet signs a challenge *transaction* and the server checks that signature against the
 * address's public key. Stellar addresses are ed25519 public keys, so the check needs nothing
 * stored and nothing trusted: either the signature verifies under that key or the caller does not
 * hold it.
 *
 * # Why a transaction and not a message
 *
 * This used to ask the wallet to sign a plain string and verify the raw UTF-8 bytes. It could never
 * have worked. Message signing on Stellar follows SEP-53, which prefixes the text with
 * "Stellar Signed Message:\n" and hashes the result before signing — so the bytes the wallet signs
 * are not the bytes the message is made of, and verification failed every time with
 * "that signature does not match the wallet".
 *
 * Rather than reimplement SEP-53 and hope every wallet agrees on it, this signs a transaction.
 * `signTransaction` is the one operation every wallet implements and tests hardest, because it is
 * how they earn their keep — including Albedo, which has no `signMessage` at all and previously
 * could not set a username. Verification uses the SDK's own `verifyTxSignedBy` rather than hand-
 * rolled crypto.
 *
 * # Why this can never be submitted
 *
 * The challenge is built with sequence number 0. A transaction is only valid when its sequence is
 * the account's current sequence plus one, and accounts start above zero, so a sequence-0
 * transaction is rejected by every validator forever. It is a signature request wearing a
 * transaction's clothes, and it moves nothing. This is the same guarantee SEP-10 relies on.
 */

const CHALLENGE_COOKIE = "nebula_challenge";

/** Five minutes. Long enough to read the prompt and approve it, short enough to be a nonce. */
const CHALLENGE_TTL = 60 * 5;

/**
 * Shown by the wallet as the operation name. Worth writing for a human: this is the one part of
 * the exchange the person actually reads, and prompts full of hex are how users learn to approve
 * things unread.
 */
const OPERATION_NAME = "Nebula sign-in";

/** manageData values are capped at 64 bytes, so the nonce is a compact hex form of a UUID. */
function newNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildChallenge(address: string, nonce: string): string {
  // "-1" so the builder increments to 0. See the note above on why that makes this unsubmittable.
  const account = new Account(address, "-1");

  return new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.manageData({ name: OPERATION_NAME, value: nonce, source: address }))
    .setTimeout(CHALLENGE_TTL)
    .build()
    .toXDR();
}

export type Challenge = { ok: true; xdr: string } | { ok: false; error: string };

/** Issue a challenge transaction and stash its nonce, signed, for [`proveOwnership`] to check. */
export async function requestChallenge(address: string): Promise<Challenge> {
  const nonce = newNonce();

  let xdr: string;
  try {
    xdr = buildChallenge(address, nonce);
  } catch {
    // Almost certainly a malformed address, which is a bad request rather than an outage.
    return { ok: false, error: "That does not look like a Stellar address." };
  }

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

  return { ok: true, xdr };
}

export type Proof = { ok: true; address: string } | { ok: false; error: string };

/**
 * Check the signed challenge and, if it holds, open a session for that address.
 *
 * Everything the client sends is treated as a claim. The transaction is re-parsed from XDR and each
 * property checked against what the server issued — source account, sequence, and the nonce out of
 * the cookie — before the signature is looked at. Verifying a signature over a transaction someone
 * else composed proves only that they can sign their own transactions.
 */
export async function proveOwnership(address: string, signedXdr: string): Promise<Proof> {
  const store = await cookies();
  const nonce = await verify(store.get(CHALLENGE_COOKIE)?.value);

  if (!nonce) {
    return { ok: false, error: "That sign-in request expired. Try again." };
  }

  // Clearing the cookie asks *this* browser to forget the challenge. It does not stop anyone who
  // kept the value from presenting it again, so the single-use guarantee is recorded server-side
  // below; this is just tidiness.
  store.delete(CHALLENGE_COOKIE);

  // Claim the nonce. The primary key does the work: the insert either wins or reports zero rows,
  // so checking and claiming are one atomic step and two simultaneous submissions of the same
  // signed challenge cannot both succeed.
  const claimed = await query(
    `INSERT INTO auth_nonces (nonce, address, expires_at)
          VALUES ($1, $2, now() + make_interval(secs => $3))
     ON CONFLICT (nonce) DO NOTHING
       RETURNING nonce`,
    [nonce, address, CHALLENGE_TTL],
  );

  if (claimed === null) {
    // The database is unreachable, so single-use cannot be guaranteed. Refuse rather than fall back
    // to accepting it: every write this session unlocks needs that database anyway.
    return { ok: false, error: "Could not verify the wallet just now. Try again in a moment." };
  }
  if (claimed.length === 0) {
    return { ok: false, error: "That sign-in request was already used. Try again." };
  }

  // Opportunistic cleanup, so the table stays about the size of one challenge window. Cheap, and it
  // saves running a scheduled job for one small table.
  void query("DELETE FROM auth_nonces WHERE expires_at < now()", [], { quiet: true });

  try {
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

    // A fee-bump wraps another transaction and carries its own source and signatures, so the checks
    // below would be inspecting the wrapper rather than what was actually authorised. Nothing here
    // ever issues one.
    if (!(tx instanceof Transaction)) {
      return { ok: false, error: "That is not a sign-in request." };
    }

    // The address is the caller's claim. Bind it to the transaction actually signed.
    if (tx.source !== address) {
      return { ok: false, error: "That signature is for a different wallet." };
    }
    // Refuse anything that could reach a ledger, however it got here.
    if (tx.sequence !== "0") {
      return { ok: false, error: "That is not a sign-in request." };
    }

    const [operation, ...rest] = tx.operations;
    if (
      rest.length > 0 ||
      operation?.type !== "manageData" ||
      operation.name !== OPERATION_NAME ||
      operation.value?.toString() !== nonce
    ) {
      return { ok: false, error: "That sign-in request did not come from here." };
    }

    if (!WebAuth.verifyTxSignedBy(tx, address)) {
      return { ok: false, error: "That signature does not match the wallet." };
    }
  } catch {
    // Unparseable XDR, wrong network, malformed address: a failed proof, not an outage.
    return { ok: false, error: "That sign-in request could not be read. Try again." };
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
