"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

import { DitherSpinner } from "@/components/ui/dither-loader";
import { Icon } from "@/components/ui/icon";
import { useWallet } from "@/components/wallet/wallet-provider";
import { track } from "@/lib/analytics";
import { explorerAccount, shortAddress } from "@/lib/contracts";
import { ensureWalletSession } from "@/lib/session-client";
import { submitSurvey } from "@/lib/survey-actions";
import {
  BACKGROUND,
  CONSENT,
  DID,
  HOLDS_XLM,
  MAINNET_SIZE,
  STUCK,
  SURVEY_FORM_URL,
  USED_YIELD,
  WALLETS,
} from "@/lib/survey-fields";

/**
 * The structured survey, as a page rather than a Google Form.
 *
 * The whole design turns on one thing: **the wallet address is never typed.** It comes from a
 * session the wallet has signed for, which means every response joins to the on-chain deposit
 * record automatically and cannot claim someone else's activity. A form that asks people to paste
 * a 56-character address gets a transcription error rate that quietly ruins the join, and it puts
 * the most important field in the hands of whoever is least motivated to get it right.
 *
 * Field order follows `docs/USER_SURVEY.md`: cheap questions first, the two that actually matter —
 * what would have to be true for real money, and what was broken — last, once someone is committed.
 */

/* ─────────────────────────────────────────────────────────── field chrome */

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-edge pt-7">
      <label className="block text-base font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-signal">*</span> : null}
      </label>
      {hint ? <p className="mt-1.5 text-sm leading-relaxed text-ink-faint">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const INPUT =
  "w-full border-b border-edge bg-transparent pb-3 text-base text-ink transition-colors outline-none placeholder:text-ink-faint focus:border-signal";

/** Radio and checkbox share their look — a bordered chip that fills with signal when chosen. */
function Chip({
  checked,
  onChange,
  label,
  name,
  type,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  name: string;
  type: "radio" | "checkbox";
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-sm transition-colors ${
        checked
          ? "border-signal bg-signal/[0.07] text-ink"
          : "border-edge text-ink-dim hover:border-ink-faint"
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex size-4 shrink-0 items-center justify-center border ${
          checked ? "border-signal bg-signal" : "border-edge"
        } ${type === "radio" ? "rounded-full" : ""}`}
      >
        {checked ? <Icon icon={Check} size={11} strokeWidth={3} className="text-void" /> : null}
      </span>
      {label}
    </label>
  );
}

function Choices({
  options,
  value,
  onChange,
  name,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <Chip
          key={o}
          type="radio"
          name={name}
          label={o}
          checked={value === o}
          onChange={() => onChange(o)}
        />
      ))}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── form */

export function SurveyForm({ alreadyResponded }: { alreadyResponded: boolean }) {
  const { address } = useWallet();

  const [handle, setHandle] = useState("");
  const [contact, setContact] = useState("");
  const [country, setCountry] = useState("");
  const [background, setBackground] = useState("");
  const [usedYield, setUsedYield] = useState("");
  const [holdsXlm, setHoldsXlm] = useState("");
  const [did, setDid] = useState<string[]>([]);
  const [wallet, setWallet] = useState("");
  const [stuckWhere, setStuckWhere] = useState("");
  const [mainnetSize, setMainnetSize] = useState("");
  const [requirements, setRequirements] = useState("");
  const [clarity, setClarity] = useState(0);
  const [issues, setIssues] = useState("");
  const [consent, setConsent] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  // Fired once, on the first keystroke or click. A pageview says someone saw the form; this says
  // they engaged with it, and the gap between the two is the drop-off worth knowing about.
  const begin = () => {
    if (started) return;
    setStarted(true);
    track("survey_started");
  };

  const toggle = (item: string) => {
    begin();
    setDid((prev) => (prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]));
  };

  const submit = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);

    // The response is attributed to a wallet, so the wallet proves it is here — the same challenge
    // the review widget uses. Without it the server would have only the address the client claimed.
    const session = await ensureWalletSession(address);
    if (!session.ok) {
      setBusy(false);
      setError(session.error ?? "Could not verify the wallet.");
      return;
    }

    const result = await submitSurvey({
      handle,
      contact,
      country,
      background,
      usedYield,
      holdsXlm,
      did,
      wallet,
      stuckWhere,
      mainnetSize,
      requirements,
      clarity,
      issues,
      consent,
    });

    setBusy(false);
    if (result.ok) {
      // Only the clarity score and whether they got stuck. The answers themselves belong in the
      // admin panel where they can be read and acted on, not in an analytics property.
      track("survey_submitted", { clarity, stuck: stuckWhere !== "I didn't get stuck" });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setError(result.error ?? "Could not save that.");
    }
  };

  /* ───────────────────────────────────────────────────────────── states */

  if (done) {
    return (
      <div className="panel p-8 text-center sm:p-12">
        <div className="mx-auto flex size-12 items-center justify-center border border-signal bg-signal/[0.07]">
          <Icon icon={Check} size={22} className="text-signal" />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-tight text-ink">Thank you — genuinely.</h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-dim">
          This is the most useful thing anyone can give this project. If you left a contact, expect
          to hear back when something you flagged gets fixed.
        </p>
        <Link
          href="/app"
          className="mt-8 inline-block border border-edge px-6 py-3 text-sm text-ink transition-colors hover:border-signal hover:text-signal"
        >
          Back to the vault
        </Link>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="panel p-8 sm:p-12">
        <h2 className="text-2xl font-medium tracking-tight text-ink">Connect your wallet first</h2>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-dim">
          Not to identify you — so your answers can be matched to what actually happened on-chain.
          It means you never have to paste a 56-character address, and it means a response cannot
          claim activity that belongs to someone else. Testnet addresses are public and hold nothing
          of value.
        </p>
        <Link
          href="/connect"
          className="mt-8 inline-block border border-signal px-6 py-3 text-sm text-signal transition-colors hover:bg-signal/[0.07]"
        >
          Connect wallet
        </Link>

        {/* The escape hatch matters more than it looks. Someone who could not install a wallet, or
            read the landing page and left, is the most useful respondent there is — and they are
            precisely the person this page can never hear from. */}
        <p className="mt-8 border-t border-edge pt-6 text-sm leading-relaxed text-ink-dim">
          No wallet, or could not get one working?{" "}
          <a
            href={SURVEY_FORM_URL}
            target="_blank"
            rel="noreferrer"
            className="text-signal underline underline-offset-4 hover:no-underline"
          >
            Answer the same questions here instead
          </a>
          . If you got stuck before connecting, that is the single most useful thing you can tell
          us — please do not skip it on the grounds that you did not get far.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-7 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-7">
        <span className="label">Responding as</span>
        <a
          href={explorerAccount(address)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-sm text-ink-dim transition-colors hover:text-signal"
        >
          {shortAddress(address, 6, 6)}
        </a>
      </div>

      {alreadyResponded ? (
        <div className="mb-2 border border-signal-dim/40 bg-signal/[0.05] px-4 py-3 text-sm text-ink">
          You have already responded. Submitting again replaces your previous answers rather than
          adding a second response.
        </div>
      ) : null}

      <div className="space-y-7" onFocusCapture={begin}>
        <Field label="Name or handle" required hint="How you want to be credited. Not a legal name.">
          <input
            className={INPUT}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="satoshi"
            maxLength={120}
          />
        </Field>

        <Field
          label="Contact — email, Telegram or X"
          required
          hint="So we can tell you when something you flagged gets fixed."
        >
          <input
            className={INPUT}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="@handle or you@example.com"
            maxLength={200}
          />
        </Field>

        <Field label="Country" hint="Optional. Geographic spread is genuinely interesting.">
          <input
            className={INPUT}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Nigeria"
            maxLength={120}
          />
        </Field>

        <Field label="Which describes you best?" required>
          <Choices name="background" options={BACKGROUND} value={background} onChange={setBackground} />
        </Field>

        <Field label="Had you used a yield or lending product before this?" required>
          <Choices name="usedYield" options={USED_YIELD} value={usedYield} onChange={setUsedYield} />
        </Field>

        <Field label="Do you hold XLM outside testnet?" required>
          <Choices name="holdsXlm" options={HOLDS_XLM} value={holdsXlm} onChange={setHoldsXlm} />
        </Field>

        <Field
          label="What did you get done?"
          required
          hint="Tick everything that applies. “I got stuck” is the most useful answer on this form."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {DID.map((d) => (
              <Chip
                key={d}
                type="checkbox"
                name="did"
                label={d}
                checked={did.includes(d)}
                onChange={() => toggle(d)}
              />
            ))}
          </div>
        </Field>

        <Field label="Which wallet?" required>
          <Choices name="wallet" options={WALLETS} value={wallet} onChange={setWallet} />
        </Field>

        <Field label="If you got stuck, where?">
          <Choices name="stuckWhere" options={STUCK} value={stuckWhere} onChange={setStuckWhere} />
        </Field>

        <Field
          label="If this were live on mainnet, how much of your own XLM would you deposit?"
          hint="“Nothing” is a real answer and we would rather have it than a polite one."
        >
          <Choices
            name="mainnetSize"
            options={MAINNET_SIZE}
            value={mainnetSize}
            onChange={setMainnetSize}
          />
        </Field>

        <Field label="What would have to be true before you used it with real money?" required>
          <textarea
            className={`${INPUT} min-h-24 resize-y`}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="An audit, a track record, knowing where the yield comes from…"
            maxLength={2000}
          />
        </Field>

        <Field label="How clear was it what nXLM is and how it earns?" required>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-ink-faint">No idea</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  begin();
                  setClarity(n);
                }}
                aria-label={`${n} out of 5`}
                aria-pressed={clarity === n}
                className={`size-11 border font-mono text-sm transition-colors ${
                  clarity === n
                    ? "border-signal bg-signal/[0.07] text-signal"
                    : "border-edge text-ink-dim hover:border-ink-faint"
                }`}
              >
                {n}
              </button>
            ))}
            <span className="ml-1 text-sm text-ink-faint">Completely clear</span>
          </div>
        </Field>

        <Field label="Anything confusing, broken, or missing?" required>
          <textarea
            className={`${INPUT} min-h-24 resize-y`}
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            placeholder="Be blunt. This is the field the whole form exists for."
            maxLength={2000}
          />
        </Field>

        <Field
          label="May we include your response in our submission?"
          required
          hint="Testnet addresses are already public, but the link between one and your name is not. That link is what this form would create, so we ask before publishing it."
        >
          <Choices name="consent" options={CONSENT} value={consent} onChange={setConsent} />
        </Field>
      </div>

      {error ? (
        <p className="mt-7 border border-ember/30 bg-ember/[0.06] px-4 py-3 text-sm text-ink-dim">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-9 flex w-full items-center justify-center gap-3 border border-signal px-6 py-4 text-sm font-medium text-signal transition-colors hover:bg-signal/[0.07] disabled:opacity-50"
      >
        {busy ? <DitherSpinner /> : null}
        {busy ? "Saving…" : "Submit"}
      </button>

      <p className="mt-4 text-center text-xs text-ink-faint">
        Signing proves the wallet is yours. It is a signature, not a transaction — it moves nothing
        and costs nothing.
      </p>
    </div>
  );
}
