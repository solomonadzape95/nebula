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

const STEPS = [
  { n: 1, title: "Connect a wallet", body: "Your wallet is your account. Nothing to sign up for." },
  { n: 2, title: "Get testnet XLM", body: "Free from the faucet. It has no real value." },
  { n: 3, title: "Deposit and earn", body: "Receive nXLM. Watch the price climb." },
];

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

      <main className="relative flex items-center justify-center px-5 py-16 sm:px-10 lg:py-20">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-ink lg:hidden"
          >
            <ArrowLeft size={14} /> Back
          </Link>

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
 * The left half: the sphere field with the journey laid over it.
 *
 * Hidden below `lg` rather than stacked. On a phone it would push the actual task, choosing a
 * wallet, below the fold behind a decorative panel.
 */
function Aside() {
  return (
    <aside className="scanlines relative hidden overflow-hidden border-r border-edge lg:flex lg:flex-col">
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
            "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(7,8,10,0.85) 0%, rgba(7,8,10,0.45) 50%, transparent 82%)",
        }}
      />

      <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
        <Link href="/" className="brand flex w-fit items-center gap-3.5">
          <Logo size={34} cell={1.8} className="brand-mark text-signal" />
          <span className="brand-name font-mono text-base tracking-[0.2em] uppercase">Nebula</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-4xl leading-[1.05] font-medium tracking-tight text-balance text-ink xl:text-5xl">
            Three minutes from here to earning.
          </h2>

          <ol className="mt-12 space-y-px border border-edge bg-edge">
            {STEPS.map((step, i) => (
              <li
                key={step.n}
                className={`flex items-start gap-5 p-6 ${
                  i === 0 ? "bg-raised" : "bg-void/70 backdrop-blur-sm"
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center font-mono text-sm ${
                    i === 0 ? "bg-signal text-void" : "border border-edge text-ink-faint"
                  }`}
                >
                  {step.n}
                </span>
                <span>
                  <span className={`block text-base ${i === 0 ? "text-ink" : "text-ink-dim"}`}>
                    {step.title}
                  </span>
                  <span className="mt-1 block text-sm text-ink-faint">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to site
        </Link>
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
