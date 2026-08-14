import type { Instrumentation } from "next";

/**
 * Server-side error tracking.
 *
 * `instrumentation-client.ts` catches what breaks in the browser; this catches what breaks in
 * Server Components, route handlers and Server Actions, which the client SDK can never see — a
 * failing indexer query renders an error page and the browser has nothing to report.
 *
 * Both halves land in the same PostHog project, so an `$exception` sits on the same timeline as
 * the funnel that produced it. That is the whole argument for not adding a second vendor here: a
 * separate error tracker would need its own identity mapping before "who hit this" could even be
 * asked.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!key) return;

  try {
    // Imported lazily so the Edge runtime does not pull a Node-only client into a bundle that
    // may never throw, and so a missing key costs nothing at all.
    const { PostHog } = await import("posthog-node");

    const posthog = new PostHog(key, {
      host: "https://us.i.posthog.com",
      // One request, then done. The default batches on a timer, which never fires in a serverless
      // function that gets frozen the moment the response is sent — the error would be recorded
      // locally and thrown away with the instance.
      flushAt: 1,
      flushInterval: 0,
    });

    // `digest` is React's hash of the original error. Server Components replace the thrown value
    // with a redacted one before it reaches here, so on a render error the digest is the only
    // handle that ties this event to the stack trace in the platform logs.
    const digest =
      typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;

    posthog.captureException(err instanceof Error ? err : new Error(String(err)), undefined, {
      digest,
      // The path only — never the query string. Amounts and addresses travel in query params on
      // some routes, and the privacy page promises analytics is not tied to your address.
      path: request.path.split("?")[0],
      method: request.method,
      router_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
    });

    await posthog.shutdown();
  } catch {
    // An error reporter that throws during error reporting turns one broken request into two.
  }
};
