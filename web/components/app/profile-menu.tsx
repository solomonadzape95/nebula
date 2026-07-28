"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Copy, Lock, LogOut, User, Wallet } from "lucide-react";

import type { LucideIcon } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DitherAvatar } from "@/components/dither-kit/avatar";
import { useBalances } from "@/components/app/balances";
import { useIdentity } from "@/components/app/identity";
import { useWallet } from "@/components/wallet/wallet-provider";
import { ADMIN_ROOT } from "@/lib/admin";
import { signOutAdmin } from "@/lib/admin-actions";
import { shortAddress } from "@/lib/contracts";
import { DURATION, ENTER, EXIT, MORPH_SPRING } from "@/lib/easing";
import { formatNumber } from "@/lib/format";

/**
 * The header identity control.
 *
 * Portalled for the same reason everything else overlaid on this site is: the app header carries
 * `backdrop-blur`, and a backdrop filter makes its element the containing block for
 * `position: fixed` descendants. Rendered in place the scrim would resolve against the header
 * strip rather than the viewport.
 */
export function ProfileMenu() {
  const { address, disconnect } = useWallet();
  const { displayName, seed, profile } = useIdentity();

  // Already fetched on connect, so the figures are present the first time this opens rather than
  // arriving a beat later.
  const { xlm, shares } = useBalances();
  const pathname = usePathname();
  const inAdmin = pathname.startsWith(ADMIN_ROOT);

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!address) {
    return (
      <Link href="/connect" className="btn btn-primary !px-5 !py-2.5 !text-xs">
        <Icon icon={Wallet} size={15} strokeWidth={2} />
        Connect
      </Link>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2.5 border border-edge py-1.5 pr-3 pl-1.5 transition-colors hover:border-ink-faint"
      >
        <DitherAvatar name={seed} hue={profile?.hue} size={28} animate={false} />
        <span className="font-mono text-xs text-ink-dim">
          {displayName ?? shortAddress(address, 4, 4)}
        </span>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.fast, ease: EXIT }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-60"
                />
                <div key="row" className="pointer-events-none fixed inset-x-0 top-3 z-70">
                  <div className="mx-auto flex max-w-app justify-end px-5 sm:px-8">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION.fast } }}
                      transition={MORPH_SPRING}
                      style={{ transformOrigin: "top right" }}
                      className="panel pointer-events-auto w-[min(88vw,20rem)] overflow-hidden"
                    >
                      <div className="flex items-center gap-3.5 border-b border-edge p-5">
                        <DitherAvatar name={seed} hue={profile?.hue} size={44} />
                        <span className="min-w-0">
                          <span className="block truncate text-base text-ink">
                            {displayName ?? "Unnamed"}
                          </span>
                          <span className="block font-mono text-xs text-ink-faint">
                            {shortAddress(address, 6, 6)}
                          </span>
                        </span>
                      </div>

                      <div className="space-y-3 border-b border-edge p-5">
                        <Balance label="XLM" value={xlm} />
                        <Balance label="nXLM" value={shares} signal />
                      </div>

                      {/* In admin the menu offers the way out of admin rather than a link into the
                          user-facing profile, which would silently drop the operator back into the
                          ordinary app. */}
                      <div className="p-2">
                        {inAdmin ? (
                          <MenuItem glyph={ArrowLeft} onClick={() => setOpen(false)} href="/app">
                            Back to the app
                          </MenuItem>
                        ) : (
                          <MenuItem glyph={User} onClick={() => setOpen(false)} href="/app/profile">
                            Profile
                          </MenuItem>
                        )}
                        <MenuItem glyph={copied ? Check : Copy} onClick={copy}>
                          {copied ? "Copied" : "Copy address"}
                        </MenuItem>
                        {inAdmin && (
                          <MenuItem
                            glyph={Lock}
                            tone="ember"
                            onClick={async () => {
                              setOpen(false);
                              await signOutAdmin();
                              window.location.assign("/app");
                            }}
                          >
                            Lock admin
                          </MenuItem>
                        )}
                        <MenuItem
                          glyph={LogOut}
                          tone="ember"
                          onClick={() => {
                            setOpen(false);
                            disconnect();
                          }}
                        >
                          Disconnect
                        </MenuItem>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function Balance({ label, value, signal }: { label: string; value: number | null; signal?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="label">{label}</span>
      <span
        className={`tabular font-mono text-base ${signal ? "text-signal" : "text-ink"}`}
      >
        {value === null ? "—" : formatNumber(value, 4)}
      </span>
    </div>
  );
}

function MenuItem({
  glyph,
  children,
  href,
  onClick,
  tone = "default",
}: {
  glyph: LucideIcon;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "ember";
}) {
  const cls = `flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors ${
    tone === "ember" ? "text-ember hover:bg-ember/10" : "text-ink-dim hover:bg-raised hover:text-ink"
  }`;

  const inner = (
    <>
      <Icon icon={glyph} size={16} />
      {children}
    </>
  );

  return href ? (
    <Link href={href} onClick={onClick} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Nudges anyone connected without a username, once, without blocking anything. */
export function UsernamePrompt() {
  const { needsUsername } = useIdentity();
  const [dismissed, setDismissed] = useState(false);

  if (!needsUsername || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: ENTER }}
      className="mb-8 flex flex-col gap-4 border border-signal-dim/40 bg-signal/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm leading-relaxed text-ink-dim">
        <span className="text-signal">Pick a username.</span> It gives you an avatar and makes your
        activity readable instead of a string of characters.
      </p>
      <span className="flex shrink-0 gap-3">
        <Link href="/app/profile" className="btn btn-primary !px-4 !py-2 !text-xs">
          Choose one
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-ink"
        >
          Later
        </button>
      </span>
    </motion.div>
  );
}
