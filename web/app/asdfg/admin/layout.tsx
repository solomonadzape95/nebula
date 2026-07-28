import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AdminGate } from "@/components/app/admin-gate";
import { AppShell } from "@/components/app/app-shell";
import { ADMIN_COOKIE } from "@/lib/admin";
import { verify } from "@/lib/signed-cookie";

export const metadata: Metadata = {
  title: "Admin · Nebula",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Second line of defence.
 *
 * `proxy.ts` already rewrites unauthenticated requests away before these pages render, which is
 * what actually prevents the data being serialized. This check remains so the section is still
 * closed if the matcher is ever edited to miss a route.
 *
 * Both layers verify the cookie's signature. They used to compare it to the constant `"1"`, which
 * meant the "two independent checks" were one check written twice: a single forged header defeated
 * both. Independence comes from being separately reachable, not from being separately written.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const authorised = (await verify(store.get(ADMIN_COOKIE)?.value)) === "admin";

  if (!authorised) return <AdminGate />;

  return <AppShell admin>{children}</AppShell>;
}
