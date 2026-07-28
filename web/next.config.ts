import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a lockfile in the user's home directory above this project, so Turbopack infers the
  // wrong workspace root. Pin it to this app.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  /**
   * Analytics is served from our own origin.
   *
   * `posthog-js` posts to `/ingest`, and these rewrites forward it. Calling a posthog.com host
   * directly gets blocked by uBlock Origin and Brave's shields, and this audience runs those far
   * more than the general web does — so the missing data would not be missing at random, it would
   * be exactly the privacy-minded users, which is most of the point of measuring a crypto product.
   *
   * `/ingest/static` is a separate entry because the library and its assets come from a different
   * host to the event endpoint. `skipTrailingSlashRedirect` stops Next answering PostHog's own
   * trailing-slash paths with a 308 the SDK does not follow.
   */
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
};

export default nextConfig;
