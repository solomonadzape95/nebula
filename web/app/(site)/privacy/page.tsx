import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = {
  title: "Privacy · Nebula",
  description: "What Nebula collects, which is almost nothing.",
};

const SECTIONS = [
  {
    h: "We have no account for you",
    p: [
      "Nebula has no sign-up, no email field, and no password. There is no user record anywhere because there is no server holding one. Connecting a wallet does not create an account; it grants this browser tab permission to ask your wallet to sign things.",
    ],
  },
  {
    h: "What the blockchain sees",
    p: [
      "Every deposit and withdrawal is a public transaction on Stellar, permanently and by design. Your address, amounts, and timing are visible to anyone, through this site or any block explorer. Nebula does not make that data public: the chain does, and nothing can make it private after the fact.",
      "Treat a wallet address as pseudonymous rather than anonymous. If an address is linked to you elsewhere, its Nebula activity is linked to you too.",
    ],
  },
  {
    h: "Analytics",
    p: [
      "We measure page views and how far people get through the deposit flow, so we can tell where the interface loses them. That data is aggregated, and it is not connected to your wallet address.",
      "Deposit and withdrawal amounts are recorded as size bands rather than exact figures, because an exact amount and a timestamp would point at one specific transaction on a public ledger.",
      "This uses PostHog, served from our own domain rather than theirs. It stores an anonymous identifier in your browser to tell one visit from the next. Clearing site data clears it, and disconnecting a wallet issues a new one.",
      "Errors are recorded so that broken states get fixed. Error reports include what the interface was doing, not who was doing it.",
    ],
  },
  {
    h: "Feedback",
    p: [
      "If you submit feedback, we keep what you wrote. If you choose to include your wallet address, we keep that alongside it so we can follow up. Both are used to improve the product and, in aggregate, to show that real people tested it.",
    ],
  },
  {
    h: "What we never do",
    p: [
      "We do not sell data, run advertising trackers, ask for personal information, or attempt to identify who is behind an address.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy"
        lede="There is very little to say here, because Nebula collects almost nothing. The blockchain, on the other hand, remembers everything."
      />

      <section className="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-3xl space-y-14">
          {SECTIONS.map((section) => (
            <article key={section.h}>
              <h2 className="text-2xl font-medium tracking-tight text-ink">{section.h}</h2>
              <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink-dim">
                {section.p.map((para) => (
                  <p key={para.slice(0, 32)}>{para}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
