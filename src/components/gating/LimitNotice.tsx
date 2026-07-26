import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, PackagePlus, TriangleAlert } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface LimitState {
  /** Live count of active items. Archived ones never count. */
  used: number;
  /** The **effective** limit: plan value + purchased add-ons. Null = unlimited. */
  limit: number | null;
  atLimit: boolean;
  nearLimit: boolean;
  remaining: number | null;
}

/**
 * Resolve a Count limit into everything the UI needs to warn about it.
 *
 * `limit` must be the **effective** limit the server enforces (plan + add-ons),
 * never the raw plan value — warning at the plan value would nag a bakery that
 * has already paid for extra capacity, and blocking there would be a bug.
 */
export function useLimitState(
  used: number,
  limit: number | null,
): LimitState {
  if (limit == null) {
    return { used, limit: null, atLimit: false, nearLimit: false, remaining: null };
  }
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    atLimit: used >= limit,
    // One slot left on a small plan is worth flagging; on a 500-product plan
    // it isn't. 80% catches both without crying wolf.
    nearLimit: used < limit && (remaining <= 1 || used / limit >= 0.8),
    remaining,
  };
}

/**
 * Naive singular form. A blunt `replace(/s$/, "")` turns "branches" into
 * "branche", so strip the "-es" of a sibilant plural first.
 */
function singular(unit: string): string {
  if (/(ch|sh|s|x|z)es$/i.test(unit)) return unit.slice(0, -2);
  return unit.replace(/s$/i, "");
}

/**
 * The `12 / 12` pill next to a create button. Turns destructive at the limit so
 * the disabled button next to it has a visible reason.
 */
export function LimitCounter({
  state,
  unit,
  className,
}: {
  state: LimitState;
  unit: string;
  className?: string;
}) {
  if (state.limit == null) return null;
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-1 text-xs tabular-nums",
        state.atLimit
          ? "border-destructive/40 text-destructive"
          : state.nearLimit
            ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
            : "text-muted-foreground",
        className,
      )}
      title={`${unit} used vs your plan's effective limit (plan + add-ons)`}
    >
      {state.used} / {state.limit} {unit}
    </span>
  );
}

/**
 * The warning banner shown when an account is at — or close to — a Count limit
 * (SH-23).
 *
 * Two routes out, and both matter: **upgrade** the plan, or **add capacity**
 * without changing tier. Offering only the upgrade would push a bakery that
 * needs one extra branch into a plan it doesn't otherwise want.
 *
 * Shop admins and staff can't buy anything, so they're told who can rather than
 * being handed a button that would 403.
 */
export function LimitNotice({
  state,
  label,
  unit,
  className,
  /** Feature key for the add-on CTA; omit when the feature isn't add-onable. */
  addonAvailable = true,
}: {
  state: LimitState;
  /** Human name of the thing being limited, e.g. "products in this branch". */
  label: string;
  unit: string;
  className?: string;
  addonAvailable?: boolean;
}) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isOwner = role === "account_super_admin";

  if (state.limit == null) return null;
  if (!state.atLimit && !state.nearLimit) return null;

  const tone = state.atLimit ? "at" : "near";

  return (
    <div
      role={state.atLimit ? "alert" : "status"}
      data-limit-state={tone}
      className={cn(
        "mb-5 flex flex-wrap items-start gap-3 rounded-xl border p-4",
        state.atLimit
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-500/40 bg-amber-500/5",
        className,
      )}
    >
      {state.atLimit ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            state.atLimit ? "text-destructive" : "text-amber-800 dark:text-amber-300",
          )}
        >
          {state.atLimit
            ? `You've used all ${state.limit} ${unit} on your plan`
            : state.remaining === 1
              ? `1 ${singular(unit)} left on your plan`
              : `${state.remaining} ${unit} left on your plan`}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {state.atLimit ? (
            <>
              You can't add more {label} until you free up space, upgrade your
              plan, or buy extra capacity. Nothing you already have is affected.
            </>
          ) : (
            <>
              You're close to the limit for {label}. Worth adding capacity before
              you're blocked mid-task.
            </>
          )}
        </p>

        {isOwner && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={state.atLimit ? "default" : "outline"}
              onClick={() => navigate("/my-subscription?tab=plans")}
            >
              Upgrade plan
              <ArrowRight className="size-3.5" />
            </Button>
            {addonAvailable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/my-subscription?tab=addons")}
              >
                <PackagePlus className="size-3.5" />
                Add capacity
              </Button>
            )}
          </div>
        )}
        {!isOwner && (
          <p className="mt-2 text-xs text-muted-foreground">
            Ask your account owner to upgrade the plan or add capacity.
          </p>
        )}
      </div>
    </div>
  );
}
