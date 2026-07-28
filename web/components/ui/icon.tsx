import type { LucideIcon } from "lucide-react";

/**
 * Every icon in the app, punched through the halftone lattice.
 *
 * The mask cell scales with the icon, and that is the whole trick. A fixed 2.5px grid reads as
 * texture on a 40px mark and eats a 14px one alive, so small icons get a finer lattice and a
 * heavier stroke to survive it. Below `MIN_DITHER` the effect is skipped entirely: at that size
 * there is not enough glyph left to dither without it turning to mush.
 *
 * Cost is a CSS mask on an inline SVG, which is composited on the GPU and never triggers layout.
 * It is cheap enough to apply everywhere.
 */

/** Below this an icon has too little surface to survive a mask. */
const MIN_DITHER = 13;

function cellFor(size: number): number {
  if (size >= 48) return 3;
  if (size >= 32) return 2.5;
  if (size >= 22) return 2;
  return 1.6;
}

export function Icon({
  icon: Glyph,
  size = 16,
  strokeWidth,
  className,
  dither = true,
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Opt out where the shape has to stay crisp, such as a wallet brand mark. */
  dither?: boolean;
}) {
  const on = dither && size >= MIN_DITHER;
  const cell = cellFor(size);

  // Thicker strokes at small sizes: the mask removes roughly half the ink, so a 2px line at 16px
  // reads much lighter than it does undithered.
  const stroke = strokeWidth ?? (on ? (size < 22 ? 2.6 : 2.2) : 2);

  return (
    <Glyph
      size={size}
      strokeWidth={stroke}
      className={className}
      style={
        on
          ? {
              WebkitMaskImage: `radial-gradient(circle at 1px 1px, #000 ${cell * 0.34}px, transparent 0)`,
              maskImage: `radial-gradient(circle at 1px 1px, #000 ${cell * 0.34}px, transparent 0)`,
              WebkitMaskSize: `${cell}px ${cell}px`,
              maskSize: `${cell}px ${cell}px`,
            }
          : undefined
      }
    />
  );
}
