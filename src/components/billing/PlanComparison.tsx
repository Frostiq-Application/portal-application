import { useMemo, useState } from "react";
import { Check, ChevronDown, InfinityIcon, Minus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { inrShort } from "@/lib/billing";
import { featureLabel } from "@/lib/billing";
import type { CycleOption, PricingPlan } from "@/types/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The full plan comparison matrix.
 *
 * The plan *cards* deliberately truncate — three columns of twelve bullet
 * points is unreadable. But truncating everywhere means you cannot actually
 * see what you're buying, which is exactly the moment someone abandons. So the
 * cards sell, and this table answers.
 *
 * Rows are grouped by feature category (limits first, since those are what
 * people hit), and the account's current plan is highlighted down its whole
 * column so "what do I gain" reads at a glance.
 */
export function PlanComparison({
  plans,
  cycle,
  currentPlanId,
  onChoose,
  defaultOpen = false,
}: {
  plans: PricingPlan[];
  cycle: CycleOption | null;
  currentPlanId?: string | null;
  onChoose?: (plan: PricingPlan) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  /** Every feature any plan mentions, limits first, then booleans A–Z. */
  const rows = useMemo(() => {
    const limitKeys: { key: string; label: string }[] = [];
    const seenLimit = new Set<string>();
    for (const p of plans) {
      for (const l of p.limits) {
        if (seenLimit.has(l.featureKey)) continue;
        seenLimit.add(l.featureKey);
        limitKeys.push({ key: l.featureKey, label: l.label });
      }
    }

    const flagKeys = [...new Set(plans.flatMap((p) => Object.keys(p.flags)))]
      .map((key) => ({ key, label: featureLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { limitKeys, flagKeys };
  }, [plans]);

  if (plans.length === 0) return null;

  return (
    <div className="rounded-2xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <div>
          <p className="font-semibold">Compare every plan</p>
          <p className="text-sm text-muted-foreground">
            Full feature and limit breakdown, side by side.
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background p-4 text-left align-bottom font-medium text-muted-foreground">
                  <span className="text-xs uppercase tracking-wide">
                    {cycle ? `Billed ${cycle.name.toLowerCase()}` : "Plan"}
                  </span>
                </th>
                {plans.map((p) => {
                  const price = p.cyclePrices.find(
                    (c) => c.code === cycle?.code,
                  );
                  const isCurrent = p.id === currentPlanId;
                  return (
                    <th
                      key={p.id}
                      className={cn(
                        "min-w-36 p-4 text-center align-bottom",
                        isCurrent && "bg-primary/5",
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {p.badge && (
                          <Badge variant="secondary" className="text-[10px]">
                            {p.badge}
                          </Badge>
                        )}
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-lg font-bold tabular-nums">
                          {inrShort(price?.price ?? p.priceMonthly)}
                        </span>
                        {isCurrent ? (
                          <Badge variant="outline" className="text-[10px]">
                            Current
                          </Badge>
                        ) : onChoose ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-1 h-7 text-xs"
                            onClick={() => onChoose(p)}
                          >
                            Choose
                          </Button>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              <SectionRow label="Limits" span={plans.length + 1} />
              {rows.limitKeys.map(({ key, label }) => (
                <tr key={key} className="border-t">
                  <th className="sticky left-0 z-10 bg-background p-3 text-left font-normal">
                    {label}
                  </th>
                  {plans.map((p) => {
                    const limit = p.limits.find((l) => l.featureKey === key);
                    const isCurrent = p.id === currentPlanId;
                    return (
                      <td
                        key={p.id}
                        className={cn(
                          "p-3 text-center tabular-nums",
                          isCurrent && "bg-primary/5",
                        )}
                      >
                        {!limit ? (
                          <Minus className="mx-auto size-3.5 text-muted-foreground/40" />
                        ) : limit.isUnlimited ? (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <InfinityIcon className="size-4" />
                          </span>
                        ) : (
                          <span className="font-medium">{limit.value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <SectionRow label="Features" span={plans.length + 1} />
              {rows.flagKeys.map(({ key, label }) => (
                <tr key={key} className="border-t">
                  <th className="sticky left-0 z-10 bg-background p-3 text-left font-normal">
                    {label}
                  </th>
                  {plans.map((p) => {
                    const on = p.flags[key] === true;
                    const isCurrent = p.id === currentPlanId;
                    return (
                      <td
                        key={p.id}
                        className={cn(
                          "p-3 text-center",
                          isCurrent && "bg-primary/5",
                        )}
                      >
                        {on ? (
                          <Check
                            className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
                            aria-label="Included"
                          />
                        ) : (
                          <Minus
                            className="mx-auto size-3.5 text-muted-foreground/40"
                            aria-label="Not included"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            Limits can be raised on any plan with add-on capacity — you don't
            have to change tier for one more branch. Features are plan-only.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="border-t bg-muted/40">
      <td
        colSpan={span}
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </td>
    </tr>
  );
}
