import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, Loader2, RotateCcw, Sparkles, TrendingUp, Zap } from "@/components/ui/icons";
import { daysUntil, inr } from "@/lib/billing";
import { cn, formatDate } from "@/lib/utils";
import type { ScheduledChange, SubscriptionSummary, UsageRow } from "@/types/billing";
import { Button } from "@/components/ui/button";

type Tone = "danger" | "warn" | "info" | "muted";

interface Banner {
  tone: Tone;
  Icon: typeof AlertTriangle;
  title: string;
  body: ReactNode;
  action?: { label: string; onClick: () => void; icon?: typeof Zap };
  /** Lower sorts first. */
  priority: number;
}

const TONE: Record<Tone, { wrap: string; icon: string }> = {
  danger: {
    wrap: "border-destructive/40 bg-destructive/5",
    icon: "text-destructive",
  },
  warn: {
    wrap: "border-amber-500/40 bg-amber-500/5",
    icon: "text-amber-600",
  },
  info: { wrap: "border-primary/30 bg-primary/5", icon: "text-primary" },
  muted: { wrap: "border-muted-foreground/25 bg-muted/40", icon: "text-muted-foreground" },
};

/**
 * The one thing that needs attention right now.
 *
 * The dashboard used to stack up to four of these — trial countdown, scheduled
 * change, pending cancellation and overdue payment could all render at once,
 * producing a wall of amber where nothing stood out and the actually-urgent
 * item ("your storefront is offline") sat below three others.
 *
 * So: compute every applicable banner, sort by how much it matters, and render
 * **only the most important**. Everything demoted is still discoverable — the
 * scheduled change shows on the plan card, the trial countdown in the summary
 * — it just stops competing for the same attention.
 */
export function StatusBanner({
  subscription,
  scheduledChange,
  nextAmount,
  archiveDays,
  usage,
  onPay,
  onUndoCancel,
  onUndoChange,
  onUpgrade,
  undoingCancel,
  undoingChange,
}: {
  subscription: SubscriptionSummary;
  scheduledChange?: ScheduledChange | null;
  nextAmount?: string;
  archiveDays?: number;
  /** Count-limit usage, for the "no room left" banner. */
  usage?: UsageRow[];
  onPay: () => void;
  onUndoCancel: () => void;
  onUndoChange: () => void;
  /** Where "see options" goes; falls back to the pay action. */
  onUpgrade?: () => void;
  undoingCancel?: boolean;
  undoingChange?: boolean;
}) {
  const s = subscription;
  const banners: Banner[] = [];

  // ---- 1. Storefront offline. Nothing outranks this. ----------------------
  if (s.status === "locked") {
    banners.push({
      priority: 0,
      tone: "danger",
      Icon: AlertTriangle,
      title: "Your storefront is offline",
      body: (
        <>
          Customers can't order right now. Paying restores everything instantly —
          nothing has been deleted.
          {s.lockedUntil && (
            <> Cancels automatically on {formatDate(s.lockedUntil)}.</>
          )}
        </>
      ),
      action: { label: `Pay ${nextAmount ? inr(nextAmount) : "now"}`, onClick: onPay, icon: Zap },
    });
  }

  // ---- 2. Payment overdue, storefront still live -------------------------
  if (s.status === "grace") {
    banners.push({
      priority: 1,
      tone: "warn",
      Icon: AlertTriangle,
      title: "Payment needed",
      body: (
        <>
          Your storefront is still live so orders in progress aren't disrupted.
          {s.graceUntil && <> It goes offline on {formatDate(s.graceUntil)}.</>}
          {s.dunningAttempt > 0 && (
            <> We've retried {s.dunningAttempt} time{s.dunningAttempt > 1 ? "s" : ""}.</>
          )}
        </>
      ),
      action: { label: `Pay ${nextAmount ? inr(nextAmount) : "now"}`, onClick: onPay, icon: Zap },
    });
  }

  // ---- 3. Cancelling at period end ---------------------------------------
  if (s.cancelAtPeriodEnd) {
    banners.push({
      priority: 2,
      tone: "muted",
      Icon: CalendarClock,
      title: "Your subscription is cancelling",
      body: (
        <>
          You keep everything until {formatDate(s.currentPeriodEnd)}, then your
          storefront goes offline and your data is archived for{" "}
          {archiveDays ?? 90} days.
        </>
      ),
      action: { label: "Keep my subscription", onClick: onUndoCancel, icon: RotateCcw },
    });
  }

  // ---- 4. Trial ending soon ----------------------------------------------
  if (s.status === "trial" && s.trialEndsAt) {
    const left = Math.max(0, daysUntil(s.trialEndsAt));
    banners.push({
      // Urgent in the last week; a gentle nudge before that.
      priority: left <= 7 ? 3 : 6,
      tone: left <= 3 ? "warn" : "info",
      Icon: Sparkles,
      title:
        left === 0
          ? "Your trial ends today"
          : `${left} day${left === 1 ? "" : "s"} left in your trial`,
      body: (
        <>
          Ends {formatDate(s.trialEndsAt)}. Activate before then and your
          storefront never skips a beat — the "Powered by Frostique" badge
          disappears too.
        </>
      ),
      action: { label: "Activate now", onClick: onPay, icon: Zap },
    });
  }

  // ---- 5. Out of room on a Count limit ------------------------------------
  // Ranked below the trial countdown but above a scheduled change: hitting a
  // ceiling blocks work *today*, and it's the moment an upgrade is worth most.
  // Unlimited and zero-capacity rows are skipped — neither has a ratio.
  const full = (usage ?? [])
    .filter((u) => !u.isUnlimited && u.effective != null && u.effective > 0)
    .filter((u) => u.used >= u.effective!)
    .sort((a, b) => b.used - a.used)[0];

  if (full) {
    banners.push({
      priority: 3.5,
      tone: "warn",
      Icon: TrendingUp,
      title: `You've used all ${full.effective} ${full.label.toLowerCase()}`,
      body: (
        <>
          You can't add more {full.label.toLowerCase()} until there's room. Move
          up a plan, or buy extra capacity for this one — nothing you've already
          created is affected either way.
        </>
      ),
      action: { label: "See options", onClick: onUpgrade ?? onPay, icon: Zap },
    });
  }

  // ---- 6. Scheduled plan change ------------------------------------------
  if (scheduledChange) {
    banners.push({
      priority: 4,
      tone: "warn",
      Icon: CalendarClock,
      title: "Plan change scheduled",
      body: (
        <>
          You move to {scheduledChange.targetPlanName}
          {scheduledChange.targetCycleName && ` · ${scheduledChange.targetCycleName}`} on{" "}
          {formatDate(scheduledChange.effectiveAt)}. Nothing changes until then.
        </>
      ),
      action: { label: "Undo", onClick: onUndoChange, icon: RotateCcw },
    });
  }

  if (banners.length === 0) return null;

  const top = banners.sort((a, b) => a.priority - b.priority)[0]!;
  const tone = TONE[top.tone];
  const ActionIcon = top.action?.icon;
  const busy =
    (top.action?.onClick === onUndoCancel && undoingCancel) ||
    (top.action?.onClick === onUndoChange && undoingChange);

  return (
    <div
      role={top.tone === "danger" ? "alert" : "status"}
      data-banner-tone={top.tone}
      className={cn(
        "flex flex-wrap items-start gap-4 rounded-xl border p-4",
        tone.wrap,
      )}
    >
      <top.Icon className={cn("mt-0.5 size-5 shrink-0", tone.icon)} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{top.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{top.body}</p>
      </div>
      {top.action && (
        <Button
          onClick={top.action.onClick}
          disabled={busy}
          variant={top.tone === "muted" ? "outline" : "default"}
          className="shrink-0"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : ActionIcon ? (
            <ActionIcon className="size-4" />
          ) : null}
          {top.action.label}
        </Button>
      )}

      {/* When more than one thing applies, say so rather than hiding it. */}
      {banners.length > 1 && (
        <p className="w-full text-xs text-muted-foreground">
          +{banners.length - 1} other update
          {banners.length - 1 === 1 ? "" : "s"} — see the details below.
        </p>
      )}
    </div>
  );
}
