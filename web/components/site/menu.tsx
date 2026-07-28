"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  Coins,
  HelpCircle,
  LayoutGrid,
  LineChart,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  external?: boolean;
}

const SECTIONS: Item[] = [
  { href: "#how", label: "How it works", icon: LayoutGrid, hint: "Three steps" },
  { href: "#nxlm", label: "What is nXLM", icon: Coins, hint: "The receipt token" },
  { href: "#yield", label: "Where yield comes from", icon: LineChart, hint: "Blend lending" },
];

const PAGES: Item[] = [
  { href: "/stats", label: "Vault stats", icon: LineChart, hint: "Live numbers" },
  { href: "/how-it-works", label: "Documentation", icon: BookOpen, hint: "The long version" },
  { href: "/faq", label: "FAQ", icon: HelpCircle, hint: "Common questions" },
];

/**
 * The menu and its trigger are the same element.
 *
 * A shared `layoutId` means Framer interpolates the button's box into the panel's box rather than
 * cross-fading two separate things, so the panel genuinely grows out of the button it replaced.
 * The panel is deliberately not full-bleed: it covers a corner, keeps the page visible behind it,
 * and never feels like a navigation event.
 */
export function Menu() {
  const [open, setOpen] = useState(false);

  // Escape closes, and the page underneath must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <AnimatePresence initial={false} mode="popLayout">
        {!open && (
          <motion.button
            key="trigger"
            layoutId="menu-surface"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={false}
            className="flex size-11 items-center justify-center border border-edge bg-void/60 text-ink-dim backdrop-blur-sm transition-colors hover:border-ink-faint hover:text-ink"
            style={{ borderRadius: 2 }}
          >
            <motion.span layoutId="menu-glyph">
              <MenuIcon size={18} strokeWidth={2} />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm"
            />

            <motion.div
              key="panel"
              layoutId="menu-surface"
              className="panel fixed top-4 right-4 z-50 w-[min(88vw,26rem)] overflow-hidden sm:top-5 sm:right-5"
              style={{ borderRadius: 2 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="flex items-center justify-between border-b border-edge px-6 py-5">
                <span className="label">Menu</span>
                <motion.button
                  layoutId="menu-glyph"
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="text-ink-dim transition-colors hover:text-ink"
                >
                  <X size={18} strokeWidth={2} />
                </motion.button>
              </div>

              {/* Content fades in after the box has finished morphing, so the two animations
                  don't compete for attention. */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.28 }}
                className="max-h-[min(70vh,34rem)] overflow-y-auto p-3"
              >
                <Group title="This page" items={SECTIONS} onNavigate={() => setOpen(false)} />
                <Group title="More" items={PAGES} onNavigate={() => setOpen(false)} />

                <div className="mt-3 border-t border-edge p-3 pt-5">
                  <Link
                    href="/app"
                    onClick={() => setOpen(false)}
                    className="btn btn-primary w-full"
                  >
                    Launch app
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Group({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: Item[];
  onNavigate: () => void;
}) {
  return (
    <div className="mb-2">
      <span className="label block px-3 py-2">{title}</span>
      {items.map((item) => (
        <MenuRow key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

/**
 * Rest state is deliberately quiet: a dithered, desaturated icon. Hover resolves it into full
 * signal colour and lifts it, so the row rewards the pointer instead of just highlighting.
 */
function MenuRow({ item, onNavigate }: { item: Item; onNavigate: () => void }) {
  const { icon: Icon } = item;

  return (
    <motion.a
      href={item.href}
      onClick={onNavigate}
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap={{ scale: 0.985 }}
      animate="rest"
      className="group flex items-center gap-4 px-3 py-3 outline-none transition-colors hover:bg-raised focus-visible:bg-raised"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center">
        {/* Dithered, dim: the resting state. */}
        <motion.span
          variants={{ rest: { opacity: 1 }, hover: { opacity: 0 } }}
          transition={{ duration: 0.18 }}
          className="absolute text-ink-faint"
          style={{
            WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.85px, transparent 0)",
            maskImage: "radial-gradient(circle at 1px 1px, #000 0.85px, transparent 0)",
            WebkitMaskSize: "2.5px 2.5px",
            maskSize: "2.5px 2.5px",
          }}
        >
          <Icon size={22} strokeWidth={2.5} />
        </motion.span>

        {/* Solid, signal, lifted: the hover state. */}
        <motion.span
          variants={{
            rest: { opacity: 0, scale: 0.86, y: 3 },
            hover: { opacity: 1, scale: 1, y: 0 },
          }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className="absolute text-signal"
        >
          <Icon size={22} strokeWidth={2} />
        </motion.span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] text-ink-dim transition-colors group-hover:text-ink">
          {item.label}
        </span>
        <span className="block font-mono text-[0.6875rem] text-ink-faint">{item.hint}</span>
      </span>

      <motion.span
        variants={{ rest: { opacity: 0, x: -4 }, hover: { opacity: 1, x: 0 } }}
        transition={{ duration: 0.18 }}
        className="text-signal"
      >
        <ArrowUpRight size={16} strokeWidth={2} />
      </motion.span>
    </motion.a>
  );
}
