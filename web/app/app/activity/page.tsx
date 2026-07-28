import { ArrowDownLeft, ArrowUpRight, Sprout } from "lucide-react";
import Link from "next/link";

import { MockNotice } from "@/components/site/mock-notice";
import { explorerTx } from "@/lib/contracts";
import { ACTIVITY, POSITION, shortDate, xlm, type ActivityRow } from "@/lib/mock";

const KINDS = {
  deposit: { label: "Deposit", icon: ArrowDownLeft, tone: "text-ink" },
  withdraw: { label: "Withdraw", icon: ArrowUpRight, tone: "text-ink" },
  harvest: { label: "Harvest", icon: Sprout, tone: "text-signal" },
} as const;

export default function ActivityPage() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Activity</h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        Every deposit, redemption and harvest, straight from on-chain events. Each row links to the
        transaction so nothing has to be taken on trust.
      </p>

      <div className="mt-8">
        <MockNotice what="These transactions" />
      </div>

      {ACTIVITY.length === 0 ? <EmptyState /> : <Table rows={ACTIVITY} />}
    </div>
  );
}

function Table({ rows }: { rows: ActivityRow[] }) {
  return (
    <>
      {/* Desktop: a real table, because these columns are worth comparing down the page. */}
      <div className="mt-10 hidden overflow-x-auto border border-edge md:block">
        <table className="w-full min-w-[46rem]">
          <thead>
            <tr className="border-b border-edge">
              <Th>Event</Th>
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
                <tr key={row.txHash} className="border-b border-edge/60 last:border-0">
                  <td className="px-5 py-5">
                    <span className="flex items-center gap-3">
                      <kind.icon size={16} className={kind.tone} strokeWidth={2} />
                      <span className="text-sm text-ink">{kind.label}</span>
                    </span>
                  </td>
                  <Td>
                    {row.kind === "withdraw" ? "−" : "+"}
                    {xlm(row.amount, 4)}
                  </Td>
                  <Td>{row.shares === null ? "—" : xlm(row.shares, 4)}</Td>
                  <Td>{xlm(row.sharePrice, 7)}</Td>
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

      {/* Mobile: cards. A six-column table at 375px is a horizontal scroll nobody performs. */}
      <div className="mt-10 space-y-px border border-edge bg-edge md:hidden">
        {rows.map((row) => {
          const kind = KINDS[row.kind];
          return (
            <a
              key={row.txHash}
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
                  {xlm(row.amount, 4)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-ink-faint">{shortDate(row.at)}</span>
                <span className="font-mono text-xs text-ink-faint">
                  @ {xlm(row.sharePrice, 7)}
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

function EmptyState() {
  return (
    <div className="panel mt-10 flex flex-col items-center px-7 py-16 text-center">
      <h2 className="text-xl font-medium tracking-tight text-ink">Nothing here yet</h2>
      <p className="mt-3 max-w-sm text-base leading-relaxed text-ink-dim">
        {POSITION.connected
          ? "Your deposits and redemptions will appear here as soon as you make one."
          : "Connect a wallet to see your own history."}
      </p>
      <Link href={POSITION.connected ? "/app" : "/connect"} className="btn btn-primary mt-8">
        {POSITION.connected ? "Make a deposit" : "Connect wallet"}
      </Link>
    </div>
  );
}
