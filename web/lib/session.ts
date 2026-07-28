import { cookies } from "next/headers";

import { verify } from "@/lib/signed-cookie";

/**
 * Who the server believes is making this request.
 *
 * Nebula has no accounts, so for most of the app the answer is "nobody, and it does not matter" —
 * deposits and redemptions authenticate themselves, because the chain will not move anyone's XLM
 * without their signature. The database is the exception. A profile row and a review row are keyed
 * by Stellar address, and an address is a public identifier: it is printed in the activity feed and
 * readable from any block explorer. Accepting one as an argument and writing against it is the same
 * as letting anybody claim to be anybody, which is exactly what was happening — the username of any
 * depositor could be changed by a stranger with curl.
 *
 * So the writes need a credential rather than an identifier. `session-actions.ts` gets one by
 * asking the wallet to sign a nonce; this file is the read side, kept separate from it because
 * anything marked `"use server"` becomes a callable endpoint, and a Server Component awaiting one
 * during render makes Next treat the render as a mutation and refresh the router into a loop.
 */

export const SESSION_COOKIE = "nebula_wallet";

/** Seven days. Long enough not to nag, short enough that a stolen cookie stops working. */
export const SESSION_TTL = 60 * 60 * 24 * 7;

/** The address this request has proven control of, or null. */
export async function currentAddress(): Promise<string | null> {
  const store = await cookies();
  return verify(store.get(SESSION_COOKIE)?.value);
}
