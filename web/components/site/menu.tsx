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
import { useEffect } from "react";

import { DURATION, ENTER, EXIT, MORPH_SPRING } from "@/lib/easing";

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
 * The panel expands out of the trigger's top-right corner.
 *
 * This deliberately does *not* use `layoutId`. A shared-layout morph between a 48px button and a
 * full panel left the trigger's border painted underneath as an empty box, and interpolating
 * wildly different aspect ratios distorted the contents on the way. Scaling from a pinned
 * `transformOrigin` gives the same "it grew from the button" reading with none of that, and the
 * trigger simply fades out as the panel arrives.
 *
 * Each `AnimatePresence` wraps exactly one keyed motion element. Putting the scrim and panel
 * together inside a fragment — the arrangement this previously had — gives AnimatePresence a
 * fragment as its child, which it cannot track: exit animations never fire, the elements never
 * unmount, and the menu stops responding to Escape and outside clicks.
 */
export function Menu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);

    // Locking the body would reclaim the scrollbar width; `scrollbar-gutter: stable` in
    // globals.css reserves it so the page does not shift sideways.
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Open menu"
        aria-expanded={open}
        animate={{ opacity: open ? 0 : 1, scale: open ? 0.85 : 1 }}
        transition={{ duration: DURATION.fast, ease: ENTER }}
        className="flex size-12 items-center justify-center border border-edge bg-void/60 text-ink-dim backdrop-blur-sm transition-colors hover:border-ink-faint hover:text-ink"
        style={{ pointerEvents: open ? "none" : "auto" }}
      >
        <MenuIcon size={22} strokeWidth={2} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EXIT }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-60 bg-void/80 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: DURATION.fast, ease: EXIT } }}
            transition={MORPH_SPRING}
            // Pinned to the trigger's corner so the growth reads as coming from the button.
            style={{ transformOrigin: "top right" }}
            className="panel absolute top-0 right-0 z-70 w-[min(86vw,27rem)] origin-top-right overflow-hidden"
          >
            <div className="flex items-center justify-end px-6 pt-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close menu"
                className="flex size-12 items-center justify-center text-ink-dim transition-colors hover:text-ink"
              >
                <X size={28} strokeWidth={2} />
              </button>
            </div>

            <div className="p-4 pt-1 pb-6">
              <Group title="This page" items={SECTIONS} onNavigate={() => onOpenChange(false)} />
              <Group title="More" items={PAGES} onNavigate={() => onOpenChange(false)} />

              <div className="mt-4 border-t border-edge px-3 pt-6">
                <Link
                  href="/app"
                  onClick={() => onOpenChange(false)}
                  className="btn btn-primary w-full !py-4 !text-base"
                >
                  Launch app
                </Link>
              </div>
            </div>
          </motion.div>
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
      transition={{ delay: 0.08 + index * 0.03, duration: DURATION.base, ease: ENTER }}
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
