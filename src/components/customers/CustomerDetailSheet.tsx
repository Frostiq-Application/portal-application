import { useCallback, useState } from "react";
import {
  Cake,
  CakeSlice,
  Loader2,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  Wallet,
  Clock,
} from "@/components/ui/icons";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import {
  useGetCustomerQuery,
  useListCustomerOrdersQuery,
} from "@/features/api/customersApi";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import type {
  CustomerOrderSummary,
  CustomerOrderType,
  OrderStatus,
} from "@/types";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import {
  SegmentedStrip,
  type SegmentedItem,
} from "@/components/SegmentedStrip";
import { CustomCakeTag } from "@/components/orders/CustomCakeBrief";
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

/** Orders per request on the history tab. */
const ORDERS_PAGE_SIZE = 10;

type Tab = "details" | "orders";

/**
 * The history is split rather than shown as one feed: a catalog order is a
 * repeat purchase to be reordered from, a custom cake is a brief that was
 * quoted and built, and staff open this drawer looking for one or the other.
 * The server does the splitting so each side pages on its own count.
 */
const ORDER_SECTIONS: SegmentedItem<CustomerOrderType>[] = [
  { value: "cake", label: "Cake orders", icon: Cake },
  { value: "custom", label: "Custom cake orders", icon: CakeSlice },
];

const EMPTY_MESSAGE: Record<CustomerOrderType, string> = {
  cake: "No cake orders yet.",
  custom: "No custom cake orders yet.",
};

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
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  // The sheet is watched as the scroll container for the history tab: it owns
  // the `overflow-y-auto`, so leaving the observer on the viewport would only
  // page once the sentinel scrolled fully into the window — which never happens
  // inside a box of its own.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  // Radix animates the panel out *after* `customerId` clears. Holding the last
  // id through that pass lets it slide away still showing the customer instead
  // of flashing skeletons on the way out.
  const [shownId, setShownId] = useState<string | null>(customerId);
  if (customerId && customerId !== shownId) setShownId(customerId);

  return (
    <>
      <Sheet open={!!customerId} onOpenChange={onOpenChange}>
        <SheetContent
          ref={setScrollEl}
          className="w-full overflow-y-auto sm:max-w-lg"
        >
          {shownId && (
            // Keyed on the customer so the tab, and the pages the history tab
            // has scrolled through, start fresh for the next one opened.
            <CustomerDetailBody
              key={shownId}
              customerId={shownId}
              scrollRoot={scrollEl}
              onOpenOrder={setOpenOrderId}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Read-only: an order reached through a customer's history is being
          looked up, not worked, and its customer is the drawer underneath. */}
      <OrderDetailDrawer
        readOnly
        orderId={openOrderId}
        onOpenChange={(open) => !open && setOpenOrderId(null)}
      />
    </>
  );
}

function CustomerDetailBody({
  customerId,
  scrollRoot,
  onOpenOrder,
}: {
  customerId: string;
  scrollRoot: Element | null;
  onOpenOrder: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const [section, setSection] = useState<CustomerOrderType>("cake");
  const { data, isLoading } = useGetCustomerQuery(customerId);

  // Keyed on the section too: switching sides drops the pages loaded for the
  // other one and starts back at page 1, so the two lists never interleave.
  const {
    page,
    items: orders,
    hasMore,
    total,
    ingest,
    loadMore: loadNextPage,
  } = useInfiniteList<CustomerOrderSummary>(`${customerId}|${section}`);

  // Nothing is requested until the history tab is opened — most visits to this
  // drawer are someone checking a phone number or address.
  //
  // `currentData`, not `data`: RTK keeps the previous page's response under
  // `data` while the next one is in flight, which reads to the accumulator as
  // "nothing changed" and silently drops a page.
  const { currentData, isFetching } = useListCustomerOrdersQuery(
    { customerId, page, limit: ORDERS_PAGE_SIZE, type: section },
    { skip: tab !== "orders" },
  );
  ingest(currentData);

  // Memoized: InfiniteScroll rebuilds its IntersectionObserver whenever this
  // identity changes, and a fresh observer re-fires on a sentinel already in
  // view — which would skip a page.
  const loadMore = useCallback(() => {
    if (!isFetching) loadNextPage();
  }, [isFetching, loadNextPage]);

  // Skeletons only while there is nothing to show yet. Paging deeper keeps the
  // loaded orders up and puts the loader underneath them instead.
  const loadingFirstPage = page === 1 && isFetching && !currentData;

  if (isLoading || !data) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{data.name ?? "Guest customer"}</SheetTitle>
        <SheetDescription>
          Customer since {formatDate(data.createdAt)}
          {!data.isActive && " · Inactive"}
        </SheetDescription>
      </SheetHeader>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="mt-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Customer details</TabsTrigger>
          <TabsTrigger value="orders">Order history</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          {/* Contact */}
          <div className="space-y-1.5 text-sm">
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
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <SegmentedStrip
            variant="secondary"
            className="mb-3"
            value={section}
            items={ORDER_SECTIONS}
            onChange={setSection}
          />

          {loadingFirstPage ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              {EMPTY_MESSAGE[section]}
            </p>
          ) : (
            <InfiniteScroll
              root={scrollRoot}
              rootMargin="120px"
              hasMore={hasMore}
              loading={isFetching}
              onLoadMore={loadMore}
              loader={
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading more…
                </div>
              }
              endMessage={
                total > ORDERS_PAGE_SIZE ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    All {total}{" "}
                    {section === "custom" ? "custom cake" : "cake"} orders shown
                  </p>
                ) : null
              }
            >
              <ul className="space-y-2">
                {orders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    onOpen={() => onOpenOrder(o.id)}
                  />
                ))}
              </ul>
            </InfiniteScroll>
          )}
        </TabsContent>
      </Tabs>
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
            {/* Same marker the orders table and the floor board use, so a row
                opened from here reads the same as it does everywhere else. */}
            {order.isCustomCake && <CustomCakeTag />}
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
