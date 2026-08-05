import { useState } from "react";
import { toast } from "sonner";
import { InfinityIcon, Loader2 } from "@/components/ui/icons";
import {
  useCreatePlanMutation,
  useUpdatePlanMutation,
} from "@/features/api/billingAdminApi";
import { inrShort } from "@/lib/billing";
import { slugify } from "@/lib/utils";
import type {
  AdminPlan,
  BillingCycle,
  BillingFeature,
  PlanFeatureValue,
} from "@/types/billing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AdminPlan | null;
  features: BillingFeature[];
  cycles: BillingCycle[];
  accounts?: { id: string; name: string }[];
}

/**
 * Plan editor (SA-05/06/08).
 *
 * The screen makes two structural rules visible rather than documenting them:
 *  - a plan has **one price** (monthly), and every cycle price is shown derived
 *    from it — there is nowhere to type a yearly price, because a stored one
 *    could drift;
 *  - **Boolean features are plan-only.** They're a switch here and nowhere
 *    else, which is exactly what makes a higher tier worth buying.
 */
export function PlanEditorDialog({
  open,
  onOpenChange,
  plan,
  features,
  cycles,
  accounts = [],
}: Props) {
  const [create, { isLoading: creating }] = useCreatePlanMutation();
  const [update, { isLoading: updating }] = useUpdatePlanMutation();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("0");
  const [badge, setBadge] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [trialDays, setTrialDays] = useState("0");
  const [hidden, setHidden] = useState(false);
  const [exclusiveAccountId, setExclusiveAccountId] = useState<string>("");
  const [values, setValues] = useState<Record<string, PlanFeatureValue>>({});

  // Seeded during render rather than in an effect so the fields are correct on
  // first paint instead of flashing the previous plan's values for a frame.
  // `features` is in the key because the value grid is built from it.
  const seedKey = open ? `${plan?.id ?? "new"}:${features.length}` : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setName(plan?.name ?? "");
    setCode(plan?.code ?? "");
    setTagline(plan?.tagline ?? "");
    setDescription(plan?.description ?? "");
    setPriceMonthly(plan ? String(Number(plan.priceMonthly)) : "0");
    setBadge(plan?.badge ?? "");
    setSortOrder(String(plan?.sortOrder ?? 0));
    setTrialDays(String(plan?.trialDays ?? 0));
    setHidden(plan?.visibility === "hidden");
    setExclusiveAccountId(plan?.exclusiveAccountId ?? "");

    const existing = plan?.planFeatures ?? [];
    const byKey = new Map(existing.map((v) => [v.featureKey, v]));
    const next: Record<string, PlanFeatureValue> = {};
    for (const f of features) {
      const v = byKey.get(f.key);
      next[f.key] = {
        featureKey: f.key,
        enabled: v?.enabled ?? false,
        limitValue: v?.limitValue ?? 0,
        isUnlimited: v?.isUnlimited ?? false,
      };
    }
    setValues(next);
  }

  const price = Number(priceMonthly) || 0;
  const busy = creating || updating;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Give the plan a name.");
      return;
    }
    const body = {
      code: code.trim() ? slugify(code).replace(/-/g, "_") : null,
      name: name.trim(),
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      priceMonthly: price,
      visibility: (hidden ? "hidden" : "public") as "hidden" | "public",
      exclusiveAccountId:
        hidden && exclusiveAccountId ? exclusiveAccountId : null,
      badge: badge.trim() || null,
      sortOrder: Number(sortOrder) || 0,
      trialDays: Number(trialDays) || 0,
      features: Object.values(values),
    };

    try {
      if (plan) {
        await update({ id: plan.id, body }).unwrap();
        toast.success(
          plan.priceMonthly !== String(price.toFixed(2))
            ? `${name} saved. The new price applies from each subscriber's next renewal. They've been emailed.`
            : `${name} saved.`,
        );
      } else {
        await create(body).unwrap();
        toast.success(`${name} created.`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't save that plan.",
      );
    }
  }

  const booleanFeatures = features.filter((f) => f.dataType === "boolean");
  const countFeatures = features.filter((f) => f.dataType === "count");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "New plan"}</DialogTitle>
          <DialogDescription>
            Set one monthly price. Every cycle price is derived from it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ---- identity --------------------------------------------------- */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Growth"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-code">Code</Label>
              <Input
                id="plan-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="growth"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-tagline">Tagline</Label>
            <Input
              id="plan-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Single branch with stronger tools"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-description">Description</Label>
            <Textarea
              id="plan-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* ---- price + derived cycles ------------------------------------ */}
          <div className="space-y-3 rounded-xl border p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="plan-price">Monthly price (₹)</Label>
                <Input
                  id="plan-price"
                  inputMode="decimal"
                  value={priceMonthly}
                  onChange={(e) =>
                    setPriceMonthly(e.target.value.replace(/[^\d.]/g, ""))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-badge">Badge</Label>
                <Input
                  id="plan-badge"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Most Popular"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-order">Display order</Label>
                <Input
                  id="plan-order"
                  inputMode="numeric"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
            </div>

            {/* The trial offer is a property of a plan, so it's set here and
                not in billing settings — and only one plan should carry it. */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-trial">Free trial (days)</Label>
              <Input
                id="plan-trial"
                inputMode="numeric"
                className="sm:max-w-40"
                value={trialDays}
                onChange={(e) =>
                  setTrialDays(e.target.value.replace(/\D/g, ""))
                }
              />
              <p className="text-xs text-muted-foreground">
                0 means no trial. Keep this on one plan only. Signups are
                offered the cheapest plan that has a trial, once per account.
              </p>
            </div>

            <Separator />
            <p className="text-xs font-medium text-muted-foreground">
              Derived cycle prices
            </p>
            <div className="flex flex-wrap gap-2">
              {cycles
                .filter((c) => c.isActive)
                .map((c) => {
                  const payable = c.months - c.freeMonths;
                  return (
                    <div
                      key={c.code}
                      className="rounded-lg border bg-muted/40 px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">{c.name}</p>
                      <p className="font-semibold tabular-nums">
                        {inrShort(price * payable)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {payable}× monthly
                        {c.freeMonths > 0 && ` · ${c.freeMonths} free`}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ---- visibility ------------------------------------------------ */}
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="plan-hidden" className="font-medium">
                  Hidden plan
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kept off the pricing page, for Enterprise and per-deal plans.
                </p>
              </div>
              <Switch
                id="plan-hidden"
                checked={hidden}
                onCheckedChange={(v) => {
                  setHidden(v);
                  if (!v) setExclusiveAccountId("");
                }}
              />
            </div>

            {hidden && (
              <div className="space-y-1.5">
                <Label htmlFor="plan-exclusive">Bind to one account</Label>
                <Select
                  value={exclusiveAccountId || "none"}
                  onValueChange={(v) =>
                    setExclusiveAccountId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger id="plan-exclusive" className="w-full">
                    <SelectValue placeholder="Any account with the link" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none">Not bound</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only this account will ever see or be able to buy the plan.
                </p>
              </div>
            )}
          </div>

          {/* ---- count features -------------------------------------------- */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Limits</h3>
              <p className="text-xs text-muted-foreground">
                Numeric caps. Accounts can extend these with add-ons on any plan,
                unless you mark them unlimited.
              </p>
            </div>
            {countFeatures.map((f) => {
              const v = values[f.key];
              if (!v) return null;
              return (
                <div
                  key={f.key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Trial cap {f.trialLimit ?? "-"}
                      {f.addonStep && ` · add-on step +${f.addonStep}`}
                    </p>
                  </div>
                  <Input
                    className="w-24"
                    inputMode="numeric"
                    disabled={v.isUnlimited}
                    value={v.isUnlimited ? "" : String(v.limitValue ?? 0)}
                    onChange={(e) =>
                      setValues((s) => ({
                        ...s,
                        [f.key]: {
                          ...v,
                          limitValue:
                            Number(e.target.value.replace(/\D/g, "")) || 0,
                        },
                      }))
                    }
                  />
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <Switch
                      checked={v.isUnlimited}
                      onCheckedChange={(on) =>
                        setValues((s) => ({
                          ...s,
                          [f.key]: { ...v, isUnlimited: on },
                        }))
                      }
                    />
                    <InfinityIcon className="size-4" />
                  </label>
                </div>
              );
            })}
          </section>

          {/* ---- boolean features ------------------------------------------ */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Features</h3>
              <p className="text-xs text-muted-foreground">
                On/off capabilities. These are the reason to upgrade. They're
                never sold as add-ons.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {booleanFeatures.map((f) => {
                const v = values[f.key];
                if (!v) return null;
                return (
                  <label
                    key={f.key}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {f.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {f.category}
                      </span>
                    </span>
                    <Switch
                      checked={v.enabled}
                      onCheckedChange={(on) =>
                        setValues((s) => ({
                          ...s,
                          [f.key]: { ...v, enabled: on },
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {plan && plan.subscriberCount > 0 && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <Badge variant="secondary" className="mr-1.5">
                {plan.subscriberCount}
              </Badge>
              account{plan.subscriberCount === 1 ? " is" : "s are"} on this
              plan. Changing the price never affects a period they've already
              paid for. It applies from each account's next renewal, and
              they'll be emailed in advance.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {plan ? "Save plan" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
