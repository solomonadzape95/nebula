import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/site/faq-list";
import { PageHero } from "@/components/site/page-hero";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ · Nebula",
  description:
    "What nXLM is, where the yield comes from, what the fees are, and what can go wrong.",
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="Questions"
        title="Everything worth asking before you deposit."
        lede="Including the answers that are not flattering. A yield product that dodges the risk question is not one you should use."
      />

      <section className="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-4xl">
          <FaqList items={FAQ} />
        </div>

        <div className="panel mt-20 max-w-4xl p-8 sm:p-10">
          <h2 className="text-2xl font-medium tracking-tight text-ink">Still unclear?</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-dim">
            The contracts are open source and the whole mechanism is written up in plain language.
            If something here does not add up, the code is the final answer.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/how-it-works" className="btn btn-ghost w-full sm:w-auto">
              Read how it works
            </Link>
            <Link href="/stats" className="btn btn-ghost w-full sm:w-auto">
              See the live numbers
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
