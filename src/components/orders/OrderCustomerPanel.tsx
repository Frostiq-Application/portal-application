import { Clock, Copy, Mail, MapPin, MessageCircle, Navigation, Phone, ShoppingBag, Store, Wallet } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { useGetCustomerQuery } from "@/features/api/customersApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { Order, OrderStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy to clipboard");
  }
}

/** A phone/email line with its own quick actions. */
function ContactRow({
  icon: Icon,
  value,
  href,
  label,
  actions,
}: {
  icon: typeof Phone;
  value: string | null;
  href?: string;
  label: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {value ? (
          href ? (
            <a href={href} className="block truncate text-sm hover:underline">
              {value}
            </a>
          ) : (
            <span className="block truncate text-sm">{value}</span>
          )
        ) : (
          <span className="text-sm text-muted-foreground">Not provided</span>
        )}
      </div>
      {value && (
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title={`Copy ${label.toLowerCase()}`}
            onClick={() => copy(value, label)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The "Customer" tab of the order drawer: who placed the order, how to reach
 * them, where it goes, and — when the plan includes customer data — their
 * lifetime value and recent orders.
 */
export function OrderCustomerPanel({ order }: { order: Order }) {
  const { hasFeature } = useEntitlements();
  const canSeeHistory = hasFeature("can_use_customer_data");

  // Lifetime stats/history live in the (plan-gated) customers module. The
  // contact block above never depends on it, so a locked plan just hides the
  // extras instead of breaking the tab.
  const { data: profile, isLoading: profileLoading } = useGetCustomerQuery(
    order.customerId,
    { skip: !canSeeHistory },
  );

  const customer = order.customer;
  const addr = order.deliveryAddress;
  const digits = customer?.phone?.replace(/\D/g, "") ?? "";
  const mapQuery =
    addr &&
    (addr.latitude && addr.longitude
      ? `${addr.latitude},${addr.longitude}`
      : encodeURIComponent(
          [addr.fullAddress, addr.landmark, addr.city, addr.pincode]
            .filter(Boolean)
            .join(", "),
        ));

  // Other orders by the same customer — this one is already on screen.
  const otherOrders = (profile?.orders ?? []).filter((o) => o.id !== order.id);

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div>
        <h3 className="text-base font-semibold">
          {customer?.name ?? "Guest customer"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {customer
            ? `Customer since ${formatDate(customer.createdAt)}`
            : "This customer record is no longer available"}
          {customer && !customer.isActive && " · Inactive"}
        </p>
      </div>

      {/* Contact */}
      <div className="space-y-2">
        <ContactRow
          icon={Phone}
          label="Phone"
          value={customer?.phone ?? null}
          href={customer?.phone ? `tel:${customer.phone}` : undefined}
          actions={
            digits ? (
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title="Message on WhatsApp"
              >
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null
          }
        />
        <ContactRow
          icon={Mail}
          label="Email"
          value={customer?.email ?? null}
          href={customer?.email ? `mailto:${customer.email}` : undefined}
        />
      </div>

      {/* Where this order goes */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          {order.deliveryType === "delivery" ? "Delivery address" : "Fulfilment"}
        </p>
        {order.deliveryType === "pickup" ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Customer picks this order up at the branch.</span>
          </div>
        ) : addr ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                {addr.label && (
                  <p className="font-medium">{addr.label}</p>
                )}
                <p className="text-muted-foreground">
                  {addr.fullAddress}
                  {addr.landmark ? `, near ${addr.landmark}` : ""}
                </p>
                {(addr.city || addr.pincode) && (
                  <p className="text-xs text-muted-foreground">
                    {[addr.city, addr.pincode].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  copy(
                    [
                      addr.fullAddress,
                      addr.landmark,
                      addr.city,
                      addr.pincode,
                    ]
                      .filter(Boolean)
                      .join(", "),
                    "Address",
                  )
                }
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button asChild size="sm" variant="outline">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="mr-1.5 h-3.5 w-3.5" />
                  Open in Maps
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No address on this order — confirm it with the customer before
            dispatch.
          </p>
        )}
      </div>

      {order.customerNote && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Note from customer
          </p>
          <p className="rounded-md bg-muted p-3 text-xs">{order.customerNote}</p>
        </div>
      )}

      {/* Lifetime value + history (plan-gated) */}
      {!canSeeHistory ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Lifetime spend and past orders are part of the Customer data feature.
          Contact your administrator to upgrade.
        </p>
      ) : profileLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : profile ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={ShoppingBag}
              label="Total orders"
              value={String(profile.orderCount)}
            />
            <Stat
              icon={Wallet}
              label="Lifetime spend"
              value={inr(profile.totalSpent)}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Previous orders
            </p>
            {otherOrders.length === 0 ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                This is their first order.
              </p>
            ) : (
              <ul className="space-y-2">
                {otherOrders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {o.orderNumber}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            statusTone(o.status),
                          )}
                        >
                          {statusLabel(o.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(o.createdAt)} · {o.deliveryType}
                        {o.paymentStatus === "pending" && " · Unpaid"}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {inr(o.totalAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
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
