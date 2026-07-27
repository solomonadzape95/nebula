import type { LucideIcon } from "lucide-react";

/**
 * A lucide icon reduced to halftone dots.
 *
 * The icon is drawn thick and then punched through the same dot grid the rest of the page uses,
 * so it reads as printed rather than as a vector dropped in. Thin strokes disintegrate under a
 * 3px mask, which is why `strokeWidth` is deliberately heavy here.
 */
export function DitherIcon({
  icon: Icon,
  className,
  size = 88,
}: {
  icon: LucideIcon;
  className?: string;
  size?: number;
}) {
  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      {/* Solid ghost underneath keeps the silhouette readable where the mask thins out. */}
      <Icon
        aria-hidden
        size={size}
        strokeWidth={1.5}
        className="absolute inset-0 text-signal opacity-20"
      />
      <Icon
        aria-hidden
        size={size}
        strokeWidth={2.5}
        className="relative text-signal"
        style={{
          WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
          maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
          WebkitMaskSize: "2.5px 2.5px",
          maskSize: "2.5px 2.5px",
        }}
      />
    </span>
  );
}
