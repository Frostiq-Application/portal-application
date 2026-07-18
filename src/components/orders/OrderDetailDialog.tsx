import { useState } from "react";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  CANCELLABLE,
  NEXT_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/orders";
import {
  useCancelOrderMutation,
  useGetOrderQuery,
  useMarkOrderPaidMutation,
  useUpdateOrderStatusMutation,
} from "@/features/api/ordersApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  orderId: string | null;
  onOpenChange: (o: boolean) => void;
}

export function OrderDetailDialog({ orderId, onOpenChange }: Props) {
  const { data: order, isLoading } = useGetOrderQuery(orderId as string, {
    skip: !orderId,
  });
  const [updateStatus, { isLoading: advancing }] = useUpdateOrderStatusMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [markPaid] = useMarkOrderPaidMutation();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const advance = (status: string) =>
    run(() => updateStatus({ id: order!.id, status: status as never }).unwrap(), "Status updated");

  const submitCancel = async () => {
    if (cancelReason.trim().length < 3) return toast.error("Reason required");
    await run(() => cancelOrder({ id: order!.id, reason: cancelReason }).unwrap(), "Order cancelled");
    setShowCancel(false);
    setCancelReason("");
  };

  return (
    <Dialog open={!!orderId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {isLoading || !order ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {order.orderNumber}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    ORDER_STATUS_TONE[order.status],
                  )}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              </DialogTitle>
              <DialogDescription>
                {order.deliveryType === "delivery" ? "Delivery" : "Pickup"} ·{" "}
                {formatDate(order.scheduledDate)}
                {order.scheduledSlotStart &&
                  ` · ${order.scheduledSlotStart.slice(0, 5)}–${order.scheduledSlotEnd?.slice(0, 5)}`}
              </DialogDescription>
            </DialogHeader>

            {/* Items */}
            <div className="space-y-2">
              {order.items.map((it) => (
                <div key={it.id} className="rounded-md border p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {it.quantity}× {it.productName}
                    </span>
                    <span>₹{Number(it.lineTotal)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {it.variantLabel}
                    {it.flavorName ? ` · ${it.flavorName}` : ""}
                  </div>
                  {it.addons.map((a, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      + {a.name} (₹{Number(a.price)})
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{Number(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>−₹{Number(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>₹{Number(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment</span>
                <span>
                  {order.paymentMethod.toUpperCase()} · {order.paymentStatus}
                </span>
              </div>
            </div>

            {order.customerNote && (
              <p className="rounded-md bg-muted p-2 text-xs">
                <span className="font-medium">Note:</span> {order.customerNote}
              </p>
            )}

            {/* Timeline */}
            <div className="border-t pt-2">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Timeline</p>
              <ol className="space-y-1.5">
                {order.statusHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="font-medium">{ORDER_STATUS_LABEL[h.status]}</span>
                    <span className="text-muted-foreground">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                    {h.note && <span className="text-muted-foreground">— {h.note}</span>}
                  </li>
                ))}
              </ol>
            </div>

            {/* Actions */}
            {!showCancel ? (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {NEXT_STATUSES[order.status].map((s) => (
                  <Button key={s} size="sm" disabled={advancing} onClick={() => advance(s)}>
                    Mark {ORDER_STATUS_LABEL[s]}
                  </Button>
                ))}
                {order.paymentStatus === "pending" && order.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => markPaid(order.id).unwrap(), "Marked paid")}
                  >
                    Mark paid
                  </Button>
                )}
                {CANCELLABLE.includes(order.status) && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShowCancel(true)}>
                    Cancel order
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 border-t pt-3">
                <Textarea
                  placeholder="Cancellation reason…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={cancelling} onClick={submitCancel}>
                    Confirm cancel
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCancel(false)}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
