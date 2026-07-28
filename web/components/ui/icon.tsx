import type { LucideIcon } from "lucide-react";

/**
 * Every icon in the app, punched through the halftone lattice.
 *
 * The mask cell scales with the icon, and that is the whole trick. A fixed 2.5px grid reads as
 * texture on a 40px mark and eats a 14px one alive. Below `MIN_DITHER` the effect is skipped
 * entirely: at that size there is not enough glyph left to dither without it turning to mush.
 *
 * The small band used to go the other way — a 1.6px cell for anything under 22px — on the reasoning
 * that a finer lattice is gentler. It is not. Two things went wrong at nav-icon size. The gaps came
 * out around half a pixel, which on a standard-density display antialiases into near-solid, so the
 * texture simply vanished and the icons in the tab bar looked undithered next to everything else.
 * And where it *did* resolve, a lattice that fine cut across the stroke often enough to break the
 * shape rather than texture it. A 2px cell with a wider dot fixes both at once: visible dots, and
 * more of the glyph left standing than before.
 *
 * Cost is a CSS mask on an inline SVG, which is composited on the GPU and never triggers layout.
 * It is cheap enough to apply everywhere.
 */

/** Below this an icon has too little surface to survive a mask. */
const MIN_DITHER = 13;

function cellFor(size: number): number {
  if (size >= 48) return 3;
  if (size >= 32) return 2.5;
  return 2;
}

/**
 * Dot radius as a fraction of the cell.
 *
 * Small icons get a larger fraction. The mask keeps the ink *inside* the dots, so a bigger ratio
 * leaves more glyph behind — which is what a 16px mark needs, since at that size there is barely a
 * stroke to spare and the shape is the first thing to go.
 */
function ratioFor(size: number): number {
  return size < 22 ? 0.38 : 0.34;
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
  const radius = cell * ratioFor(size);

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
              WebkitMaskImage: `radial-gradient(circle at 1px 1px, #000 ${radius}px, transparent 0)`,
              maskImage: `radial-gradient(circle at 1px 1px, #000 ${radius}px, transparent 0)`,
              WebkitMaskSize: `${cell}px ${cell}px`,
              maskSize: `${cell}px ${cell}px`,
            }
          : undefined
      }
    />
  );
}
