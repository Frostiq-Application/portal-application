import { useState } from "react";
import { ImageOff } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  orderId: string | null;
  onOpenChange: (o: boolean) => void;
}

/** Small square thumbnail with a graceful fallback when there's no image. */
function Thumb({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 rounded-md border object-cover", className)}
    />
  );
}

/**
 * Right-hand drawer showing a single order in full: line items with product and
 * add-on photos, totals, the customer note, the status timeline, and the same
 * fulfilment actions as the row.
 */
export function OrderDetailDrawer({ orderId, onOpenChange }: Props) {
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
    run(
      () => updateStatus({ id: order!.id, status: status as never }).unwrap(),
      "Status updated",
    );

  const submitCancel = async () => {
    if (cancelReason.trim().length < 3) return toast.error("Reason required");
    await run(
      () => cancelOrder({ id: order!.id, reason: cancelReason }).unwrap(),
      "Order cancelled",
    );
    setShowCancel(false);
    setCancelReason("");
  };

  return (
    <Sheet open={!!orderId} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        {isLoading || !order ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-6">
              <SheetTitle className="flex items-center gap-2">
                <span className="font-mono">{order.orderNumber}</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    ORDER_STATUS_TONE[order.status],
                  )}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              </SheetTitle>
              <SheetDescription>
                {order.deliveryType === "delivery" ? "Delivery" : "Pickup"} ·{" "}
                {formatDate(order.scheduledDate)}
                {order.scheduledSlotStart &&
                  ` · ${order.scheduledSlotStart.slice(0, 5)}–${order.scheduledSlotEnd?.slice(0, 5)}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-6">
              {/* Items — each line carries the product photo and add-on photos. */}
              <div className="space-y-3">
                {order.items.map((it) => (
                  <div key={it.id} className="rounded-lg border p-3">
                    <div className="flex gap-3">
                      <Thumb
                        src={it.imageUrl}
                        alt={it.productName}
                        className="h-16 w-16"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">
                            {it.quantity}× {it.productName}
                          </span>
                          <span className="whitespace-nowrap">
                            ₹{Number(it.lineTotal)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {it.variantLabel}
                          {it.flavorName ? ` · ${it.flavorName}` : ""}
                        </p>
                      </div>
                    </div>

                    {it.addons.length > 0 && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {it.addons.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Thumb
                              src={a.imageUrl}
                              alt={a.name}
                              className="h-8 w-8"
                            />
                            <span className="flex-1 text-muted-foreground">
                              + {a.name}
                            </span>
                            <span className="text-muted-foreground">
                              ₹{Number(a.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 border-t pt-4 text-sm">
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
                <p className="rounded-md bg-muted p-3 text-xs">
                  <span className="font-medium">Note:</span> {order.customerNote}
                </p>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Timeline
                </p>
                <ol className="space-y-1.5">
                  {order.statusHistory.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="font-medium">
                        {ORDER_STATUS_LABEL[h.status]}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(h.changedAt).toLocaleString()}
                      </span>
                      {h.note && (
                        <span className="text-muted-foreground">— {h.note}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Actions */}
              {!showCancel ? (
                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  {NEXT_STATUSES[order.status].map((s) => (
                    <Button
                      key={s}
                      size="lg"
                      className="flex-1"
                      disabled={advancing}
                      onClick={() => advance(s)}
                    >
                      Mark {ORDER_STATUS_LABEL[s]}
                    </Button>
                  ))}
                  {order.paymentStatus === "pending" &&
                    order.status !== "cancelled" && (
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          run(() => markPaid(order.id).unwrap(), "Marked paid")
                        }
                      >
                        Mark paid
                      </Button>
                    )}
                  {CANCELLABLE.includes(order.status) && (
                    <Button
                      size="lg"
                      variant="ghost"
                      className="w-full text-destructive"
                      onClick={() => setShowCancel(true)}
                    >
                      Cancel order
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 border-t pt-4">
                  <Textarea
                    placeholder="Cancellation reason…"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancelling}
                      onClick={submitCancel}
                    >
                      Confirm cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCancel(false)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
