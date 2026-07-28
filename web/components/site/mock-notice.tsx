import { Info } from "lucide-react";

/**
 * Marks any screen still rendering placeholder data.
 *
 * Non-negotiable while `lib/mock.ts` is in play. A dashboard showing invented figures without
 * saying so is the single fastest way to lose a reviewer's trust in every other number on the
 * site, and it costs nothing to be honest about it. Deletes itself when the data goes live.
 */
export function MockNotice({ what = "These figures" }: { what?: string }) {
  return (
    <div className="flex items-start gap-3 border border-ember/25 bg-ember/[0.06] px-5 py-4">
      <Info size={18} className="mt-0.5 shrink-0 text-ember" strokeWidth={2} />
      <p className="text-sm leading-relaxed text-ink-dim">
        <span className="text-ember">Preview data.</span> {what} are the real values read off the
        testnet vault, but this screen is not reading the chain yet. Wiring it to the contracts and
        the indexer is the next step.
      </p>
    </div>
  );
}
