"use client";

import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DitherField } from "@/components/shader/dither-field";
import { Logo } from "@/components/site/logo";
import { DitherSpinner } from "@/components/ui/dither-loader";
import { useWallet } from "@/components/wallet/wallet-provider";
import { signInAdmin } from "@/lib/admin-actions";
import { isAdminAddress } from "@/lib/admin";
import { shortAddress } from "@/lib/contracts";
import { DURATION, ENTER } from "@/lib/easing";

/**
 * The password prompt.
 *
 * The connected wallet is shown as context, not as a credential. Address checks happen in the
 * browser and can be spoofed by anyone willing to edit their own JavaScript; the password is
 * compared on the server and is the only thing actually holding this door shut.
 */
export function AdminGate() {
  const router = useRouter();
  const { address } = useWallet();

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);

    const result = await signInAdmin(password);
    setBusy(false);

    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error ?? "Could not sign in.");
      setPassword("");
    }
  };

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden px-5">
      <DitherField
        variant="drift"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        speed={0.3}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(7,8,10,0.9) 0%, rgba(7,8,10,0.6) 55%, transparent 85%)",
        }}
      />

      <div className="panel relative w-full max-w-md">
        <div className="flex items-center gap-3.5 border-b border-edge p-6">
          <Logo size={30} cell={1.8} className="text-signal" />
          <span className="font-mono text-sm tracking-[0.2em] uppercase">Nebula</span>
          <span className="ml-auto border border-ember/40 px-2 py-1 font-mono text-[0.625rem] tracking-wider text-ember uppercase">
            Admin
          </span>
        </div>

        <form onSubmit={submit} className="p-7 sm:p-8">
          <Icon icon={ShieldCheck} size={26} className="text-signal" strokeWidth={2} />

          <h1 className="mt-6 text-2xl font-medium tracking-tight text-ink">Restricted</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-dim">
            This section shows depositor records and vault controls. Enter the operator password to
            continue.
          </p>

          {address && (
            <p className="mt-6 font-mono text-xs text-ink-faint">
              Connected as {shortAddress(address, 6, 6)}
              {isAdminAddress(address) ? " · recognised operator" : " · not an operator address"}
            </p>
          )}

          <label htmlFor="admin-password" className="label mt-8 block">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="mt-3 w-full border-b border-edge bg-transparent pb-3 font-mono text-lg text-ink transition-colors outline-none focus:border-signal"
          />

          <button
            type="submit"
            disabled={busy || !password}
            className="btn btn-primary mt-8 w-full !py-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <>
                <DitherSpinner size={18} /> Checking
              </>
            ) : (
              "Unlock"
            )}
          </button>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: ENTER }}
              className="mt-5 border border-ember/30 bg-ember/[0.06] px-4 py-3 text-sm text-ink-dim"
            >
              {error}
            </motion.p>
          )}

          <Link
            href="/app"
            className="mt-8 inline-flex items-center gap-2 font-mono text-xs tracking-wider text-ink-faint uppercase transition-colors hover:text-ink"
          >
            <Icon icon={ArrowLeft} size={14} /> Back to the app
          </Link>
        </form>
      </div>
    </div>
  );
}
