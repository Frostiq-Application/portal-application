import { useState } from "react";
import { ImageOff } from "@/components/ui/icons";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  CANCELLABLE,
  NEXT_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  formatSlotRange,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderCustomerPanel } from "./OrderCustomerPanel";
import { useCan } from "@/hooks/useCan";

interface Props {
  orderId: string | null;
  onOpenChange: (o: boolean) => void;
  /**
   * Show the order alone: no fulfilment actions, and no customer tab.
   *
   * For the drawer opened out of a customer's own order history, where the
   * order is a record being read rather than one being worked — the customer
   * tab would only repeat the drawer sitting directly underneath it, and
   * fulfilment belongs to the queue and the kitchen and delivery boards, where
   * the order is actually in hand.
   */
  readOnly?: boolean;
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
 *
 * Opened from the orders queue *and* from the kitchen and delivery boards, so
 * every block is gated on the permission its API call needs. A chef sees the
 * cake, the note and the timeline; the money and the customer are not theirs to
 * see, and cancelling is not theirs to do — showing those buttons would only
 * produce a 403 they can't act on.
 *
 * It also opens over a customer's order history, where it is read rather than
 * worked — see {@link Props.readOnly}.
 */
export function OrderDetailDrawer({ orderId, onOpenChange, readOnly }: Props) {
  const { can } = useCan();
  const showMoney = can("orders.manage");
  const showCustomer = can("customers.view") && !readOnly;
  const canAdvance = can("orders.status");
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

  // Same wording as the queue's delivery-time column: "10:00 AM – 12:00 PM".
  const slot = formatSlotRange(order?.scheduledSlotStart, order?.scheduledSlotEnd);

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
                {slot && ` · ${slot}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-6">
              {/* Order lines vs. who placed them — actions below stay visible
                  on both tabs. Keyed so opening another order resets to Order. */}
              <Tabs key={order.id} defaultValue="order">
                {showCustomer && (
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="order">Order</TabsTrigger>
                    <TabsTrigger value="customer">Customer</TabsTrigger>
                  </TabsList>
                )}

                <TabsContent value="order" className="mt-4 space-y-6">
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
                              {showMoney && (
                                <span className="whitespace-nowrap">
                                  ₹{Number(it.lineTotal)}
                                </span>
                              )}
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
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs"
                              >
                                <Thumb
                                  src={a.imageUrl}
                                  alt={a.name}
                                  className="h-8 w-8"
                                />
                                <span className="flex-1 text-muted-foreground">
                                  + {a.name}
                                </span>
                                {showMoney && (
                                  <span className="text-muted-foreground">
                                    ₹{Number(a.price)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  {showMoney && (
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
                          {order.paymentMethod.toUpperCase()} ·{" "}
                          {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  )}

                  {order.customerNote && (
                    <p className="rounded-md bg-muted p-3 text-xs">
                      <span className="font-medium">Note:</span>{" "}
                      {order.customerNote}
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
                            <span className="text-muted-foreground">
                              · {h.note}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                </TabsContent>

                {showCustomer && (
                  <TabsContent value="customer" className="mt-4">
                    <OrderCustomerPanel order={order} />
                  </TabsContent>
                )}
              </Tabs>

              {/* Actions — the whole block, not just the buttons inside it, so
                  a read-only drawer ends cleanly at the timeline. */}
              {readOnly ? null : !showCancel ? (
                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  {canAdvance &&
                    NEXT_STATUSES[order.status].map((s) => (
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
                  {showMoney &&
                    order.paymentStatus === "pending" &&
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
                  {showMoney && CANCELLABLE.includes(order.status) && (
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
