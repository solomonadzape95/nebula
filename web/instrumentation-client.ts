import posthog from "posthog-js";

/**
 * Starts PostHog before React hydrates.
 *
 * Next runs this after the document loads and before hydration, which is exactly when analytics
 * wants to exist: early enough that the first pageview is not missed, late enough that `window` is
 * real. Anything thrown here happens before the app is interactive, so the whole body is guarded —
 * a bad analytics key should cost you a funnel, not the site.
 *
 * Nothing initialises without a key, so local development and previews stay silent by default
 * rather than filling the production project with your own clicking.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  try {
    posthog.init(key, {
      // Requests go to our own origin and are rewritten to PostHog in `next.config.ts`. A direct
      // call to a posthog.com domain is blocked by uBlock and Brave's shields, and Nebula's
      // audience runs those at a much higher rate than the general web — measuring only the
      // visitors without a blocker would bias every number here.
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",

      // Follows client-side navigation. The App Router changes route without a document load, so
      // the default listener would record one pageview per session and miss every page after the
      // first.
      capture_pageview: "history_change",

      // Off. Session recording on a page where people type amounts and approve wallet prompts is a
      // lot of exposure for a question the funnel already answers, and it is the single biggest
      // consumer of the free tier's quota.
      disable_session_recording: true,

      persistence: "localStorage+cookie",

      // The address is set explicitly on connect, via `identifyWallet`. Until then a visitor is
      // anonymous, which is the correct state for someone reading the FAQ.
      person_profiles: "identified_only",
    });
  } catch {
    // Analytics failing to start is not a reason for the app not to.
  }
}
