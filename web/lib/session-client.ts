import { NETWORK_PASSPHRASE } from "@/lib/contracts";
import { proveOwnership, requestChallenge, sessionAddress } from "@/lib/session-actions";
import { loadKit } from "@/lib/wallet-kit";

/**
 * Gets the browser a proven session for `address`, prompting the wallet only when it has to.
 *
 * Deliberately lazy. Asking for a signature the moment a wallet connects would put a prompt in
 * front of people who came to look at the numbers, and most visitors never write anything — the
 * only actions that need this are choosing a username and leaving a review. So the prompt appears
 * at the point where the reason for it is on screen.
 *
 * The existing session is checked first, which costs one round trip and saves a signature on every
 * subsequent write for a week.
 *
 * What gets signed is a challenge transaction built with sequence 0, which no validator will ever
 * accept — so approving this prompt cannot move anything. It signs a transaction rather than a
 * message because `signTransaction` is the operation every wallet implements and tests hardest,
 * and because message signing follows SEP-53, which hashes a prefixed form of the text: the bytes
 * the wallet signs are not the bytes of the message, so verifying the message itself never matched.
 */
export async function ensureWalletSession(address: string): Promise<{ ok: boolean; error?: string }> {
  if ((await sessionAddress()) === address) return { ok: true };

  const challenge = await requestChallenge(address);
  if (!challenge.ok) return { ok: false, error: challenge.error };

  let signedXdr: string;
  try {
    const kit = await loadKit();
    const result = await kit.signTransaction(challenge.xdr, {
      address,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    signedXdr = result.signedTxXdr;
  } catch (error) {
    return { ok: false, error: describe(error) };
  }

  const proof = await proveOwnership(address, signedXdr);
  return proof.ok ? { ok: true } : { ok: false, error: proof.error };
}

function describe(error: unknown): string {
  const message = String(
    (error as { message?: string })?.message ?? (error as string) ?? "",
  ).toLowerCase();

  if (message.includes("reject") || message.includes("denied") || message.includes("cancel")) {
    return "You declined the signature, so nothing was saved.";
  }
  return "Could not verify the wallet. Check it is unlocked and try again.";
}
