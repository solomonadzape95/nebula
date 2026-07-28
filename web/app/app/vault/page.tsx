import { ArrowUpRight } from "lucide-react";

import { Icon } from "@/components/ui/icon";

import { AllocationBar } from "@/components/site/allocation-bar";
import { DataNotice } from "@/components/site/data-notice";
import {
  BLEND_POOL_ID,
  SHARE_TOKEN_ID,
  STRATEGY_ID,
  VAULT_ID,
  explorerContract,
  shortAddress,
} from "@/lib/contracts";
import { formatStroops } from "@/lib/format";
import { getVaultState } from "@/lib/stellar";

export const revalidate = 30;

export default async function VaultPage() {
  const vault = await getVaultState();

  if (!vault) return <Unavailable />;

  const deployed = vault.strategies.reduce((sum, s) => sum + s.deployed, 0n);
  const total = vault.totalAssets === 0n ? 1n : vault.totalAssets;
  const deployedPct = (Number(deployed) / Number(total)) * 100;

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Where your money is
      </h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        Nothing is pooled somewhere you cannot see. Every address below is live on Stellar testnet.
      </p>

      <div className="mt-8">
        <DataNotice chainOk />
      </div>

      <div className="mt-10">
        <AllocationBar
          segments={[
            {
              label: "Supplied to Blend",
              amount: formatStroops(deployed, 2),
              pct: deployedPct,
              note: "Earning borrower interest",
              tone: "signal",
            },
            {
              label: "Idle reserve",
              amount: formatStroops(vault.idle, 2),
              pct: 100 - deployedPct,
              note: "Held back so ordinary withdrawals are instant",
              tone: "dim",
            },
          ]}
        />
      </div>

      <div className="mt-10 grid gap-px border border-edge bg-edge lg:grid-cols-2">
        <Holding
          label="Supplied to Blend"
          amount={deployed}
          pct={deployedPct}
          body="Lent to borrowers who post collateral and pay interest. Nebula supplies without using the position as collateral and never borrows, so it carries no health factor and cannot be liquidated."
          id={STRATEGY_ID}
        />
        <Holding
          label="Idle reserve"
          amount={vault.idle}
          pct={100 - deployedPct}
          body="Held back on purpose so ordinary withdrawals are instant and never have to unwind a lending position. Target is 10% of total assets."
          id={VAULT_ID}
        />
      </div>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">Contracts</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="space-y-px border border-edge bg-edge">
          <ContractRow label="Vault" id={VAULT_ID} note="Holds deposits and issues nXLM" />
          <ContractRow label="nXLM token" id={SHARE_TOKEN_ID} note="Minter fixed to the vault" />
          <ContractRow label="Blend strategy" id={STRATEGY_ID} note="Supplies XLM, harvests interest" />
          <ContractRow label="Blend pool" id={BLEND_POOL_ID} note="Upstream lending market" />
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-center gap-4">
          <span className="label whitespace-nowrap">The invariant</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="panel p-8 sm:p-10">
          <p className="font-mono text-base text-signal sm:text-lg">
            total assets = idle reserve + everything deployed
          </p>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
            The vault asserts this after every deposit, redemption, allocation and harvest. Total
            assets is tracked in contract state rather than read from a token balance, which is what
            makes the classic first-depositor attack impossible here: XLM donated directly to the
            vault address never enters the accounting, so it cannot move the share price.
          </p>
          <p className="tabular mt-6 font-mono text-sm text-ink-faint">
            {formatStroops(vault.totalAssets, 4)} = {formatStroops(vault.idle, 4)} +{" "}
            {formatStroops(deployed, 4)}
          </p>
        </div>
      </section>
    </div>
  );
}

function Holding({
  label,
  amount,
  pct,
  body,
  id,
}: {
  label: string;
  amount: bigint;
  pct: number;
  body: string;
  id: string;
}) {
  return (
    <div className="bg-void p-8 sm:p-10">
      <div className="flex items-baseline justify-between gap-4">
        <span className="label">{label}</span>
        <span className="tabular font-mono text-sm text-signal">{pct.toFixed(1)}%</span>
      </div>
      <p className="figure mt-4 text-4xl text-ink">
        {formatStroops(amount, 2)} <span className="text-base text-ink-faint">XLM</span>
      </p>
      <p className="mt-5 text-base leading-relaxed text-ink-dim">{body}</p>
      <a
        href={explorerContract(id)}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs text-ink-faint transition-colors hover:text-signal"
      >
        {shortAddress(id, 6, 6)} <Icon icon={ArrowUpRight} size={13} />
      </a>
    </div>
  );
}

function ContractRow({ label, id, note }: { label: string; id: string; note: string }) {
  return (
    <a
      href={explorerContract(id)}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col gap-2 bg-void px-6 py-5 transition-colors hover:bg-raised sm:flex-row sm:items-center sm:justify-between sm:gap-8"
    >
      <span>
        <span className="block text-base text-ink">{label}</span>
        <span className="mt-0.5 block text-sm text-ink-faint">{note}</span>
      </span>
      <span className="font-mono text-sm text-ink-dim">{shortAddress(id, 6, 6)}</span>
    </a>
  );
}

function Unavailable() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Where your money is
      </h1>
      <div className="mt-8">
        <DataNotice chainOk={false} />
      </div>
    </div>
  );
}
