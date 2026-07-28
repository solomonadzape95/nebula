"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, MessageSquare, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DitherSpinner } from "@/components/ui/dither-loader";
import { useWallet } from "@/components/wallet/wallet-provider";
import { DURATION, ENTER, EXIT, MORPH_SPRING } from "@/lib/easing";
import { submitReview } from "@/lib/profile-actions";

interface ReviewValue {
  open: () => void;
}

const ReviewContext = createContext<ReviewValue | null>(null);

export function useReview(): ReviewValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used inside <ReviewProvider>");
  return ctx;
}

/** Ignore momentum wobble so the floating button does not flicker. */
const THRESHOLD = 12;
/** Below this there is nothing to review yet, so the button stays out of the way. */
const REVEAL_AT = 400;

/**
 * Feedback capture: a floating trigger, a modal, and the shared open handle.
 *
 * The trigger appears on the way *down* and hides on the way up. Scrolling down means still
 * reading; scrolling back up usually means leaving, and asking for feedback at the door is how you
 * get an empty form. App surfaces only, never the landing page: an opinion is worth something once
 * someone has used the thing.
 */
export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - previous;
      if (Math.abs(delta) > THRESHOLD) {
        setVisible(delta > 0 && current > REVEAL_AT);
        previous = current;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <ReviewContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <FloatingTrigger visible={visible && !isOpen} onClick={() => setIsOpen(true)} />
      <ReviewModal open={isOpen} onClose={() => setIsOpen(false)} />
    </ReviewContext.Provider>
  );
}

/**
 * The floating trigger.
 *
 * Behaves exactly like a row in the landing menu: at rest the icon is dithered and desaturated,
 * and hover resolves it to solid signal colour and lifts it. No shape morph and no glow until the
 * pointer is on it. A button that glows while nobody is looking at it competes with the content
 * it is sitting on top of.
 */
function FloatingTrigger({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label="Leave a review"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: DURATION.base, ease: ENTER }}
          whileHover="hover"
          whileFocus="hover"
          whileTap={{ scale: 0.96 }}
          className="fixed right-5 bottom-5 z-50 flex size-14 items-center justify-center border border-edge bg-void/85 backdrop-blur-sm transition-colors outline-none hover:border-signal-dim focus-visible:border-signal-dim sm:right-8 sm:bottom-8"
        >
          <span className="relative flex size-6 items-center justify-center">
            {/* Rest: dithered and dim. */}
            <motion.span
              variants={{ hover: { opacity: 0 } }}
              initial={{ opacity: 1 }}
              transition={{ duration: DURATION.fast }}
              className="absolute text-ink-faint"
              style={{
                WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
                maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
                WebkitMaskSize: "2.5px 2.5px",
                maskSize: "2.5px 2.5px",
              }}
            >
              <MessageSquare size={24} strokeWidth={2.5} />
            </motion.span>

            {/* Hover: solid, signal, lifted. */}
            <motion.span
              variants={{ hover: { opacity: 1, scale: 1, y: 0 } }}
              initial={{ opacity: 0, scale: 0.82, y: 4 }}
              transition={MORPH_SPRING}
              className="absolute text-signal"
            >
              <MessageSquare size={24} strokeWidth={2} />
            </motion.span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function ReviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useWallet();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [deposited, setDeposited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const submit = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    const result = await submitReview({ address, rating, body, deposited });
    setBusy(false);
    if (result.ok) {
      setDone(true);
      window.setTimeout(() => {
        onClose();
        setDone(false);
        setRating(0);
        setBody("");
        setDeposited(false);
      }, 1600);
    } else {
      setError(result.error ?? "Could not save that.");
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EXIT }}
            onClick={onClose}
            className="fixed inset-0 z-60 bg-void/80 backdrop-blur-sm"
          />
          <div key="row" className="pointer-events-none fixed inset-0 z-70 grid place-items-center p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: DURATION.fast } }}
              transition={MORPH_SPRING}
              className="panel pointer-events-auto w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-edge px-6 py-5">
                <span className="label">How was it?</span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-ink-dim transition-colors hover:text-ink"
                >
                  <X size={22} strokeWidth={2} />
                </button>
              </div>

              {done ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <Check size={30} className="text-signal" strokeWidth={2.5} />
                  <p className="mt-5 text-lg text-ink">Thank you.</p>
                  <p className="mt-2 text-sm text-ink-dim">
                    Genuinely read, and acted on where we can.
                  </p>
                </div>
              ) : !address ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-base text-ink-dim">
                    Connect a wallet first, so we can tell reviews apart.
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  <span className="label">Rating</span>
                  <div className="mt-3 flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        aria-label={`${n} out of 5`}
                        className={`h-11 flex-1 border font-mono text-sm transition-colors ${
                          rating >= n
                            ? "border-signal bg-signal/15 text-signal"
                            : "border-edge text-ink-faint hover:border-ink-faint"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <label htmlFor="review-body" className="label mt-7 block">
                    What worked, and what did not
                  </label>
                  <textarea
                    id="review-body"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setError(null);
                    }}
                    rows={5}
                    maxLength={2000}
                    placeholder="The part that confused me was…"
                    className="mt-3 w-full resize-none border border-edge bg-void/60 p-4 text-base text-ink transition-colors outline-none placeholder:text-ink-faint focus:border-signal"
                  />

                  <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-ink-dim">
                    <input
                      type="checkbox"
                      checked={deposited}
                      onChange={(e) => setDeposited(e.target.checked)}
                      className="size-4 accent-[var(--color-signal)]"
                    />
                    I managed to complete a deposit
                  </label>

                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || rating === 0 || body.trim().length < 4}
                    className="btn btn-primary mt-7 w-full !py-4 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? (
                      <>
                        <DitherSpinner size={18} /> Sending
                      </>
                    ) : (
                      "Send review"
                    )}
                  </button>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: DURATION.base, ease: ENTER }}
                      className="mt-4 border border-ember/30 bg-ember/[0.06] px-4 py-3 text-sm text-ink-dim"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** The footer entry point, for people who never scroll far enough to see the floating one. */
export function ReviewLink({ className }: { className?: string }) {
  const { open } = useReview();
  return (
    <button
      type="button"
      onClick={open}
      className={className ?? "font-mono text-xs text-ink-faint transition-colors hover:text-signal"}
    >
      Leave a review
    </button>
  );
}
