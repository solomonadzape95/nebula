import { loadKit } from "@/lib/wallet-kit";
import { proveOwnership, requestChallenge, sessionAddress } from "@/lib/session-actions";

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
 */
export async function ensureWalletSession(address: string): Promise<{ ok: boolean; error?: string }> {
  if ((await sessionAddress()) === address) return { ok: true };

  const challenge = await requestChallenge();
  if (!challenge.ok) return { ok: false, error: challenge.error };

  let signature: string;
  try {
    const kit = await loadKit();
    const result = await kit.signMessage(challenge.message, { address });
    signature = result.signedMessage;
  } catch (error) {
    // Not every wallet can sign a message: Albedo has no such method and throws, and a hardware
    // wallet may refuse. Say which case it is, because "try again" is useless advice for a wallet
    // that will never support it.
    return { ok: false, error: describe(error) };
  }

  const proof = await proveOwnership(address, signature);
  return proof.ok ? { ok: true } : { ok: false, error: proof.error };
}

function describe(error: unknown): string {
  const message = String(
    (error as { message?: string })?.message ?? (error as string) ?? "",
  ).toLowerCase();

  if (message.includes("does not support")) {
    return "This wallet cannot sign messages, so it cannot prove ownership. Freighter or xBull can. Your deposits are unaffected.";
  }
  if (message.includes("reject") || message.includes("denied") || message.includes("cancel")) {
    return "You declined the signature, so nothing was saved.";
  }
  return "Could not verify the wallet. Check it is unlocked and try again.";
}
