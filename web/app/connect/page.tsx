import type { Metadata } from "next";

import { ConnectPanel } from "@/components/site/connect-panel";

export const metadata: Metadata = {
  title: "Connect · Nebula",
  description: "Connect a Stellar wallet to deposit XLM and receive nXLM.",
};

export default function ConnectPage() {
  return <ConnectPanel />;
}
