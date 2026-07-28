"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { DURATION, ENTER } from "@/lib/easing";

export interface Segment {
  label: string;
  amount: string;
  pct: number;
  note: string;
  /** Signal for capital at work, dim for capital held back. */
  tone: "signal" | "dim";
}

/**
 * The allocation bar, made readable.
 *
 * As a bare two-colour strip it showed a ratio but never said which colour was which, so the
 * legend below it was doing all the work and the bar was decoration. Hovering a segment now names
 * it, and the segment that is not hovered dims so the pairing is unambiguous. On touch, where
 * there is no hover, tapping does the same thing.
 */
export function AllocationBar({ segments }: { segments: Segment[] }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="relative">
      <div
        className="flex h-4 w-full overflow-hidden border border-edge"
        onMouseLeave={() => setActive(null)}
      >
        {segments.map((segment, i) => (
          <button
            key={segment.label}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(active === i ? null : i)}
            aria-label={`${segment.label}: ${segment.amount} XLM, ${segment.pct.toFixed(1)}%`}
            className={`h-full outline-none transition-opacity duration-200 ${
              segment.tone === "signal" ? "bg-signal" : "bg-signal-dim/40"
            } ${active !== null && active !== i ? "opacity-30" : "opacity-100"}`}
            style={{ width: `${segment.pct}%` }}
          />
        ))}
      </div>

      {/* Reserved height so the row below does not jump as the readout appears. */}
      <div className="mt-4 h-12">
        <AnimatePresence mode="wait">
          {active !== null && segments[active] ? (
            <motion.div
              key={segments[active].label}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast, ease: ENTER }}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`size-2.5 ${
                    segments[active].tone === "signal" ? "bg-signal" : "bg-signal-dim/60"
                  }`}
                />
                <span className="text-base text-ink">{segments[active].label}</span>
              </span>
              <span className="tabular font-mono text-base text-signal">
                {segments[active].amount} XLM
              </span>
              <span className="tabular font-mono text-sm text-ink-faint">
                {segments[active].pct.toFixed(1)}%
              </span>
              <span className="w-full text-sm text-ink-dim sm:w-auto">
                {segments[active].note}
              </span>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast }}
              className="text-sm text-ink-faint"
            >
              Hover a segment to see what it is.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
