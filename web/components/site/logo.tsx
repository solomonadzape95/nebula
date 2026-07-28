/**
 * The Nebula mark: three circles of descending size, one ring and two discs, arranged on a
 * diagonal so it reads as bodies in orbit rather than a static logo.
 *
 * The halftone is baked into the SVG as a pattern-driven mask rather than applied with CSS, so the
 * mark carries its own texture wherever it goes: a favicon, an OG image, a print asset. A
 * CSS-masked version would render solid the moment it left the DOM.
 *
 * `cell` exists because dithering does not scale. At 96px a 2px lattice reads as texture; at 20px
 * the same lattice eats the shape. Smaller renderings get a finer grid, and the favicon opts out
 * entirely.
 */
export function Logo({
  size = 28,
  cell = 2,
  dithered = true,
  className,
  title,
}: {
  size?: number;
  cell?: number;
  dithered?: boolean;
  className?: string;
  title?: string;
}) {
  // Ids must be unique per instance or a second copy on the page reuses the first one's mask.
  const uid = `logo-${size}-${cell}-${dithered ? "d" : "s"}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {dithered && (
        <defs>
          <pattern id={`${uid}-dots`} width={cell} height={cell} patternUnits="userSpaceOnUse">
            <rect width={cell} height={cell} fill="black" />
            <circle cx={cell / 2} cy={cell / 2} r={cell * 0.3} fill="white" />
          </pattern>
          <mask id={`${uid}-mask`}>
            <rect width="40" height="40" fill={`url(#${uid}-dots)`} />
          </mask>
        </defs>
      )}

      <g
        mask={dithered ? `url(#${uid}-mask)` : undefined}
        fill="currentColor"
        stroke="currentColor"
      >
        {/* The event horizon: largest, and the only one left open. */}
        <circle cx="16.5" cy="23" r="12.5" fill="none" strokeWidth="3.2" />
        {/* Mid body, breaking the ring's edge. */}
        <circle cx="29.5" cy="11.5" r="7.4" stroke="none" />
        {/* Far body. */}
        <circle cx="7.5" cy="7.5" r="3.4" stroke="none" />
      </g>
    </svg>
  );
}
