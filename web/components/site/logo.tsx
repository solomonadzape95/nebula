/**
 * The Nebula mark: a solid body with circular voids punched clean through it.
 *
 * Not three separate circles drawn side by side — one disc, holes cut out of it, so the negative
 * space does the work. Three voids of descending size read as depth in the body rather than as
 * three objects.
 *
 * The halftone is baked into the SVG as a pattern-driven mask rather than applied with CSS, so the
 * mark carries its own texture wherever it goes: a favicon, an OG image, a print asset. A
 * CSS-masked version would render solid the moment it left the DOM.
 *
 * `cell` exists because dithering does not scale. At 96px a 2px lattice reads as texture; at 20px
 * the same lattice eats the shape. Smaller renderings get a finer grid.
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
  // Ids must be unique per instance or a second copy on the page reuses the first one's masks.
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
      <defs>
        {/* White keeps the body, black punches it away. */}
        <mask id={`${uid}-voids`}>
          <circle cx="20" cy="20" r="18.5" fill="white" />
          <circle cx="25.5" cy="13" r="7.2" fill="black" />
          <circle cx="13" cy="26.5" r="4.6" fill="black" />
          <circle cx="27" cy="28.5" r="2.6" fill="black" />
        </mask>

        {dithered && (
          <>
            {/* Dot radius is a large fraction of the cell so the mark stays dense. A sparser
                lattice greys it out, and at logo scale the mark must read as the same green as
                the buttons rather than a muted version of it. */}
            <pattern id={`${uid}-dots`} width={cell} height={cell} patternUnits="userSpaceOnUse">
              <rect width={cell} height={cell} fill="black" />
              <circle cx={cell / 2} cy={cell / 2} r={cell * 0.4} fill="white" />
            </pattern>
            <mask id={`${uid}-halftone`}>
              <rect width="40" height="40" fill={`url(#${uid}-dots)`} />
            </mask>
          </>
        )}
      </defs>

      {/* Two stacked masks: the voids shape the body, the halftone shreds what is left. */}
      <g mask={dithered ? `url(#${uid}-halftone)` : undefined}>
        <rect width="40" height="40" fill="currentColor" mask={`url(#${uid}-voids)`} />
      </g>
    </svg>
  );
}
