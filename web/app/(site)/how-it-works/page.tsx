import { AlertTriangle, Coins, Lock, Repeat, ShieldCheck, Workflow } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DitherIcon } from "@/components/site/dither-icon";
import { Glyph } from "@/components/site/glyph";
import { PageHero } from "@/components/site/page-hero";
import { BLEND_POOL_ID, SHARE_TOKEN_ID, VAULT_ID, explorerContract, shortAddress } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "How it works · Nebula",
  description:
    "The mechanism in plain language: what nXLM is, how the share price moves, where the yield comes from, and what the protocol can and cannot do.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="The whole mechanism, in plain language."
        lede="No prior DeFi knowledge assumed. If you know what a bank account is, this will make sense."
      />

      <Prose />
      <Guarantees />
      <Risks />
      <Addresses />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────── prose */

function Prose() {
  return (
    <section className="relative overflow-hidden border-b border-edge">
      <Glyph
        char="§"
        rotate={-10}
        opacity={0.04}
        className="top-20 -right-10 text-[20rem] lg:text-[26rem]"
      />
      <div className="relative mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl space-y-16">
          <Block
            n="01"
            icon={Coins}
            title="You deposit XLM and get nXLM"
            body={
              <>
                <p>
                  Every deposit goes into one shared pot. In return you receive nXLM, which is your
                  claim on a slice of that pot. If you put in a hundredth of the vault, you hold a
                  hundredth of the nXLM.
                </p>
                <p>
                  The quantity you receive is fixed at that moment and never changes again. No
                  rebasing, no airdrops into your wallet, no balance that creeps upward while you
                  sleep.
                </p>
              </>
            }
          />

          <Block
            n="02"
            icon={Workflow}
            title="The vault lends it out"
            body={
              <>
                <p>
                  Roughly ninety percent of the pot is supplied to{" "}
                  <a
                    href="https://www.blend.capital"
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal underline-offset-4 hover:underline"
                  >
                    Blend
                  </a>
                  , a lending market on Stellar. Borrowers put up collateral, take XLM, and pay
                  interest for the privilege. That interest is the entire source of your yield.
                </p>
                <p>
                  The other ten percent stays idle in the vault on purpose, so ordinary withdrawals
                  do not have to unwind a lending position to pay you.
                </p>
                <p>
                  Nebula supplies without using the position as collateral, and never borrows. That
                  means the position carries no health factor and cannot be liquidated. It is the
                  boring end of lending, deliberately.
                </p>
              </>
            }
          />

          <Block
            n="03"
            icon={Repeat}
            title="A keeper harvests the interest"
            body={
              <>
                <p>
                  On a schedule, an automated keeper collects the interest Blend owes and puts it
                  back into the vault. The pot grows. The number of nXLM in existence does not.
                </p>
                <p>
                  So each nXLM is now a claim on slightly more XLM than before. That is the share
                  price rising, and it is the only thing that ever moves it upward.
                </p>
                <p className="text-ink">
                  You do not claim anything, compound anything, or press any button. It happens
                  whether or not you are watching.
                </p>
              </>
            }
          />

          <Block
            n="04"
            icon={Lock}
            title="You redeem whenever you like"
            body={
              <>
                <p>
                  Hand back your nXLM and the vault burns it, then pays you your slice of the pot at
                  the current share price. Because the pot grew and your slice did not shrink, you
                  get back more XLM than you put in.
                </p>
                <p>
                  Redeeming does not move the price for anyone else. It removes XLM and nXLM in
                  exactly the same proportion, so the ratio is untouched. That is a deliberate
                  property: if withdrawing nudged the price, someone could loop deposits and
                  withdrawals to milk the difference.
                </p>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Block({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ComponentProps<typeof DitherIcon>["icon"];
  title: string;
  body: React.ReactNode;
}) {
  return (
    <article>
      <div className="flex items-start gap-6">
        <DitherIcon icon={icon} size={64} />
        <div className="pt-1">
          <span className="tabular font-mono text-sm text-signal-dim">{n}</span>
          <h2 className="mt-3 text-2xl font-medium tracking-tight text-ink sm:text-3xl">{title}</h2>
        </div>
      </div>
      <div className="mt-7 space-y-5 text-lg leading-relaxed text-ink-dim">{body}</div>
    </article>
  );
}

/* ───────────────────────────────────────────────────────── guarantees */

const GUARANTEES = [
  {
    title: "Withdrawals can never be paused",
    body: "Deposits can be halted by the admin. Getting your money out cannot be, by construction. A vault that can trap funds is a custodian.",
  },
  {
    title: "Nobody can mint nXLM but the vault",
    body: "The share token's minter is fixed at deployment and cannot be rotated. There is no admin key anywhere that can print unbacked shares.",
  },
  {
    title: "Admin cannot touch user funds",
    body: "It can register strategies and set the fee and reserve target. It cannot move deposits, mint, or block redemptions.",
  },
  {
    title: "The keeper cannot steal",
    body: "It only moves money between the vault and already-registered strategies. That is why it is safe to run unattended.",
  },
  {
    title: "Every XLM is accounted for",
    body: "The vault holds one invariant at all times: total assets equals the idle reserve plus everything deployed to strategies. It is asserted after every operation.",
  },
  {
    title: "Fees come out of yield only",
    body: "Ten percent of what the vault earns. If it earns nothing, it charges nothing. Your principal is never touched.",
  },
];

function Guarantees() {
  return (
    <section className="border-b border-edge">
      <div className="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-28">
        <div className="mb-14 flex items-center gap-4">
          <span className="label whitespace-nowrap">What the protocol guarantees</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-px border border-edge bg-edge md:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((item) => (
            <div key={item.title} className="bg-void p-8">
              <DitherIcon icon={ShieldCheck} size={40} />
              <h3 className="mt-6 text-lg font-medium tracking-tight text-ink">{item.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-ink-dim">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────── risks */

const RISKS = [
  {
    title: "Smart contract risk",
    body: "Nebula's contracts could contain a bug. They are open source, covered by 57 tests including the known attack classes, and deposits are capped during beta. That reduces the risk. It does not remove it.",
  },
  {
    title: "Blend could fail",
    body: "Your XLM sits in someone else's lending market. If Blend has a bug or takes bad debt, Nebula is exposed to it. Each strategy has a hard ceiling so no single venue can take the whole vault.",
  },
  {
    title: "Liquidity risk",
    body: "A lending pool that is fully borrowed out cannot be exited until borrowers repay. A large redemption can fail in that window. The app shows what is genuinely redeemable right now, not just what you own.",
  },
  {
    title: "Yield can go to zero",
    body: "Interest depends on people wanting to borrow. If borrowing demand dries up, the share price stops rising. It will not fall, but it will sit still.",
  },
];

function Risks() {
  return (
    <section className="relative overflow-hidden border-b border-edge">
      <div className="relative mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-28">
        <div className="mb-14 flex items-center gap-4">
          <span className="label whitespace-nowrap">What can go wrong</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <DitherIcon icon={AlertTriangle} size={72} />
            <p className="mt-8 text-lg leading-relaxed text-ink-dim">
              Nebula is on testnet, where nothing is real money. When it is not, these are the
              things that could cost you.
            </p>
          </div>

          <div className="space-y-px border border-edge bg-edge">
            {RISKS.map((risk) => (
              <div key={risk.title} className="bg-void p-8">
                <h3 className="text-lg font-medium tracking-tight text-ink">{risk.title}</h3>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-dim">{risk.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── addresses */

const CONTRACTS = [
  { label: "Vault", id: VAULT_ID },
  { label: "nXLM share token", id: SHARE_TOKEN_ID },
  { label: "Blend pool (upstream)", id: BLEND_POOL_ID },
];

function Addresses() {
  return (
    <section>
      <div className="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-28">
        <div className="mb-14 flex items-center gap-4">
          <span className="label whitespace-nowrap">Verify it yourself</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        <div className="max-w-4xl space-y-px border border-edge bg-edge">
          {CONTRACTS.map((contract) => (
            <a
              key={contract.id}
              href={explorerContract(contract.id)}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-2 bg-void px-6 py-6 transition-colors hover:bg-raised sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="label">{contract.label}</span>
              <span className="font-mono text-sm text-ink-dim">
                {shortAddress(contract.id, 8, 8)}
              </span>
            </a>
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-base leading-relaxed text-ink-dim">
          Every deposit, harvest and withdrawal is a public transaction on Stellar testnet. Nothing
          about how the vault behaves has to be taken on trust.{" "}
          <Link href="/stats" className="text-signal underline-offset-4 hover:underline">
            See the live numbers
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
