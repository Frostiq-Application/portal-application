import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ChevronsUpDown,
  Clock,
  Eye,
  Inbox,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  Truck,
  X,
} from "@/components/ui/icons";
import type { IconComponent } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { LiveIndicator } from "@/components/LiveIndicator";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  CANCELLABLE,
  DATE_BUCKET_ITEMS,
  NEXT_STATUSES,
  ORDER_STATUS_ACCENT,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  dayDistanceLabel,
  formatSlotRange,
  isOverdue,
  isoToday,
  relativeDayLabel,
  shortDayDate,
} from "@/lib/orders";
import type { OrderDateBucket, OrderSortBy, SortDir } from "@/lib/orders";
import {
  useCancelOrderMutation,
  useGetOrderScheduleCountsQuery,
  useGetOrderStatusCountsQuery,
  useListOrdersQuery,
  useMarkOrderPaidMutation,
  useUpdateOrderStatusMutation,
} from "@/features/api/ordersApi";
import type {
  DeliveryType,
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from "@/types";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import { selectStreamStatus } from "@/features/notifications/notificationsSlice";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import { SegmentedStrip } from "@/components/SegmentedStrip";
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import { CreateOrderDialog } from "@/components/orders/CreateOrderDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DELIVERY_TYPES: DeliveryType[] = ["delivery", "pickup"];
const PAYMENT_STATUSES: OrderPaymentStatus[] = ["pending", "paid"];

/** Status tabs, in pipeline order. */
const STATUS_TABS: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

/**
 * Team presets scope the status strip to a team's stages and jump to that
 * team's primary queue — the kitchen team lives in prep/ready, the delivery
 * team in dispatch/delivered. "All" shows the full pipeline.
 */
type TeamView = "all" | "kitchen" | "delivery";

const TEAM_STATUSES: Record<TeamView, OrderStatus[]> = {
  all: STATUS_TABS,
  kitchen: ["placed", "confirmed", "preparing", "ready"],
  delivery: ["ready", "out_for_delivery", "delivered"],
};

const TEAM_PRIMARY: Record<Exclude<TeamView, "all">, OrderStatus> = {
  kitchen: "preparing",
  delivery: "out_for_delivery",
};

const TEAM_ITEMS: { value: TeamView; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "kitchen", label: "Kitchen" },
  { value: "delivery", label: "Delivery" },
];

/** Icon per status — gives each queue stage a quick visual anchor. */
const STATUS_ICON: Record<OrderStatus, IconComponent> = {
  placed: Inbox,
  confirmed: CheckCircle2,
  preparing: ChefHat,
  ready: PackageCheck,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: Ban,
};

/** Tail of the empty-state sentence, per delivery-day tab. */
const DAY_PHRASE: Record<OrderDateBucket, string> = {
  all: "",
  today: " due today",
  tomorrow: " due tomorrow",
  overmorrow: " due the day after",
  other: " on other days",
};

/**
 * Direction a column starts in when you first sort by it: soonest-first for
 * the schedule (what to make next), biggest/newest first for the rest.
 */
const DEFAULT_SORT_DIR: Record<OrderSortBy, SortDir> = {
  schedule: "asc",
  slot: "asc",
  total: "desc",
  created: "desc",
};

/** A column header that toggles the queue's sort key/direction. */
function SortHead({
  label,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: OrderSortBy;
  sortBy: OrderSortBy;
  sortDir: SortDir;
  onSort: (key: OrderSortBy) => void;
  className?: string;
}) {
  const active = sortBy === sortKey;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn(
            "h-3.5 w-3.5 transition-opacity",
            active ? "opacity-100" : "opacity-40 group-hover:opacity-80",
          )}
        />
      </button>
    </TableHead>
  );
}

/**
 * Delivery day cell: the relative day staff actually speak in ("Today",
 * "Tomorrow") with the calendar date underneath, plus a "Late" flag for
 * anything still open past its date.
 */
function DeliveryDay({ order, today }: { order: Order; today: string }) {
  const relative = relativeDayLabel(order.scheduledDate, today);
  const date = shortDayDate(order.scheduledDate);
  const late = isOverdue(order.scheduledDate, order.status, today);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{relative ?? date}</span>
        {late && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
            Late
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {relative ? date : dayDistanceLabel(order.scheduledDate, today)}
      </div>
    </>
  );
}

/** Delivery window, as a slot range — "10:00 AM – 12:00 PM". */
function DeliveryTime({ order }: { order: Order }) {
  const slot = formatSlotRange(order.scheduledSlotStart, order.scheduledSlotEnd);
  if (!slot) {
    return <span className="text-xs text-muted-foreground">Any time</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {slot}
    </span>
  );
}

/**
 * Inline row action buttons: advance to the next status, decline, mark-paid.
 *
 * `onFail` lets the page flash the row when a background request reverts it,
 * and `busy` reflects that the row has an in-flight action (it fades out
 * optimistically the instant the action fires).
 */
function OrderRowActions({
  order,
  onFail,
}: {
  order: Order;
  onFail: (id: string) => void;
}) {
  const [updateStatus] = useUpdateOrderStatusMutation();
  const [markPaid, { isLoading: paying }] = useMarkOrderPaidMutation();
  const [cancelOrder] = useCancelOrderMutation();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      onFail(order.id);
      toast.error(apiError(err));
    }
  };

  const submitDecline = async () => {
    if (reason.trim().length < 3) {
      toast.error("Please give a short reason");
      return;
    }
    setDeclineOpen(false);
    setDeclining(true);
    await run(
      () => cancelOrder({ id: order.id, reason: reason.trim() }).unwrap(),
      "Order declined",
    );
    setDeclining(false);
    setReason("");
  };

  const next = NEXT_STATUSES[order.status];
  const canPay = order.paymentStatus === "pending" && order.status !== "cancelled";
  const canDecline = CANCELLABLE.includes(order.status);

  if (next.length === 0 && !canPay && !canDecline) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    // Stop row-click (which opens the detail dialog) when using the buttons.
    <div
      className="flex flex-wrap justify-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {next.map((s) => (
        <Button
          key={s}
          size="sm"
          disabled={declining}
          onClick={() =>
            run(
              () => updateStatus({ id: order.id, status: s }).unwrap(),
              `Moved to ${ORDER_STATUS_LABEL[s]}`,
            )
          }
        >
          Mark {ORDER_STATUS_LABEL[s]}
        </Button>
      ))}
      {canPay && (
        <Button
          size="sm"
          variant="outline"
          disabled={paying}
          onClick={() => run(() => markPaid(order.id).unwrap(), "Marked paid")}
        >
          {paying && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Mark paid
        </Button>
      )}
      {canDecline && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={declining}
          onClick={() => setDeclineOpen(true)}
        >
          <Ban className="mr-1 h-3.5 w-3.5" />
          Decline
        </Button>
      )}

      <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline order {order.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the order. The customer will see the reason below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for declining (e.g. out of stock, outside delivery area)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeclineOpen(false);
                setReason("");
              }}
            >
              Keep order
            </Button>
            <Button variant="destructive" onClick={submitDecline}>
              Decline order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus>("placed");
  const [team, setTeam] = useState<TeamView>("all");
  const [deliveryType, setDeliveryType] = useState<DeliveryType | "all">("all");
  const [payment, setPayment] = useState<OrderPaymentStatus | "all">("all");
  const shopId = useAppSelector(selectSelectedBranchId);
  const [scheduledDate, setScheduledDate] = useState("");
  // Opens on today's deliveries — the queue's real question is "what do we
  // make next", and the other days are one click (and one count) away.
  const [dateBucket, setDateBucket] = useState<OrderDateBucket>("today");
  const [sortBy, setSortBy] = useState<OrderSortBy>("schedule");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Ids whose background action just failed and snapped back — flashed briefly.
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(search, 350);

  // The browser's calendar day anchors the day tabs and the row labels, so
  // "Today" always means the shop's today rather than the server's UTC day.
  const today = isoToday();

  // Shared by the list and both count queries — one shape, no drift. The day
  // tab is kept separate because the day-counts query must ignore it (it is
  // the dimension that query groups by).
  const filters = {
    search: debouncedSearch || undefined,
    deliveryType: deliveryType === "all" ? undefined : deliveryType,
    shopId: !shopId || shopId === ALL_BRANCHES ? undefined : shopId,
    scheduledDate: scheduledDate || undefined,
    refDate: today,
  };
  const day = dateBucket === "all" ? undefined : dateBucket;

  const { data, isLoading, isFetching } = useListOrdersQuery({
    ...filters,
    dateBucket: day,
    page,
    limit: 20,
    status,
    sortBy,
    sortDir,
  });

  // The single order SSE connection lives in <OrderNotifications /> (app shell)
  // so alerts fire from any screen. Here we only read its live status for the
  // indicator; cache refreshes are driven centrally by that listener.
  const branchId = shopId && shopId !== ALL_BRANCHES ? shopId : null;
  // Realtime order stream is a plan feature (Growth+). Without it we still show
  // orders — just no live updates and no Live indicator.
  const { hasFeature } = useEntitlements();
  const realtimeEnabled = hasFeature("can_use_realtime");
  const streamStatus = useAppSelector(selectStreamStatus);

  const flash = useCallback((id: string) => {
    setFlashIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setFlashIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(id);
        return nextSet;
      });
    }, 1000);
  }, []);

  // paymentStatus isn't a server filter — narrow the current page client-side.
  const rows = useMemo(() => {
    const all = data?.data ?? [];
    return payment === "all"
      ? all
      : all.filter((o) => o.paymentStatus === payment);
  }, [data, payment]);

  const totalPages = data?.meta.totalPages ?? 1;

  const resetPage = () => setPage(1);
  // Branch selection is a shared, persisted app-wide choice — not a per-page
  // filter — so it's intentionally excluded from "has filters" / "Clear".
  const hasFilters =
    !!search || deliveryType !== "all" || payment !== "all" || !!scheduledDate;

  const clearAll = () => {
    setSearch("");
    setDeliveryType("all");
    setPayment("all");
    setScheduledDate("");
    setPage(1);
  };

  /** Toggle direction when re-clicking the active column, else adopt its default. */
  const applySort = (key: OrderSortBy) => {
    if (key === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
    resetPage();
  };

  // An exact date and a relative day tab would fight each other (the server
  // ANDs them), so picking one clears the other.
  const pickDay = (bucket: OrderDateBucket) => {
    setDateBucket(bucket);
    if (bucket !== "all") setScheduledDate("");
    resetPage();
  };

  const pickExactDate = (value: string) => {
    setScheduledDate(value);
    if (value) setDateBucket("all");
    resetPage();
  };

  // Live per-status totals so every tab shows its count, not just the active
  // one. Same filters as the list; refreshed by the same realtime invalidation.
  const { data: statusCounts } = useGetOrderStatusCountsQuery({
    ...filters,
    dateBucket: day,
  });
  const statusItems = useMemo(
    () =>
      TEAM_STATUSES[team].map((s) => ({
        value: s,
        label: ORDER_STATUS_LABEL[s],
        icon: STATUS_ICON[s],
        accent: ORDER_STATUS_ACCENT[s],
        count: statusCounts?.[s],
      })),
    [statusCounts, team],
  );

  // Per-day totals for the delivery-day tabs. These honor the selected status
  // too, so "Today · 6" means six orders in *this* queue due today.
  const { data: dayCounts } = useGetOrderScheduleCountsQuery({
    ...filters,
    status,
  });
  const dayItems = useMemo(
    () =>
      DATE_BUCKET_ITEMS.map((item) => ({
        ...item,
        count: dayCounts?.[item.value],
      })),
    [dayCounts],
  );

  // Now that the queue opens on one day, "No orders found." would read as if
  // the shop had none at all — name the day so the counts on the other tabs
  // are the obvious next place to look.
  const emptyMessage = `No ${ORDER_STATUS_LABEL[status].toLowerCase()} orders${DAY_PHRASE[dateBucket]}.`;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Order queue & fulfilment"
        actions={
          <div className="flex items-center gap-3">
            {realtimeEnabled && <LiveIndicator status={streamStatus} />}
            <ShopSelect onChange={resetPage} />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Create order
            </Button>
          </div>
        }
      />

      {/* Team preset scopes the pipeline to the kitchen or delivery team. */}
      <SegmentedStrip
        className="mb-3"
        variant="secondary"
        value={team}
        items={TEAM_ITEMS}
        onChange={(t) => {
          setTeam(t);
          if (t !== "all") setStatus(TEAM_PRIMARY[t]);
          resetPage();
        }}
      />

      {/* Custom status strip drives the server-side status filter. */}
      <SegmentedStrip
        className="mb-4"
        value={status}
        items={statusItems}
        onChange={(s) => {
          setStatus(s);
          resetPage();
        }}
      />

      {/* Delivery-day tabs: the queue's running order at a glance — what is
          due today, next, and later — so staff know what to start on. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Delivery day
        </span>
        <SegmentedStrip
          className="min-w-0 flex-1"
          variant="secondary"
          value={dateBucket}
          items={dayItems}
          onChange={pickDay}
        />
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search order number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={deliveryType}
            onValueChange={(v) => {
              setDeliveryType(v as DeliveryType | "all");
              resetPage();
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {DELIVERY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={payment}
            onValueChange={(v) => {
              setPayment(v as OrderPaymentStatus | "all");
              resetPage();
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              {PAYMENT_STATUSES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="w-44"
            title="Jump to an exact delivery date"
            value={scheduledDate}
            onChange={(e) => pickExactDate(e.target.value)}
          />

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <SortHead
                label="Delivery date"
                sortKey="schedule"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={applySort}
              />
              <SortHead
                label="Delivery time"
                sortKey="slot"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={applySort}
              />
              <TableHead>Type</TableHead>
              <SortHead
                label="Total"
                sortKey="total"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={applySort}
              />
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((o) => (
                <TableRow
                  key={o.id}
                  className={cn(
                    "cursor-pointer animate-row-enter",
                    flashIds.has(o.id) && "animate-row-flash",
                  )}
                  onClick={() => setOpenId(o.id)}
                >
                  <TableCell className="font-mono font-medium">
                    {o.orderNumber}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <DeliveryDay order={o} today={today} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <DeliveryTime order={o} />
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {o.deliveryType}
                  </TableCell>
                  <TableCell>₹{Number(o.totalAmount)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        o.paymentStatus === "paid"
                          ? "text-xs text-emerald-600"
                          : "text-xs text-amber-600"
                      }
                    >
                      {o.paymentStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        ORDER_STATUS_TONE[o.status],
                      )}
                    >
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(o.id);
                        }}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        See Order Details
                      </Button>
                      <OrderRowActions order={o} onFail={flash} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : `${rows.length} shown`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <OrderDetailDrawer orderId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultShopId={branchId}
      />
    </>
  );
}
