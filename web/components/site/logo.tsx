/**
 * The Nebula mark: a solid body with circular voids punched clean through it.
 *
 * Not three separate circles drawn side by side — one disc, holes cut out of it, so the negative
 * space does the work. Three voids of descending size read as depth in the body rather than as
 * three objects.
 *
 * # Why the halftone is printed on, not punched through
 *
 * Masking the body into dots means half its pixels are page background, so the mark can never
 * read as the same green as the buttons: it averages towards whatever is behind it and lands
 * somewhere muddier and darker. Instead the body is filled with the true signal colour and the
 * lattice is printed *onto* it in the page's own ground colour. Same halftone texture, but the
 * base colour underneath is exactly `--color-signal`.
 *
 * It is baked into the SVG rather than applied with CSS so the mark keeps its texture as a
 * favicon, an OG image, or any other export. A CSS-masked version renders solid the moment it
 * leaves the DOM.
 *
 * `cell` exists because dithering does not scale. At 96px a 2px lattice reads as texture; at 20px
 * the same lattice closes the voids up.
 */
export function Logo({
  size = 28,
  cell = 2,
  dithered = true,
  /** The surface the mark sits on. The printed lattice uses it so the dots read as gaps. */
  ground = "#07080a",
  className,
  title,
}: {
  size?: number;
  cell?: number;
  dithered?: boolean;
  ground?: string;
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
            <pattern id={`${uid}-dots`} width={cell} height={cell} patternUnits="userSpaceOnUse">
              <rect width={cell} height={cell} fill="black" />
              <circle cx={cell / 2} cy={cell / 2} r={cell * 0.32} fill="white" />
            </pattern>
            <mask id={`${uid}-lattice`}>
              <rect width="40" height="40" fill={`url(#${uid}-dots)`} />
            </mask>
          </>
        )}
      </defs>

      <g mask={`url(#${uid}-voids)`}>
        <rect width="40" height="40" fill="currentColor" />
        {dithered && (
          <rect
            width="40"
            height="40"
            fill={ground}
            mask={`url(#${uid}-lattice)`}
            opacity="0.82"
          />
        )}
      </g>
    </svg>
  );
}
