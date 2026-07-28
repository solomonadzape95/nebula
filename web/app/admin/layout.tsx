import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: "Admin · Nebula",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell admin>{children}</AppShell>;
}
