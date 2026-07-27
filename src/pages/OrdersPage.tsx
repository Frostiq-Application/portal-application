import { useCallback, useMemo, useState } from "react";
import { Ban, CheckCircle2, ChefHat, Eye, Inbox, Loader2, PackageCheck, Plus, Search, Truck, X } from "@/components/ui/icons";
import type { IconComponent } from "@/components/ui/icons";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { LiveIndicator } from "@/components/LiveIndicator";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  CANCELLABLE,
  NEXT_STATUSES,
  ORDER_STATUS_ACCENT,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/orders";
import {
  useCancelOrderMutation,
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Ids whose background action just failed and snapped back — flashed briefly.
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isLoading, isFetching } = useListOrdersQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status,
    deliveryType: deliveryType === "all" ? undefined : deliveryType,
    shopId: !shopId || shopId === ALL_BRANCHES ? undefined : shopId,
    scheduledDate: scheduledDate || undefined,
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

  // Live per-status totals so every tab shows its count, not just the active
  // one. Same filters as the list; refreshed by the same realtime invalidation.
  const { data: statusCounts } = useGetOrderStatusCountsQuery({
    search: debouncedSearch || undefined,
    deliveryType: deliveryType === "all" ? undefined : deliveryType,
    shopId: !shopId || shopId === ALL_BRANCHES ? undefined : shopId,
    scheduledDate: scheduledDate || undefined,
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
            value={scheduledDate}
            onChange={(e) => {
              setScheduledDate(e.target.value);
              resetPage();
            }}
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
              <TableHead>Schedule</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No orders found.
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
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(o.scheduledDate)}
                    {o.scheduledSlotStart && ` · ${o.scheduledSlotStart.slice(0, 5)}`}
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
