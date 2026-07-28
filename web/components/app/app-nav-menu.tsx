"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DURATION, ENTER, EXIT, MORPH_SPRING } from "@/lib/easing";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The app and admin tab bars, collapsed for small screens.
 *
 * The trigger names the section you are currently in rather than saying "Menu". With the tabs
 * hidden there is nothing else on screen telling you where you are, and a bare hamburger throws
 * that away for no reason.
 *
 * Portalled to `document.body` like the marketing menu, and for the same reason: the app header
 * carries `backdrop-blur`, and a backdrop filter makes its element the containing block for
 * `position: fixed` descendants. Rendered in place, the scrim would resolve against the header
 * strip instead of the viewport, leaving a dark band across the top and swallowing no clicks
 * anywhere else.
 */
export function AppNavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  // Store the path the menu was opened on rather than a boolean. Openness is then derived, so any
  // navigation closes it for free, including a browser back button that changes the route without
  // a click. The boolean version needed an effect to watch `pathname` and reset itself, which is
  // a render thrown away every time.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (next: boolean) => setOpenedAt(next ? pathname : null);

  const current = items.find((item) => item.href === pathname) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!current) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Change section"
        aria-expanded={open}
        className="flex items-center gap-2.5 border border-edge px-3.5 py-2.5 text-ink-dim transition-colors hover:border-ink-faint hover:text-ink md:hidden"
      >
        <current.icon size={15} strokeWidth={2} className="text-signal" />
        <span className="font-mono text-xs tracking-wider uppercase">{current.label}</span>
        <ChevronDown size={14} strokeWidth={2} className="text-ink-faint" />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <AnimatePresence>
              {open && (
                <motion.div
                  key="app-nav-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.base, ease: EXIT }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-60 bg-void/80 backdrop-blur-sm md:hidden"
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {open && (
                <div
                  key="app-nav-row"
                  className="pointer-events-none fixed inset-x-0 top-3 z-70 md:hidden"
                >
                  <div className="mx-auto flex max-w-app justify-end px-5">
                    <motion.nav
                      initial={{ opacity: 0, scale: 0.86 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{
                        opacity: 0,
                        scale: 0.92,
                        transition: { duration: DURATION.fast, ease: EXIT },
                      }}
                      transition={MORPH_SPRING}
                      style={{ transformOrigin: "top right" }}
                      className="panel pointer-events-auto w-[min(88vw,20rem)] overflow-hidden p-2"
                    >
                      {items.map((item, i) => {
                        const active = item.href === pathname;
                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: 0.06 + i * 0.03,
                              duration: DURATION.base,
                              ease: ENTER,
                            }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              aria-current={active ? "page" : undefined}
                              className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                                active ? "bg-raised text-signal" : "text-ink-dim hover:bg-raised"
                              }`}
                            >
                              <item.icon
                                size={20}
                                strokeWidth={2}
                                className={active ? "text-signal" : "text-ink-faint"}
                              />
                              <span className="flex-1 font-mono text-sm tracking-wider uppercase">
                                {item.label}
                              </span>
                              {active && <Check size={16} strokeWidth={2.5} />}
                            </Link>
                          </motion.div>
                        );
                      })}
                    </motion.nav>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </>,
          document.body,
        )}
    </>
  );
}
