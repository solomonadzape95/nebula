"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DitherSpinner } from "@/components/ui/dither-loader";
import { DURATION, ENTER } from "@/lib/easing";
import { useWallet } from "@/components/wallet/wallet-provider";
import { getNativeBalance } from "@/lib/balances";
import { formatNumber } from "@/lib/format";

type Mode = "deposit" | "withdraw";
type TxState = "idle" | "signing" | "submitting" | "done" | "error";

/**
 * Deposit and withdraw as two tabs on one card rather than two routes.
 *
 * Every extra navigation step sits between a first-time visitor and their first transaction, and
 * the target is under two minutes from landing to deposit. Lido, Yearn and Blend all do it this
 * way for the same reason.
 */
interface DepositCardProps {
  /** XLM per nXLM, from the contract. Null when the chain could not be read. */
  sharePrice: number | null;
  depositsPaused: boolean;
  availableLiquidity: number | null;
}

export function DepositCard({ sharePrice, depositsPaused, availableLiquidity }: DepositCardProps) {
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<TxState>("idle");

  const { address } = useWallet();
  // Keyed by address so a disconnect or account switch invalidates the reading without an effect
  // resetting it. Storing the address alongside the number is what lets that be derived.
  const [fetched, setFetched] = useState<{ address: string; balance: number | null } | null>(null);

  // Balance is fetched client-side because it is per-connected-wallet, so it cannot be part of the
  // server render. Null means "not known yet or unfunded", which is why Max is hidden rather than
  // showing a confident zero.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void getNativeBalance(address).then((next) => {
      if (!cancelled) setFetched({ address, balance: next });
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const balance = fetched?.address === address ? fetched.balance : null;

  const parsed = Number(amount) || 0;
  const overBalance =
    mode === "deposit" && balance !== null && parsed > balance;
  const valid = parsed > 0 && sharePrice !== null && !overBalance;

  // What you get out the other side. Deposits divide by the price, redemptions multiply by it.
  const receives = sharePrice === null ? 0 : mode === "deposit" ? parsed / sharePrice : parsed * sharePrice;

  const submit = () => {
    if (!valid) return;
    setState("signing");
    window.setTimeout(() => setState("submitting"), 900);
    window.setTimeout(() => setState("error"), 2200);
  };

  if (!address) return <DisconnectedCard />;

  return (
    <div className="panel">
      <div role="tablist" aria-label="Deposit or withdraw" className="grid grid-cols-2 border-b border-edge">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setAmount("");
              setState("idle");
            }}
            role="tab"
            aria-selected={mode === m}
            className={`relative py-5 font-mono text-sm tracking-wider uppercase transition-colors ${
              mode === m ? "text-signal" : "text-ink-faint hover:text-ink"
            }`}
          >
            {m}
            {mode === m && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-signal"
                transition={{ duration: DURATION.base, ease: ENTER }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-7 sm:p-8">
        <div className="flex items-baseline justify-between">
          <label htmlFor="amount" className="label">
            {mode === "deposit" ? "Amount to deposit" : "nXLM to redeem"}
          </label>
          {mode === "deposit" && balance !== null ? (
            <button
              type="button"
              onClick={() => setAmount(String(Math.max(0, balance - 1)))}
              className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
              title="Leaves 1 XLM behind for reserves and fees"
            >
              Max {formatNumber(balance, 2)}
            </button>
          ) : (
            <span className="font-mono text-xs text-ink-faint">
              {depositsPaused && mode === "deposit" ? "Deposits paused" : ""}
            </span>
          )}
        </div>

        <div
          className={`mt-4 flex items-baseline gap-3 border-b pb-4 transition-colors ${
            overBalance ? "border-ember" : "border-edge focus-within:border-signal"
          }`}
        >
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              setState("idle");
            }}
            className="tabular min-w-0 flex-1 bg-transparent font-mono text-3xl text-ink outline-none placeholder:text-ink-faint sm:text-4xl"
          />
          <span className="font-mono text-sm text-ink-faint">
            {mode === "deposit" ? "XLM" : "nXLM"}
          </span>
        </div>

        {overBalance && (
          <p className="mt-3 text-sm text-ember">
            You have {formatNumber(balance ?? 0, 4)} XLM.
          </p>
        )}

        <div className="mt-7 space-y-3 border-t border-edge pt-6">
          <Row
            k="You receive"
            v={`${formatNumber(receives, 4)} ${mode === "deposit" ? "nXLM" : "XLM"}`}
            emphasis
          />
          <Row
            k="Share price"
            v={sharePrice === null ? "—" : `${formatNumber(sharePrice, 7)} XLM`}
          />
          <Row k="Network fee" v="~0.00001 XLM" />
          {mode === "withdraw" && (
            <Row
              k="Available to redeem now"
              v={availableLiquidity === null ? "—" : `${formatNumber(availableLiquidity, 2)} XLM`}
            />
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={
            !valid ||
            (mode === "deposit" && depositsPaused) ||
            state === "signing" ||
            state === "submitting"
          }
          className="btn btn-primary mt-8 w-full !py-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === "signing" && (
            <>
              <DitherSpinner size={18} /> Waiting for your wallet
            </>
          )}
          {state === "submitting" && (
            <>
              <DitherSpinner size={18} /> Submitting
            </>
          )}
          {(state === "idle" || state === "error" || state === "done") &&
            (mode === "deposit"
              ? depositsPaused
                ? "Deposits paused"
                : "Deposit XLM"
              : "Redeem nXLM")}
        </button>

        <AnimatePresence>
          {state === "error" && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base, ease: ENTER }}
              className="mt-5 border border-ember/30 bg-ember/[0.06] px-4 py-3 text-sm leading-relaxed text-ink-dim"
            >
              <span className="text-ember">Not wired up yet.</span> Signing lands with the contract
              integration. The amounts and previews above are calculated for real.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ k, v, emphasis }: { k: string; v: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`text-sm ${emphasis ? "text-ink" : "text-ink-dim"}`}>{k}</span>
      <span
        className={`tabular font-mono ${emphasis ? "text-lg text-signal" : "text-sm text-ink-dim"}`}
      >
        {v}
      </span>
    </div>
  );
}

/** The first thing most visitors will see. It should explain itself, not just block. */
function DisconnectedCard() {
  return (
    <div className="panel flex flex-col items-center px-7 py-14 text-center sm:px-10">
      <span
        aria-hidden
        className="flex size-16 items-center justify-center border border-edge text-signal"
        style={{
          WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
          maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
          WebkitMaskSize: "2.5px 2.5px",
          maskSize: "2.5px 2.5px",
        }}
      >
        <Wallet size={26} strokeWidth={2} />
      </span>

      <h2 className="mt-8 text-2xl font-medium tracking-tight text-ink">Connect to get started</h2>
      <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-dim">
        Nebula has no accounts. Connect a Stellar wallet and you can deposit straight away. Testnet
        XLM is free, so nothing here costs you anything.
      </p>

      <Link href="/connect" className="btn btn-primary mt-9 w-full !py-4 sm:w-auto">
        Connect wallet <ArrowRight size={16} />
      </Link>

      <Link
        href="/how-it-works"
        className="mt-5 font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-signal"
      >
        Or read how it works first
      </Link>
    </div>
  );
}
