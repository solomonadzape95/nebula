/**
 * Who is allowed into the admin surface.
 *
 * This list is public: it ships in the client bundle because the app needs to know whether to send
 * a connecting wallet to the admin area. That is fine. Knowing which address is an admin grants
 * nothing, in the same way knowing a username grants nothing.
 *
 * The obscure URL prefix is not security either. It keeps the admin surface out of casual sight
 * and out of crawlers; the password checked server-side in `admin-actions.ts` is the actual gate,
 * and it is the only thing standing between a visitor and this section.
 */
export const ADMIN_ADDRESSES = [
  "GAHWEUMWQOOPEAQDRWGWKCW7YTXS3L7Q3CWJ6FVLF44GM3PN46GHR37K",
];

/** Path segment the admin routes live under. Changing it moves the whole section. */
export const ADMIN_PREFIX = "asdfg";

export const ADMIN_ROOT = `/${ADMIN_PREFIX}/admin`;

export const ADMIN_COOKIE = "nebula_admin";

export function isAdminAddress(address: string | null | undefined): boolean {
  return Boolean(address) && ADMIN_ADDRESSES.includes(address!);
}
