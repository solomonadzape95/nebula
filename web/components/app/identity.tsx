"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useWallet } from "@/components/wallet/wallet-provider";
import { getProfile, saveProfile, type Profile, type SaveResult } from "@/lib/profile";

interface IdentityValue {
  profile: Profile | null;
  /** True once the lookup has finished, so callers can tell "no profile" from "not asked yet". */
  loaded: boolean;
  /** Connected, lookup done, and no username chosen. Drives the one-time prompt. */
  needsUsername: boolean;
  save: (username: string, hue: number) => Promise<SaveResult>;
  /** The name to show. Falls back to a shortened address so the UI is never blank. */
  displayName: string | null;
  /** Avatar seed: stable per person, and unique even before a username exists. */
  seed: string;
}

const IdentityContext = createContext<IdentityValue | null>(null);

/**
 * Username and avatar for the connected wallet.
 *
 * The avatar seed combines the chosen username with a slice of the address rather than using
 * either alone. A username alone means two people who both pick "alex" on different wallets get
 * identical avatars; an address alone means the avatar never changes and feels unearned. Together
 * the mark is unique per wallet and still reflects the name they chose.
 */
export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [state, setState] = useState<{ address: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void getProfile(address).then((profile) => {
      if (!cancelled) setState({ address, profile });
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Derived rather than reset by an effect, so a disconnect or account switch invalidates the
  // lookup without a render being thrown away.
  const current = state?.address === address ? state : null;
  const profile = current?.profile ?? null;
  const loaded = current !== null;

  const save = useCallback(
    async (username: string, hue: number): Promise<SaveResult> => {
      if (!address) return { ok: false, error: "Connect a wallet first." };
      const result = await saveProfile(address, username, hue);
      if (result.ok) setState({ address, profile: result.profile });
      return result;
    },
    [address],
  );

  const seed = profile ? `${profile.username}:${address?.slice(-6) ?? ""}` : (address ?? "nebula");

  return (
    <IdentityContext.Provider
      value={{
        profile,
        loaded,
        needsUsername: Boolean(address) && loaded && profile === null,
        save,
        displayName: profile?.username ?? null,
        seed,
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used inside <IdentityProvider>");
  return ctx;
}
