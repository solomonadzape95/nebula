interface StatProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "signal";
}

export function Stat({ label, value, unit, hint, tone = "default" }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <span
        className={`tabular font-mono text-2xl leading-none sm:text-[1.75rem] ${
          tone === "signal" ? "text-signal" : "text-ink"
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-sm text-ink-faint">{unit}</span>}
      </span>
      {hint && <span className="font-mono text-[0.6875rem] text-ink-faint">{hint}</span>}
    </div>
  );
}
