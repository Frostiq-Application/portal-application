import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, Loader2, ReceiptIndianRupee, ShieldCheck, TriangleAlert } from "@/components/ui/icons";
import { usePaymentExitGuard } from "@/hooks/usePaymentExitGuard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Where the flow is between Razorpay handing back a signed result and the app
 * being ready to move on. These are real states, not a fake progress bar:
 * each one is a request that is genuinely in flight.
 */
export type PaymentStage = "verifying" | "activating" | "done" | "error";

interface Props {
  open: boolean;
  stage: PaymentStage;
  /** What was bought — "Growth · Yearly", "Extra branches", … */
  detail?: string;
  /** Formatted amount, shown as the anchor fact while they wait. */
  amount?: string;
  /** Only read on the `error` stage. */
  errorMessage?: string;
  errorActionLabel?: string;
  onErrorAction?: () => void;
}

/** The three things that actually happen, in order. */
const STEPS = [
  { key: "paid", label: "Payment authorised" },
  { key: "verifying", label: "Confirming with Razorpay" },
  { key: "activating", label: "Activating your plan" },
] as const;

/**
 * Full-screen lock shown between "Razorpay says the payment went through" and
 * "the app is ready to show you the result".
 *
 * This window is short but it is the single worst moment in the product to lose
 * the tab: the money has left the customer's account, and the record of what it
 * bought is still being written. So while it is up the page cannot be scrolled,
 * navigated back out of, or dismissed with Escape, and a refresh or tab-close
 * raises the browser's own confirm dialog.
 *
 * None of that is a data-integrity guarantee — the Razorpay webhook settles the
 * same payment server-side and is idempotent, so a killed tab still ends up with
 * the right subscription. The lock exists so nobody has to find that out while
 * wondering whether they have just been charged for nothing.
 */
export function PaymentProcessingOverlay({
  open,
  stage,
  detail,
  amount,
  errorMessage,
  errorActionLabel = "Go to billing",
  onErrorAction,
}: Props) {
  // On `error` the flow is over and the customer must be able to leave — a
  // lock with no exit is a trap, not a safeguard.
  const locked = open && stage !== "error";
  const [nudged, setNudged] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Someone tried to get out. Flinch the card and escalate the warning. */
  const nudge = useCallback(() => {
    setNudged(false);
    // Restart the shake even if it is already showing.
    requestAnimationFrame(() => setNudged(true));
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudged(false), 8000);
  }, []);

  // Refresh, tab close and Back are handled by the shared guard — this screen
  // is the strictest use of it, so the Back trap is on.
  usePaymentExitGuard(locked, { onAttempt: nudge, guardBackButton: true });

  useEffect(() => {
    if (!locked) return;

    // Escape is this overlay's own concern rather than the guard's: there is no
    // dismiss to reach, so the key has to die here instead of bubbling to some
    // dialog underneath and closing it.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        nudge();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [locked, nudge]);

  useEffect(
    () => () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    },
    [],
  );

  if (!open) return null;

  const done = stage === "done";
  const failed = stage === "error";
  const activeIndex = stage === "verifying" ? 1 : stage === "activating" ? 2 : 3;

  const headline = failed
    ? "We couldn't confirm it just yet"
    : done
      ? "You're all set"
      : stage === "activating"
        ? "Activating your plan"
        : "Confirming your payment";

  const subline = failed
    ? "Your money is safe. If it was debited, the payment settles on its own within a few minutes and your plan switches on — no need to pay again."
    : done
      ? "Payment confirmed and your plan is live. Taking you through…"
      : "This usually takes a few seconds. Please keep this window open.";

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={headline}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md duration-300 animate-in fade-in-0"
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-2xl",
          nudged && "animate-pay-nudge",
        )}
      >
        {/* ---- emblem ------------------------------------------------- */}
        <div className="relative mx-auto flex size-20 items-center justify-center">
          {!done && !failed && (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/25 animate-pay-ring" />
              <span
                className="absolute inset-0 rounded-full bg-primary/25 animate-pay-ring"
                style={{ animationDelay: "0.8s" }}
              />
            </>
          )}
          <span
            className={cn(
              "relative flex size-16 items-center justify-center rounded-full",
              failed
                ? "bg-destructive/10 text-destructive"
                : done
                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary",
            )}
          >
            {failed ? (
              <CircleAlert className="size-8" />
            ) : done ? (
              <Check className="size-8 animate-pay-pop" strokeWidth={2.5} />
            ) : (
              <ReceiptIndianRupee className="size-7" />
            )}
          </span>
        </div>

        <h2 className="mt-5 text-xl font-semibold tracking-tight">{headline}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {failed ? errorMessage || subline : subline}
        </p>

        {/* ---- what was bought ---------------------------------------- */}
        {(amount || detail) && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-left">
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {detail}
            </span>
            {amount && (
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {amount}
              </span>
            )}
          </div>
        )}

        {/* ---- real progress ------------------------------------------ */}
        {!failed && (
          <ol className="mt-5 space-y-2.5 text-left">
            {STEPS.map((s, i) => {
              const complete = i < activeIndex;
              const active = i === activeIndex;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                      complete
                        ? "bg-emerald-600 text-white"
                        : active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground/50",
                    )}
                  >
                    {complete ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : active ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm transition-colors",
                      complete
                        ? "text-muted-foreground"
                        : active
                          ? "font-medium text-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* ---- the "don't leave" line, escalated once they try --------- */}
        {locked && (
          <p
            className={cn(
              "mt-5 flex items-start gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors",
              nudged
                ? "bg-destructive/10 font-medium text-destructive"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
          >
            {nudged ? (
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
            ) : (
              <ShieldCheck className="mt-px size-3.5 shrink-0" />
            )}
            {nudged
              ? "Please don't close or refresh yet — we're still writing your payment to your account. It'll only be a moment."
              : "Don't close or refresh this window while we finish up."}
          </p>
        )}

        {failed && onErrorAction && (
          <Button className="mt-6 w-full" onClick={onErrorAction}>
            {errorActionLabel}
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}
