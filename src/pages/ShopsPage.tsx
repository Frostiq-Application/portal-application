import { useCallback, useEffect, useState } from "react";
import {
  MoreHorizontal,
  Search,
  MapPin,
  Clock,
  Phone,
  CalendarOff,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntitlements } from "@/hooks/useEntitlements";
import { apiError } from "@/lib/apiError";
import {
  useActivateShopMutation,
  useListShopsQuery,
  useSuspendShopMutation,
} from "@/features/api/shopsApi";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isShopAdmin } from "@/lib/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopStatusBadge } from "@/components/StatusBadge";
import { ShopDialog } from "@/components/shops/ShopDialog";
import { BranchDetails } from "@/components/shops/BranchDetails";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 24;

export function ShopsPage() {
  const { role } = useAuth();
  // A shop admin owns exactly one branch → show a rich detail view instead of
  // the multi-branch grid used by account/platform admins.
  if (isShopAdmin(role)) return <MyBranch />;
  return <BranchGrid />;
}

/** Shop-admin view: their single branch as a detail page. */
function MyBranch() {
  const { data, isLoading } = useListShopsQuery({ page: 1, limit: 1 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const shop = data?.data[0] ?? null;

  if (isLoading) {
    return (
      <>
        <PageHeader title="My Branch" description="Your outlet at a glance" />
        <Skeleton className="h-52 w-full rounded-xl" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  if (!shop) {
    return (
      <>
        <PageHeader title="My Branch" description="Your outlet at a glance" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-20 text-center">
          <Store className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No branch is assigned to you yet.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <BranchDetails shop={shop} onEdit={() => setDialogOpen(true)} />
      <ShopDialog open={dialogOpen} onOpenChange={setDialogOpen} shop={shop} />
    </>
  );
}

/** Account / platform admin view: the searchable multi-branch grid. */
function BranchGrid() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const [items, setItems] = useState<Shop[]>([]);
  const { data, isFetching, isLoading } = useListShopsQuery({
    page,
    limit: PAGE_SIZE,
    search: debounced || undefined,
  });
  const [suspend] = useSuspendShopMutation();
  const [activate] = useActivateShopMutation();
  const { isExempt, entitlements } = useEntitlements();

  // Plan branch cap (gated roles only). Platform admin is exempt → no cap.
  const maxShops = isExempt ? null : entitlements?.maxShops ?? null;
  const shopsUsed = entitlements?.shopsUsed ?? 0;
  const atBranchLimit = maxShops != null && shopsUsed >= maxShops;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);

  // Reset the accumulator whenever the search term changes.
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [debounced]);

  // Accumulate pages for infinite scroll. Page 1 (initial load, search change,
  // or a mutation refetch that invalidates LIST) replaces the accumulator.
  useEffect(() => {
    if (!data) return;
    setItems((prev) =>
      data.meta.page === 1
        ? data.data
        : [
            ...prev.filter((p) => !data.data.some((n) => n.id === p.id)),
            ...data.data,
          ],
    );
  }, [data]);

  const totalPages = data?.meta.totalPages ?? 1;
  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (!isFetching) setPage((p) => p + 1);
  }, [isFetching]);

  const openNew = () => {
    if (atBranchLimit) {
      toast.error(
        "Branch limit reached for your plan. Contact your administrator to upgrade.",
      );
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: Shop) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Branches"
        description={
          maxShops != null
            ? `${shopsUsed} of ${maxShops} branches used on your plan`
            : "Outlets across your brand"
        }
        actions={
          <Button
            onClick={openNew}
            disabled={atBranchLimit}
            title={
              atBranchLimit
                ? "Branch limit reached for your plan — contact your administrator to upgrade"
                : undefined
            }
          >
            New branch
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-20 text-center">
          <Store className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No branches found.</p>
        </div>
      ) : (
        <InfiniteScroll
          hasMore={hasMore}
          loading={isFetching}
          onLoadMore={loadMore}
          loader={
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-xl" />
              ))}
            </div>
          }
          endMessage={
            <p className="pt-6 text-center text-xs text-muted-foreground">
              {items.length} branch{items.length === 1 ? "" : "es"}
            </p>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <BranchTicket
                key={s.id}
                shop={s}
                onEdit={() => openEdit(s)}
                onSuspend={() =>
                  run(() => suspend(s.id).unwrap(), "Branch suspended")
                }
                onActivate={() =>
                  run(() => activate(s.id).unwrap(), "Branch activated")
                }
              />
            ))}
          </div>
        </InfiniteScroll>
      )}

      <ShopDialog open={dialogOpen} onOpenChange={setDialogOpen} shop={editing} />
    </>
  );
}

interface BranchTicketProps {
  shop: Shop;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
}

function BranchTicket({ shop, onEdit, onSuspend, onActivate }: BranchTicketProps) {
  const hours =
    shop.openingTime && shop.closingTime
      ? `${shop.openingTime.slice(0, 5)}–${shop.closingTime.slice(0, 5)}`
      : null;
  const location = [shop.displayArea, shop.city].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-background shadow-sm transition-shadow hover:shadow-md",
        shop.status !== "active" && "opacity-80",
      )}
    >
      {/* Property photo — fixed 16:9 */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-primary/5">
        {shop.bannerUrl ? (
          <img
            src={shop.bannerUrl}
            alt={shop.branchName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <Store className="h-8 w-8" />
          </div>
        )}

        {/* Status pill, bottom-left over the photo */}
        <div className="absolute bottom-2 left-2">
          <ShopStatusBadge status={shop.status} />
        </div>

        {/* Actions, top-right over the photo */}
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              {shop.status === "active" ? (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onSuspend}
                >
                  Suspend
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onActivate}>
                  Activate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title + location, like a listing headline */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <p className="truncate text-base font-semibold">{shop.branchName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">{location || "No location set"}</span>
        </p>
        <p className="mt-2 truncate font-mono text-xs text-muted-foreground/80">
          /{shop.slug}
        </p>
      </div>

      {/* Feature strip at the bottom */}
      <div className="mt-auto grid grid-cols-3 divide-x border-t bg-muted/30 text-center">
        <Feature icon={Clock} label={hours ?? "—"} caption="Hours" />
        <Feature
          icon={Phone}
          label={shop.whatsappNumber ?? "—"}
          caption="WhatsApp"
        />
        <Feature
          icon={CalendarOff}
          label={shop.closedDays.length ? shop.closedDays.join(", ") : "None"}
          caption="Closed"
        />
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  label,
  caption,
}: {
  icon: typeof MapPin;
  label: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="w-full truncate text-xs font-medium">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {caption}
      </span>
    </div>
  );
}
