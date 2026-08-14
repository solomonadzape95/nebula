import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { SurveyForm } from "@/components/site/survey-form";
import { currentAddress } from "@/lib/session";
import { hasResponded } from "@/lib/survey";

export const metadata: Metadata = {
  title: "Feedback · Nebula",
  description:
    "Tell us what worked, what broke, and what would have to be true before you used Nebula with real money.",
};

/**
 * Dynamic: the form's state depends on who is connected — whether they have already responded, and
 * whether there is a signed session at all. There is nothing here worth caching for a stranger.
 */
export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const address = await currentAddress();
  const responded = address ? await hasResponded(address) : false;

  return (
    <>
      <PageHero
        eyebrow="Feedback"
        title="Tell us what broke."
        lede="Two minutes. The unflattering answers are the ones worth having — a tester who got stuck tells us more than ten who did not."
      />

      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="mb-12 space-y-4 text-base leading-relaxed text-ink-dim">
          <p>
            Nebula is on testnet, unaudited, and holds nothing of value. Nobody is risking money
            here, which is exactly why honest answers are cheap to give and worth a great deal.
          </p>
          <p>
            Your answers are matched to your on-chain activity automatically, so there is no address
            to paste and no question about what you actually did — the ledger already says. What it
            cannot say is who you are, what you wanted, or where you got stuck. That is what this is
            for.
          </p>
        </div>

        <SurveyForm alreadyResponded={responded} />
      </section>
    </>
  );
}
