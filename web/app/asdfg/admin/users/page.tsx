import { ArrowUpRight, Download } from "lucide-react";

import { Icon } from "@/components/ui/icon";

import { DataNotice } from "@/components/site/data-notice";
import { explorerAccount, explorerTx, shortAddress } from "@/lib/contracts";
import { formatStroops, shortDate } from "@/lib/format";
import { getDepositors, getIndexerStats, getSyncState, type Depositor } from "@/lib/indexer";
import { getVaultState } from "@/lib/stellar";

const TARGET = 10;

/**
 * The depositor register.
 *
 * This exists for the submission rather than for users: it is the evidence that real wallets
 * interacted with the vault. Every row carries a transaction hash so a reviewer can verify any
 * line independently instead of taking the count on trust.
 */
export const revalidate = 30;

export default async function AdminUsersPage() {
  const [depositors, stats, vault, sync] = await Promise.all([
    getDepositors(),
    getIndexerStats(),
    getVaultState(),
    getSyncState(),
  ]);

  const total = depositors.length;
  const pct = Math.min(100, (total / TARGET) * 100);
  const totalDeposited = depositors.reduce((sum, d) => sum + d.totalDeposited, 0n);

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Depositors</h1>
          <p className="mt-2 max-w-2xl text-base text-ink-dim">
            Every address that has ever deposited, reconstructed from vault events by the indexer.
          </p>
        </div>
        <button type="button" className="btn btn-ghost w-full sm:w-auto">
          <Icon icon={Download} size={15} /> Export CSV
        </button>
      </div>

      <div className="mt-8">
        <DataNotice
          chainOk={vault !== null}
          indexerOk={sync !== null}
          indexerUpdatedAt={sync?.updatedAt ?? null}
        />
      </div>

      {/* Progress against the onboarding requirement, stated plainly rather than buried. */}
      <div className="panel mt-10 p-7 sm:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <span className="label">Unique depositors</span>
          <span className="tabular font-mono text-sm text-ink-faint">
            {total} of {TARGET} target
          </span>
        </div>

        <p className="figure mt-4 text-6xl leading-none text-signal">{total}</p>

        <div className="mt-7 h-2 w-full overflow-hidden bg-raised">
          <div
            className="h-full bg-signal transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
              maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
              WebkitMaskSize: "3px 3px",
              maskSize: "3px 3px",
            }}
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-edge pt-7 sm:grid-cols-4">
          <Metric label="Total deposited" value={`${formatStroops(totalDeposited, 2)} XLM`} />
          <Metric
            label="Currently locked"
            value={vault ? `${formatStroops(vault.totalAssets, 2)} XLM` : "—"}
          />
          <Metric label="Harvests" value={stats ? String(stats.harvestCount) : "—"} />
          <Metric
            label="Yield paid out"
            value={stats ? `${formatStroops(stats.grossYield, 7)} XLM` : "—"}
          />
        </div>
      </div>

      {total === 0 ? <EmptyState /> : <DepositorTable rows={depositors} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <p className="tabular mt-2 font-mono text-lg text-ink">{value}</p>
    </div>
  );
}

function DepositorTable({ rows }: { rows: Depositor[] }) {
  return (
    <>
      <div className="mt-10 hidden overflow-x-auto border border-edge lg:block">
        <table className="w-full min-w-[52rem]">
          <thead>
            <tr className="border-b border-edge">
              <th className="label px-5 py-4 text-left font-normal">#</th>
              <th className="label px-5 py-4 text-left font-normal">Address</th>
              <th className="label px-5 py-4 text-right font-normal">Deposits</th>
              <th className="label px-5 py-4 text-right font-normal">Withdrawals</th>
              <th className="label px-5 py-4 text-right font-normal">Total in</th>
              <th className="label px-5 py-4 text-right font-normal">First seen</th>
              <th className="label px-5 py-4 text-right font-normal">Proof</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.account} className="border-b border-edge/60 last:border-0">
                <td className="tabular px-5 py-5 font-mono text-sm text-ink-faint">{i + 1}</td>
                <td className="px-5 py-5">
                  <a
                    href={explorerAccount(d.account)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-ink-dim transition-colors hover:text-signal"
                  >
                    {shortAddress(d.account, 8, 8)}
                  </a>
                </td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink-dim">
                  {d.deposits}
                </td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink-dim">
                  {d.withdrawals}
                </td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink">
                  {formatStroops(d.totalDeposited, 2)}
                </td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink-faint">
                  {shortDate(d.firstSeen)}
                </td>
                <td className="px-5 py-5 text-right">
                  <a
                    href={explorerTx(d.firstTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-ink-faint transition-colors hover:text-signal"
                  >
                    {d.firstTxHash.slice(0, 8)}… <Icon icon={ArrowUpRight} size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 space-y-px border border-edge bg-edge lg:hidden">
        {rows.map((d, i) => (
          <div key={d.account} className="bg-void p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="tabular font-mono text-xs text-ink-faint">#{i + 1}</span>
              <a
                href={explorerAccount(d.account)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-ink-dim transition-colors hover:text-signal"
              >
                {shortAddress(d.account, 6, 6)}
              </a>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Small label="In" value={formatStroops(d.totalDeposited, 2)} />
              <Small label="Deposits" value={String(d.deposits)} />
              <Small label="Withdrawals" value={String(d.withdrawals)} />
            </div>
            <a
              href={explorerTx(d.firstTxHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-ink-faint transition-colors hover:text-signal"
            >
              {d.firstTxHash.slice(0, 12)}… <Icon icon={ArrowUpRight} size={12} />
            </a>
          </div>
        ))}
      </div>
    </>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <p className="tabular mt-1 font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel mt-10 px-7 py-16 text-center">
      <h2 className="text-xl font-medium tracking-tight text-ink">No depositors indexed</h2>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-dim">
        Run the indexer to pull vault events into the database. Soroban RPC discards events after
        about a week, so a gap here cannot be backfilled once it opens.
      </p>
      <p className="mt-6 font-mono text-sm text-signal">cd indexer && npm run sync</p>
    </div>
  );
}
