"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/site/logo";
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

  return (
    <>
      {/*
        The header holds only the wordmark and is hidden outright while the menu is open. Earlier
        attempts dropped just its background and a band still showed across the top of the overlay;
        the reliable fix is for the whole bar to stop painting. That is only safe because the menu
        trigger no longer lives in here — it is its own fixed layer below, so hiding the header
        cannot disturb the shared-layout morph.
      */}
      <header
        aria-hidden={menuOpen}
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ease-out ${
          hidden && !menuOpen ? "-translate-y-full" : "translate-y-0"
        } ${menuOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-300 ${
            scrolled && !menuOpen
              ? "border-b border-edge/70 bg-void/80 opacity-100 backdrop-blur-xl"
              : "opacity-0"
          }`}
        />
        <nav className="relative mx-auto flex h-18 max-w-app items-center px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={26} cell={1.6} className="text-signal" />
            <span className="font-mono text-lg tracking-[0.2em] uppercase">Nebula</span>
          </Link>
        </nav>
      </header>

      {/*
        Its own fixed layer so the header can be hidden without disturbing it, but laid out
        through the same `max-w-app` container as the wordmark. Pinning it to the viewport edge
        instead pushed it into the far corner on wide screens, well outside the page's own margin.
        The row is click-through; only the button and the panel inside it take pointer events.
      */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-3 z-50 transition-transform duration-300 ease-out ${
          hidden && !menuOpen ? "-translate-y-[5.5rem]" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex max-w-app justify-end px-5 sm:px-8">
          <div className="pointer-events-auto relative">
            <Menu open={menuOpen} onOpenChange={setMenuOpen} />
          </div>
        </div>
      </div>
    </>
  );
}
