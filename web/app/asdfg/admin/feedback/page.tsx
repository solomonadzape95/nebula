import { MessageSquare } from "lucide-react";

import { Icon } from "@/components/ui/icon";

import { DitherAvatar } from "@/components/dither-kit/avatar";

import { explorerAccount, shortAddress } from "@/lib/contracts";
import { shortDate } from "@/lib/format";
import { getReviews, type Review } from "@/lib/profile";
import { getSurveyResponses, type SurveyResponse } from "@/lib/survey";

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
  const [reviews, survey] = await Promise.all([getReviews(), getSurveyResponses()]);

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

        <p className="figure mt-4 text-6xl leading-none text-signal">{total}</p>

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

      <SurveySection rows={survey} />

      <h2 className="mt-20 text-2xl font-medium tracking-tight text-ink">In-app reviews</h2>
      {total === 0 ? <EmptyState /> : <Responses rows={reviews} />}
    </div>
  );
}

/**
 * The structured survey, summarized the way it should be reported.
 *
 * The headline is deliberately **corroborated**, not the raw count. A response total is a claim
 * about how many forms were filled in; the corroborated count is how many of those addresses
 * actually deposited into the live vault, read from the chain rather than from the form. That is
 * the number a reviewer should be given, because it is the one nobody here can inflate.
 */
function SurveySection({ rows }: { rows: SurveyResponse[] }) {
  const total = rows.length;
  const corroborated = rows.filter((r) => r.corroborated).length;
  const stuck = rows.filter((r) => r.stuckWhere && r.stuckWhere !== "I didn't get stuck").length;
  const avgClarity = total ? rows.reduce((sum, r) => sum + r.clarity, 0) / total : 0;
  const wouldDeposit = rows.filter(
    (r) => r.mainnetSize && r.mainnetSize !== "Nothing",
  ).length;

  return (
    <>
      <h2 className="mt-20 text-2xl font-medium tracking-tight text-ink">Survey responses</h2>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        From <span className="font-mono text-ink">/feedback</span>. Every row is joined to the
        on-chain deposit record automatically, so a claimed deposit that never happened shows up as
        “Not corroborated”.
      </p>

      {total === 0 ? (
        <div className="panel mt-8 px-7 py-14 text-center">
          <p className="text-base text-ink-dim">
            No survey responses yet. Send testers to{" "}
            <span className="font-mono text-ink">/feedback</span> right after they deposit.
          </p>
        </div>
      ) : (
        <>
          <div className="panel mt-8 grid grid-cols-2 gap-6 p-7 sm:grid-cols-5 sm:p-9">
            <Metric label="Responses" value={String(total)} />
            <Metric label="Corroborated on-chain" value={`${corroborated} of ${total}`} />
            <Metric label="Got stuck" value={`${stuck} of ${total}`} />
            <Metric label="Avg. clarity" value={`${avgClarity.toFixed(1)} / 5`} />
            <Metric label="Would deposit real XLM" value={`${wouldDeposit} of ${total}`} />
          </div>

          <div className="mt-6 space-y-px border border-edge bg-edge">
            {rows.map((row) => (
              <article key={row.id} className="bg-void p-7 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span>
                    <a
                      href={explorerAccount(row.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-ink transition-colors hover:text-signal"
                    >
                      {row.handle}
                    </a>
                    <span className="block font-mono text-xs text-ink-faint">
                      {shortAddress(row.address, 6, 6)}
                      {row.country ? ` · ${row.country}` : ""}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center gap-3">
                    <Tag
                      label={row.corroborated ? "Corroborated" : "Not corroborated"}
                      tone={row.corroborated ? "signal" : "default"}
                    />
                    <Tag label={`Clarity ${row.clarity}/5`} />
                    <Tag label={row.wallet} />
                    <span className="font-mono text-xs text-ink-faint">
                      {shortDate(row.createdAt)}
                    </span>
                  </span>
                </div>

                <dl className="mt-6 space-y-5">
                  <Answer q="Before real money" a={row.requirements} />
                  <Answer q="Confusing, broken or missing" a={row.issues} />
                </dl>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-edge pt-5">
                  <Tag label={row.background} />
                  <Tag label={row.usedYield} />
                  {row.mainnetSize ? <Tag label={`Mainnet: ${row.mainnetSize}`} /> : null}
                  {row.stuckWhere && row.stuckWhere !== "I didn't get stuck" ? (
                    <Tag label={`Stuck: ${row.stuckWhere}`} />
                  ) : null}
                </div>

                <p className="mt-4 font-mono text-xs text-ink-faint">
                  {row.contact} · {row.consent}
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
        </>
      )}
    </>
  );
}

function Answer({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="label">{q}</dt>
      <dd className="mt-1.5 text-base leading-relaxed whitespace-pre-line text-ink-dim">{a}</dd>
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
