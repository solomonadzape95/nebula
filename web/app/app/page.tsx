import Link from "next/link";

import { DepositCard } from "@/components/app/deposit-card";
import { UsernamePrompt } from "@/components/app/profile-menu";
import { DataNotice } from "@/components/site/data-notice";
import { VaultChart, type ChartPoint } from "@/components/site/vault-chart";
import { formatStroops, fromStroops, shortDate } from "@/lib/format";
import { getApy, getPriceSeries, getSyncState } from "@/lib/indexer";
import { getVaultState, type VaultState } from "@/lib/stellar";

export const revalidate = 30;

export default async function AppPage() {
  const [vault, series, apy, sync] = await Promise.all([
    getVaultState(),
    getPriceSeries(),
    getApy(),
    getSyncState(),
  ]);

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Nebula vault</h1>
          <p className="mt-2 text-base text-ink-dim">
            Deposit XLM, receive nXLM, and keep it liquid.
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
        <UsernamePrompt />
        <DataNotice
          chainOk={vault !== null}
          indexerOk={series.length > 0 || sync !== null}
          indexerUpdatedAt={sync?.updatedAt ?? null}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        <div className="space-y-8">
          <VaultPanel vault={vault} />
          <PriceCard vault={vault} series={series} apy={apy} />
        </div>

        <DepositCard
          sharePrice={vault ? fromStroops(vault.sharePrice) : null}
          depositsPaused={vault?.depositsPaused ?? false}
          availableLiquidity={vault ? fromStroops(vault.availableLiquidity) : null}
        />
      </div>
    </div>
  );
}

function VaultPanel({ vault }: { vault: VaultState | null }) {
  return (
    <div className="panel p-7 sm:p-9">
      <span className="label">Share price</span>

      <p className="figure mt-5 text-4xl leading-none text-signal sm:text-5xl">
        {vault ? formatStroops(vault.sharePrice, 7) : "—"}
      </p>
      <p className="mt-3 text-sm text-ink-dim">XLM per nXLM, and it only moves upward.</p>

      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-edge pt-7 sm:grid-cols-3">
        <Metric
          label="Total value locked"
          value={vault ? formatStroops(vault.totalAssets, 2) : "—"}
          note="XLM"
        />
        <Metric
          label="Redeemable now"
          value={vault ? formatStroops(vault.availableLiquidity, 2) : "—"}
          note="XLM"
        />
        <Metric
          label="Protocol fee"
          value={vault ? `${vault.feeBps / 100}%` : "—"}
          note="of yield"
        />
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

function PriceCard({
  vault,
  series,
  apy,
}: {
  vault: VaultState | null;
  series: Awaited<ReturnType<typeof getPriceSeries>>;
  apy: Awaited<ReturnType<typeof getApy>>;
}) {
  const data: ChartPoint[] = series.map((p) => ({
    at: shortDate(p.at),
    value: fromStroops(p.sharePrice),
  }));

  return (
    <div className="panel p-7 sm:p-9">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="label">History</span>
          <p className="figure mt-3 text-2xl text-signal sm:text-3xl">
            {vault ? formatStroops(vault.sharePrice, 7) : "—"}
          </p>
        </div>
        <div className="text-right">
          <span className="label">Realized APY</span>
          <p className="tabular mt-3 font-mono text-lg text-ink-dim">
            {apy ? `${apy.percent.toFixed(2)}%` : "n/a"}
          </p>
        </div>
      </div>

      {data.length > 1 ? (
        <div className="mt-7 h-44">
          <VaultChart data={data} label="Share price" decimals={6} />
        </div>
      ) : (
        <p className="mt-7 border border-edge px-5 py-8 text-center text-sm text-ink-faint">
          Not enough history to chart yet.
        </p>
      )}

      <p className="mt-6 border-t border-edge pt-5 text-sm leading-relaxed text-ink-dim">
        Each step up is a harvest: interest collected from Blend and credited to every holder at
        once. You never claim it.
      </p>
    </div>
  );
}
