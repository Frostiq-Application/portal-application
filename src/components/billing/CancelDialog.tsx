import { useState } from "react";
import { toast } from "sonner";
import { HeartCrack, Loader2 } from "@/components/ui/icons";
import {
  useBillingStatesQuery,
  useCancelSubscriptionMutation,
} from "@/features/api/billingApi";
import { CANCEL_REASON_LABEL } from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Cancellation (SH-21). The reason is required — it feeds the churn report the
 * Super Admin reads (SA-18), and it's the only place that signal exists.
 *
 * Deliberately plain about what happens: access runs to period end, no refund,
 * autopay is revoked, and Undo is available the whole time.
 */
export function CancelDialog({
  open,
  onOpenChange,
  periodEnd,
  archiveDays = 90,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEnd?: string;
  archiveDays?: number;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: meta } = useBillingStatesQuery();
  const [cancel] = useCancelSubscriptionMutation();

  async function handleCancel() {
    if (!reason) return;
    setBusy(true);
    try {
      const result = await cancel({
        reason,
        comment: comment.trim() || undefined,
      }).unwrap();
      toast.success(
        `Cancelled. You keep full access until ${formatDate(result.accessUntil)}.`,
      );
      onDone?.();
      onOpenChange(false);
      setReason("");
      setComment("");
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't cancel your subscription.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartCrack className="size-4 text-muted-foreground" />
            Cancel subscription
          </DialogTitle>
          <DialogDescription>
            {periodEnd
              ? `You'll keep everything until ${formatDate(periodEnd)} — you've already paid for it.`
              : "You'll keep access until the end of your current period."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">
              Why are you leaving? <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="cancel-reason" className="w-full">
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                {(meta?.cancelReasons ?? Object.keys(CANCEL_REASON_LABEL)).map(
                  (r) => (
                    <SelectItem key={r} value={r}>
                      {CANCEL_REASON_LABEL[r] ?? r}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-comment">
              Anything else?{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="cancel-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="It genuinely helps us improve."
            />
          </div>

          <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <li>• Your storefront stays live until the end of the period.</li>
            <li>• Autopay is switched off — you won't be charged again.</li>
            <li>• Subscription fees are non-refundable.</li>
            <li>
              • Your data is archived for {archiveDays} days, not deleted. Come
              back any time within that window and it's all still here.
            </li>
            <li>• You can undo this until the period ends.</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep my subscription
          </Button>
          <Button
            variant="destructive"
            disabled={!reason || busy}
            onClick={handleCancel}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Cancel subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
