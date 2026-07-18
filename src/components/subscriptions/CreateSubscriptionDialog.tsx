import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateSubscriptionMutation } from "@/features/api/subscriptionsApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useListPlansQuery } from "@/features/api/plansApi";
import { apiError } from "@/lib/apiError";
import type { BillingCycle, SubscriptionStatus } from "@/types";
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
  DialogTrigger,
} from "@/components/ui/dialog";

const CYCLES: BillingCycle[] = ["monthly", "quarterly", "annual"];
const STATUSES: SubscriptionStatus[] = ["trial", "active"];

export function CreateSubscriptionDialog() {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [status, setStatus] = useState<SubscriptionStatus>("trial");

  const { data: accounts } = useListAccountsQuery({ page: 1, limit: 100 });
  const { data: plans } = useListPlansQuery({ page: 1, limit: 100, activeOnly: true });
  const [create, { isLoading }] = useCreateSubscriptionMutation();

  const submit = async () => {
    if (!accountId || !planId) {
      toast.error("Select a shop and a plan");
      return;
    }
    try {
      await create({ accountId, planId, billingCycle: cycle, status }).unwrap();
      toast.success("Subscription created");
      setOpen(false);
      setAccountId("");
      setPlanId("");
    } catch (err) {
      toast.error(apiError(err, "Failed to create subscription"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New subscription</Button>
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
              <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
              <SelectContent>
                {(accounts?.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {(plans?.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — ₹{Number(p.priceMonthly).toLocaleString("en-IN")}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Billing cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Initial status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
