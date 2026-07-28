import { AlertTriangle, TrendingDown } from "lucide-react";

import { Icon } from "@/components/ui/icon";

import type { Breakdown, Funnel } from "@/lib/posthog-query";
import { WINDOW_DAYS } from "@/lib/posthog-query";

/**
 * The drop-off panel.
 *
 * Built around one question the rest of admin cannot answer: of the people who got as far as
 * connecting a wallet, how many never deposited? The depositor table proves who succeeded, because
 * it reads the chain. Nobody who left is in it — that is what makes them easy to forget and
 * expensive to ignore.
 *
 * `deposited` deliberately comes from the indexer rather than from PostHog. Analytics can be
 * blocked, and a wallet audience blocks things; the chain cannot be. So the last step of this
 * funnel is the on-chain count, and only the earlier steps are behavioural. It means the two halves
 * are measured differently, which is stated on screen rather than hidden — a funnel that quietly
 * mixes sources is worse than no funnel.
 */
export function FunnelPanel({
  funnel,
  phases,
  wallets,
  onChainDepositors,
  configured,
}: {
  funnel: Funnel | null;
  phases: Breakdown[] | null;
  wallets: Breakdown[] | null;
  onChainDepositors: number;
  configured: boolean;
}) {
  if (!configured) {
    return (
      <Notice>
        No PostHog key is set on this server, so drop-off cannot be read. Set{" "}
        <code className="font-mono text-ink-dim">POSTHOG_API_KEY</code> and{" "}
        <code className="font-mono text-ink-dim">POSTHOG_PROJECT_ID</code> to fill this in.
      </Notice>
    );
  }

  if (!funnel) {
    return (
      <Notice>
        PostHog did not answer. The vault figures above are unaffected — they are read from the
        chain and the indexer, not from analytics.
      </Notice>
    );
  }

  const abandoned = Math.max(funnel.connected - onChainDepositors, 0);
  // Guard the divide: on a site nobody has used yet every number here is zero, and the panel should
  // say so rather than render NaN.
  const conversion = funnel.connected > 0 ? (onChainDepositors / funnel.connected) * 100 : null;
  const quiet = funnel.connectStarted === 0;

  return (
    <div className="space-y-8">
      {quiet && (
        <Notice tone="signal">
          No visitors recorded yet. Analytics only sees a deployed site, so this stays empty until
          Nebula is somewhere other than your machine.
        </Notice>
      )}

      <div className="grid gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-4">
        <Step label="Started connecting" value={funnel.connectStarted} source="analytics" />
        <Step label="Wallet connected" value={funnel.connected} source="analytics" />
        <Step label="Began a deposit" value={funnel.depositStarted} source="analytics" />
        <Step label="Deposited" value={onChainDepositors} source="on chain" tone="signal" />
      </div>

      <div className="panel p-7 sm:p-8">
        <div className="flex items-start gap-4">
          <Icon icon={TrendingDown} size={20} className="mt-1 shrink-0 text-ember" />
          <div className="min-w-0">
            <p className="text-lg text-ink">
              {quiet
                ? "Nobody has arrived yet."
                : abandoned === 0
                  ? "Everyone who connected went on to deposit."
                  : `${abandoned} ${abandoned === 1 ? "person" : "people"} connected a wallet and never deposited.`}
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-dim">
              {conversion === null
                ? `Measured over the last ${WINDOW_DAYS} days.`
                : `${conversion.toFixed(0)}% of connected wallets completed a deposit, over the last ${WINDOW_DAYS} days. The first three steps come from analytics and can be undercounted by ad blockers; the last is read from Stellar and cannot.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <List
          title="Where deposits failed"
          empty="No failed deposits recorded."
          rows={phases}
          note="The phase it reached. “signing” is people backing out at the wallet prompt; “simulating” is the contract rejecting them before they ever signed."
        />
        <List
          title="Wallets used"
          empty="No connections recorded."
          rows={wallets}
          note="What people actually reach for, which is worth comparing against the order they are listed in on the connect page."
        />
      </div>

      {funnel.connectFailures > 0 && (
        <Notice tone="ember">
          {funnel.connectFailures} wallet {funnel.connectFailures === 1 ? "connection" : "connections"}{" "}
          failed outright. Worth reading the raw events in PostHog: a cluster on one wallet usually
          means an adapter problem rather than user error.
        </Notice>
      )}
    </div>
  );
}

function Step({
  label,
  value,
  source,
  tone = "default",
}: {
  label: string;
  value: number;
  source: string;
  tone?: "default" | "signal";
}) {
  return (
    <div className="bg-void p-6">
      <span className="label">{label}</span>
      <p
        className={`figure mt-3 text-3xl leading-none ${
          tone === "signal" ? "text-signal" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-3 font-mono text-[0.625rem] tracking-wider text-ink-faint uppercase">
        {source}
      </p>
    </div>
  );
}

function List({
  title,
  rows,
  empty,
  note,
}: {
  title: string;
  rows: Breakdown[] | null;
  empty: string;
  note: string;
}) {
  const total = rows?.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return (
    <div className="panel p-7 sm:p-8">
      <span className="label">{title}</span>

      {!rows || rows.length === 0 ? (
        <p className="mt-6 border border-edge px-5 py-8 text-center text-sm text-ink-faint">
          {empty}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate font-mono text-sm text-ink-dim">{row.label}</span>
                <span className="tabular shrink-0 font-mono text-sm text-ink">{row.count}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden bg-raised">
                <div
                  className="h-full bg-signal-dim"
                  style={{ width: `${total > 0 ? (row.count / total) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm leading-relaxed text-ink-faint">{note}</p>
    </div>
  );
}

function Notice({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "signal" | "ember";
}) {
  const border =
    tone === "signal"
      ? "border-signal-dim/30 bg-signal/[0.04]"
      : tone === "ember"
        ? "border-ember/25 bg-ember/[0.06]"
        : "border-edge";
  const color = tone === "signal" ? "text-signal" : tone === "ember" ? "text-ember" : "text-ink-faint";

  return (
    <div className={`flex items-start gap-3 border px-5 py-4 ${border}`}>
      <Icon icon={AlertTriangle} size={18} className={`mt-0.5 shrink-0 ${color}`} />
      <p className="text-sm leading-relaxed text-ink-dim">{children}</p>
    </div>
  );
}
