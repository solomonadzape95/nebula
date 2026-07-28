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

import { DURATION, ENTER, EXIT, MORPH_SPRING, SETTLE } from "@/lib/easing";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
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
 * The trigger and the panel share a `layoutId`, so the panel grows out of the button.
 *
 * The arrangement matters and is the one Motion documents: the trigger lives **outside**
 * `AnimatePresence` and stays mounted forever, while only the panel is conditionally rendered
 * inside it. Putting both inside their own `AnimatePresence` — the obvious-looking version — gives
 * two separate presence trees that cannot hand off to each other, so the morph silently degrades
 * into a cross-fade. Keeping the trigger mounted also means the navbar never reflows when the menu
 * opens, because nothing is removed from its layout.
 *
 * `layoutRoot` is required because the panel is `position: fixed`; without it Motion measures
 * against the scrolled document and the morph starts from the wrong place.
 */
export function Menu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    // Locking the body removes the scrollbar, which on a stable-gutter browser is free but
    // otherwise shifts the page. `scrollbar-gutter: stable` in globals.css reserves the space.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.button
        layoutId="menu-surface"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        transition={MORPH_SPRING}
        style={{ borderRadius: 2 }}
        className="flex size-12 items-center justify-center border border-edge bg-void/60 text-ink-dim backdrop-blur-sm transition-colors hover:border-ink-faint hover:text-ink"
      >
        <motion.span layoutId="menu-glyph" transition={MORPH_SPRING}>
          <MenuIcon size={22} strokeWidth={2} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EXIT }}
              onClick={() => setOpen(false)}
              /* Above the navbar so the bar dims with everything else instead of floating on top
                 of the scrim. */
              className="fixed inset-0 z-60 bg-void/80 backdrop-blur-sm"
            />

            <motion.div
              key="panel"
              layoutId="menu-surface"
              layoutRoot
              transition={MORPH_SPRING}
              style={{ borderRadius: 2 }}
              className="panel fixed top-4 right-4 z-70 w-[min(92vw,30rem)] overflow-hidden sm:top-5 sm:right-6"
            >
              <div className="flex items-center justify-end px-6 pt-5">
                <motion.button
                  layoutId="menu-glyph"
                  transition={MORPH_SPRING}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="text-ink-dim transition-colors hover:text-ink"
                >
                  <X size={28} strokeWidth={2} />
                </motion.button>
              </div>

              {/* Content fades in after the box has finished travelling, so the two animations do
                  not compete for attention. */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EXIT } }}
                transition={{ delay: 0.1, duration: DURATION.slow, ease: SETTLE }}
                className="p-4 pt-2 pb-6"
              >
                <Group title="This page" items={SECTIONS} onNavigate={() => setOpen(false)} />
                <Group title="More" items={PAGES} onNavigate={() => setOpen(false)} />

                <div className="mt-4 border-t border-edge px-3 pt-6">
                  <Link
                    href="/app"
                    onClick={() => setOpen(false)}
                    className="btn btn-primary w-full !py-4 !text-base"
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
    <div className="mb-3">
      <span className="label block px-3 pt-3 pb-2">{title}</span>
      {items.map((item, i) => (
        <MenuRow key={item.href} item={item} index={i} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

/**
 * Rest state is deliberately quiet: a dithered, desaturated icon. Hover resolves it into full
 * signal colour and lifts it, so the row rewards the pointer instead of merely highlighting.
 */
function MenuRow({
  item,
  index,
  onNavigate,
}: {
  item: Item;
  index: number;
  onNavigate: () => void;
}) {
  const { icon: Icon } = item;

  return (
    <motion.a
      href={item.href}
      onClick={onNavigate}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.14 + index * 0.035, duration: DURATION.base, ease: ENTER }}
      whileHover="hover"
      whileFocus="hover"
      whileTap={{ scale: 0.985 }}
      className="group flex items-center gap-5 px-3 py-4 outline-none transition-colors hover:bg-raised focus-visible:bg-raised"
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center">
        {/* Dithered and dim: the resting state. */}
        <motion.span
          variants={{ hover: { opacity: 0 } }}
          initial={{ opacity: 1 }}
          transition={{ duration: DURATION.fast }}
          className="absolute text-ink-faint"
          style={{
            WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
            maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
            WebkitMaskSize: "2.5px 2.5px",
            maskSize: "2.5px 2.5px",
          }}
        >
          <Icon size={30} strokeWidth={2.5} />
        </motion.span>

        {/* Solid, signal, lifted: the hover state. */}
        <motion.span
          variants={{ hover: { opacity: 1, scale: 1, y: 0 } }}
          initial={{ opacity: 0, scale: 0.82, y: 4 }}
          transition={MORPH_SPRING}
          className="absolute text-signal"
        >
          <Icon size={30} strokeWidth={2} />
        </motion.span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-lg text-ink-dim transition-colors group-hover:text-ink">
          {item.label}
        </span>
        <span className="block font-mono text-xs text-ink-faint">{item.hint}</span>
      </span>

      <motion.span
        variants={{ hover: { opacity: 1, x: 0 } }}
        initial={{ opacity: 0, x: -6 }}
        transition={{ duration: DURATION.fast, ease: ENTER }}
        className="text-signal"
      >
        <ArrowUpRight size={20} strokeWidth={2} />
      </motion.span>
    </motion.a>
  );
}
