import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = {
  title: "Terms · Nebula",
  description: "Terms of use for the Nebula testnet vault.",
};

const SECTIONS = [
  {
    h: "This is testnet software",
    p: [
      "Nebula runs on the Stellar test network. The XLM you deposit is free, issued by a public faucet, and has no monetary value. Nothing here is an investment, a financial product, or an offer of one.",
      "Testnet is periodically reset by the network operators. If that happens, balances and history disappear. That is expected and is not a failure of the protocol.",
    ],
  },
  {
    h: "No custody, no accounts",
    p: [
      "Nebula holds no keys and operates no accounts. Your wallet signs every transaction, and nobody involved in this project can move, freeze, or recover your funds.",
      "That also means there is no password reset. If you lose access to your wallet, the position is gone. This is a property of self-custody, not a fault in the software.",
    ],
  },
  {
    h: "Software provided as-is",
    p: [
      "The contracts are open source and provided without warranty of any kind. They have not been audited by a third party. They may contain bugs that cause partial or total loss of deposited funds.",
      "By using Nebula you accept that risk in full. See the risk section in the documentation for the specific failure modes we know about.",
    ],
  },
  {
    h: "Third-party protocols",
    p: [
      "Deposits are supplied to Blend, a lending market Nebula does not control or maintain. A failure there can affect funds Nebula has deployed. Nebula caps exposure per venue but cannot eliminate the dependency.",
    ],
  },
  {
    h: "Fees",
    p: [
      "Nebula takes ten percent of harvested yield. It never charges a fee on deposits, withdrawals, or principal. If the vault earns nothing, it charges nothing. The fee is set on-chain and any change is a public transaction.",
    ],
  },
  {
    h: "Availability",
    p: [
      "This interface may go offline at any time. The contracts remain on-chain and can be called directly, so your ability to withdraw does not depend on this website existing.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of use"
        lede="Short, because there is not much to agree to. Nebula is testnet software that holds none of your keys."
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

          <p className="border-t border-edge pt-8 text-base text-ink-faint">
            Questions about any of this belong in the{" "}
            <Link href="/faq" className="text-signal underline-offset-4 hover:underline">
              FAQ
            </Link>
            , which is written in the same plain language.
          </p>
        </div>
      </section>
    </>
  );
}
