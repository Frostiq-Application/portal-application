import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMarkPaidMutation } from "@/features/api/subscriptionsApi";
import { apiError } from "@/lib/apiError";
import type { PaymentMethodType, Subscription } from "@/types";
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
} from "@/components/ui/dialog";

const METHODS: PaymentMethodType[] = ["upi", "bank_transfer", "cash", "other"];

function addMonthsISO(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

interface Props {
  subscription: Subscription | null;
  onOpenChange: (o: boolean) => void;
  /** Fired after a payment is recorded successfully (e.g. to close a detail sheet). */
  onSuccess?: (subscription: Subscription) => void;
}

export function MarkPaidDialog({ subscription, onOpenChange, onSuccess }: Props) {
  const [markPaid, { isLoading }] = useMarkPaidMutation();
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState("0");
  const [paymentDate, setPaymentDate] = useState(today);
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(addMonthsISO(today, 1));
  const [method, setMethod] = useState<PaymentMethodType>("upi");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (subscription) {
      setAmount(String(Number(subscription.priceAtSubscription)));
      const start = subscription.nextBillingDate || today;
      setPaymentDate(today);
      setPeriodStart(start);
      setPeriodEnd(addMonthsISO(start, 1));
      setMethod("upi");
      setReference("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id]);

  const submit = async () => {
    if (!subscription) return;
    try {
      const res = await markPaid({
        id: subscription.id,
        body: {
          amount: Number(amount) || 0,
          paymentDate,
          periodStart,
          periodEnd,
          paymentMethod: method,
          referenceNote: reference.trim() || undefined,
        },
      }).unwrap();
      toast.success(`Payment recorded — receipt ${res.receiptNumber}`);
      onOpenChange(false);
      onSuccess?.(subscription);
    } catch (err) {
      toast.error(apiError(err, "Failed to record payment"));
    }
  };

  return (
    <Dialog open={!!subscription} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Marks the subscription paid, extends billing dates, and generates a
            receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Payment date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Period start</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Period end</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reference / UTR</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
