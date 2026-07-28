import { MessageSquare } from "lucide-react";

import { Icon } from "@/components/ui/icon";

import { DitherAvatar } from "@/components/dither-kit/avatar";

import { explorerAccount, shortAddress } from "@/lib/contracts";
import { shortDate } from "@/lib/format";
import { getReviews, type Review } from "@/lib/profile";

const TARGET = 8;

/**
 * Tester feedback, and what changed because of it.
 *
 * The `actioned` line on each response is the part that matters. Collecting feedback and doing
 * nothing with it is theatre; a reviewer can tell the difference immediately, and so can the
 * person who bothered to write it.
 */
export const revalidate = 30;

export default async function AdminFeedbackPage() {
  const reviews = await getReviews();

  const total = reviews.length;
  const pct = Math.min(100, (total / TARGET) * 100);
  const deposited = reviews.filter((r) => r.deposited).length;
  const avgRating = total ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
  const positive = reviews.filter((r) => r.rating >= 4).length;

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Feedback</h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        What testers said, and what changed as a result. Responses come from the in-app widget and
        the linked form.
      </p>

      <div className="panel mt-10 p-7 sm:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <span className="label">Responses collected</span>
          <span className="tabular font-mono text-sm text-ink-faint">
            {total} of {TARGET} target
          </span>
        </div>

        <p className="figure mt-4 text-5xl leading-none text-signal">{total}</p>

        <div className="mt-7 h-2 w-full overflow-hidden bg-raised">
          <div
            className="h-full bg-signal transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
              maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
              WebkitMaskSize: "3px 3px",
              maskSize: "3px 3px",
            }}
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-edge pt-7 sm:grid-cols-4">
          <Metric label="Completed a deposit" value={`${deposited} of ${total}`} />
          <Metric label="Avg. rating" value={total ? `${avgRating.toFixed(1)} / 5` : "n/a"} />
          <Metric label="Rated 4 or 5" value={`${positive} of ${total}`} />
          <Metric
            label="Acted on"
            value={`${reviews.filter((r) => r.actioned).length} of ${total}`}
          />
        </div>
      </div>

      {total === 0 ? <EmptyState /> : <Responses rows={reviews} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <p className="tabular mt-2 font-mono text-lg text-ink">{value}</p>
    </div>
  );
}

function Responses({ rows }: { rows: Review[] }) {
  return (
    <div className="mt-10 space-y-px border border-edge bg-edge">
      {rows.map((row) => (
        <article key={row.id} className="bg-void p-7 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-3">
              <DitherAvatar
                name={row.username ? `${row.username}:${row.address.slice(-6)}` : row.address}
                hue={row.hue}
                size={32}
                animate={false}
              />
              <span>
                <a
                  href={explorerAccount(row.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-ink transition-colors hover:text-signal"
                >
                  {row.username ?? shortAddress(row.address, 6, 6)}
                </a>
                {row.username && (
                  <span className="block font-mono text-xs text-ink-faint">
                    {shortAddress(row.address, 4, 4)}
                  </span>
                )}
              </span>
            </span>

            <span className="flex flex-wrap items-center gap-3">
              <Tag label={`${row.rating}/5`} tone={row.rating >= 4 ? "signal" : "default"} />
              {row.deposited ? (
                <Tag label="Deposited" tone="signal" />
              ) : (
                <Tag label="No deposit" />
              )}
              <span className="font-mono text-xs text-ink-faint">{shortDate(row.createdAt)}</span>
            </span>
          </div>

          <p className="mt-6 text-base leading-relaxed whitespace-pre-line text-ink-dim">
            {row.body}
          </p>

          {row.actioned ? (
            <div className="mt-6 border-l-2 border-signal bg-signal/[0.05] py-3 pl-5">
              <span className="label text-signal-dim">Changed as a result</span>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">{row.actioned}</p>
            </div>
          ) : (
            <p className="mt-6 border-l-2 border-edge py-3 pl-5 text-sm text-ink-faint">
              Not yet acted on.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function Tag({ label, tone = "default" }: { label: string; tone?: "default" | "signal" }) {
  return (
    <span
      className={`border px-2 py-1 font-mono text-[0.625rem] tracking-wider uppercase ${
        tone === "signal"
          ? "border-signal-dim/50 text-signal"
          : "border-edge text-ink-faint"
      }`}
    >
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="panel mt-10 flex flex-col items-center px-7 py-16 text-center">
      <Icon icon={MessageSquare} size={28} className="text-ink-faint" strokeWidth={2} />
      <h2 className="mt-6 text-xl font-medium tracking-tight text-ink">No responses yet</h2>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-dim">
        The review button is live on every app screen. Ask testers right after they complete a
        deposit, which is when they actually have an opinion.
      </p>
    </div>
  );
}
