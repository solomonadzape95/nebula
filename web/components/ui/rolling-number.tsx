"use client";

import { AnimatePresence, motion } from "motion/react";

import { ROLL_SPRING } from "@/lib/easing";

/**
 * An odometer. Each character sits in its own slot; when it changes, the new one rises from below
 * and pushes the old one out of the top.
 *
 * Motion ships an `AnimateNumber` component that does this, but only from a version newer than the
 * one installed here, so this is the same idea in about thirty lines. Per-character keying means
 * only the digits that actually changed animate: in `1.002481`, a tick moves the last digit and
 * leaves the rest completely still, which is what makes it read as a mechanical counter rather
 * than the whole number flickering.
 *
 * Separators are rendered outside the animation so a decimal point never slides.
 */
export function RollingNumber({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`tabular inline-flex ${className ?? ""}`} aria-label={value}>
      {value.split("").map((char, index) => {
        const isDigit = /\d/.test(char);

        if (!isDigit) {
          return (
            <span key={`sep-${index}`} aria-hidden>
              {char}
            </span>
          );
        }

        return (
          <span
            key={`slot-${index}`}
            aria-hidden
            className="relative inline-block overflow-hidden text-center"
            // A digit slot must not resize as its contents change, or the whole number shuffles
            // sideways on every tick. `ch` is the width of a figure in a monospace face.
            style={{ width: "1ch", height: "1.1em" }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={char}
                initial={{ y: "100%" }}
                animate={{ y: "0%" }}
                exit={{ y: "-100%" }}
                transition={ROLL_SPRING}
                className="absolute inset-0 flex items-center justify-center"
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}
