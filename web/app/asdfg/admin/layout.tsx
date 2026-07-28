import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AdminGate } from "@/components/app/admin-gate";
import { AppShell } from "@/components/app/app-shell";
import { ADMIN_COOKIE } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin · Nebula",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Second line of defence.
 *
 * `proxy.ts` already rewrites unauthenticated requests away before these pages render, which is
 * what actually prevents the data being serialized. This check remains so the section is still
 * closed if the matcher is ever edited to miss a route: two independent checks, neither of which
 * relies on the other being right.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const authorised = store.get(ADMIN_COOKIE)?.value === "1";

  if (!authorised) return <AdminGate />;

  return <AppShell admin>{children}</AppShell>;
}
