import { ArrowDownLeft, ArrowUpRight, Sprout } from "lucide-react";
import Link from "next/link";

import { DataNotice } from "@/components/site/data-notice";
import { explorerAccount, explorerTx, shortAddress } from "@/lib/contracts";
import { formatStroops, shortDate } from "@/lib/format";
import { getActivity, getSyncState, type ActivityEvent } from "@/lib/indexer";

export const revalidate = 30;

const KINDS = {
  deposit: { label: "Deposit", icon: ArrowDownLeft, tone: "text-ink" },
  withdraw: { label: "Withdraw", icon: ArrowUpRight, tone: "text-ink" },
  harvest: { label: "Harvest", icon: Sprout, tone: "text-signal" },
} as const;

export default async function ActivityPage() {
  const [rows, sync] = await Promise.all([getActivity(), getSyncState()]);

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Activity</h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        Every deposit, redemption and harvest, straight from on-chain events. Each row links to the
        transaction so nothing has to be taken on trust.
      </p>

      <div className="mt-8">
        <DataNotice chainOk indexerOk={sync !== null} indexerUpdatedAt={sync?.updatedAt ?? null} />
      </div>

      {rows.length === 0 ? <EmptyState indexerOk={sync !== null} /> : <Table rows={rows} />}
    </div>
  );
}

function Table({ rows }: { rows: ActivityEvent[] }) {
  return (
    <>
      {/* Desktop: a real table, because these columns are worth comparing down the page. */}
      <div className="mt-10 hidden overflow-x-auto border border-edge md:block">
        <table className="w-full min-w-[52rem]">
          <thead>
            <tr className="border-b border-edge">
              <Th>Event</Th>
              <Th>Account</Th>
              <Th align="right">Amount</Th>
              <Th align="right">nXLM</Th>
              <Th align="right">Share price</Th>
              <Th align="right">When</Th>
              <Th align="right">Transaction</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const kind = KINDS[row.kind];
              return (
                <tr key={row.txHash + row.kind} className="border-b border-edge/60 last:border-0">
                  <td className="px-5 py-5">
                    <span className="flex items-center gap-3">
                      <kind.icon size={16} className={kind.tone} strokeWidth={2} />
                      <span className="text-sm text-ink">{kind.label}</span>
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    {row.account ? (
                      <a
                        href={explorerAccount(row.account)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
                      >
                        {shortAddress(row.account, 4, 4)}
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-ink-faint">protocol</span>
                    )}
                  </td>
                  <Td>
                    {row.kind === "withdraw" ? "−" : "+"}
                    {formatStroops(row.amount, 4)}
                  </Td>
                  <Td>{row.shares === null ? "—" : formatStroops(row.shares, 4)}</Td>
                  <Td>{formatStroops(row.sharePrice, 7)}</Td>
                  <Td muted>{shortDate(row.at)}</Td>
                  <td className="px-5 py-5 text-right">
                    <a
                      href={explorerTx(row.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
                    >
                      {row.txHash.slice(0, 8)}…
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards. A seven-column table at 375px is a horizontal scroll nobody performs. */}
      <div className="mt-10 space-y-px border border-edge bg-edge md:hidden">
        {rows.map((row) => {
          const kind = KINDS[row.kind];
          return (
            <a
              key={row.txHash + row.kind}
              href={explorerTx(row.txHash)}
              target="_blank"
              rel="noreferrer"
              className="block bg-void p-5 transition-colors hover:bg-raised"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2.5">
                  <kind.icon size={15} className={kind.tone} strokeWidth={2} />
                  <span className="text-sm text-ink">{kind.label}</span>
                </span>
                <span className="tabular font-mono text-base text-ink">
                  {row.kind === "withdraw" ? "−" : "+"}
                  {formatStroops(row.amount, 4)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-ink-faint">{shortDate(row.at)}</span>
                <span className="font-mono text-xs text-ink-faint">
                  @ {formatStroops(row.sharePrice, 7)}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`label px-5 py-4 font-normal ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      className={`tabular px-5 py-5 text-right font-mono text-sm ${
        muted ? "text-ink-faint" : "text-ink-dim"
      }`}
    >
      {children}
    </td>
  );
}

function EmptyState({ indexerOk }: { indexerOk: boolean }) {
  return (
    <div className="panel mt-10 flex flex-col items-center px-7 py-16 text-center">
      <h2 className="text-xl font-medium tracking-tight text-ink">
        {indexerOk ? "Nothing here yet" : "History unavailable"}
      </h2>
      <p className="mt-3 max-w-sm text-base leading-relaxed text-ink-dim">
        {indexerOk
          ? "Deposits, redemptions and harvests appear here as soon as they happen."
          : "The indexer is not answering. Live vault figures are unaffected."}
      </p>
      <Link href="/app" className="btn btn-primary mt-8">
        Go to the vault
      </Link>
    </div>
  );
}
