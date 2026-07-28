/**
 * Shared motion curves.
 *
 * Every animation on the site pulls from this file so the whole thing feels like one system
 * rather than a pile of independently-guessed durations. The rule of thumb they encode: things
 * entering the screen decelerate hard (fast at the start, long settle), things leaving accelerate
 * away, and things morphing between two states ease at both ends.
 */

/** Expo out. Very fast start, long glide. For panels and overlays arriving. */
export const ENTER = [0.16, 1, 0.3, 1] as const;

/** Quint out. Slightly gentler than ENTER, for content settling into place. */
export const SETTLE = [0.22, 1, 0.36, 1] as const;

/** Quart in-out. Symmetrical, for an element changing shape rather than appearing. */
export const MORPH = [0.76, 0, 0.24, 1] as const;

/** Quad in. Leaving should be quicker than arriving and not linger. */
export const EXIT = [0.4, 0, 1, 1] as const;

export const DURATION = {
  /** Hover states, colour changes. Below this it reads as instant. */
  fast: 0.18,
  /** The default for most UI transitions. */
  base: 0.32,
  /** Panels, morphs, anything covering distance. */
  slow: 0.48,
} as const;

/** The morph between the menu trigger and the open panel. */
export const MORPH_SPRING = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
} as const;
