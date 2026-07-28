import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE, ADMIN_ROOT } from "@/lib/admin";

const GATE_PATH = `${ADMIN_ROOT}/locked`;

/**
 * Stops unauthenticated requests before the admin pages render.
 *
 * Checking in the layout was not enough. A layout that returns a gate instead of `children` still
 * has those children rendered by React: the page runs its queries and the result is serialized into
 * the RSC payload, so the depositor table was being streamed to the browser and merely not
 * displayed. Verified by grepping a locked response for a depositor address and finding it.
 *
 * Rewriting here means the page function is never invoked, so there is nothing to leak. Next 16
 * calls this Proxy; it is the same thing Middleware was.
 *
 * This is an optimistic check on cookie presence, which is the documented role for this layer. The
 * cookie is `httpOnly` and only ever set by the server action that compares the password, so
 * presence is meaningful; the layout still verifies it before rendering anything.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === GATE_PATH) return NextResponse.next();

  const authorised = request.cookies.get(ADMIN_COOKIE)?.value === "1";
  if (authorised) return NextResponse.next();

  // A rewrite rather than a redirect: the URL stays put, so unlocking lands you back where you
  // were aiming instead of on a login page you then have to navigate away from.
  return NextResponse.rewrite(new URL(GATE_PATH, request.url));
}

/**
 * The matcher must be a static literal: Next parses it at build time and cannot evaluate a template
 * built from `ADMIN_PREFIX`. It therefore has to be kept in step with `ADMIN_ROOT` by hand, which
 * the assertion below turns from a silent drift into a build failure.
 */
export const config = {
  matcher: ["/asdfg/admin/:path*"],
};

if (ADMIN_ROOT !== "/asdfg/admin") {
  throw new Error(
    `proxy matcher is hardcoded to /asdfg/admin but ADMIN_ROOT is ${ADMIN_ROOT}. Update both.`,
  );
}
