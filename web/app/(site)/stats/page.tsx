import type { Metadata } from "next";

import { Sparkline } from "@/components/dither-kit/sparkline";
import { DataNotice } from "@/components/site/data-notice";
import { PageHero } from "@/components/site/page-hero";
import { Stat } from "@/components/site/stat";
import {
  BLEND_POOL_ID,
  STRATEGY_ID,
  VAULT_ID,
  explorerContract,
  shortAddress,
} from "@/lib/contracts";
import { formatStroops, fromStroops, growthPercent } from "@/lib/format";
import { getApy, getIndexerStats, getPriceSeries, getSyncState } from "@/lib/indexer";
import { getVaultState, type VaultState } from "@/lib/stellar";

export const metadata: Metadata = {
  title: "Vault stats · Nebula",
  description: "Live TVL, share price, yield and strategy allocation for the Nebula vault.",
};

/** Contract state changes every ledger; a half-minute window is fresh enough and cheap. */
export const revalidate = 30;

export default async function StatsPage() {
  const [vault, stats, series, apy, sync] = await Promise.all([
    getVaultState(),
    getIndexerStats(),
    getPriceSeries(),
    getApy(),
    getSyncState(),
  ]);

  const priceData = series.map((p) => fromStroops(p.sharePrice));
  const tvlData = series.map((p) => fromStroops(p.totalAssets));
  const growth = series.length > 1 ? growthPercent(series[0]!.sharePrice, series.at(-1)!.sharePrice) : 0;

  return (
    <>
      <PageHero
        eyebrow="Transparency"
        title="Every number, and where it comes from."
        lede="Read live from the contracts, with history reconstructed from on-chain events. Nothing here is self-reported."
      />

      <section className="mx-auto max-w-app px-5 py-16 sm:px-8 sm:py-20">
        <DataNotice
          chainOk={vault !== null}
          indexerOk={stats !== null}
          indexerUpdatedAt={sync?.updatedAt ?? null}
        />

        <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          <Stat
            label="Total value locked"
            value={vault ? formatStroops(vault.totalAssets, 2) : "—"}
            unit="XLM"
          />
          <Stat
            label="Share price"
            value={vault ? formatStroops(vault.sharePrice, 7) : "—"}
            unit="XLM"
            tone="signal"
            hint={series.length > 1 ? `+${growth.toFixed(4)}% since launch` : undefined}
          />
          <Stat
            label="Depositors"
            value={stats ? String(stats.uniqueDepositors) : "—"}
            hint={stats ? undefined : "indexer offline"}
          />
          <Stat
            label="Realized APY"
            value={apy ? `${apy.percent.toFixed(2)}%` : "n/a"}
            hint={apy ? `over ${apy.windowHours.toFixed(0)}h` : "not enough history yet"}
          />
        </div>

        {/* Refusing to annualize a short window is a feature, and worth explaining rather than
            leaving as an unexplained dash. */}
        {!apy && stats !== null && (
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-faint">
            APY stays blank until there are at least six hours of share price history. Annualizing a
            shorter window produces numbers in the thousands of percent, which would be
            arithmetically correct and completely misleading.
          </p>
        )}
      </section>

      {series.length > 1 && (
        <section className="border-y border-edge">
          <div className="mx-auto grid max-w-app gap-px bg-edge lg:grid-cols-2">
            <ChartCard
              title="Share price"
              value={vault ? formatStroops(vault.sharePrice, 7) : "—"}
              caption="Every step up is a harvest. The only thing that can push it down is a real loss."
              data={priceData}
            />
            <ChartCard
              title="Total value locked"
              value={vault ? `${formatStroops(vault.totalAssets, 2)} XLM` : "—"}
              caption="Deposits less withdrawals, plus everything the vault has earned and kept."
              data={tvlData}
            />
          </div>
        </section>
      )}

      {vault && <Allocation vault={vault} />}
      {vault && <Parameters vault={vault} stats={stats} />}
    </>
  );
}

function ChartCard({
  title,
  value,
  caption,
  data,
}: {
  title: string;
  value: string;
  caption: string;
  data: number[];
}) {
  return (
    <div className="bg-void p-8 sm:p-10">
      <span className="label">{title}</span>
      <p className="tabular mt-3 font-mono text-3xl text-signal sm:text-4xl">{value}</p>
      <div className="mt-8 h-40">
        <Sparkline data={data} color="green" variant="gradient" animate bloom="low" />
      </div>
      <p className="mt-7 border-t border-edge pt-5 text-sm leading-relaxed text-ink-dim">
        {caption}
      </p>
    </div>
  );
}

function Allocation({ vault }: { vault: VaultState }) {
  const total = vault.totalAssets === 0n ? 1n : vault.totalAssets;
  const deployed = vault.strategies.reduce((sum, s) => sum + s.deployed, 0n);
  const deployedPct = (Number(deployed) / Number(total)) * 100;
  const idlePct = 100 - deployedPct;

  return (
    <section className="border-b border-edge">
      <div className="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-24">
        <div className="mb-12 flex items-center gap-4">
          <span className="label whitespace-nowrap">Where the money is</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        {/* A two-segment bar rather than a pie: there are two numbers and they sum to a whole. */}
        <div className="flex h-3 w-full overflow-hidden border border-edge">
          <div className="bg-signal" style={{ width: `${deployedPct}%` }} />
          <div className="bg-signal-dim/40" style={{ width: `${idlePct}%` }} />
        </div>

        <div className="mt-10 grid gap-px border border-edge bg-edge md:grid-cols-2">
          <AllocationRow
            label="Supplied to Blend"
            amount={deployed}
            pct={deployedPct}
            note="Earning borrower interest"
            id={STRATEGY_ID}
          />
          <AllocationRow
            label="Idle reserve"
            amount={vault.idle}
            pct={idlePct}
            note="Held back so ordinary withdrawals are instant"
            id={VAULT_ID}
          />
        </div>

        <div className="mt-8 flex flex-col gap-2 text-sm text-ink-faint sm:flex-row sm:justify-between">
          <p>
            Upstream lending market:{" "}
            <a
              href={explorerContract(BLEND_POOL_ID)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-ink-dim transition-colors hover:text-signal"
            >
              {shortAddress(BLEND_POOL_ID, 6, 6)}
            </a>
          </p>
          {vault.pendingInterest > 0n && (
            <p>
              Unharvested interest:{" "}
              <span className="tabular font-mono text-signal">
                {formatStroops(vault.pendingInterest, 7)} XLM
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AllocationRow({
  label,
  amount,
  pct,
  note,
  id,
}: {
  label: string;
  amount: bigint;
  pct: number;
  note: string;
  id: string;
}) {
  return (
    <div className="bg-void p-8">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-base text-ink">{label}</span>
        <span className="tabular font-mono text-xl text-ink sm:text-2xl">
          {formatStroops(amount, 2)} <span className="text-sm text-ink-faint">XLM</span>
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className="text-sm text-ink-dim">{note}</span>
        <span className="tabular font-mono text-sm text-signal">{pct.toFixed(1)}%</span>
      </div>
      <a
        href={explorerContract(id)}
        target="_blank"
        rel="noreferrer"
        className="mt-5 block font-mono text-xs text-ink-faint transition-colors hover:text-signal"
      >
        {shortAddress(id, 6, 6)}
      </a>
    </div>
  );
}

function Parameters({
  vault,
  stats,
}: {
  vault: VaultState;
  stats: Awaited<ReturnType<typeof getIndexerStats>>;
}) {
  const rows = [
    { k: "Protocol fee", v: `${vault.feeBps / 100}% of yield`, note: "Never of your deposit" },
    {
      k: "Reserve target",
      v: `${vault.reserveBps / 100}% of assets`,
      note: "Kept idle for instant exits",
    },
    {
      k: "Deposit cap",
      v:
        vault.depositCap === 0n
          ? "Uncapped"
          : `${formatStroops(vault.depositCap, 0)} XLM`,
      note: "Bounds beta exposure",
    },
    {
      k: "Deposits",
      v: vault.depositsPaused ? "Paused" : "Open",
      note: "Withdrawals are never pausable",
    },
    {
      k: "Harvests to date",
      v: stats ? String(stats.harvestCount) : "—",
      note: "Each one raises the share price",
    },
    {
      k: "Gross yield earned",
      v: stats ? `${formatStroops(stats.grossYield, 7)} XLM` : "—",
      note: stats ? `${formatStroops(stats.feesTaken, 7)} taken as fees` : "indexer offline",
    },
  ];

  return (
    <section>
      <div className="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-24">
        <div className="mb-12 flex items-center gap-4">
          <span className="label whitespace-nowrap">Parameters</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-px border border-edge bg-edge md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.k} className="bg-void p-7">
              <span className="label">{row.k}</span>
              <p className="mt-3 font-mono text-lg text-ink">{row.v}</p>
              <p className="mt-2 text-sm text-ink-faint">{row.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
