"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DitherSpinner } from "@/components/ui/dither-loader";
import { useWallet } from "@/components/wallet/wallet-provider";
import { getNativeBalance, getShareBalance } from "@/lib/balances";
import { explorerTx } from "@/lib/contracts";
import { DURATION, ENTER } from "@/lib/easing";
import { formatNumber } from "@/lib/format";
import { TxError, deposit, redeem, type TxPhase } from "@/lib/tx";

type Mode = "deposit" | "withdraw";

/** XLM left behind so the account keeps its base reserve and can still pay fees. */
const FEE_HEADROOM = 1.5;

const PHASE_LABEL: Partial<Record<TxPhase, string>> = {
  simulating: "Checking",
  signing: "Waiting for your wallet",
  submitting: "Submitting",
  confirming: "Confirming on Stellar",
};

/**
 * Deposit and withdraw as two tabs on one card rather than two routes.
 *
 * Every extra navigation step sits between a first-time visitor and their first transaction, and
 * the target is under two minutes from landing to deposit. Lido, Yearn and Blend all do it this
 * way for the same reason.
 */
export function DepositCard({
  sharePrice,
  depositsPaused,
  availableLiquidity,
}: {
  /** XLM per nXLM, from the contract. Null when the chain could not be read. */
  sharePrice: number | null;
  depositsPaused: boolean;
  availableLiquidity: number | null;
}) {
  const router = useRouter();
  const { address } = useWallet();

  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Balances are per-connected-wallet, so they cannot be part of the server render. Keying the
  // result by address means a disconnect or account switch invalidates it without an effect
  // reaching in to reset state.
  const [fetched, setFetched] = useState<{
    address: string;
    xlm: number | null;
    shares: number | null;
  } | null>(null);

  // Refetches after a confirmed transaction, which is when the numbers have actually moved.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void Promise.all([getNativeBalance(address), getShareBalance(address)]).then(
      ([xlm, shares]) => {
        if (!cancelled) setFetched({ address, xlm, shares });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [address, txHash]);

  const balances = fetched?.address === address ? fetched : null;
  const max = mode === "deposit" ? (balances?.xlm ?? null) : (balances?.shares ?? null);
  const spendable = mode === "deposit" && max !== null ? Math.max(0, max - FEE_HEADROOM) : max;

  const parsed = Number(amount) || 0;
  const overBalance = max !== null && parsed > max;
  const busy = phase !== "idle" && phase !== "done";
  const blocked = mode === "deposit" && depositsPaused;
  const valid = parsed > 0 && sharePrice !== null && !overBalance && !blocked;

  const receives =
    sharePrice === null ? 0 : mode === "deposit" ? parsed / sharePrice : parsed * sharePrice;

  const submit = async () => {
    if (!valid || !address || busy) return;
    setError(null);
    setTxHash(null);

    try {
      const run = mode === "deposit" ? deposit : redeem;
      const hash = await run({ address, amount: parsed, onPhase: setPhase });
      setTxHash(hash);
      setAmount("");
      setPhase("done");
      // Vault figures on this page are server-rendered, so they only move on a refresh.
      router.refresh();
    } catch (cause) {
      setPhase("idle");
      setError(cause instanceof TxError ? cause.message : "Something went wrong.");
    }
  };

  if (!address) return <DisconnectedCard />;

  return (
    <div className="panel">
      <div
        role="tablist"
        aria-label="Deposit or withdraw"
        className="grid grid-cols-2 border-b border-edge"
      >
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(m);
              setAmount("");
              setError(null);
              setTxHash(null);
            }}
            role="tab"
            aria-selected={mode === m}
            className={`relative py-5 font-mono text-sm tracking-wider uppercase transition-colors disabled:opacity-50 ${
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
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="amount" className="label">
            {mode === "deposit" ? "Amount to deposit" : "nXLM to redeem"}
          </label>
          {spendable !== null && spendable > 0 ? (
            <button
              type="button"
              onClick={() => setAmount(String(Number(spendable.toFixed(7))))}
              disabled={busy}
              className="font-mono text-xs text-ink-faint transition-colors hover:text-signal disabled:opacity-50"
              title={
                mode === "deposit"
                  ? `Leaves ${FEE_HEADROOM} XLM for reserves and fees`
                  : "Your full nXLM balance"
              }
            >
              Max {formatNumber(spendable, 2)}
            </button>
          ) : (
            <span className="font-mono text-xs text-ink-faint">
              {blocked ? "Deposits paused" : ""}
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
            disabled={busy}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              setError(null);
              setTxHash(null);
            }}
            className="tabular min-w-0 flex-1 bg-transparent font-mono text-3xl text-ink outline-none placeholder:text-ink-faint disabled:opacity-60 sm:text-4xl"
          />
          <span className="font-mono text-sm text-ink-faint">
            {mode === "deposit" ? "XLM" : "nXLM"}
          </span>
        </div>

        {overBalance && (
          <p className="mt-3 text-sm text-ember">
            You have {formatNumber(max ?? 0, 4)} {mode === "deposit" ? "XLM" : "nXLM"}.
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
          disabled={!valid || busy}
          className="btn btn-primary mt-8 w-full !py-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <>
              <DitherSpinner size={18} /> {PHASE_LABEL[phase] ?? "Working"}
            </>
          ) : blocked ? (
            "Deposits paused"
          ) : mode === "deposit" ? (
            "Deposit XLM"
          ) : (
            "Redeem nXLM"
          )}
        </button>

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base, ease: ENTER }}
              className="mt-5 border border-ember/30 bg-ember/[0.06] px-4 py-3 text-sm leading-relaxed text-ink-dim"
            >
              {error}
            </motion.p>
          )}

          {txHash && !error && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base, ease: ENTER }}
              className="mt-5 border border-signal-dim/40 bg-signal/[0.05] px-4 py-3"
            >
              <p className="flex items-center gap-2 text-sm text-ink">
                <Check size={15} className="text-signal" strokeWidth={2.5} />
                Confirmed on Stellar.
              </p>
              <a
                href={explorerTx(txHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-signal underline-offset-4 hover:underline"
              >
                {txHash.slice(0, 16)}… <ArrowUpRight size={12} />
              </a>
            </motion.div>
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
