import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: "App · Nebula",
  description: "Deposit XLM, hold nXLM, and watch the share price climb.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
