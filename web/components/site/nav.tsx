"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Menu } from "@/components/site/menu";

/** Ignore sub-pixel jitter and momentum wobble at the top of the page. */
const THRESHOLD = 8;
/** Below this the hero owns the screen, so the bar stays invisible and unbacked. */
const HERO_ZONE = 120;

export function Nav() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let previous = window.scrollY;

    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - previous;

      if (Math.abs(delta) > THRESHOLD) {
        // Reveal on the way up, get out of the way on the way down. Over the hero the bar is
        // always hidden, so nothing sits on top of the shader.
        setHidden(delta > 0 && current > HERO_ZONE);
        previous = current;
      }

      setScrolled(current > HERO_ZONE);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While the menu is open the bar drops its background entirely. A translucent blurred strip
  // sitting under the scrim still reads as a visible band across the top of the overlay, and no
  // amount of z-index fixes that: the fix is for there to be no strip.
  const backed = scrolled && !menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
        hidden && !menuOpen ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div
        aria-hidden
        className={`absolute inset-0 border-b transition-opacity duration-300 ${
          backed
            ? "border-edge/70 bg-void/80 opacity-100 backdrop-blur-xl"
            : "border-transparent opacity-0"
        }`}
      />

      <nav className="relative mx-auto flex h-18 max-w-app items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className={`flex items-center gap-3 transition-opacity duration-200 ${
            menuOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <Mark />
          <span className="font-mono text-lg tracking-[0.2em] uppercase">Nebula</span>
        </Link>

        <Menu open={menuOpen} onOpenChange={setMenuOpen} />
      </nav>
    </header>
  );
}

/** A halftone ring: the black hole, reduced to a favicon. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden className="text-signal">
      <circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="9" cy="9" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}
