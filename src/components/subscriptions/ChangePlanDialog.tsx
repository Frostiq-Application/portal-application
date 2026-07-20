import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useUpdateSubscriptionMutation } from "@/features/api/subscriptionsApi";
import { useListPlansQuery } from "@/features/api/plansApi";
import { apiError } from "@/lib/apiError";
import type { Subscription } from "@/types";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";

interface Props {
  /** The subscription to re-plan; dialog is open while this is non-null. */
  subscription: Subscription | null;
  accountName: string;
  currentPlanName: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (s: Subscription) => void;
}

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function ChangePlanDialog({
  subscription: s,
  accountName,
  currentPlanName,
  onOpenChange,
  onSuccess,
}: Props) {
  const [planId, setPlanId] = useState("");
  const { data: plans } = useListPlansQuery({
    page: 1,
    limit: 100,
    activeOnly: true,
  });
  const [update, { isLoading }] = useUpdateSubscriptionMutation();

  // Preselect the subscription's current plan each time the dialog opens.
  useEffect(() => {
    setPlanId(s?.planId ?? "");
  }, [s]);

  const selectedPlan = useMemo(
    () => (plans?.data ?? []).find((p) => p.id === planId),
    [plans, planId],
  );

  const changed = !!s && planId !== "" && planId !== s.planId;

  const submit = async () => {
    if (!s || !changed) return;
    try {
      const updated = await update({
        id: s.id,
        body: { planId },
      }).unwrap();
      toast.success("Plan changed");
      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to change plan"));
    }
  };

  return (
    <Dialog open={!!s} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            Move <strong>{accountName}</strong> to a different plan. This updates
            the existing subscription and re-locks the price to the new plan — no
            new subscription row is created.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Current:</span>
            <span className="font-medium">{currentPlanName}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>New plan</Label>
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

          {selectedPlan && changed && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">{currentPlanName}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-semibold">{selectedPlan.name}</span>
              <span className="ml-auto font-medium">
                {money(selectedPlan.priceMonthly)}
                <span className="text-xs font-normal text-muted-foreground">
                  /mo
                </span>
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isLoading || !changed}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
