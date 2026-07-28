"use client";

import { Sparkline } from "@/components/dither-kit/sparkline";
import { DitherField } from "@/components/shader/dither-field";

/**
 * Share price over time, drawn with Dither Kit's ordered-dither fill.
 *
 * The series is a stand-in shaped like real vault behaviour — a line that only ever rises, in
 * uneven steps, because share price moves when a harvest lands rather than continuously. When the
 * indexer is wired in this becomes `vault_samples`; the shape should not need to change.
 *
 * A rising line is the entire pitch, so it gets a panel of its own rather than a footnote.
 */
const SERIES = [
  1.0, 1.0, 1.0002, 1.0002, 1.0002, 1.0009, 1.0009, 1.0009, 1.0014, 1.0014, 1.0021, 1.0021, 1.0021,
  1.0029, 1.0029, 1.0036, 1.0036, 1.0036, 1.0044, 1.0044, 1.0051, 1.0051, 1.0059, 1.0059, 1.0068,
  1.0068, 1.0068, 1.0077, 1.0086, 1.0086, 1.0094, 1.0103, 1.0103, 1.0112, 1.0122, 1.0122, 1.0131,
  1.0142,
];

export function YieldChart() {
  const first = SERIES[0]!;
  const last = SERIES[SERIES.length - 1]!;
  const growth = ((last - first) / first) * 100;

  return (
    <div className="panel relative overflow-hidden">
      <DitherField
        variant="drift"
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        speed={0.4}
      />

      <div className="relative p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="label">Share price</span>
            <p className="figure mt-2 text-3xl text-signal sm:text-4xl">
              {last.toFixed(4)}
            </p>
          </div>
          <div className="text-right">
            <span className="label">Since launch</span>
            <p className="tabular mt-2 font-mono text-lg text-ink">+{growth.toFixed(2)}%</p>
          </div>
        </div>

        <div className="mt-8 h-40">
          <Sparkline data={SERIES} color="green" variant="gradient" animate bloom="low" />
        </div>

        {/* Each step up is a harvest. Saying so turns a pretty line into an explanation. */}
        <p className="mt-7 border-t border-edge pt-5 text-sm leading-relaxed text-ink-dim">
          Every step up is a harvest: interest collected from Blend and credited to the price. The
          only thing that can push it down is a real loss.
        </p>
      </div>
    </div>
  );
}
