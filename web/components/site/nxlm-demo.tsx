"use client";

import { useEffect, useState } from "react";

import { ImageField } from "@/components/shader/image-field";
import { DitherProgress } from "@/components/ui/dither-loader";
import { RollingNumber } from "@/components/ui/rolling-number";

const DEFAULT_DEPOSIT = 100;
const MAX_DEPOSIT = 1_000_000;
const START_PRICE = 1;
/** Paced for the digit roll: fast enough to watch, slow enough that each change lands. */
const RATE_PER_TICK = 0.000_28;
const TICK_MS = 420;
/** One full cycle, then it starts over so a returning eye always catches it moving. */
const CYCLE_TICKS = 72;

/**
 * The concept, demonstrated rather than described.
 *
 * Reading "your balance stays fixed while the price rises" convinces nobody. Watching one number
 * sit perfectly still while the two beside it climb does the job in about four seconds. The nXLM
 * row is deliberately the boring one, because that is the point being made.
 *
 * The deposit is editable so the visitor can type their own number in. Seeing the yield on an
 * amount you actually hold is a different thing from seeing it on a stranger's round hundred.
 *
 * Precision is per row rather than uniform: a price needs six decimals to visibly move, money
 * needs four, and the two amounts the visitor chose are whole numbers because that is how they
 * think about them.
 */
export function NxlmDemo() {
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);

  useEffect(() => {
    if (!running) return;
    // One counter drives everything. Deriving price and elapsed time from ticks keeps render pure
    // and keeps server and client markup identical, which reading a clock would not.
    const id = setInterval(() => setTicks((t) => (t + 1) % CYCLE_TICKS), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const price = START_PRICE + ticks * RATE_PER_TICK;
  const worth = deposit * price;
  const earned = worth - deposit;
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

        <div className="mt-9 flex items-baseline justify-between gap-4 border-b border-edge pb-6">
          <label htmlFor="demo-deposit" className="text-base text-ink-dim">
            You deposited
          </label>
          <span className="flex items-baseline gap-2">
            <DepositInput value={deposit} onChange={setDeposit} />
            <span className="font-mono text-sm text-ink-faint">XLM</span>
          </span>
        </div>

        <div className="mt-8 space-y-7">
          <DemoRow label="Your nXLM" value={formatWhole(deposit)} note="never changes" frozen />
          <DemoRow label="Price per nXLM" value={price.toFixed(6)} note="XLM" />
          <DemoRow label="What it's worth" value={formatMoney(worth)} note="XLM" signal large />
        </div>

        <div className="mt-10 border-t border-edge pt-7">
          <div className="flex items-baseline justify-between gap-4">
            <span className="label">Earned in {elapsed.toFixed(1)}s</span>
            <span className="tabular font-mono text-xl text-signal sm:text-2xl">
              +<RollingNumber value={formatMoney(earned)} /> XLM
            </span>
          </div>
          <DitherProgress value={ticks / CYCLE_TICKS} className="mt-5" />
        </div>
      </div>
    </div>
  );
}

const formatWhole = (n: number) => n.toLocaleString("en-US");
const formatMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/**
 * Sized to its own content so the number stays visually anchored to the right edge like every
 * other figure in the panel, instead of sitting in a fixed box that looks like a form.
 */
function DepositInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  const commit = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "").slice(0, 7);
    const next = Math.min(Number(digits) || 0, MAX_DEPOSIT);
    setDraft(digits);
    if (next > 0) onChange(next);
  };

  return (
    <input
      id="demo-deposit"
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => commit(e.target.value)}
      // An empty or zero field is a state you can type through, not one to leave the panel in.
      onBlur={() => {
        const next = Number(draft) || DEFAULT_DEPOSIT;
        setDraft(String(next));
        onChange(next);
      }}
      aria-label="Deposit amount in XLM"
      className="tabular w-[6ch] border-b border-edge bg-transparent text-right font-mono text-xl text-ink-dim transition-colors outline-none hover:border-ink-faint focus:border-signal focus:text-ink sm:text-2xl"
    />
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
          <RollingNumber value={value} />
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
