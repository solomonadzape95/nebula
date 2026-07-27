/**
 * Oversized typographic marks floating behind sections.
 *
 * Purely decorative — they exist so the page between the hero and the footer isn't flat black.
 * Each one is masked through the same halftone grid as everything else, so it reads as part of the
 * print rather than a watermark dropped on top. Always `aria-hidden`: a screen reader announcing a
 * giant "?" would be noise.
 */

interface GlyphProps {
  char: string;
  className?: string;
  /** Degrees. Kept off-axis deliberately — a straight glyph looks like a mistake. */
  rotate?: number;
  /** 0–1. These should sit at the very edge of visibility. */
  opacity?: number;
  drift?: boolean;
}

export function Glyph({
  char,
  className,
  rotate = -12,
  opacity = 0.05,
  drift = true,
}: GlyphProps) {
  return (
    <span
      aria-hidden
      /* Hidden below `md`: at phone widths these either overlap the copy or push the page wide,
         and neither is worth the decoration. */
      className={`pointer-events-none absolute hidden leading-none font-black select-none md:block ${className ?? ""}`}
      style={{
        opacity,
        color: "var(--color-signal)",
        // The glyph is punched through a dot grid, same cell as the page overlay.
        WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
        maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
        WebkitMaskSize: "3px 3px",
        maskSize: "3px 3px",
        transform: `rotate(${rotate}deg)`,
        ...(drift
          ? {
              ["--glyph-rotate" as string]: `${rotate}deg`,
              animation: "glyph-drift 14s ease-in-out infinite",
            }
          : {}),
      }}
    >
      {char}
    </span>
  );
}
