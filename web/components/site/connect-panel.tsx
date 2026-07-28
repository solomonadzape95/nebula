"use client";

import { motion } from "motion/react";
import { ArrowLeft, ArrowUpRight, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DitherField } from "@/components/shader/dither-field";
import { DitherSpinner } from "@/components/ui/dither-loader";
import { Logo } from "@/components/site/logo";
import { DURATION, ENTER } from "@/lib/easing";
import { WALLETS, type Wallet } from "@/lib/wallets";

type Status = { wallet: string; state: "connecting" | "failed" } | null;

export function ConnectPanel() {
  const [status, setStatus] = useState<Status>(null);

  // Wiring point. Stellar Wallets Kit brokers the actual handshake; until it is installed this
  // shows the pending state and then the honest failure rather than pretending to succeed.
  const connect = (wallet: Wallet) => {
    setStatus({ wallet: wallet.id, state: "connecting" });
    window.setTimeout(() => setStatus({ wallet: wallet.id, state: "failed" }), 1400);
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <Aside />

      <main className="relative flex items-center justify-center px-5 py-12 sm:px-10 lg:py-16">
        <div className="w-full max-w-md">
          {/* The lockup lives on this side, not over the shader: it belongs with the thing you
              are here to do, and this is the only column that exists on a phone. */}
          <div className="mb-12 flex items-center justify-between gap-4">
            <Link href="/" className="brand flex items-center gap-3.5">
              <Logo size={34} cell={1.8} className="brand-mark text-signal" />
              <span className="brand-name font-mono text-base tracking-[0.2em] uppercase">
                Nebula
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-ink"
            >
              <ArrowLeft size={14} /> Back
            </Link>
          </div>

          <h1 className="text-3xl font-medium tracking-tight text-balance text-ink sm:text-4xl">
            Connect your wallet
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-dim">
            Nebula has no accounts, no passwords, and no email. The vault is non-custodial, so your
            wallet is your identity and your keys never leave it.
          </p>

          <div className="mt-10 space-y-px border border-edge bg-edge">
            {WALLETS.map((wallet) => (
              <WalletRow
                key={wallet.id}
                wallet={wallet}
                status={status?.wallet === wallet.id ? status.state : null}
                onSelect={() => connect(wallet)}
              />
            ))}
          </div>

          {status?.state === "failed" && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: ENTER }}
              className="mt-6 border border-ember/30 bg-ember/[0.06] px-5 py-4"
            >
              <p className="text-sm leading-relaxed text-ink-dim">
                <span className="text-ember">Not wired up yet.</span> Wallet connection lands with
                the app build. Everything else on this page is real.
              </p>
            </motion.div>
          )}

          <div className="mt-10 space-y-4 border-t border-edge pt-8">
            <p className="text-sm leading-relaxed text-ink-dim">
              No wallet yet?{" "}
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-signal underline-offset-4 hover:underline"
              >
                Start with Freighter <ExternalLink size={13} />
              </a>
            </p>
            <p className="text-sm leading-relaxed text-ink-dim">
              Need testnet XLM?{" "}
              <a
                href="https://friendbot.stellar.org"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-signal underline-offset-4 hover:underline"
              >
                The faucet gives it away free <ExternalLink size={13} />
              </a>
            </p>
          </div>

          <p className="mt-10 text-xs leading-relaxed text-ink-faint">
            Nebula runs on Stellar testnet. Tokens here have no real value, and connecting cannot
            move anything you own on mainnet.
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * The left half: the sphere field carrying the same promise the landing page opens with.
 *
 * No border, so the shader runs to the edge of the viewport and the two halves meet on a change
 * of content rather than a drawn line. Hidden below `lg` rather than stacked, because on a phone
 * it would push the actual task below a decorative panel.
 */
function Aside() {
  return (
    <aside className="scanlines relative hidden overflow-hidden lg:flex lg:items-center">
      <DitherField
        variant="blackhole"
        className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[130vh] -translate-x-1/2 -translate-y-1/2"
        speed={0.55}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-void/35" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 58% at 50% 50%, rgba(7,8,10,0.86) 0%, rgba(7,8,10,0.45) 52%, transparent 84%)",
        }}
      />

      <div className="relative w-full p-12 xl:p-20">
        <h2 className="max-w-lg text-5xl leading-[1.02] font-medium tracking-tight text-balance text-ink xl:text-6xl">
          Earn on your XLM.
          <br />
          Keep it liquid.
        </h2>
        <p className="mt-8 max-w-md text-lg leading-relaxed text-ink-dim">
          Deposit XLM and receive nXLM. It grows in value every day, and stays tradeable and
          spendable the whole time.
        </p>
      </div>
    </aside>
  );
}

function WalletRow({
  wallet,
  status,
  onSelect,
}: {
  wallet: Wallet;
  status: "connecting" | "failed" | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={status === "connecting"}
      className="group flex w-full items-center gap-4 bg-void px-5 py-4 text-left outline-none transition-colors hover:bg-raised focus-visible:bg-raised disabled:cursor-wait"
    >
      <WalletGlyph id={wallet.id} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-base text-ink">{wallet.name}</span>
          {wallet.recommended && (
            <span className="border border-signal-dim/50 px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider text-signal uppercase">
              Popular
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-ink-faint">{wallet.blurb}</span>
      </span>

      <span className="shrink-0 text-ink-faint">
        {status === "connecting" ? (
          <DitherSpinner size={20} />
        ) : status === "failed" ? (
          <Check size={18} className="text-ember" />
        ) : (
          <ArrowUpRight
            size={18}
            className="transition-colors group-hover:text-signal"
            strokeWidth={2}
          />
        )}
      </span>
    </button>
  );
}

/**
 * A dithered monogram per wallet.
 *
 * Real brand logos would need six licensed SVGs and would clash with a halftone site anyway. The
 * initial in the site's own lattice reads as deliberate rather than as missing assets.
 */
function WalletGlyph({ id }: { id: string }) {
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center border border-edge font-mono text-base text-signal transition-colors group-hover:border-signal-dim"
      style={{
        WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
        maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
        WebkitMaskSize: "2.5px 2.5px",
        maskSize: "2.5px 2.5px",
      }}
    >
      {id.charAt(0).toUpperCase()}
    </span>
  );
}
