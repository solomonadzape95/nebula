import type { Metadata } from "next";

import { AdminGate } from "@/components/app/admin-gate";

export const metadata: Metadata = {
  title: "Restricted · Nebula",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Where the proxy rewrites unauthenticated admin requests.
 *
 * It is its own route rather than a branch inside the admin layout so that the real admin pages
 * are never rendered for a locked visitor. Their queries never run and nothing about them reaches
 * the RSC payload.
 */
export default function AdminLockedPage() {
  return <AdminGate />;
}
