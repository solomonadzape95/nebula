"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useWallet } from "@/components/wallet/wallet-provider";
import { getNativeBalance, getShareBalance } from "@/lib/balances";

interface BalancesValue {
  xlm: number | null;
  shares: number | null;
  /** True only on the very first fetch for an address, so the UI can tell empty from unknown. */
  loading: boolean;
  /** Call after a confirmed transaction. */
  refresh: () => void;
}

const BalancesContext = createContext<BalancesValue | null>(null);

/**
 * Wallet balances, fetched the moment an address exists.
 *
 * Previously the header dropdown fetched on open, so the first open always sat on two round trips
 * with dashes showing. Fetching on connect instead means the numbers are already there by the time
 * anyone looks, and the deposit card, the dropdown and the profile page share one result rather
 * than making the same two calls three times.
 */
export function BalancesProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [state, setState] = useState<{
    address: string;
    xlm: number | null;
    shares: number | null;
  } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void Promise.all([getNativeBalance(address), getShareBalance(address)]).then(
      ([xlm, shares]) => {
        if (!cancelled) setState({ address, xlm, shares });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [address, nonce]);

  // Derived rather than reset by an effect, so switching accounts invalidates the old reading
  // instead of briefly showing it against the new address.
  const current = state?.address === address ? state : null;

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <BalancesContext.Provider
      value={{
        xlm: current?.xlm ?? null,
        shares: current?.shares ?? null,
        loading: Boolean(address) && current === null,
        refresh,
      }}
    >
      {children}
    </BalancesContext.Provider>
  );
}

export function useBalances(): BalancesValue {
  const ctx = useContext(BalancesContext);
  if (!ctx) throw new Error("useBalances must be used inside <BalancesProvider>");
  return ctx;
}
