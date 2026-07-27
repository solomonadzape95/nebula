"use client";

import { useEffect, useState } from "react";

import { ImageField } from "@/components/shader/image-field";

const HOLDING = 100;
const START_PRICE = 1;
/** Fast enough to see in a few seconds, slow enough not to look like a slot machine. */
const RATE_PER_TICK = 0.000_08;
const TICK_MS = 90;

/**
 * The concept, demonstrated rather than described.
 *
 * Reading "your balance stays fixed while the price rises" convinces nobody. Watching one number
 * sit perfectly still for thirty seconds while the two beside it climb does the job in about four.
 * The nXLM row is deliberately the boring one — that is the point being made.
 */
export function NxlmDemo() {
  // One counter drives everything. Deriving price and elapsed time from ticks rather than reading
  // a clock keeps render pure — and keeps the server and client markup identical, which a
  // `Date.now()` read during render would not.
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTicks((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const price = START_PRICE + ticks * RATE_PER_TICK;
  const worth = HOLDING * price;
  const gain = worth - HOLDING * START_PRICE;
  const elapsed = Math.floor((ticks * TICK_MS) / 1000);

  return (
    <div className="panel relative overflow-hidden">
      {/* Real telescope imagery, reduced to the same dots as everything else. */}
      <ImageField
        source="nebula"
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        pxSize={3}
        colorSteps={3}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(7,8,10,0.35) 0%, rgba(7,8,10,0.9) 65%, var(--color-void) 100%)",
        }}
      />

      <div className="relative p-7 sm:p-9">
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

        <div className="mt-8 space-y-6">
          <DemoRow
            label="Your nXLM"
            value={HOLDING.toFixed(7)}
            note="never changes"
            frozen
          />
          <DemoRow label="Price per nXLM" value={price.toFixed(7)} note="XLM" />
          <DemoRow label="What it's worth" value={worth.toFixed(7)} note="XLM" signal />
        </div>

        <div className="mt-8 flex items-baseline justify-between border-t border-edge pt-5">
          <span className="label">Earned in {elapsed}s</span>
          <span className="tabular font-mono text-sm text-signal">+{gain.toFixed(7)} XLM</span>
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
}: {
  label: string;
  value: string;
  note?: string;
  signal?: boolean;
  frozen?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`text-sm ${frozen ? "text-ink" : "text-ink-dim"}`}>{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={`tabular font-mono text-lg sm:text-xl ${
            signal ? "text-signal" : frozen ? "text-ink" : "text-ink-dim"
          }`}
        >
          {value}
        </span>
        {note && (
          <span
            className={`font-mono text-[0.625rem] tracking-wider uppercase ${
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
