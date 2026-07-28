interface StatProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "signal";
}

export function Stat({ label, value, unit, hint, tone = "default" }: StatProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label">{label}</span>
      {/* Long values like a seven-decimal share price have to survive a 320px column, so the size
          steps down at the narrow end rather than wrapping mid-number. The steps go up together,
          keeping that relationship: the smallest breakpoint stays the one doing the protecting. */}
      <span
        className={`figure text-[2rem] leading-none sm:text-4xl lg:text-[2.75rem] ${
          tone === "signal" ? "text-signal" : "text-ink"
        }`}
      >
        {value}
        {unit && <span className="ml-1.5 text-sm text-ink-faint">{unit}</span>}
      </span>
      {hint && <span className="font-mono text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}
