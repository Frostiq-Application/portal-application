import { Clock, Copy, Mail, MapPin, MessageCircle, Navigation, Phone, ShoppingBag, Store, Wallet } from "@/components/ui/icons";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { useGetCustomerQuery } from "@/features/api/customersApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeNote } from "@/components/gating/UpgradeNote";
import type { Order, OrderStatus } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function inr(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

/** Initials for the avatar chip, e.g. "Arbaj Ansari" → "AA". */
function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * "+919812345678" → "+91 98123 45678". Anything the parser doesn't recognise
 * (a local number typed by shop staff, say) is shown exactly as stored — a
 * number staff has to read out loud is worse mangled than unformatted.
 */
function prettyPhone(phone: string): string {
  return formatPhoneNumberIntl(phone) || phone;
}

/**
 * "Near Amanora Mall" → "Amanora Mall". Customers type the word themselves
 * (the storefront's own placeholder invites it), and the line already reads
 * "…, near <landmark>" — otherwise the shop gets "near Near Amanora Mall".
 */
function landmarkText(landmark: string): string {
  return landmark.replace(/^\s*near(by)?\b[\s,]*/i, "").trim() || landmark;
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

/**
 * A phone/email line with its own quick actions.
 *
 * `display` exists because the value staff read is not always the value the
 * links need: the phone shows spaced for reading, while `tel:` and the copy
 * button carry the raw stored number.
 */
function ContactRow({
  icon: Icon,
  value,
  display,
  href,
  label,
  hint,
  actions,
}: {
  icon: typeof Phone;
  value: string | null;
  display?: string;
  href?: string;
  label: string;
  /** Shown in place of the value when there isn't one. */
  hint?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {value ? (
          href ? (
            <a
              href={href}
              className="block truncate text-sm font-medium hover:underline"
            >
              {display ?? value}
            </a>
          ) : (
            <span className="block truncate text-sm font-medium">
              {display ?? value}
            </span>
          )
        ) : (
          <span className="block truncate text-sm text-muted-foreground">
            {hint ?? "Not provided"}
          </span>
        )}
      </div>
      {value && (
        <div className="flex shrink-0 items-center gap-0.5">
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

  // The order carries its own copy of the buyer so the contact block works on
  // every plan; the customers module is only a fallback for orders served by
  // an API build that predates that.
  const customer = order.customer ?? profile ?? null;
  const identityLoading = !order.customer && canSeeHistory && profileLoading;
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
      {/* Who placed it, and how to reach them — one card, because staff read
          the name and dial the number in the same breath. */}
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        {identityLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials(customer?.name ?? null)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold">
                  {customer?.name ?? "Guest customer"}
                </h3>
                {customer && !customer.isActive && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {customer
                  ? `Customer since ${formatDate(customer.createdAt)}`
                  : "This customer record is no longer available"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <ContactRow
            icon={Phone}
            label="Phone"
            value={customer?.phone ?? null}
            display={customer?.phone ? prettyPhone(customer.phone) : undefined}
            href={customer?.phone ? `tel:${customer.phone}` : undefined}
            hint="No number on this account"
            actions={
              digits ? (
                <>
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
                  <Button
                    asChild
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Call customer"
                  >
                    <a href={`tel:${customer?.phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </>
              ) : null
            }
          />
          <ContactRow
            icon={Mail}
            label="Email"
            value={customer?.email ?? null}
            href={customer?.email ? `mailto:${customer.email}` : undefined}
            hint="No email on this account"
          />
        </div>
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
                  {addr.landmark ? `, near ${landmarkText(addr.landmark)}` : ""}
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
        <UpgradeNote
          feature="can_use_customer_data"
          description="Lifetime spend and this customer’s past orders, right here in the order."
        />
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
