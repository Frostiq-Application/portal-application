import { useNavigate } from "react-router-dom";
import { Gift, TrendingUp, Zap } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useMySubscriptionQuery } from "@/features/api/billingApi";
import { daysUntil } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** Show the capacity nudge only once a limit is actually close. */
const NEARLY_FULL = 0.8;

/**
 * The trial countdown and the capacity nudge, on the screen people actually
 * open every day.
 *
 * Both signals already existed but only on the billing page, which a bakery
 * visits roughly never — a countdown nobody sees isn't a countdown. This is
 * deliberately one line: it sits above the day's numbers, so it has to be
 * skimmable and must not turn the dashboard into a billing screen.
 *
 * Exactly one message renders. The trial deadline outranks capacity, because a
 * trial that lapses takes the capacity question with it.
 */
export function TrialStatusStrip() {
  const navigate = useNavigate();
  const { data } = useMySubscriptionQuery();

  const sub = data?.subscription;
  if (!sub) return null;

  // ---- 1. Trial countdown -------------------------------------------------
  if (sub.status === "trial" && sub.trialEndsAt) {
    const left = Math.max(0, daysUntil(sub.trialEndsAt));
    const urgent = left <= 3;
    return (
      <Strip
        tone={urgent ? "warn" : "info"}
        Icon={Gift}
        title={
          left === 0
            ? "Your trial ends today"
            : `${left} day${left === 1 ? "" : "s"} left in your trial`
        }
        body={
          urgent
            ? "Pick a plan now and nothing about your shop changes."
            : "You're on the full plan. Pick one before it ends to keep every feature."
        }
        cta="See plans"
        onClick={() => navigate("/my-subscription")}
      />
    );
  }

  // ---- 2. Running out of room --------------------------------------------
  // Unlimited rows have no ratio to be near, and an effective limit of 0 would
  // divide by zero — both are skipped rather than special-cased downstream.
  const tight = (data?.usage ?? [])
    .filter((u) => !u.isUnlimited && u.effective != null && u.effective > 0)
    .map((u) => ({ ...u, ratio: u.used / u.effective! }))
    .filter((u) => u.ratio >= NEARLY_FULL)
    .sort((a, b) => b.ratio - a.ratio)[0];

  if (tight) {
    const full = tight.used >= tight.effective!;
    return (
      <Strip
        tone={full ? "warn" : "info"}
        Icon={TrendingUp}
        title={
          full
            ? `You've used all ${tight.effective} ${tight.label.toLowerCase()}`
            : `${tight.used} of ${tight.effective} ${tight.label.toLowerCase()} used`
        }
        body={
          full
            ? "Move up a plan or add capacity to keep adding."
            : "You're close to your plan's limit. Worth a look before you hit it."
        }
        cta={full ? "Upgrade" : "See options"}
        onClick={() => navigate("/my-subscription")}
      />
    );
  }

  return null;
}

function Strip({
  tone,
  Icon,
  title,
  body,
  cta,
  onClick,
}: {
  tone: "warn" | "info";
  Icon: typeof Gift;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
        tone === "warn"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          tone === "warn" ? "text-amber-600" : "text-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      <Button size="sm" onClick={onClick} className="shrink-0">
        <Zap className="size-4" />
        {cta}
      </Button>
    </div>
  );
}
