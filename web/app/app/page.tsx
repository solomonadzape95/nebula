import Link from "next/link";

import { Sparkline } from "@/components/dither-kit/sparkline";
import { DepositCard } from "@/components/app/deposit-card";
import { MockNotice } from "@/components/site/mock-notice";
import { PRICE_SERIES, POSITION, VAULT, xlm } from "@/lib/mock";

export default function AppPage() {
  const earned = POSITION.worth - POSITION.costBasis;

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            {POSITION.connected ? "Your position" : "Nebula vault"}
          </h1>
          <p className="mt-2 text-base text-ink-dim">
            {POSITION.connected
              ? "Your nXLM never changes. What it is worth does."
              : "Deposit XLM, receive nXLM, and keep it liquid."}
          </p>
        </div>
        <Link
          href="/stats"
          className="font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-signal"
        >
          Full vault stats →
        </Link>
      </div>

      <div className="mt-8">
        <MockNotice />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        <div className="space-y-8">
          {POSITION.connected ? (
            <PositionPanel earned={earned} />
          ) : (
            <VaultPanel />
          )}
          <PriceCard />
        </div>

        <DepositCard />
      </div>
    </div>
  );
}

function PositionPanel({ earned }: { earned: number }) {
  return (
    <div className="panel p-7 sm:p-9">
      <span className="label">Your position</span>

      <p className="tabular mt-5 font-mono text-4xl leading-none text-ink sm:text-5xl">
        {xlm(POSITION.worth, 4)} <span className="text-lg text-ink-faint">XLM</span>
      </p>

      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-edge pt-7 sm:grid-cols-3">
        <Metric label="Your nXLM" value={xlm(POSITION.shares, 4)} note="never changes" />
        <Metric label="You deposited" value={xlm(POSITION.costBasis, 2)} note="XLM" />
        <Metric
          label="Earned"
          value={`+${xlm(earned, 4)}`}
          note="XLM"
          tone={earned > 0 ? "signal" : "default"}
        />
      </div>
    </div>
  );
}

/** Shown before connecting. The vault's own numbers still tell the story. */
function VaultPanel() {
  return (
    <div className="panel p-7 sm:p-9">
      <span className="label">Vault</span>

      <p className="tabular mt-5 font-mono text-4xl leading-none text-signal sm:text-5xl">
        {xlm(VAULT.sharePrice, 7)}
      </p>
      <p className="mt-3 text-sm text-ink-dim">XLM per nXLM, and it only moves upward.</p>

      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-edge pt-7 sm:grid-cols-3">
        <Metric label="Total value locked" value={xlm(VAULT.totalAssets, 2)} note="XLM" />
        <Metric label="Depositors" value={String(VAULT.depositors)} />
        <Metric label="Protocol fee" value={`${VAULT.feeBps / 100}%`} note="of yield" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "signal";
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <p
        className={`tabular mt-2 font-mono text-xl ${
          tone === "signal" ? "text-signal" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1 font-mono text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

function PriceCard() {
  return (
    <div className="panel p-7 sm:p-9">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="label">Share price</span>
          <p className="tabular mt-3 font-mono text-2xl text-signal sm:text-3xl">
            {xlm(VAULT.sharePrice, 7)}
          </p>
        </div>
        <div className="text-right">
          <span className="label">Realized APY</span>
          <p className="tabular mt-3 font-mono text-lg text-ink-dim">
            {VAULT.apyPercent === null ? "n/a" : `${VAULT.apyPercent.toFixed(2)}%`}
          </p>
        </div>
      </div>

      <div className="mt-7 h-32">
        <Sparkline data={PRICE_SERIES} color="green" variant="gradient" animate bloom="low" />
      </div>

      <p className="mt-6 border-t border-edge pt-5 text-sm leading-relaxed text-ink-dim">
        Each step up is a harvest: interest collected from Blend and credited to every holder at
        once. You never claim it.
      </p>
    </div>
  );
}
