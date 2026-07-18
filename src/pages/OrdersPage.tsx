import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/orders";
import { useListOrdersQuery } from "@/features/api/ordersApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import type { DeliveryType, OrderPaymentStatus, OrderStatus } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [deliveryType, setDeliveryType] = useState<DeliveryType | "all">("all");
  const [payment, setPayment] = useState<OrderPaymentStatus | "all">("all");
  const [shopId, setShopId] = useState<string | "all">("all");
  const [scheduledDate, setScheduledDate] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isLoading } = useListOrdersQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    deliveryType: deliveryType === "all" ? undefined : deliveryType,
    shopId: shopId === "all" ? undefined : shopId,
    scheduledDate: scheduledDate || undefined,
  });
  const { data: shops } = useListShopsQuery({ page: 1, limit: 100 });

  // paymentStatus isn't a server filter — narrow the current page client-side.
  const rows = useMemo(() => {
    const all = data?.data ?? [];
    return payment === "all"
      ? all
      : all.filter((o) => o.paymentStatus === payment);
  }, [data, payment]);

  const totalPages = data?.meta.totalPages ?? 1;

  const resetPage = () => setPage(1);
  const hasFilters =
    !!search ||
    status !== "all" ||
    deliveryType !== "all" ||
    payment !== "all" ||
    shopId !== "all" ||
    !!scheduledDate;

  const clearAll = () => {
    setSearch("");
    setStatus("all");
    setDeliveryType("all");
    setPayment("all");
    setShopId("all");
    setScheduledDate("");
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Orders" description="Order queue & fulfilment" />

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
            value={status}
            onValueChange={(v) => {
              setStatus(v as OrderStatus | "all");
              resetPage();
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Select
            value={shopId}
            onValueChange={(v) => {
              setShopId(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {(shops?.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.branchName}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(o.id)}
                >
                  <TableCell className="font-mono font-medium">{o.orderNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(o.scheduledDate)}
                    {o.scheduledSlotStart && ` · ${o.scheduledSlotStart.slice(0, 5)}`}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{o.deliveryType}</TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>

      <OrderDetailDialog orderId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  );
}
