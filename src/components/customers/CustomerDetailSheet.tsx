import { useState } from "react";
import { MapPin, Phone, Mail, ShoppingBag, Wallet, Clock } from "@/components/ui/icons";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { useGetCustomerQuery } from "@/features/api/customersApi";
import type { CustomerOrderSummary, OrderStatus } from "@/types";
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
}

function inr(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

/** "completed" isn't in the portal's status map — fall back gracefully. */
function statusLabel(status: OrderStatus | "completed"): string {
  if (status === "completed") return "Completed";
  return ORDER_STATUS_LABEL[status] ?? status;
}
function statusTone(status: OrderStatus | "completed"): string {
  if (status === "completed") return ORDER_STATUS_TONE.delivered;
  return ORDER_STATUS_TONE[status] ?? "bg-muted text-muted-foreground";
}

export function CustomerDetailSheet({ customerId, onOpenChange }: Props) {
  const { data, isLoading } = useGetCustomerQuery(customerId as string, {
    skip: !customerId,
  });
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <>
      <Sheet open={!!customerId} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {isLoading || !data ? (
            <div className="space-y-4 pt-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{data.name ?? "Guest customer"}</SheetTitle>
                <SheetDescription>
                  Customer since {formatDate(data.createdAt)}
                  {!data.isActive && " · Inactive"}
                </SheetDescription>
              </SheetHeader>

              {/* Contact */}
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{data.phone ?? "No phone"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{data.email ?? "No email"}</span>
                </div>
              </div>

              {/* Spend summary */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat
                  icon={ShoppingBag}
                  label="Total orders"
                  value={String(data.orderCount)}
                />
                <Stat
                  icon={Wallet}
                  label="Lifetime spend"
                  value={inr(data.totalSpent)}
                />
              </div>

              {/* Addresses */}
              {data.addresses.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold">Addresses</h3>
                  <ul className="space-y-2">
                    {data.addresses.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border bg-muted/30 p-3 text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {a.label ?? "Address"}
                              </span>
                              {a.isDefault && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              {a.fullAddress}
                              {a.landmark ? `, near ${a.landmark}` : ""}
                            </p>
                            {(a.city || a.pincode) && (
                              <p className="text-xs text-muted-foreground">
                                {[a.city, a.pincode].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Order history */}
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Order history</h3>
                {data.orders.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No orders yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.orders.map((o) => (
                      <OrderRow
                        key={o.id}
                        order={o}
                        onOpen={() => setOpenOrderId(o.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <OrderDetailDrawer
        orderId={openOrderId}
        onOpenChange={(open) => !open && setOpenOrderId(null)}
      />
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function OrderRow({
  order,
  onOpen,
}: {
  order: CustomerOrderSummary;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">
              {order.orderNumber}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusTone(order.status),
              )}
            >
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(order.createdAt)} · {order.deliveryType}
            {order.paymentStatus === "pending" && " · Unpaid"}
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold">
          {inr(order.totalAmount)}
        </span>
      </button>
    </li>
  );
}
