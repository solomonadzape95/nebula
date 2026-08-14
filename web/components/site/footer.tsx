import Link from "next/link";

import { ImageField } from "@/components/shader/image-field";
import { Logo } from "@/components/site/logo";
import { VAULT_ID, explorerContract } from "@/lib/contracts";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/app", label: "Launch app" },
      { href: "/stats", label: "Vault stats" },
      { href: "/connect", label: "Connect wallet" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/faq", label: "FAQ" },
      { href: "/#nxlm", label: "What is nXLM" },
      { href: "/feedback", label: "Give feedback" },
    ],
  },
];

const EXTERNAL = [
  { href: explorerContract(VAULT_ID), label: "Vault contract" },
  { href: "https://www.blend.capital", label: "Blend" },
  { href: "https://developers.stellar.org", label: "Stellar" },
];

export function SiteFooter() {
  return (
    <footer className="relative flex min-h-[80svh] flex-col overflow-hidden">
      {/* The photograph, run through the same dither as the rest of the page. A transparent
          `colorBack` drops the darkest tones out entirely so the page ground shows through and the
          picture reads as printed onto the page rather than placed on it. */}
      <ImageField
        source="footer"
        className="pointer-events-none absolute inset-0"
        pxSize={2.6}
        colorSteps={4}
        colorBack="#00000000"
      />
      {/* A flat wash across the whole image. The gradient below shapes the bottom edge, but the
          link columns sit over the brightest part of the photograph and need the overall level
          brought down to stay readable. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-void/45" />
      {/* Only the bottom fades, so the image begins exactly at the footer's own border. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(7,8,10,0.55) 70%, rgba(7,8,10,0.85) 88%, rgba(7,8,10,0.95) 100%)",
        }}
      />

      <div className="relative flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-app gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div>
            <h2 className="text-headline max-w-xl text-balance text-ink">Put your XLM to work.</h2>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-ink-dim">
              A testnet wallet, two minutes, and nothing at risk. See what it does before you decide
              anything.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/app" className="btn btn-primary w-full sm:w-auto">
                Launch app
              </Link>
              <Link href="/how-it-works" className="btn btn-ghost w-full sm:w-auto">
                Read the docs
              </Link>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <span className="label">{column.title}</span>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-ink-dim transition-colors hover:text-signal"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <span className="label">On chain</span>
              <ul className="mt-5 space-y-3">
                {EXTERNAL.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-ink-dim transition-colors hover:text-signal"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-app px-5 pb-8 sm:px-8">
        <div className="flex flex-col gap-4 border-t border-edge/60 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="brand flex w-fit items-center gap-3">
            <Logo size={32} cell={1.8} className="brand-mark text-signal" />
            <span className="brand-name font-mono text-sm tracking-[0.2em] text-ink-dim uppercase">
              Nebula
            </span>
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex gap-6">
              <Link
                href="/terms"
                className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
              >
                Privacy
              </Link>
            </div>
            <span className="font-mono text-xs text-ink-faint">
              © {new Date().getFullYear()} Nebula. All rights reserved, all wrongs pardoned.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
