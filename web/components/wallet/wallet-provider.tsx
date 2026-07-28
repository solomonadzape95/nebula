"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { resetIdentity, track } from "@/lib/analytics";
import { NETWORK } from "@/lib/contracts";
import { endSession } from "@/lib/session-actions";
import { loadKit } from "@/lib/wallet-kit";

const STORAGE_KEY = "nebula.wallet";

export type WalletStatus = "idle" | "connecting" | "connected" | "error";

interface WalletContextValue {
  address: string | null;
  walletId: string | null;
  status: WalletStatus;
  error: string | null;
  connect: (walletId: string) => Promise<string | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);


/**
 * The kit throws plain objects, not Errors, and its messages are aimed at developers. This turns
 * the common ones into something worth putting in front of a person.
 */
function describe(cause: unknown, walletName: string): string {
  const raw =
    typeof cause === "object" && cause !== null && "message" in cause
      ? String((cause as { message: unknown }).message)
      : String(cause);

  if (/not installed|no provider|undefined is not an object|cannot read/i.test(raw)) {
    return `${walletName} does not seem to be installed in this browser.`;
  }
  if (/reject|denied|declined|cancel/i.test(raw)) {
    return "You declined the connection request.";
  }
  if (/locked/i.test(raw)) {
    return `${walletName} is locked. Unlock it and try again.`;
  }
  if (/network/i.test(raw)) {
    return `${walletName} may be on the wrong network. Nebula runs on ${NETWORK}.`;
  }
  return raw || "Could not reach that wallet.";
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (id: string): Promise<string | null> => {
    setStatus("connecting");
    setError(null);
    // Recorded before the attempt, so a wallet that never returns still leaves a trace. The gap
    // between started and connected is people whose extension refused or who closed the prompt,
    // which is invisible if only successes are counted.
    track("wallet_connect_started", { wallet: id });
    try {
      const kit = await loadKit();
      kit.setWallet(id);

      // `fetchAddress`, not `getAddress`. The latter only reads the kit's own memory and throws
      // "No wallet has been connected." when it is empty, which is always the case on a first
      // connect. `fetchAddress` calls into the wallet itself, which is what triggers Freighter's
      // permission prompt and populates that memory.
      const { address: next } = await kit.fetchAddress();

      setAddress(next);
      setWalletId(id);
      setStatus("connected");
      window.localStorage.setItem(STORAGE_KEY, id);
      track("wallet_connected", { wallet: id });
      // Returned as well as stored: a caller routing on the result cannot wait for a state update
      // that lands after its own render.
      return next;
    } catch (cause) {
      setError(describe(cause, id.charAt(0).toUpperCase() + id.slice(1)));
      setStatus("error");
      // The wallet's own message, not ours: the phrasing users see is already in `describe`, and
      // the raw text is what makes a cluster of failures diagnosable.
      track("wallet_connect_failed", {
        wallet: id,
        reason: String((cause as { message?: string })?.message ?? cause).slice(0, 120),
      });
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletId(null);
    setStatus("idle");
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);

    // Drop the proven-ownership cookie too. It is httpOnly and outlives the browser tab, so a
    // session that survived a disconnect would leave the next person at this machine still able to
    // write as the wallet that walked away.
    void endSession().catch(() => {});

    // Start a fresh anonymous analytics id. Nothing here is tied to an address, but a shared
    // browser would otherwise fold two people's sessions into one and understate how many tried it.
    resetIdentity();

    void loadKit()
      .then((kit) => kit.disconnect())
      .catch(() => {
        // Local state is already cleared; a failed teardown should not surface to the user.
      });
  }, []);

  // Restore a previous session. The kit's memory does not survive a reload, so this has to go back
  // to the wallet; where permission is still granted that returns silently without a prompt.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    let cancelled = false;
    void (async () => {
      try {
        const kit = await loadKit();
        kit.setWallet(saved);
        const { address: next } = await kit.fetchAddress();
        if (cancelled || !next) return;
        setAddress(next);
        setWalletId(saved);
        setStatus("connected");
      } catch {
        // Permission was revoked or the wallet is gone. Forget it rather than nagging on load.
        window.localStorage.removeItem(STORAGE_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WalletContext.Provider value={{ address, walletId, status, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
