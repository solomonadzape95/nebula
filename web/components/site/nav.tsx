import Link from "next/link";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#nxlm", label: "nXLM" },
  { href: "#yield", label: "Yield" },
];

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-edge/60 bg-void/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-mono text-sm tracking-[0.22em] uppercase">Nebula</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-xs tracking-wider text-ink-dim uppercase transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <Link href="/app" className="btn btn-primary !px-4 !py-2 !text-[0.7rem]">
          Launch app
        </Link>
      </nav>
    </header>
  );
}

/** A halftone ring — the black hole, reduced to a favicon. */
function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-signal">
      <circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="9" cy="9" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}
