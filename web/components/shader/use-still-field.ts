"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the shader fields should render one frame and stop.
 *
 * The dither shaders are fragment-bound: every pixel does the noise and the ordered-dither lookup
 * on every frame, so the cost scales with screen area rather than with scene complexity. On a
 * desktop GPU that is free. On a phone it is the whole frame budget, and the page janks while
 * scrolling — which is the worst possible place to spend it, because the hero is the first thing a
 * new user sees and mobile responsiveness is a scored requirement.
 *
 * Three conditions, one query:
 *
 * - `prefers-reduced-motion` — the OS-level request, honoured everywhere.
 * - `pointer: coarse` — a touch device, which is the population reporting the lag.
 * - `max-width: 767px` — a narrow viewport, catching a phone whose browser lies about the pointer
 *   and desktop windows dragged narrow, where the field is decorative anyway.
 *
 * The server snapshot is `true`: still is the safe default, so a phone gets a frozen field on the
 * first paint rather than starting the animation and cancelling it after hydration.
 */
const STILL = "(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 767px)";

export function useStillField(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(STILL);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(STILL).matches,
    () => true,
  );
}

/**
 * The frame the still is taken at, in milliseconds since the animation's start.
 *
 * Not zero. Every one of these shapes begins from a flat or perfectly symmetrical state and only
 * develops its structure as time advances, so frame 0 is the one frame in the loop that looks like
 * a mistake. Four seconds in, each variant has its full form.
 */
export const STILL_FRAME = 4000;
