"use client";

import {
  Activity,
  Gauge,
  LayoutDashboard,
  Layers,
  MessageSquare,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppNavMenu } from "@/components/app/app-nav-menu";
import { IdentityProvider } from "@/components/app/identity";
import { ProfileMenu } from "@/components/app/profile-menu";
import { ReviewLink, ReviewProvider } from "@/components/app/review";
import { Logo } from "@/components/site/logo";


const APP_NAV = [
  { href: "/app", label: "Position", icon: LayoutDashboard },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/vault", label: "Vault", icon: Layers },
  { href: "/app/profile", label: "Profile", icon: User },
];

const ADMIN_NAV = [
  { href: "/asdfg/admin", label: "Overview", icon: Gauge },
  { href: "/asdfg/admin/users", label: "Depositors", icon: Users },
  { href: "/asdfg/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/asdfg/admin/ops", label: "Operations", icon: ShieldCheck },
];

/**
 * Chrome for the signed-in surfaces.
 *
 * Deliberately not the marketing navbar: no hide-on-scroll, no shader, no footer. Someone looking
 * at a live position wants the numbers to stay still, and a scroll-reactive bar over a balance
 * reads as instability.
 */
export function AppShell({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const pathname = usePathname();
  const items = admin ? ADMIN_NAV : APP_NAV;

  return (
    <IdentityProvider>
      <ReviewProvider>
        <Shell admin={admin} items={items} pathname={pathname}>
          {children}
        </Shell>
      </ReviewProvider>
    </IdentityProvider>
  );
}

function Shell({
  children,
  admin,
  items,
  pathname,
}: {
  children: React.ReactNode;
  admin: boolean;
  items: typeof APP_NAV;
  pathname: string;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="dither-overlay" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-edge bg-void/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-app items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="brand flex items-center gap-3">
              <Logo size={28} cell={1.7} className="brand-mark text-signal" />
              <span className="brand-name hidden font-mono text-base tracking-[0.2em] uppercase sm:block">
                Nebula
              </span>
            </Link>

            {admin && (
              <span className="border border-ember/40 px-2 py-1 font-mono text-[0.625rem] tracking-wider text-ember uppercase">
                Admin
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <AppNavMenu items={items} pathname={pathname} />
            <ProfileMenu />
          </div>
        </div>

        {/* Tabs from `md` up, where they fit without scrolling. Below that they collapse into
            AppNavMenu: a horizontally scrolling tab strip hides destinations off the edge with no
            affordance saying so, which is worse than a menu that lists all of them. */}
        <nav className="mx-auto hidden max-w-app gap-1 px-3 sm:px-6 md:flex">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 font-mono text-xs tracking-wider uppercase transition-colors ${
                  active
                    ? "border-signal text-signal"
                    : "border-transparent text-ink-faint hover:text-ink"
                }`}
              >
                <span
                  className={active ? "" : "opacity-90"}
                  style={
                    active
                      ? undefined
                      : {
                          WebkitMaskImage:
                            "radial-gradient(circle at 1px 1px, #000 0.85px, transparent 0)",
                          maskImage:
                            "radial-gradient(circle at 1px 1px, #000 0.85px, transparent 0)",
                          WebkitMaskSize: "2px 2px",
                          maskSize: "2px 2px",
                        }
                  }
                >
                  <item.icon size={16} strokeWidth={active ? 2 : 2.5} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-edge">
        <div className="mx-auto flex max-w-app flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-mono text-xs text-ink-faint">
            Stellar testnet. Tokens have no real value.
          </span>
          <div className="flex gap-6">
            <Link
              href="/how-it-works"
              className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
            >
              Docs
            </Link>
            <Link
              href="/faq"
              className="font-mono text-xs text-ink-faint transition-colors hover:text-signal"
            >
              FAQ
            </Link>
            <ReviewLink />
          </div>
        </div>
      </footer>
    </div>
  );
}

