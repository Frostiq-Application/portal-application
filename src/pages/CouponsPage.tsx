import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Ticket, Store, CalendarRange, Users, Globe, Lock, ShoppingBag } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  useDeleteCouponMutation,
  useListCouponsQuery,
} from "@/features/api/couponsApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import type { Coupon } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { CouponDialog } from "@/components/coupons/CouponDialog";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 24;

export function CouponsPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Coupon[]>([]);
  const { data, isFetching, isLoading } = useListCouponsQuery({
    page,
    limit: PAGE_SIZE,
  });
  const { data: shops } = useListShopsQuery({ page: 1, limit: 100 });
  const [deleteCoupon] = useDeleteCouponMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  // Accumulate pages for infinite scroll. When the LIST tag is invalidated
  // (create/update/delete) RTK refetches page 1, so reset the accumulator.
  useEffect(() => {
    if (!data) return;
    setItems((prev) =>
      data.meta.page === 1
        ? data.data
        : [
            ...prev.filter(
              (p) => !data.data.some((n) => n.id === p.id),
            ),
            ...data.data,
          ],
    );
  }, [data]);

  const totalPages = data?.meta.totalPages ?? 1;
  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (!isFetching) setPage((p) => p + 1);
  }, [isFetching]);

  const shopName = useMemo(() => {
    const m = new Map((shops?.data ?? []).map((s) => [s.id, s.branchName]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [shops]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setDialogOpen(true);
  };
  const doDelete = async (id: string) => {
    try {
      await deleteCoupon(id).unwrap();
      setPage(1);
      toast.success("Coupon deleted");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Branch discount codes"
        actions={<Button onClick={openNew}>New coupon</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-20 text-center">
          <Ticket className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No coupons yet.</p>
        </div>
      ) : (
        <InfiniteScroll
          hasMore={hasMore}
          loading={isFetching}
          onLoadMore={loadMore}
          loader={
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
          }
          endMessage={
            <p className="pt-6 text-center text-xs text-muted-foreground">
              {items.length} coupon{items.length === 1 ? "" : "s"}
            </p>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <CouponTicket
                key={c.id}
                coupon={c}
                shopName={shopName(c.shopId)}
                onEdit={() => openEdit(c)}
                onDelete={() => doDelete(c.id)}
              />
            ))}
          </div>
        </InfiniteScroll>
      )}

      <CouponDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coupon={editing}
      />
    </>
  );
}

interface CouponTicketProps {
  coupon: Coupon;
  shopName: string;
  onEdit: () => void;
  onDelete: () => void;
}

function CouponTicket({ coupon, shopName, onEdit, onDelete }: CouponTicketProps) {
  const isPct = coupon.discountType === "percentage";
  const bigValue = isPct
    ? `${Number(coupon.discountValue)}%`
    : `₹${Number(coupon.discountValue)}`;

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden rounded-xl border bg-background shadow-sm transition-shadow hover:shadow-md",
        !coupon.isActive && "opacity-70",
      )}
    >
      {/* Stub — the "amount" side of the ticket */}
      <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-primary/5 p-4 text-primary">
        <Ticket className="mb-1 h-4 w-4 opacity-60" />
        <span className="text-2xl font-bold leading-none">{bigValue}</span>
        <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {isPct ? "off" : "flat off"}
        </span>
        {isPct && coupon.maxDiscountAmount ? (
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            up to ₹{Number(coupon.maxDiscountAmount)}
          </span>
        ) : null}
      </div>

      {/* Perforation */}
      <div className="relative w-0 border-l border-dashed border-border">
        <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-muted" />
        <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full bg-muted" />
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-base font-semibold">
              {coupon.code}
            </p>
            {coupon.displayLabel ? (
              <p className="truncate text-xs text-muted-foreground">
                {coupon.displayLabel}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                coupon.isActive
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {coupon.isActive ? "Active" : "Inactive"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onDelete}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-y-1.5 text-xs text-muted-foreground">
          <Detail icon={Store} label={shopName} />
          <Detail
            icon={CalendarRange}
            label={`${formatDate(coupon.validFrom)} – ${formatDate(coupon.validUntil)}`}
          />
          {coupon.minOrderAmount ? (
            <Detail
              icon={ShoppingBag}
              label={`Min order ₹${Number(coupon.minOrderAmount)}`}
            />
          ) : null}
          {coupon.usageLimitTotal || coupon.usageLimitPerCustomer ? (
            <Detail
              icon={Users}
              label={[
                coupon.usageLimitTotal
                  ? `${coupon.usageLimitTotal} total`
                  : null,
                coupon.usageLimitPerCustomer
                  ? `${coupon.usageLimitPerCustomer}/customer`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : null}
          <Detail
            icon={coupon.isPublic ? Globe : Lock}
            label={coupon.isPublic ? "Public" : "Private"}
          />
        </dl>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
}: {
  icon: typeof Store;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </div>
  );
}
