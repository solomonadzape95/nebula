"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, Copy, Wallet } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DitherAvatar } from "@/components/dither-kit/avatar";
import { useIdentity } from "@/components/app/identity";
import { DitherSpinner } from "@/components/ui/dither-loader";
import { useWallet } from "@/components/wallet/wallet-provider";
import { getNativeBalance, getShareBalance } from "@/lib/balances";
import { explorerAccount, shortAddress } from "@/lib/contracts";
import { DURATION, ENTER } from "@/lib/easing";
import { formatNumber, shortDate } from "@/lib/format";

/** Evenly spaced around the wheel, so the swatches stay visually distinct. */
const HUES = [150, 175, 200, 265, 320, 20, 45, 95];

export function ProfilePanel() {
  const { address } = useWallet();
  const { profile, loaded, save, seed } = useIdentity();

  const [username, setUsername] = useState("");
  const [hue, setHue] = useState(150);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<{ xlm: number | null; shares: number | null } | null>(
    null,
  );

  // Seed the form from the loaded profile exactly once, keyed on the profile itself so a later
  // save does not clobber what the user is currently typing.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (loaded && profile && seededFor !== profile.address) {
    setSeededFor(profile.address);
    setUsername(profile.username);
    setHue(profile.hue);
  }

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void Promise.all([getNativeBalance(address), getShareBalance(address)]).then(
      ([xlm, shares]) => {
        if (!cancelled) setBalances({ xlm, shares });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) return <Disconnected />;

  const submit = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await save(username, hue);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } else {
      setError(result.error);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  // Preview reflects what is being typed, so the avatar reacts as you choose a name.
  const previewSeed = username.trim()
    ? `${username.trim()}:${address.slice(-6)}`
    : seed;

  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">Profile</h1>
      <p className="mt-2 max-w-2xl text-base text-ink-dim">
        Nebula stores a username and an avatar colour. Nothing else, because there is nothing else
        it needs.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <div className="panel p-7 sm:p-9">
          <span className="label">Identity</span>

          <div className="mt-7 flex items-center gap-5">
            <DitherAvatar name={previewSeed} hue={hue} size={80} bloom="low" />
            <div className="min-w-0">
              <p className="truncate text-xl text-ink">{username.trim() || "Unnamed"}</p>
              <p className="mt-1 font-mono text-xs text-ink-faint">
                {shortAddress(address, 6, 6)}
              </p>
              {profile && (
                <p className="mt-1 font-mono text-xs text-ink-faint">
                  Joined {shortDate(profile.createdAt)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-9">
            <label htmlFor="username" className="label">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="satoshi_lite"
              maxLength={20}
              className="mt-3 w-full border-b border-edge bg-transparent pb-3 font-mono text-xl text-ink transition-colors outline-none placeholder:text-ink-faint focus:border-signal"
            />
            <p className="mt-3 text-xs text-ink-faint">
              3 to 20 characters. Letters, numbers and underscores. Has to be unique.
            </p>
          </div>

          <div className="mt-8">
            <span className="label">Avatar colour</span>
            <div className="mt-4 flex flex-wrap gap-3">
              {HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHue(h)}
                  aria-label={`Hue ${h}`}
                  aria-pressed={hue === h}
                  className={`border p-1 transition-colors ${
                    hue === h ? "border-signal" : "border-edge hover:border-ink-faint"
                  }`}
                >
                  <DitherAvatar name={previewSeed} hue={h} size={34} animate={false} />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={saving || !username.trim()}
            className="btn btn-primary mt-9 w-full !py-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <DitherSpinner size={18} /> Saving
              </>
            ) : profile ? (
              "Update profile"
            ) : (
              "Create profile"
            )}
          </button>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.base, ease: ENTER }}
                className="mt-5 border border-ember/30 bg-ember/[0.06] px-4 py-3 text-sm text-ink-dim"
              >
                {error}
              </motion.p>
            )}
            {saved && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.base, ease: ENTER }}
                className="mt-5 flex items-center gap-2 border border-signal-dim/40 bg-signal/[0.05] px-4 py-3 text-sm text-ink"
              >
                <Icon icon={Check} size={15} className="text-signal" strokeWidth={2.5} /> Saved.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          <div className="panel p-7 sm:p-9">
            <span className="label">Balances</span>
            <div className="mt-7 space-y-7">
              <Figure label="Wallet" value={balances?.xlm ?? null} unit="XLM" />
              <Figure label="Your nXLM" value={balances?.shares ?? null} unit="nXLM" signal />
            </div>
            <Link href="/app" className="btn btn-ghost mt-8 w-full">
              Deposit or redeem
            </Link>
          </div>

          <div className="panel p-7 sm:p-9">
            <span className="label">Wallet</span>
            <p className="mt-4 font-mono text-sm break-all text-ink-dim">{address}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={copy} className="btn btn-ghost w-full sm:w-auto">
                {copied ? <Icon icon={Check} size={15} /> : <Icon icon={Copy} size={15} />}
                {copied ? "Copied" : "Copy address"}
              </button>
              <a
                href={explorerAccount(address)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost w-full sm:w-auto"
              >
                Explorer <Icon icon={ArrowUpRight} size={14} />
              </a>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-ink-faint">
              Nebula never holds your keys. Disconnecting removes this browser&apos;s permission and
              nothing else.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  unit,
  signal,
}: {
  label: string;
  value: number | null;
  unit: string;
  signal?: boolean;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <p
        className={`figure mt-2 text-3xl ${signal ? "text-signal" : "text-ink"}`}
      >
        {value === null ? "—" : formatNumber(value, 4)}{" "}
        <span className="text-base text-ink-faint">{unit}</span>
      </p>
    </div>
  );
}

function Disconnected() {
  return (
    <div className="mx-auto max-w-app px-5 py-20 sm:px-8">
      <div className="panel mx-auto flex max-w-md flex-col items-center px-7 py-14 text-center">
        <Icon icon={Wallet} size={28} className="text-ink-faint" strokeWidth={2} />
        <h1 className="mt-6 text-2xl font-medium tracking-tight text-ink">No wallet connected</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-dim">
          Your profile is tied to your wallet address, so there is nothing to show until one is
          connected.
        </p>
        <Link href="/connect" className="btn btn-primary mt-8">
          Connect wallet
        </Link>
      </div>
    </div>
  );
}
