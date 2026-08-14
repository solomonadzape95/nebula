"use client";

import dynamic from "next/dynamic";

import { STILL_FRAME, useStillField } from "./use-still-field";

/**
 * The one piece of motion in the whole design.
 *
 * Everything is generated on the GPU — no video, no image, nothing to download. That is not a
 * compromise on the "space footage through a halftone filter" idea, it is a better version of it:
 * a video would be several megabytes, would loop visibly, would need a licence, and would blow the
 * mobile performance budget. This renders at any resolution, never repeats, and costs ~0 bytes.
 *
 * **On mobile it does not animate.** See `useStillField` for why. The still is not a downgraded
 * substitute — it is the same shader drawn at a fixed frame, so the art direction is identical and
 * only the motion is gone.
 */

// WebGL only exists in the browser, so the shader is loaded client-side only. Doing it this way
// rather than with a `mounted` flag avoids a render pass that exists purely to be thrown away.
const Dithering = dynamic(
  () => import("@paper-design/shaders-react").then((mod) => mod.Dithering),
  { ssr: false },
);

export type FieldVariant = "warp" | "blackhole" | "wormhole" | "ripple" | "drift";

const VARIANTS = {
  /** Folding spacetime. The hero — more turbulent and less symmetrical than a sphere. */
  warp: { shape: "warp", type: "4x4", pxSize: 2.6, speed: 0.34, scale: 1.15 },
  /** A dithered sphere reads as an event horizon. Secondary page heroes. */
  blackhole: { shape: "sphere", type: "4x4", pxSize: 2.4, speed: 0.42, scale: 1 },
  /** Twisting vortex — used where the page needs pull rather than mass. */
  wormhole: { shape: "swirl", type: "4x4", pxSize: 2.2, speed: 0.5, scale: 0.9 },
  /** Concentric waves. Quiet enough to sit behind text. */
  ripple: { shape: "ripple", type: "8x8", pxSize: 2, speed: 0.3, scale: 1.1 },
  /** Slow noise. Section dividers and empty states. */
  drift: { shape: "simplex", type: "8x8", pxSize: 2.6, speed: 0.16, scale: 1.4 },
} as const;

/**
 * Fill-rate ceiling for a still field.
 *
 * A frozen shader still pays for its one draw, and on a phone at DPR 3 a full-bleed hero is several
 * million fragments of noise — enough to stall the first paint on the very devices this is meant to
 * unburden. Capping the buffer and letting it scale up costs nothing visible through a dither this
 * coarse, where the halftone grid is already throwing away that detail.
 */
const STILL_MAX_PIXELS = 1280 * 720;

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
  const still = useStillField();

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
        /* Speed 0 does not merely slow the field down — it cancels the animation frame outright,
           so a still costs one draw and then nothing at all for as long as the page is open. */
        speed={still ? 0 : preset.speed * speed}
        frame={still ? STILL_FRAME : undefined}
        maxPixelCount={still ? STILL_MAX_PIXELS : undefined}
      />
    </div>
  );
}
