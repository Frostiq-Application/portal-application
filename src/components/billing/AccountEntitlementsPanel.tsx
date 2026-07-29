import { useState } from "react";
import { toast } from "sonner";
import { Gift, Info, Loader2, Pencil, RotateCcw } from "@/components/ui/icons";
import {
  useAccountEntitlementsQuery,
  useRemoveAccountOverrideMutation,
} from "@/features/api/billingAdminApi";
import type { AccountEntitlementRow } from "@/types/billing";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { GrantOverrideDialog } from "./GrantOverrideDialog";

/** Order the categories read in, rather than however they were created. */
const CATEGORY_ORDER = ["core", "scale", "marketing", "insight", "product", "support"];

const CATEGORY_LABEL: Record<string, string> = {
  core: "Core",
  scale: "Capacity",
  marketing: "Marketing",
  insight: "Insight",
  product: "Product",
  support: "Support",
};

function categoryRank(c: string): number {
  const i = CATEGORY_ORDER.indexOf(c);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/** How a count row reads: what the plan gave, and what was added to it. */
function capacityBreakdown(row: AccountEntitlementRow): string {
  const parts: string[] = [
    `plan ${row.planUnlimited ? "unlimited" : (row.planValue ?? 0)}`,
  ];
  if (row.addonValue > 0) parts.push(`+${row.addonValue} bought`);
  const bonus = row.override?.isLive ? (row.override.bonusValue ?? 0) : 0;
  if (bonus > 0) parts.push(`+${bonus} granted`);
  if (row.override?.isLive && row.override.isUnlimited) parts.push("granted unlimited");
  return parts.join(" · ");
}

/**
 * What one account actually holds, and the controls to change it (per-account
 * overrides).
 *
 * The screen is built around one question a platform admin has when a client
 * calls: *why* does this account have — or not have — this feature? So every row
 * shows the plan's own answer next to the effective one, and anything that
 * differs is labelled with where it came from. A feature that looks unlocked for
 * no reason is the thing this view exists to make impossible.
 *
 * Reverting a switch back to what the plan says deletes the override outright
 * rather than storing an override that happens to agree with the plan — so the
 * account resumes tracking its plan, including through a later upgrade.
 */
export function AccountEntitlementsPanel({ accountId }: { accountId: string }) {
  const { data, isLoading } = useAccountEntitlementsQuery(accountId);
  const [removeOverride, { isLoading: removing }] =
    useRemoveAccountOverrideMutation();
  const [editing, setEditing] = useState<AccountEntitlementRow | null>(null);
  const [pendingEnabled, setPendingEnabled] = useState<boolean>(true);

  async function revertToPlan(row: AccountEntitlementRow) {
    try {
      await removeOverride({ accountId, featureKey: row.key }).unwrap();
      toast.success(`${row.label} follows the plan again.`);
    } catch {
      toast.error("Couldn't remove that override.");
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  const grantedCount = data.features.filter(
    (f) => f.override?.isLive && f.source === "override",
  ).length;

  const grouped = [...data.features].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category),
  );
  const categories = [...new Set(grouped.map((f) => f.category))];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <Info className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          On <span className="font-medium text-foreground">{data.plan?.name ?? "no plan"}</span>
          {grantedCount > 0
            ? ` · ${grantedCount} exception${grantedCount === 1 ? "" : "s"} on top`
            : " · no exceptions"}
        </span>
      </div>

      {/* An override changes the tier the account is treated as being on. It
          does not keep a non-paying account switched on, and saying so here
          heads off the obvious misuse. */}
      {data.subscription &&
        !["trial", "active", "grace"].includes(data.subscription.status) && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            This subscription is {data.subscription.status} — everything below is
            switched off for the account until it's paid, grants included.
          </p>
        )}

      {categories.map((category) => (
        <div key={category} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABEL[category] ?? category}
          </p>
          <div className="divide-y rounded-xl border">
            {grouped
              .filter((f) => f.category === category)
              .map((row) => {
                const isCount = row.dataType === "count";
                const live = row.override?.isLive === true;
                const overridden = live && row.source === "override";

                return (
                  <div
                    key={row.key}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {row.label}
                        {overridden && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 text-xs",
                              row.override?.enabled === false
                                ? "border-destructive/40 text-destructive"
                                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                            )}
                          >
                            <Gift className="size-3" />
                            {row.override?.enabled === false ? "Revoked" : "Granted"}
                          </Badge>
                        )}
                        {row.override && !live && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Lapsed
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isCount
                          ? capacityBreakdown(row)
                          : row.planEnabled
                            ? "Included in the plan"
                            : "Not in the plan"}
                        {live && row.override?.expiresAt && (
                          <> · until {formatDate(row.override.expiresAt)}</>
                        )}
                      </p>
                      {live && row.override?.reason && (
                        <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                          {row.override.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isCount ? (
                        <>
                          <span className="text-sm tabular-nums">
                            {row.effectiveUnlimited ? "∞" : row.effectiveValue}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPendingEnabled(true);
                              setEditing(row);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Switch
                          checked={row.effectiveEnabled === true}
                          disabled={removing}
                          onCheckedChange={(next) => {
                            // Landing back on the plan's own answer means the
                            // exception is no longer needed — drop it, so the
                            // account tracks its plan again from here on.
                            if (next === row.planEnabled) {
                              if (row.override) void revertToPlan(row);
                              return;
                            }
                            setPendingEnabled(next);
                            setEditing(row);
                          }}
                        />
                      )}
                      {row.override && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Remove the override"
                          disabled={removing}
                          onClick={() => void revertToPlan(row)}
                        >
                          {removing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      <GrantOverrideDialog
        accountId={accountId}
        row={editing}
        targetEnabled={pendingEnabled}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
