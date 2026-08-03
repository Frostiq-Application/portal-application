import { useCallback, useState } from "react";
import { MoreHorizontal, Search, MapPin, Clock, Phone, CalendarOff, Store, MessageCircle, Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { useLimitState } from "@/hooks/useLimitState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  LimitCounter,
  LimitNotice,
} from "@/components/gating/LimitNotice";
import { apiError } from "@/lib/apiError";
import {
  useActivateShopMutation,
  useListShopsQuery,
  useSuspendShopMutation,
} from "@/features/api/shopsApi";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { storefrontUrl, whatsappShareUrl } from "@/lib/storefront";
import { useAuth } from "@/hooks/useAuth";
import { isShopAdmin } from "@/lib/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopStatusBadge } from "@/components/StatusBadge";
import { ShopDialog } from "@/components/shops/ShopDialog";
import { BranchDetails } from "@/components/shops/BranchDetails";
import { BranchTicketSkeletonGrid } from "@/components/shops/BranchTicketSkeleton";
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
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);

  // The debounce window is dead time the user can see: they have typed, the
  // request hasn't left yet. Count it as loading, so the grid never sits there
  // showing results for a term that is already gone.
  const isTyping = search !== debounced;

  const { page, items, hasMore, total, ingest, loadMore: loadNextPage } =
    useInfiniteList<Shop>(debounced);

  // `currentData`, not `data`: RTK keeps the PREVIOUS search's response in
  // `data` (same object identity) while the new one is in flight, which both
  // hides the fact that we're loading and, when the new term is already cached,
  // looks like "nothing changed" to the accumulator.
  const { currentData, isFetching } = useListShopsQuery({
    page,
    limit: PAGE_SIZE,
    search: debounced || undefined,
  });
  ingest(currentData);

  // Skeletons whenever we have nothing to show for what the user is asking for
  // — the debounce window, the first load, and every search change. Paging past
  // page 1 keeps the grid up and shows the loader underneath instead.
  const showSkeletons = isTyping || (page === 1 && isFetching && !currentData);

  const [suspend] = useSuspendShopMutation();
  const [activate] = useActivateShopMutation();
  const { isExempt, entitlements } = useEntitlements();

  // Plan branch cap (gated roles only). Platform admin is exempt → no cap.
  // The EFFECTIVE limit (plan + purchased add-ons) — the same number the server
  // enforces. Warning at the raw plan value would nag an account that already
  // paid for extra branches.
  const maxShops = isExempt ? null : (entitlements?.maxShops ?? null);
  const shopsUsed = entitlements?.shopsUsed ?? 0;
  const branchLimit = useLimitState(shopsUsed, maxShops);
  const atBranchLimit = branchLimit.atLimit;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);

  // Memoized: InfiniteScroll rebuilds its IntersectionObserver whenever this
  // identity changes, and a fresh observer re-fires on a sentinel that is
  // already in view — which would skip a page.
  const loadMore = useCallback(() => {
    if (!isFetching) loadNextPage();
  }, [isFetching, loadNextPage]);

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
          <div className="flex items-center gap-3">
            <LimitCounter state={branchLimit} unit="branches" />
            <Button
              onClick={openNew}
              disabled={atBranchLimit}
              title={
                atBranchLimit
                  ? `Your plan allows ${maxShops} branch(es). Upgrade or add capacity to open another.`
                  : undefined
              }
            >
              New branch
            </Button>
          </div>
        }
      />

      <LimitNotice
        state={branchLimit}
        label="branches"
        unit="branches"
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder="Search branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-busy={showSkeletons}
        />
        {/* Reassurance inside the field itself: the keystroke registered and a
            result is coming, even before the debounce lets the request go. */}
        {showSkeletons && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSkeletons ? (
        <BranchTicketSkeletonGrid />
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
          loader={<BranchTicketSkeletonGrid count={3} className="pt-4" />}
          endMessage={
            <p className="pt-6 text-center text-xs text-muted-foreground">
              {total} branch{total === 1 ? "" : "es"}
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
              {/* Copy is the fallback for desktop; the WhatsApp item below is
                  the one that actually gets used, on a phone. */}
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(storefrontUrl(shop.slug))
                    .then(() => toast.success("Shop link copied."))
                    .catch(() => toast.error("Couldn't copy that."));
                }}
              >
                Copy shop link
              </DropdownMenuItem>
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

        {/* The last step before a first order: getting this link to the people
            who already buy from this bakery. One tap, straight into WhatsApp's
            own contact picker. */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3 w-full border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <a
            href={whatsappShareUrl(shop.branchName, shop.slug)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4" />
            Share on WhatsApp
          </a>
        </Button>
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
