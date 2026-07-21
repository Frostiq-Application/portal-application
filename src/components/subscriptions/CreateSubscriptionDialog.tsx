import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCreateSubscriptionMutation } from "@/features/api/subscriptionsApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useListPlansQuery } from "@/features/api/plansApi";
import { apiError } from "@/lib/apiError";
import {
  BILLING_CYCLE_LABEL,
  annualSavingsPct,
  planCyclePrice,
} from "@/lib/subscriptions";
import type { BillingCycle, SubscriptionStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CYCLES: BillingCycle[] = ["monthly", "quarterly", "annual"];
const STATUSES: { value: SubscriptionStatus; label: string; hint: string }[] = [
  { value: "trial", label: "Trial", hint: "No charge until trial ends" },
  { value: "active", label: "Active", hint: "Billing starts immediately" },
];

interface Props {
  /** Pre-select this account (e.g. when opened from a shop). */
  defaultAccountId?: string;
  trigger?: React.ReactNode;
}

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function CreateSubscriptionDialog({ defaultAccountId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [status, setStatus] = useState<SubscriptionStatus>("trial");
  const [trialEndsAt, setTrialEndsAt] = useState("");

  const { data: accounts } = useListAccountsQuery({ page: 1, limit: 100 });
  const { data: plans } = useListPlansQuery({
    page: 1,
    limit: 100,
    activeOnly: true,
  });
  const [create, { isLoading }] = useCreateSubscriptionMutation();

  const selectedPlan = useMemo(
    () => (plans?.data ?? []).find((p) => p.id === planId),
    [plans, planId],
  );

  const cyclePrice = selectedPlan
    ? planCyclePrice(selectedPlan.priceMonthly, selectedPlan.priceAnnual, cycle)
    : null;
  const savingsPct =
    selectedPlan && cycle === "annual"
      ? annualSavingsPct(selectedPlan.priceMonthly, selectedPlan.priceAnnual)
      : null;

  const reset = () => {
    setAccountId(defaultAccountId ?? "");
    setPlanId("");
    setCycle("monthly");
    setStatus("trial");
    setTrialEndsAt("");
  };

  const submit = async () => {
    if (!accountId || !planId) {
      toast.error("Select a shop and a plan");
      return;
    }
    try {
      await create({
        accountId,
        planId,
        billingCycle: cycle,
        status,
        ...(status === "trial" && trialEndsAt ? { trialEndsAt } : {}),
      }).unwrap();
      toast.success("Subscription created");
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(apiError(err, "Failed to create subscription"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button>New subscription</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create subscription</DialogTitle>
          <DialogDescription>Assign a plan to a shop.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Shop</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shop" />
              </SelectTrigger>
              <SelectContent>
                {(accounts?.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {(plans?.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {money(p.priceMonthly)}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Billing cycle</Label>
              <Select
                value={cycle}
                onValueChange={(v) => setCycle(v as BillingCycle)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {BILLING_CYCLE_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Initial status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as SubscriptionStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "trial" && (
            <div className="flex flex-col gap-1.5">
              <Label>Trial ends (optional)</Label>
              <Input
                type="date"
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
            </div>
          )}

          {/* Live price preview */}
          {selectedPlan && cyclePrice !== null && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Summary
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {selectedPlan.name} · {BILLING_CYCLE_LABEL[cycle]}
                </span>
                <span className="text-base font-semibold">
                  {money(cyclePrice)}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{cycle === "monthly" ? "mo" : cycle === "quarterly" ? "qtr" : "yr"}
                  </span>
                </span>
              </div>
              {savingsPct != null && (
                <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Save {savingsPct}% vs {money(Number(selectedPlan.priceMonthly) * 12)}/yr paid monthly
                </p>
              )}
              {status === "trial" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Starts as a trial — no receipt until you record the first
                  payment.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
