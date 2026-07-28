"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";

import { DURATION, ENTER, SETTLE } from "@/lib/easing";
import type { FaqItem } from "@/lib/faq";

/**
 * An accordion built on a real button and a height animation.
 *
 * `<details>` would be less code but cannot be animated open without fighting the browser, and
 * the whole design leans on things resolving rather than snapping. Height is animated to `auto`,
 * which Motion measures for us.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="border-t border-edge">
      {items.map((item, i) => {
        const isOpen = openIndex === i;

        return (
          <div key={item.q} className="border-b border-edge">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="group flex w-full items-start justify-between gap-6 py-7 text-left outline-none focus-visible:bg-raised"
            >
              <span
                className={`text-lg transition-colors sm:text-xl ${
                  isOpen ? "text-ink" : "text-ink-dim group-hover:text-ink"
                }`}
              >
                {item.q}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0, color: isOpen ? "#86f2c0" : "#767c85" }}
                transition={{ duration: DURATION.base, ease: ENTER }}
                className="mt-1 shrink-0"
              >
                <Plus size={22} strokeWidth={2} />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: DURATION.base, ease: SETTLE }}
                  className="overflow-hidden"
                >
                  <p className="max-w-3xl pr-10 pb-8 text-base leading-relaxed text-ink-dim sm:text-lg">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
