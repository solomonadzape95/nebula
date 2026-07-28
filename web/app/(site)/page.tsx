import { ArrowDownToLine, Coins, Repeat } from "lucide-react";
import Link from "next/link";

import { DitherField } from "@/components/shader/dither-field";
import { DitherIcon } from "@/components/site/dither-icon";
import { DitherText } from "@/components/site/dither-text";
import { FaqList } from "@/components/site/faq-list";
import { Glyph } from "@/components/site/glyph";
import { LiveBadge } from "@/components/site/live-badge";
import { NxlmDemo } from "@/components/site/nxlm-demo";
import { Stat } from "@/components/site/stat";
import { YieldChart } from "@/components/site/yield-chart";
import { FEATURED_FAQ } from "@/lib/faq";

/**
 * Placeholder figures.
 *
 * These are the real values read off the testnet vault at the time of writing, so the layout is
 * designed against realistic magnitudes rather than lorem-ipsum numbers. They are NOT live yet.
 * Wiring them to the contract and the indexer is the next step.
 */
const PLACEHOLDER = {
  tvl: "130.00",
  sharePrice: "1.0001421",
  depositors: "2",
  apy: null as string | null,
};

export default function Home() {
  return (
    <>
      <Hero />
      <StatBand />
      <Problem />
      <HowItWorks />
      <NxlmExplainer />
      <YieldSource />
      <Faq />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────── hero */

function Hero() {
  return (
    <section className="scanlines relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      {/* Folding spacetime. Bleeds off all four edges so it reads as a window, not a panel. */}
      <DitherField
        variant="warp"
        className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[165vmax] -translate-x-1/2 -translate-y-1/2"
      />

      {/* Flat wash over the whole field. The vignette below shapes contrast in the centre; this
          just takes the overall brightness down a step so the shader sits behind the type rather
          than competing with it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-void/25" />

      {/* Vignette pulls the centre dark so type stays legible over the brightest part. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 64% 50% at 50% 50%, rgba(7,8,10,0.9) 0%, rgba(7,8,10,0.55) 45%, transparent 78%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-void to-transparent"
      />

      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-24 pb-16 text-center sm:px-8">
        <LiveBadge />

        <h1 className="text-display mt-10 text-balance text-ink">
          Earn on your XLM.
          <br />
          Keep it liquid.
        </h1>

        <p className="mx-auto mt-9 max-w-2xl text-lg leading-relaxed text-ink-dim text-pretty sm:text-xl lg:text-[1.375rem]">
          Deposit XLM and receive <span className="text-ink">nXLM</span>. It grows in value every
          day, and stays tradeable and spendable the whole time.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/app" className="btn btn-primary w-full sm:w-auto">
            Launch app
          </Link>
          <a href="#how" className="btn btn-ghost w-full sm:w-auto">
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────── stat band */

function StatBand() {
  return (
    <section className="relative z-10 border-y border-edge bg-void">
      <div className="mx-auto grid max-w-app grid-cols-2 gap-x-8 gap-y-10 px-5 py-12 sm:px-8 lg:grid-cols-4">
        <Stat label="Total value locked" value={PLACEHOLDER.tvl} unit="XLM" />
        <Stat
          label="Share price"
          value={PLACEHOLDER.sharePrice}
          unit="XLM"
          tone="signal"
          hint="only goes up"
        />
        <Stat label="Depositors" value={PLACEHOLDER.depositors} />
        <Stat
          label="Realized APY"
          value={PLACEHOLDER.apy ?? "n/a"}
          hint={PLACEHOLDER.apy ? undefined : "not enough history yet"}
        />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────── problem */

function Problem() {
  return (
    <Section>
      <Glyph
        char="?"
        rotate={-14}
        opacity={0.055}
        className="top-1/2 -right-6 -translate-y-1/2 text-[24rem] lg:text-[32rem]"
      />
      <p className="text-statement relative mx-auto max-w-4xl text-balance text-ink">
        Your XLM sits in a wallet <DitherText>earning nothing</DitherText>. Real yield exists on
        Stellar, but reaching it means running lending positions by hand.{" "}
        <span className="text-ink-faint">Almost nobody does.</span>
      </p>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────── how it works */

const STEPS = [
  {
    n: "01",
    icon: ArrowDownToLine,
    title: "Deposit XLM",
    body: "You get nXLM back. Think of it as your receipt. Its quantity never changes again.",
  },
  {
    n: "02",
    icon: Coins,
    title: "It goes to work",
    body: "Nebula supplies your XLM to Blend, a lending market on Stellar. Borrowers pay interest on it.",
  },
  {
    n: "03",
    icon: Repeat,
    title: "Cash out whenever",
    body: "Your nXLM is worth more XLM than when you got it. Or just hold. It keeps earning either way.",
  },
];

function HowItWorks() {
  return (
    <Section id="how" label="How it works">
      <Glyph
        char="↗"
        rotate={8}
        opacity={0.045}
        className="-top-20 -left-12 text-[22rem] lg:text-[28rem]"
      />
      <div className="relative grid gap-px overflow-hidden border border-edge bg-edge md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="flex flex-col bg-void p-9 lg:p-12">
            <div className="flex items-start justify-between">
              <DitherIcon icon={step.icon} />
              <span className="tabular font-mono text-sm text-signal-dim">{step.n}</span>
            </div>
            <h3 className="mt-10 text-2xl font-medium tracking-tight sm:text-[1.75rem]">
              {step.title}
            </h3>
            <p className="mt-4 text-lg leading-relaxed text-ink-dim">{step.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────── nXLM explainer */

function NxlmExplainer() {
  return (
    <Section id="nxlm" label="The part everyone asks about">
      <Glyph
        char="="
        rotate={-9}
        opacity={0.05}
        className="-bottom-28 -left-10 text-[20rem] lg:text-[26rem]"
      />
      <div className="relative grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <h2 className="text-headline text-balance text-ink">Think of it like gold.</h2>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink-dim lg:text-xl">
            <p>
              You own 10 grams. A year later you still own{" "}
              <span className="text-ink">10 grams</span>. The number never changes. It is simply
              worth more.
            </p>
            <p>
              nXLM works the same way. Your balance is <DitherText>frozen</DitherText> the moment
              you receive it. What rises is the price.
            </p>
            <p>
              That is what keeps it{" "}
              <span className="text-ink">spendable everywhere else on Stellar</span>. It behaves
              like an ordinary token, because it is one.
            </p>
          </div>
        </div>

        <NxlmDemo />
      </div>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────── yield source */

function YieldSource() {
  return (
    <Section id="yield" label="Where the yield comes from">
      <Glyph
        char="%"
        rotate={11}
        opacity={0.045}
        className="-top-24 right-0 text-[20rem] lg:text-[26rem]"
      />
      <div className="relative grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div>
          <h2 className="text-headline text-balance text-ink">
            Real interest, from real borrowers.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-ink-dim lg:text-xl">
            Nebula supplies your XLM to <span className="text-ink">Blend</span>, a lending market on
            Stellar. People borrow against collateral and pay to do it. That interest is your yield:{" "}
            <DitherText>not emissions</DitherText>, not inflation, not a subsidy.
          </p>

          <div className="mt-12 space-y-px border border-edge bg-edge">
            <Fact k="Source" v="Blend lending interest" />
            <Fact k="Protocol fee" v="10% of yield, never of your deposit" />
            <Fact k="Withdrawals" v="Can never be paused" />
            <Fact k="Stellar staking" v="Does not exist. SCP is not proof-of-stake." />
          </div>
        </div>

        <YieldChart />
      </div>
    </Section>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1.5 bg-void px-6 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <span className="label">{k}</span>
      <span className="text-base text-ink-dim sm:text-right">{v}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── shell */

function Section({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id?: string;
  label?: string;
}) {
  return (
    <section id={id} className="relative overflow-hidden border-b border-edge">
      <div className="relative mx-auto max-w-app px-5 py-24 sm:px-8 sm:py-28 lg:py-36">
        {label && (
          <div className="mb-14 flex items-center gap-4">
            <span className="label whitespace-nowrap">{label}</span>
            <span className="h-px flex-1 bg-edge" />
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────── faq */

function Faq() {
  return (
    <Section id="faq" label="Questions">
      <Glyph
        char="?"
        rotate={12}
        opacity={0.04}
        className="-top-16 -right-8 text-[20rem] lg:text-[26rem]"
      />
      <div className="relative grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <h2 className="text-headline text-balance text-ink">The short answers.</h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-dim">
            The longer ones, including what can go wrong, are on the{" "}
            <Link href="/faq" className="text-signal underline-offset-4 hover:underline">
              full FAQ
            </Link>
            .
          </p>
        </div>
        <FaqList items={FEATURED_FAQ} />
      </div>
    </Section>
  );
}
