import Link from "next/link";

import { DitherField } from "@/components/shader/dither-field";
import { Nav } from "@/components/site/nav";
import { Stat } from "@/components/site/stat";

/**
 * Placeholder figures.
 *
 * These are the real values read off the testnet vault at the time of writing, so the layout is
 * designed against realistic magnitudes rather than lorem-ipsum numbers. They are NOT live yet —
 * wiring them to the contract and the indexer is the next step.
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
      <Nav />
      <div className="dither-overlay" aria-hidden />
      <main className="flex-1">
        <Hero />
        <StatBand />
        <Problem />
        <HowItWorks />
        <NxlmExplainer />
        <YieldSource />
      </main>
      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────── hero */

function Hero() {
  return (
    <section className="scanlines relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      {/* The event horizon. Sits behind everything, bleeding off all four edges. */}
      <DitherField
        variant="blackhole"
        className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[150vmax] -translate-x-1/2 -translate-y-1/2"
      />

      {/* Vignette — pulls the centre dark so type stays legible over the brightest part. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(7,8,10,0.88) 0%, rgba(7,8,10,0.5) 45%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-void to-transparent"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-5 pt-20 pb-16 text-center sm:px-8">
        <span className="label inline-flex items-center gap-2 border border-edge bg-void/60 px-3 py-1.5 backdrop-blur-sm">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-signal" />
          Live on Stellar testnet
        </span>

        <h1 className="mt-8 text-[2.75rem] leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
          Earn on your XLM
          <br />
          <span className="text-ink-dim">without locking it up.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-ink-dim text-pretty sm:text-lg">
          Deposit XLM, receive <span className="text-ink">nXLM</span>. It is worth more XLM every
          day — and you can trade or spend it whenever you like.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-10 sm:px-8 lg:grid-cols-4">
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
          value={PLACEHOLDER.apy ?? "—"}
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
      <p className="mx-auto max-w-3xl text-center text-2xl leading-snug font-light text-balance sm:text-3xl">
        Your XLM sits in a wallet earning nothing. Real yield exists on Stellar — but claiming it
        means managing lending positions by hand.{" "}
        <span className="text-ink-faint">Most people never do.</span>
      </p>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────── how it works */

const STEPS = [
  {
    n: "01",
    title: "Deposit XLM",
    body: "You receive nXLM in return. Think of it as your receipt — its quantity never changes again.",
  },
  {
    n: "02",
    title: "It goes to work",
    body: "Nebula supplies your XLM to Blend, a lending market on Stellar. Borrowers pay interest on it.",
  },
  {
    n: "03",
    title: "Redeem any time",
    body: "Your nXLM is worth more XLM than when you got it. Or don't redeem — it keeps earning either way.",
  },
];

function HowItWorks() {
  return (
    <Section id="how" label="How it works">
      <div className="grid gap-px overflow-hidden border border-edge bg-edge md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="bg-void p-8 lg:p-10">
            <span className="tabular font-mono text-xs text-signal-dim">{step.n}</span>
            <h3 className="mt-5 text-xl font-medium tracking-tight">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">{step.body}</p>
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
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-3xl leading-[1.1] font-medium tracking-tight text-balance sm:text-4xl">
            Think of it like gold.
          </h2>
          <div className="mt-6 space-y-5 text-ink-dim">
            <p className="leading-relaxed">
              You own 10 grams. A year later you still own{" "}
              <span className="text-ink">10 grams</span> — the number never changes. It is simply
              worth more.
            </p>
            <p className="leading-relaxed">
              nXLM works the same way. Your balance is fixed the moment you receive it. What rises
              is the price.
            </p>
            <p className="leading-relaxed">
              That is what keeps it{" "}
              <span className="text-ink">spendable everywhere else on Stellar</span> — it behaves
              like an ordinary token, because it is one.
            </p>
          </div>
        </div>

        {/* The whole concept in one table. The row that doesn't change is the loud one. */}
        <div className="panel relative overflow-hidden">
          <DitherField
            variant="ripple"
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            speed={0.5}
          />
          <div className="relative grid grid-cols-3 gap-y-5 p-7 sm:p-9">
            <span className="label" />
            <span className="label text-right">At deposit</span>
            <span className="label text-right">Today</span>

            <Row label="Your nXLM" a="100.00" b="100.00" highlight />
            <Row label="Price per nXLM" a="1.0000" b="1.0142" />
            <Row label="Worth" a="100.00" b="101.42" signal />
          </div>
        </div>
      </div>
    </Section>
  );
}

function Row({
  label,
  a,
  b,
  highlight,
  signal,
}: {
  label: string;
  a: string;
  b: string;
  highlight?: boolean;
  signal?: boolean;
}) {
  return (
    <>
      <span className={`text-sm ${highlight ? "text-ink" : "text-ink-dim"}`}>{label}</span>
      <span className="tabular text-right font-mono text-sm text-ink-faint">{a}</span>
      <span
        className={`tabular text-right font-mono text-sm ${
          signal ? "text-signal" : highlight ? "text-ink" : "text-ink-dim"
        }`}
      >
        {b}
        {highlight && (
          <span className="ml-2 font-sans text-[0.625rem] tracking-wide text-ink-faint uppercase">
            unchanged
          </span>
        )}
      </span>
    </>
  );
}

/* ────────────────────────────────────────────────────────── yield source */

function YieldSource() {
  return (
    <Section id="yield" label="Where the yield comes from">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <h2 className="text-3xl leading-[1.1] font-medium tracking-tight text-balance sm:text-4xl">
            Real interest, from real borrowers.
          </h2>
          <p className="mt-6 leading-relaxed text-ink-dim">
            Nebula supplies your XLM to <span className="text-ink">Blend</span>, a lending market on
            Stellar. People borrow against collateral and pay interest. That interest is the yield —
            not token emissions, not inflation, not a subsidy.
          </p>
        </div>

        <div className="space-y-px border border-edge bg-edge">
          <Fact k="Source" v="Blend lending interest" />
          <Fact k="Protocol fee" v="10% of yield — never of your deposit" />
          <Fact k="Withdrawals" v="Can never be paused" />
          <Fact k="Stellar staking" v="Does not exist — SCP is not proof-of-stake" />
        </div>
      </div>
    </Section>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1 bg-void px-6 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <span className="label">{k}</span>
      <span className="text-sm text-ink-dim sm:text-right">{v}</span>
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
    <section id={id} className="relative border-b border-edge">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        {label && (
          <div className="mb-12 flex items-center gap-4">
            <span className="label whitespace-nowrap">{label}</span>
            <span className="h-px flex-1 bg-edge" />
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <DitherField variant="drift" className="pointer-events-none absolute inset-0 opacity-[0.18]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="font-mono text-xs tracking-[0.2em] text-ink-faint uppercase">
          Nebula — liquid yield for XLM
        </span>
        <span className="font-mono text-[0.6875rem] text-ink-faint">
          Testnet. Tokens have no real value.
        </span>
      </div>
    </footer>
  );
}
