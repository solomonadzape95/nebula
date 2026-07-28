import { AlertTriangle, Radio } from "lucide-react";

import { shortDate } from "@/lib/format";

/**
 * States a data-bearing screen can be in, said out loud.
 *
 * The whole point of replacing the placeholder banner was to stop showing numbers without saying
 * where they came from. That obligation does not disappear once the data is real: RPC can be
 * unreachable and the indexer can be hours behind, and both produce a page that looks fine while
 * being wrong. Silence is the failure mode worth designing against.
 */
export function DataNotice({
  chainOk,
  indexerOk,
  indexerUpdatedAt,
}: {
  chainOk: boolean;
  indexerOk?: boolean;
  indexerUpdatedAt?: Date | null;
}) {
  if (!chainOk) {
    return (
      <Banner tone="ember" icon={AlertTriangle}>
        <span className="text-ember">Cannot reach the network.</span> These figures could not be
        read from the vault just now. Nothing is wrong with your position; this page simply has
        nothing to show until Soroban RPC answers again.
      </Banner>
    );
  }

  if (indexerOk === false) {
    return (
      <Banner tone="ember" icon={AlertTriangle}>
        <span className="text-ember">History unavailable.</span> Live vault figures are current,
        but the indexer is not answering, so charts and past activity are missing. Run{" "}
        <code className="font-mono text-ink-dim">npm run sync</code> in <code className="font-mono text-ink-dim">indexer/</code>.
      </Banner>
    );
  }

  return (
    <Banner tone="signal" icon={Radio}>
      <span className="text-signal">Live.</span> Vault figures are read directly from the contracts
      on Stellar testnet.
      {indexerUpdatedAt && <> History indexed up to {shortDate(indexerUpdatedAt)}.</>}
    </Banner>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "signal" | "ember";
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const border = tone === "signal" ? "border-signal-dim/30 bg-signal/[0.04]" : "border-ember/25 bg-ember/[0.06]";
  const color = tone === "signal" ? "text-signal" : "text-ember";

  return (
    <div className={`flex items-start gap-3 border px-5 py-4 ${border}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} strokeWidth={2} />
      <p className="text-sm leading-relaxed text-ink-dim">{children}</p>
    </div>
  );
}
