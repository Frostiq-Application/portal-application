import { toast } from "sonner";
import { useGetOrderQuery, useUpdateOrderStatusMutation } from "@/features/api/ordersApi";
import { apiError } from "@/lib/apiError";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_ACCENT,
  ORDER_STATUS_LABEL,
  formatSlotRange,
  isoToday,
  relativeDayLabel,
  shortDayDate,
} from "@/lib/orders";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  Clock,
  ImageOff,
  Loader2,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Store,
  Truck,
  User,
  X,
} from "@/components/ui/icons";
import type { QueueAction } from "./types";

interface Props {
  orderId: string | null;
  /** Every step this board knows about; filtered to the order's own status. */
  actions: QueueAction[];
  /**
   * Show who the order is for — name, address, phone, email.
   *
   * Decided by the board rather than by a permission, and deliberately so: the
   * delivery card already puts the address in front of anyone with
   * `delivery.view`, so gating the same facts here would only mean the sheet
   * showed less than the card behind it. The kitchen board simply doesn't ask.
   */
  showContact?: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Square photo with a graceful fallback when a product has none. */
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="grid size-20 shrink-0 place-items-center rounded-2xl border bg-muted text-muted-foreground">
        <ImageOff className="size-7" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="size-20 shrink-0 rounded-2xl border object-cover"
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The full order, sized for a floor.
 *
 * Deliberately **not** the admin `OrderDetailDrawer`: this is read at arm's
 * length by someone with flour on their hands or a helmet still on, often on a
 * tablet propped on a shelf. Everything that matters — what to make, when it's
 * due, the note, where it's going — is set at a size you can read across a
 * bench, and the one action they came here to take is a full-width button at
 * the bottom rather than a small control in a row of others.
 *
 * What it *doesn't* show follows the same rule as the boards: money and
 * customer contact appear only for the roles that hold the permission, so a
 * chef gets the cake and a rider gets the address.
 */
export function FloorOrderSheet({
  orderId,
  actions,
  showContact,
  onOpenChange,
}: Props) {
  const { can } = useCan();
  const showMoney = can("orders.manage");

  const {
    data,
    isFetching,
  } = useGetOrderQuery(orderId as string, {
    skip: !orderId,
    // Always re-ask on open. An order looked at an hour ago is cached, and a
    // cached copy is exactly the thing nobody on a floor should be reading.
    refetchOnMountOrArgChange: true,
  });
  const [updateStatus, { isLoading: advancing }] = useUpdateOrderStatusMutation();

  // Skeleton whenever a request is in flight, not just on a cold open: showing
  // last time's copy while the real one loads is worse than showing nothing,
  // because it looks settled. `getOrder` is only ever refetched for *this*
  // order — another order changing can't flash this open sheet.
  const loading = isFetching || !data;
  const order = loading ? undefined : data;

  const advance = async (order: Order, action: QueueAction) => {
    try {
      await updateStatus({ id: order.id, status: action.to }).unwrap();
      toast.success(`${order.orderNumber} → ${action.label.toLowerCase()}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Couldn't update that order"));
    }
  };

  const next = order ? actions.filter((a) => a.from === order.status) : [];
  const accent = order ? ORDER_STATUS_ACCENT[order.status] : undefined;
  const today = isoToday();

  return (
    <Sheet open={!!orderId} onOpenChange={onOpenChange}>
      <SheetContent
        hideClose
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        {!order ? (
          // Shaped like the real thing, so the sheet doesn't jump when it
          // arrives. Radix needs a title on every dialog, loading or not.
          <div className="flex h-full flex-col">
            <SheetTitle className="sr-only">Loading order</SheetTitle>
            <div className="space-y-4 border-b bg-muted/40 px-6 py-6 sm:px-8">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-10 w-64 rounded-xl" />
              <Skeleton className="h-5 w-80 rounded-lg" />
            </div>
            <div className="flex-1 space-y-4 px-6 py-6 sm:px-8">
              <Skeleton className="h-5 w-40 rounded-lg" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
            <div className="border-t p-5 sm:px-8">
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Header. The order number and the deadline are what someone
                double-checks against the ticket in their hand, so they get the
                largest type on the screen. */}
            <div
              className="relative shrink-0 border-b px-6 py-6 sm:px-8"
              style={{ background: `${accent}14` }}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="absolute right-4 top-4 size-12 rounded-full"
              >
                <X className="size-6" />
              </Button>

              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white"
                style={{ background: accent }}
              >
                {ORDER_STATUS_LABEL[order.status]}
              </span>

              <SheetTitle className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
                {order.orderNumber}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {order.deliveryType === "delivery" ? "Delivery" : "Pickup"} on{" "}
                {order.scheduledDate}
              </SheetDescription>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-base font-medium">
                <span className="flex items-center gap-2">
                  {order.deliveryType === "delivery" ? (
                    <Truck className="size-5 text-muted-foreground" />
                  ) : (
                    <Store className="size-5 text-muted-foreground" />
                  )}
                  {order.deliveryType === "delivery" ? "Delivery" : "Pickup"}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarClock className="size-5 text-muted-foreground" />
                  {relativeDayLabel(order.scheduledDate, today) ??
                    shortDayDate(order.scheduledDate)}
                </span>
                {formatSlotRange(
                  order.scheduledSlotStart,
                  order.scheduledSlotEnd,
                ) && (
                  <span className="flex items-center gap-2 tabular-nums">
                    <Clock className="size-5 text-muted-foreground" />
                    {formatSlotRange(
                      order.scheduledSlotStart,
                      order.scheduledSlotEnd,
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8">
              <Section title={`What to make · ${order.items.length} item${order.items.length === 1 ? "" : "s"}`}>
                <div className="space-y-3">
                  {order.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex gap-4 rounded-2xl border bg-card p-4"
                    >
                      <Thumb src={it.imageUrl} alt={it.productName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                            {it.quantity}
                          </span>
                          <p className="min-w-0 flex-1 text-lg font-semibold leading-snug">
                            {it.productName}
                          </p>
                          {showMoney && (
                            <span className="shrink-0 text-lg font-semibold tabular-nums">
                              ₹{Number(it.lineTotal)}
                            </span>
                          )}
                        </div>
                        {/* Indented past the quantity chip (2.5rem) + gap. */}
                        <p className="mt-1.5 pl-[3.25rem] text-base text-muted-foreground">
                          {[it.variantLabel, it.flavorName]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                        {it.addons.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {it.addons.map((a, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium"
                              >
                                + {a.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {order.customerNote && (
                <div className="flex gap-4 rounded-2xl bg-amber-100 p-5 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                  <StickyNote className="mt-0.5 size-6 shrink-0" />
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider opacity-70">
                      Note from the customer
                    </p>
                    <p className="mt-1 text-lg font-medium leading-snug">
                      {order.customerNote}
                    </p>
                  </div>
                </div>
              )}

              {/* Who it's for, and where it goes. The kitchen board doesn't ask
                  for this block at all — a chef needs the cake, not the person.
                  On the delivery board it's the half of the job the items don't
                  cover: you cannot hand a box over without a name to ask for, a
                  number to ring on arrival and a door to knock on. */}
              {showContact && (
                <Section title="Who it's for">
                  <div className="space-y-4 rounded-2xl border bg-card p-5">
                    <div className="flex items-center gap-4">
                      <User className="size-6 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 text-xl font-bold leading-tight">
                        {order.customer?.name || "Name not provided"}
                      </p>
                    </div>

                    {order.deliveryType === "pickup" ? (
                      <div className="flex items-center gap-4 rounded-xl bg-muted p-4">
                        <Store className="size-6 shrink-0 text-muted-foreground" />
                        <p className="text-lg font-semibold">
                          Pickup — collects from the branch
                        </p>
                      </div>
                    ) : (
                      order.deliveryAddress && (
                        <div className="flex gap-4">
                          <MapPin className="mt-1 size-6 shrink-0 text-muted-foreground" />
                          <p className="text-lg leading-snug">
                            {order.deliveryAddress.fullAddress}
                            {order.deliveryAddress.landmark && (
                              <span className="block text-base text-muted-foreground">
                                Near {order.deliveryAddress.landmark}
                              </span>
                            )}
                            {(order.deliveryAddress.city ||
                              order.deliveryAddress.pincode) && (
                              <span className="block text-base text-muted-foreground">
                                {[
                                  order.deliveryAddress.city,
                                  order.deliveryAddress.pincode,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              </span>
                            )}
                          </p>
                        </div>
                      )
                    )}

                    {order.customer?.email && (
                      <p className="flex items-center gap-4 text-base text-muted-foreground">
                        <Mail className="size-6 shrink-0" />
                        <span className="min-w-0 break-all">
                          {order.customer.email}
                        </span>
                      </p>
                    )}

                    {order.customer?.phone && (
                      <Button
                        asChild
                        variant="outline"
                        className="h-14 w-full rounded-xl text-lg font-semibold"
                      >
                        <a href={`tel:${order.customer.phone}`}>
                          <Phone className="mr-2 size-5" />
                          Call {order.customer.phone}
                        </a>
                      </Button>
                    )}
                  </div>
                </Section>
              )}

              {/* Pickup still has to be said out loud on a board that hides the
                  customer — otherwise the screen just looks like it lost an
                  address. */}
              {!showContact && order.deliveryType === "pickup" && (
                <div className="flex items-center gap-4 rounded-2xl border bg-muted/50 p-5">
                  <Store className="size-6 shrink-0 text-muted-foreground" />
                  <p className="text-lg font-semibold">
                    Pickup — the customer collects from the branch
                  </p>
                </div>
              )}

              {showMoney && (
                <Section title="Payment">
                  <div className="flex items-center justify-between rounded-2xl border bg-card p-5">
                    <span className="text-base text-muted-foreground">
                      {order.paymentMethod.toUpperCase()} · {order.paymentStatus}
                    </span>
                    <span className="text-2xl font-bold tabular-nums">
                      ₹{Number(order.totalAmount)}
                    </span>
                  </div>
                </Section>
              )}

              <Section title="Timeline">
                <ol className="space-y-4">
                  {order.statusHistory.map((h, i) => (
                    <li key={i} className="flex gap-4">
                      <span
                        className="mt-1.5 size-3.5 shrink-0 rounded-full"
                        style={{ background: ORDER_STATUS_ACCENT[h.status] }}
                      />
                      <div className="min-w-0">
                        <p className="text-base font-semibold">
                          {ORDER_STATUS_LABEL[h.status]}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {new Date(h.changedAt).toLocaleString()}
                          </span>
                        </p>
                        {h.note && (
                          <p className="text-base text-muted-foreground">
                            {h.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>

            {/* The one thing they came to do, at the size of a door handle. */}
            {next.length > 0 && (
              <div className="shrink-0 border-t bg-background p-5 sm:px-8">
                <div className={cn("grid gap-3", next.length > 1 && "sm:grid-cols-2")}>
                  {next.map((a) => (
                    <Button
                      key={a.to}
                      size="lg"
                      variant={a.primary ? "default" : "outline"}
                      disabled={advancing}
                      onClick={() => advance(order, a)}
                      className="h-16 rounded-2xl text-lg font-bold"
                    >
                      {advancing && <Loader2 className="mr-2 size-5 animate-spin" />}
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
