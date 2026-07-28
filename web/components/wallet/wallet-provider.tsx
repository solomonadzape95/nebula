"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { NETWORK } from "@/lib/contracts";

const STORAGE_KEY = "nebula.wallet";

export type WalletStatus = "idle" | "connecting" | "connected" | "error";

interface WalletContextValue {
  address: string | null;
  walletId: string | null;
  status: WalletStatus;
  error: string | null;
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Wallet connection, kept out of the render tree's way.
 *
 * Stellar Wallets Kit is loaded on demand rather than imported at the top. It pulls in adapters for
 * every wallet it supports plus the Stellar SDK, and none of that should sit in the bundle for
 * someone reading the FAQ. The import happens the first time a connection is attempted.
 *
 * The kit is also a browser-only singleton with global state, so it can only be touched after
 * mount, never during render or on the server.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads the kit and points it at the right network. Safe to call repeatedly.
   *
   * Adapters are imported one by one from their own subpaths rather than through a catch-all. The
   * kit ships adapters for sixteen wallets, most of which Nebula does not offer, and pulling them
   * all in would mean shipping hardware-wallet and WalletConnect transports to every visitor.
   */
  const loadKit = useCallback(async () => {
    const [{ StellarWalletsKit }, { Networks }, freighter, lobstr, xbull, albedo, rabet, hana] =
      await Promise.all([
        import("@creit.tech/stellar-wallets-kit"),
        import("@creit.tech/stellar-wallets-kit/types"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/modules/rabet"),
        import("@creit.tech/stellar-wallets-kit/modules/hana"),
      ]);

    StellarWalletsKit.init({
      modules: [
        new freighter.FreighterModule(),
        new lobstr.LobstrModule(),
        new xbull.xBullModule(),
        new albedo.AlbedoModule(),
        new rabet.RabetModule(),
        new hana.HanaModule(),
      ],
      network: NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
    });
    return StellarWalletsKit;
  }, []);

  const connect = useCallback(
    async (id: string) => {
      setStatus("connecting");
      setError(null);
      try {
        const kit = await loadKit();
        kit.setWallet(id);
        const { address: next } = await kit.getAddress();

        setAddress(next);
        setWalletId(id);
        setStatus("connected");
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch (cause) {
        // Wallet errors are for humans: "User declined access" is useful, a stack trace is not.
        setError((cause as Error).message || "Could not connect to that wallet.");
        setStatus("error");
      }
    },
    [loadKit],
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletId(null);
    setStatus("idle");
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
    void loadKit()
      .then((kit) => kit.disconnect())
      .catch(() => {
        // Local state is already cleared; a failed teardown should not surface to the user.
      });
  }, [loadKit]);

  // Restore a previous session silently. A reconnect that needs a prompt is left for the user to
  // trigger, so nobody lands on the site and is immediately asked to approve something.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    let cancelled = false;
    void (async () => {
      try {
        const kit = await loadKit();
        kit.setWallet(saved);
        const { address: next } = await kit.getAddress();
        if (cancelled || !next) return;
        setAddress(next);
        setWalletId(saved);
        setStatus("connected");
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadKit]);

  return (
    <WalletContext.Provider
      value={{ address, walletId, status, error, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
