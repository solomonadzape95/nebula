"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

/**
 * The one piece of motion in the whole design.
 *
 * Everything is generated on the GPU — no video, no image, nothing to download. That is not a
 * compromise on the "space footage through a halftone filter" idea, it is a better version of it:
 * a video would be several megabytes, would loop visibly, would need a licence, and would blow the
 * mobile performance budget. This renders at any resolution, never repeats, and costs ~0 bytes.
 */

// WebGL only exists in the browser, so the shader is loaded client-side only. Doing it this way
// rather than with a `mounted` flag avoids a render pass that exists purely to be thrown away.
const Dithering = dynamic(
  () => import("@paper-design/shaders-react").then((mod) => mod.Dithering),
  { ssr: false },
);

export type FieldVariant = "blackhole" | "wormhole" | "ripple" | "drift";

const VARIANTS = {
  /** A dithered sphere reads as an event horizon. The hero. */
  blackhole: { shape: "sphere", type: "4x4", pxSize: 2.4, speed: 0.42, scale: 1 },
  /** Twisting vortex — used where the page needs pull rather than mass. */
  wormhole: { shape: "swirl", type: "4x4", pxSize: 2.2, speed: 0.5, scale: 0.9 },
  /** Concentric waves. Quiet enough to sit behind text. */
  ripple: { shape: "ripple", type: "8x8", pxSize: 2, speed: 0.3, scale: 1.1 },
  /** Slow noise. Section dividers and empty states. */
  drift: { shape: "simplex", type: "8x8", pxSize: 2.6, speed: 0.16, scale: 1.4 },
} as const;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Subscribes to the OS motion preference the way React wants external state read. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

interface DitherFieldProps {
  variant?: FieldVariant;
  className?: string;
  colorFront?: string;
  colorBack?: string;
  /** Multiplies the variant's default speed. 0 freezes it. */
  speed?: number;
  scale?: number;
}

export function DitherField({
  variant = "blackhole",
  className,
  colorFront = "#86f2c0",
  colorBack = "#07080a",
  speed = 1,
  scale,
}: DitherFieldProps) {
  const preset = VARIANTS[variant];
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={className}>
      {/* Fallback: a soft radial bloom in the signal colour, over the section's own ground.
          Visible before the GPU is ready and for anyone whose browser refuses WebGL. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colorFront}22 0%, ${colorBack}00 55%)`,
        }}
      />
      <Dithering
        className="absolute inset-0 h-full w-full"
        /* Fully transparent ground so the field composites into whatever section it sits in,
           rather than punching an opaque rectangle through the page. */
        colorBack="#00000000"
        colorFront={colorFront}
        shape={preset.shape}
        type={preset.type}
        pxSize={preset.pxSize}
        scale={scale ?? preset.scale}
        speed={reducedMotion ? 0 : preset.speed * speed}
      />
    </div>
  );
}
