"use client";

import { useEffect, useState } from "react";

/**
 * Dot-matrix loaders.
 *
 * Built rather than pulled from a package: these are a 5×5 grid of dots with a moving mask, which
 * is a few lines of state, and every dithered-loader library ships a canvas engine to do it. The
 * design system already owns the dot grid; the loader just animates which cells are lit.
 */

const SIZE = 5;

/** Cells lit at each step, as (row, col) offsets from centre — a rotating orbit. */
const ORBIT: ReadonlyArray<readonly [number, number]> = [
  [-2, 0],
  [-1, 1],
  [0, 2],
  [1, 1],
  [2, 0],
  [1, -1],
  [0, -2],
  [-1, -1],
];

export function DitherSpinner({ size = 24, className }: { size?: number; className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 110);
    return () => clearInterval(id);
  }, []);

  const centre = Math.floor(SIZE / 2);
  const cell = size / SIZE;

  return (
    <span
      role="status"
      aria-label="Loading"
      className={`relative inline-block ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const row = Math.floor(i / SIZE);
        const col = i % SIZE;

        // Distance, in orbit steps, from the currently lit cell — the tail fades behind the head.
        const lit = ORBIT.findIndex(
          ([dr, dc]) => row === centre + dr && col === centre + dc,
        );
        const trail = lit === -1 ? -1 : (((frame - lit) % ORBIT.length) + ORBIT.length) % ORBIT.length;
        const opacity = trail === -1 ? 0.07 : Math.max(0.07, 1 - trail * 0.22);

        return (
          <span
            key={i}
            className="absolute rounded-full bg-signal"
            style={{
              width: cell * 0.62,
              height: cell * 0.62,
              left: col * cell + cell * 0.19,
              top: row * cell + cell * 0.19,
              opacity,
              transition: "opacity 110ms linear",
            }}
          />
        );
      })}
    </span>
  );
}

/**
 * A horizontal dissolve bar — for anything with a known duration, like a pending transaction.
 * Density rises left to right as it fills, so it reads as a dithered gradient rather than a bar.
 */
export function DitherProgress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`relative h-2 w-full overflow-hidden bg-raised ${className ?? ""}`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-signal"
        style={{
          width: `${pct * 100}%`,
          WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
          maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
          WebkitMaskSize: "3px 3px",
          maskSize: "3px 3px",
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}
