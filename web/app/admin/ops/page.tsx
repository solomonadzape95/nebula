import { AlertTriangle, Layers, PauseCircle, Sprout } from "lucide-react";

import { MockNotice } from "@/components/site/mock-notice";
import { STRATEGY_ID, VAULT_ID, explorerContract, shortAddress } from "@/lib/contracts";
import { VAULT, xlm } from "@/lib/mock";

/**
 * Keeper and admin controls.
 *
 * Grouped by who can call them and what the blast radius is, rather than by convenience. The two
 * routine jobs sit at the top; anything that changes protocol parameters is fenced off below with
 * its consequence spelled out, because a mis-clicked fee change is not undoable for the block it
 * lands in.
 */
export default function AdminOpsPage() {
  const idlePct = (VAULT.idle / VAULT.totalAssets) * 100;
  const deployable = Math.max(0, VAULT.idle - VAULT.totalAssets * (VAULT.reserveBps / 10_000));

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Operations</h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        Keeper jobs and vault parameters. The keeper can only move funds between the vault and
        registered strategies, which is why it is safe to run unattended.
      </p>

      <div className="mt-8">
        <MockNotice what="These readings" />
      </div>

      <section className="mt-10">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Keeper jobs</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-px border border-edge bg-edge lg:grid-cols-2">
          <Job
            icon={Layers}
            title="Allocate"
            body="Pushes idle XLM above the reserve target into strategies, split by weight."
            readout={`${xlm(deployable, 4)} XLM deployable now`}
            detail={`Reserve is at ${idlePct.toFixed(1)}%, target ${VAULT.reserveBps / 100}%`}
            action="Run allocate"
            disabled={deployable <= 0}
            disabledNote="Nothing above the reserve target to deploy."
          />
          <Job
            icon={Sprout}
            title="Harvest"
            body="Collects interest from every strategy, takes the protocol fee, and credits the rest to the share price."
            readout={`${VAULT.harvests} harvests to date`}
            detail={`${xlm(VAULT.grossYield, 7)} XLM gross, ${xlm(VAULT.feesTaken, 7)} in fees`}
            action="Run harvest"
          />
        </div>

        <p className="mt-6 text-sm leading-relaxed text-ink-faint">
          Both run automatically from the keeper cron. Manual runs are for demos and incidents.
        </p>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Strategies</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="overflow-x-auto border border-edge">
          <table className="w-full min-w-[40rem]">
            <thead>
              <tr className="border-b border-edge">
                <th className="label px-5 py-4 text-left font-normal">Strategy</th>
                <th className="label px-5 py-4 text-right font-normal">Weight</th>
                <th className="label px-5 py-4 text-right font-normal">Cap</th>
                <th className="label px-5 py-4 text-right font-normal">Deployed</th>
                <th className="label px-5 py-4 text-right font-normal">State</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-5 py-5">
                  <a
                    href={explorerContract(STRATEGY_ID)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-ink transition-colors hover:text-signal"
                  >
                    Blend lending
                  </a>
                  <span className="mt-0.5 block font-mono text-xs text-ink-faint">
                    {shortAddress(STRATEGY_ID, 6, 6)}
                  </span>
                </td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink-dim">100%</td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink-dim">
                  Uncapped
                </td>
                <td className="tabular px-5 py-5 text-right font-mono text-sm text-ink">
                  {xlm(VAULT.deployed, 2)} XLM
                </td>
                <td className="px-5 py-5 text-right">
                  <span className="border border-signal-dim/50 px-2 py-1 font-mono text-[0.625rem] tracking-wider text-signal uppercase">
                    Active
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Parameters</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-px border border-edge bg-edge md:grid-cols-3">
          <Param label="Protocol fee" value={`${VAULT.feeBps / 100}%`} note="Of harvested yield" />
          <Param
            label="Reserve target"
            value={`${VAULT.reserveBps / 100}%`}
            note="Kept idle for instant exits"
          />
          <Param
            label="Deposit cap"
            value={`${VAULT.depositCap.toLocaleString("en-US")} XLM`}
            note="Bounds beta exposure"
          />
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap text-ember">Restricted</span>
          <span className="h-px flex-1 bg-ember/25" />
        </div>

        <div className="border border-ember/25 bg-ember/[0.04]">
          <div className="flex items-start gap-4 border-b border-ember/20 p-7">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-ember" strokeWidth={2} />
            <p className="text-sm leading-relaxed text-ink-dim">
              These require the admin multisig and take effect immediately. Withdrawals are absent
              from this list on purpose: the vault has no mechanism to pause them, which is what
              makes it non-custodial rather than merely well-intentioned.
            </p>
          </div>

          <div className="grid gap-px bg-ember/15 md:grid-cols-2">
            <Restricted
              icon={PauseCircle}
              title={VAULT.depositsPaused ? "Resume deposits" : "Pause deposits"}
              body="Stops new money entering. Existing holders are unaffected and can still redeem in full."
            />
            <Restricted
              icon={Layers}
              title="Unwind a strategy"
              body="Pulls capital back from a venue into the reserve. For rebalancing, or evacuating a venue in an incident."
            />
          </div>
        </div>

        <p className="mt-6 font-mono text-xs text-ink-faint">
          Vault {shortAddress(VAULT_ID, 6, 6)} ·{" "}
          <a
            href={explorerContract(VAULT_ID)}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-signal"
          >
            View on Stellar Expert
          </a>
        </p>
      </section>
    </div>
  );
}

function Job({
  icon: Icon,
  title,
  body,
  readout,
  detail,
  action,
  disabled,
  disabledNote,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  readout: string;
  detail: string;
  action: string;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <div className="bg-void p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon size={20} className="text-signal" strokeWidth={2} />
          <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
        </div>
      </div>

      <p className="mt-4 text-base leading-relaxed text-ink-dim">{body}</p>

      <div className="mt-7 border-t border-edge pt-6">
        <p className="tabular font-mono text-lg text-ink">{readout}</p>
        <p className="mt-1 font-mono text-xs text-ink-faint">{detail}</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        className="btn btn-ghost mt-7 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {action}
      </button>
      {disabled && disabledNote && (
        <p className="mt-3 text-center text-xs text-ink-faint">{disabledNote}</p>
      )}
    </div>
  );
}

function Param({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-void p-7">
      <span className="label">{label}</span>
      <p className="tabular mt-3 font-mono text-2xl text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-faint">{note}</p>
    </div>
  );
}

function Restricted({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-void p-7">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-ember" strokeWidth={2} />
        <h3 className="text-base font-medium text-ink">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-dim">{body}</p>
      <button
        type="button"
        className="btn mt-6 w-full border border-ember/40 !text-xs text-ember transition-colors hover:bg-ember/10"
      >
        {title}
      </button>
    </div>
  );
}
