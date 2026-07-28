import { ArrowUpRight, MessageSquare, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import Link from "next/link";

import { Sparkline } from "@/components/dither-kit/sparkline";
import { FunnelPanel } from "@/components/app/funnel-panel";
import { DataNotice } from "@/components/site/data-notice";
import { formatStroops, fromStroops } from "@/lib/format";
import { getDepositors, getIndexerStats, getPriceSeries, getSyncState } from "@/lib/indexer";
import {
  analyticsConfigured,
  getFailurePhases,
  getFunnel,
  getWallets,
} from "@/lib/posthog-query";
import { getReviews } from "@/lib/profile";
import { getVaultState } from "@/lib/stellar";

const USER_TARGET = 10;
const FEEDBACK_TARGET = 8;

/**
 * Admin overview.
 *
 * Framed around the submission requirements rather than around vanity metrics, because that is
 * what this surface is actually for. Two of the three gates here cannot be rescued in the final
 * week, so they are shown as progress bars with the shortfall stated plainly rather than as
 * numbers that look fine in isolation.
 */
export const revalidate = 30;

export default async function AdminPage() {
  const [depositors, stats, series, vault, sync, reviews, funnel, phases, wallets] =
    await Promise.all([
      getDepositors(),
      getIndexerStats(),
      getPriceSeries(),
      getVaultState(),
      getSyncState(),
      getReviews(),
      getFunnel(),
      getFailurePhases(),
      getWallets(),
    ]);

  const users = depositors.length;
  const feedback = reviews.length;
  const priceData = series.map((p) => fromStroops(p.sharePrice));

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Overview</h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        Vault health and progress against the submission requirements.
      </p>

      <div className="mt-8">
        <DataNotice
          chainOk={vault !== null}
          indexerOk={sync !== null}
          indexerUpdatedAt={sync?.updatedAt ?? null}
        />
      </div>

      <section className="mt-12">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Requirements</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-px border border-edge bg-edge md:grid-cols-2">
          <Gate
            icon={Users}
            label="Real depositors"
            value={users}
            target={USER_TARGET}
            href="/asdfg/admin/users"
            note="Distinct wallets that have deposited. Cannot be backfilled: start recruiting early."
          />
          <Gate
            icon={MessageSquare}
            label="Feedback responses"
            value={feedback}
            target={FEEDBACK_TARGET}
            href="/asdfg/admin/feedback"
            note="Reviews left through the in-app button, with what changed as a result."
          />
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Drop-off</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <FunnelPanel
          funnel={funnel}
          phases={phases}
          wallets={wallets}
          onChainDepositors={users}
          configured={analyticsConfigured()}
        />
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Vault health</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel p-7 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="label">Share price</span>
                <p className="tabular mt-3 font-mono text-3xl text-signal sm:text-4xl">
                  {vault ? formatStroops(vault.sharePrice, 7) : "—"}
                </p>
              </div>
              <div className="text-right">
                <span className="label">TVL</span>
                <p className="tabular mt-3 font-mono text-xl text-ink">
                  {vault ? formatStroops(vault.totalAssets, 2) : "—"}
                </p>
              </div>
            </div>
            {priceData.length > 1 ? (
              <div className="mt-7 h-32">
                <Sparkline data={priceData} color="green" variant="gradient" animate bloom="low" />
              </div>
            ) : (
              <p className="mt-7 border border-edge px-5 py-8 text-center text-sm text-ink-faint">
                Not enough history to chart yet.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-px border border-edge bg-edge">
            <Tile label="Harvests" value={stats ? String(stats.harvestCount) : "—"} />
            <Tile label="Gross yield" value={stats ? formatStroops(stats.grossYield, 7) : "—"} />
            <Tile label="Fees taken" value={stats ? formatStroops(stats.feesTaken, 7) : "—"} />
            <Tile
              label="Deposits"
              value={vault?.depositsPaused ? "Paused" : "Open"}
              tone={vault?.depositsPaused ? "ember" : "signal"}
            />
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Jump to</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-px border border-edge bg-edge md:grid-cols-3">
          <Shortcut
            icon={Users}
            title="Depositors"
            body="Every address with transaction proof."
            href="/asdfg/admin/users"
          />
          <Shortcut
            icon={MessageSquare}
            title="Feedback"
            body="What testers said and what changed."
            href="/asdfg/admin/feedback"
          />
          <Shortcut
            icon={ShieldCheck}
            title="Operations"
            body="Keeper jobs, strategies, parameters."
            href="/asdfg/admin/ops"
          />
        </div>
      </section>
    </div>
  );
}

function Gate({
  icon: glyph,
  label,
  value,
  target,
  note,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  target: number;
  note: string;
  href: string;
}) {
  const pct = Math.min(100, (value / target) * 100);
  const met = value >= target;

  return (
    <Link href={href} className="group bg-void p-8 transition-colors hover:bg-raised">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-3">
          <Icon icon={glyph} size={18} className={met ? "text-signal" : "text-ink-faint"} />
          <span className="label">{label}</span>
        </span>
        <span className="tabular font-mono text-sm text-ink-faint">
          {value} / {target}
        </span>
      </div>

      <p
        className={`tabular mt-5 font-mono text-4xl leading-none ${
          met ? "text-signal" : "text-ink"
        }`}
      >
        {value}
      </p>

      <div className="mt-6 h-2 w-full overflow-hidden bg-raised">
        <div
          className={`h-full transition-[width] duration-500 ${met ? "bg-signal" : "bg-signal-dim"}`}
          style={{
            width: `${pct}%`,
            WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
            maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
            WebkitMaskSize: "3px 3px",
            maskSize: "3px 3px",
          }}
        />
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink-dim">
        {met ? "Requirement met." : `${target - value} more needed. `}
        {!met && note}
      </p>
    </Link>
  );
}

function Tile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "signal" | "ember";
}) {
  const color =
    tone === "signal" ? "text-signal" : tone === "ember" ? "text-ember" : "text-ink";
  return (
    <div className="bg-void p-6">
      <span className="label">{label}</span>
      <p className={`tabular mt-3 font-mono text-lg ${color}`}>{value}</p>
    </div>
  );
}

function Shortcut({
  icon: glyph,
  title,
  body,
  href,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className="group bg-void p-7 transition-colors hover:bg-raised">
      <div className="flex items-center justify-between">
        <Icon icon={glyph} size={20} className="text-signal" />
        <Icon icon={ArrowUpRight}
          size={16}
          className="text-ink-faint transition-colors group-hover:text-signal"
        />
      </div>
      <h2 className="mt-5 text-lg font-medium tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">{body}</p>
    </Link>
  );
}
