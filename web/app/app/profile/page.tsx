import type { Metadata } from "next";

import { ProfilePanel } from "@/components/app/profile-panel";

export const metadata: Metadata = {
  title: "Profile · Nebula",
};

export default function ProfilePage() {
  return <ProfilePanel />;
}
