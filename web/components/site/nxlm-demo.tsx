"use client";

import { useEffect, useState } from "react";

import { ImageField } from "@/components/shader/image-field";
import { DitherProgress } from "@/components/ui/dither-loader";

const DEPOSIT = 100;
const START_PRICE = 1;
/** Fast enough to see in a few seconds, slow enough not to look like a slot machine. */
const RATE_PER_TICK = 0.000_06;
const TICK_MS = 90;
/** One full cycle, then it starts over so a returning eye always catches it moving. */
const CYCLE_TICKS = 340;

/**
 * The concept, demonstrated rather than described.
 *
 * Reading "your balance stays fixed while the price rises" convinces nobody. Watching one number
 * sit perfectly still while the two beside it climb does the job in about four seconds. The nXLM
 * row is deliberately the boring one, because that is the point being made.
 *
 * Precision is per row rather than uniform: a price needs six decimals to visibly move, a balance
 * needs four, and money needs two. Printing everything to seven places was noise pretending to be
 * rigour.
 */
export function NxlmDemo() {
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    // One counter drives everything. Deriving price and elapsed time from ticks keeps render pure
    // and keeps server and client markup identical, which reading a clock would not.
    const id = setInterval(() => setTicks((t) => (t + 1) % CYCLE_TICKS), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const price = START_PRICE + ticks * RATE_PER_TICK;
  const worth = DEPOSIT * price;
  const earned = worth - DEPOSIT;
  const elapsed = (ticks * TICK_MS) / 1000;

  return (
    <div className="panel relative overflow-hidden">
      {/* Real telescope imagery, reduced to the same dots as everything else. */}
      <ImageField
        source="nebula"
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        pxSize={3}
        colorSteps={3}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(7,8,10,0.4) 0%, rgba(7,8,10,0.9) 60%, var(--color-void) 100%)",
        }}
      />

      <div className="relative p-8 sm:p-10 lg:p-12">
        <div className="flex items-center justify-between gap-4">
          <span className="label">Live demonstration</span>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-signal"
          >
            {running ? "Pause" : "Resume"}
          </button>
        </div>

        {/* What went in. Fixed, and visually quieter than everything below it. */}
        <div className="mt-9 flex items-baseline justify-between gap-4 border-b border-edge pb-6">
          <span className="text-base text-ink-dim">You deposited</span>
          <span className="tabular font-mono text-xl text-ink-dim sm:text-2xl">
            {DEPOSIT.toFixed(2)} <span className="text-sm text-ink-faint">XLM</span>
          </span>
        </div>

        <div className="mt-8 space-y-7">
          <DemoRow label="Your nXLM" value={DEPOSIT.toFixed(4)} note="never changes" frozen />
          <DemoRow label="Price per nXLM" value={price.toFixed(6)} note="XLM" />
          <DemoRow label="What it's worth" value={worth.toFixed(4)} note="XLM" signal large />
        </div>

        <div className="mt-10 border-t border-edge pt-7">
          <div className="flex items-baseline justify-between gap-4">
            <span className="label">Earned in {elapsed.toFixed(1)}s</span>
            <span className="tabular font-mono text-xl text-signal sm:text-2xl">
              +{earned.toFixed(4)} XLM
            </span>
          </div>
          <DitherProgress value={ticks / CYCLE_TICKS} className="mt-5" />
        </div>
      </div>
    </div>
  );
}

function DemoRow({
  label,
  value,
  note,
  signal,
  frozen,
  large,
}: {
  label: string;
  value: string;
  note?: string;
  signal?: boolean;
  frozen?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`text-base ${frozen ? "text-ink" : "text-ink-dim"}`}>{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={`tabular font-mono ${large ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} ${
            signal ? "text-signal" : frozen ? "text-ink" : "text-ink-dim"
          }`}
        >
          {value}
        </span>
        {note && (
          <span
            className={`font-mono text-[0.6875rem] tracking-wider uppercase ${
              frozen ? "text-signal-dim" : "text-ink-faint"
            }`}
          >
            {note}
          </span>
        )}
      </span>
    </div>
  );
}
