import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CakeSlice,
  Eye,
  Images,
  Plus,
  Search,
  Settings2,
} from "@/components/ui/icons";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import {
  customCakeApi,
  useListCustomCakesQuery,
  type CustomCakeRequest,
  type CustomCakeStatus,
  CUSTOM_CAKE_PIPELINE,
  CUSTOM_CAKE_STATUS_ACCENT,
  CUSTOM_CAKE_STATUS_LABELS,
} from "@/features/api/customCakeApi";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { OrderEvent } from "@/types";
import { selectCustomCakeStreamStatus } from "@/features/notifications/notificationsSlice";
import { useOrderStream } from "@/hooks/useOrderStream";
import { ShopSelect } from "@/components/ShopSelect";
import { SegmentedStrip, type SegmentedItem } from "@/components/SegmentedStrip";
import { LiveIndicator } from "@/components/LiveIndicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntitlements } from "@/hooks/useEntitlements";
import { CreateCustomCakeDialog } from "@/components/custom-cake/CreateCustomCakeDialog";
import { CustomCakeDetailSheet } from "@/components/custom-cake/CustomCakeDetailSheet";
import { CustomCakeOptionsDrawer } from "@/components/custom-cake/CustomCakeOptionsDrawer";
import { CustomCakeIntro } from "@/components/custom-cake/CustomCakeIntro";
import { useListGalleryImagesQuery } from "@/features/api/galleryApi";
import { GalleryTab } from "@/components/custom-cake/GalleryTab";

const INTRO_SEEN_KEY = "frostique-portal-custom-cake-intro";

type StatusFilter = "all" | CustomCakeStatus;
/** The page has two workspaces: the request queue and the design gallery. */
type CustomCakeSection = "requests" | "gallery";

/**
 * The request's own pipeline, and all of it. Preparing/ready/delivered used to
 * be tabs here; they now live on the order an accepted request becomes, which
 * is what stops the two screens showing different states for one cake.
 */
const STATUS_ORDER: CustomCakeStatus[] = CUSTOM_CAKE_PIPELINE;

const NO_ITEMS: CustomCakeRequest[] = [];

export function CustomCakesPage() {
  const dispatch = useAppDispatch();
  const branchId = useAppSelector(selectSelectedBranchId);
  const shopId = branchId === ALL_BRANCHES ? "" : branchId;
  // The section lives in the URL so the sidebar can link straight to the
  // gallery and highlight the row the user is actually on.
  const location = useLocation();
  const navigate = useNavigate();
  const section: CustomCakeSection = location.pathname.endsWith("/gallery")
    ? "gallery"
    : "requests";
  const setSection = (next: CustomCakeSection) =>
    navigate(next === "gallery" ? "/custom-cakes/gallery" : "/custom-cakes");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [selected, setSelected] = useState<CustomCakeRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(
    () => localStorage.getItem(INTRO_SEEN_KEY) !== "1",
  );

  const { data, isLoading, isFetching } = useListCustomCakesQuery(
    shopId
      ? {
          shopId,
          status: status === "all" ? undefined : status,
          search: debouncedSearch || undefined,
          limit: 100,
        }
      : {
          status: status === "all" ? undefined : status,
          search: debouncedSearch || undefined,
          limit: 100,
        },
    { skip: !shopId },
  );

  // `?? []` would build a fresh array each render while the query is in flight,
  // making the memo below recompute every time. One shared constant is stable.
  const items = data?.items ?? NO_ITEMS;

  // Realtime is a plan feature (Growth+); without it the list still works,
  // just no live updates and no Live indicator. Also needs the custom-cake add-on.
  const { hasFeature } = useEntitlements();
  const realtimeEnabled =
    hasFeature("can_use_realtime") && hasFeature("can_use_custom_cake");
  // The request stream itself is owned by CustomCakeNotifications in the app
  // shell — one connection for the whole portal, so a request landing on any
  // screen still rings the bell and raises the sidebar dot. It invalidates the
  // cache too, which is what keeps this queue live; all this page needs from it
  // is the connection status for the indicator.
  const streamStatus = useAppSelector(selectCustomCakeStreamStatus);

  // An accepted request shows its ORDER's status, so a cake advanced on the
  // kitchen board has to repaint this queue too. The order stream carries the
  // request id precisely so this page can listen without the two backend
  // modules having to know about each other.
  const onOrderEvent = useCallback(
    (e: OrderEvent) => {
      if (!e.customCakeRequestId) return;
      if (shopId && e.shopId !== shopId) return;
      dispatch(
        customCakeApi.util.invalidateTags([
          { type: "CustomCake", id: e.customCakeRequestId },
          { type: "CustomCake", id: "LIST" },
        ]),
      );
    },
    [dispatch, shopId],
  );
  useOrderStream(onOrderEvent, realtimeEnabled);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of items) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [items]);

  // Cheap count for the section pill — RTK dedupes it with the tab's own query.
  const { data: galleryImages } = useListGalleryImagesQuery(shopId, {
    skip: !shopId,
  });

  const sectionItems: SegmentedItem<CustomCakeSection>[] = useMemo(
    () => [
      {
        value: "requests",
        label: "Requests",
        icon: CakeSlice,
        accent: "#e11d48",
        count: items.length,
      },
      {
        value: "gallery",
        label: "Gallery",
        icon: Images,
        accent: "#8b5cf6",
        count: galleryImages?.length,
      },
    ],
    [items.length, galleryImages?.length],
  );

  const statusItems: SegmentedItem<StatusFilter>[] = useMemo(
    () => [
      { value: "all", label: "All", count: items.length },
      ...STATUS_ORDER.map((s) => ({
        value: s,
        label: CUSTOM_CAKE_STATUS_LABELS[s],
        accent: CUSTOM_CAKE_STATUS_ACCENT[s],
        count: counts[s],
      })),
    ],
    [items.length, counts],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Custom Cakes</h1>
          <p className="text-sm text-muted-foreground">
            {section === "requests"
              ? "Review made-to-order cake requests, send quotes, and convert them into orders."
              : "Curate the cake photos customers browse for inspiration."}
          </p>
        </div>
        <div className="flex items-end gap-2">
          {realtimeEnabled && section === "requests" && (
            <LiveIndicator status={streamStatus} />
          )}
          <ShopSelect />
          {section === "requests" && (
            <>
              <Button
                variant="outline"
                onClick={() => setOptionsOpen(true)}
                disabled={!shopId}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Form options
              </Button>
              {/* A cake phoned in or asked for at the counter still starts life
                  as a request that needs quoting — so it is raised here, in the
                  queue that handles it, rather than from the order desk. The
                  route already proves the plan and the permission, so the
                  button needs no gate of its own. */}
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Custom cake order
              </Button>
            </>
          )}
        </div>
      </div>

      <SegmentedStrip
        value={section}
        items={sectionItems}
        onChange={setSection}
      />

      {!shopId ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Select a branch to view its{" "}
          {section === "requests" ? "custom cake requests" : "design gallery"}.
        </Card>
      ) : section === "gallery" ? (
        <GalleryTab shopId={shopId} />
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search request number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <SegmentedStrip
            value={status}
            items={statusItems}
            onChange={setStatus}
          />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <CakeSlice className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch
                  ? "No custom cake requests match your search."
                  : `No custom cake requests ${status === "all" ? "yet" : "in this status"}.`}
              </p>
            </Card>
          ) : (
            <div
              className={`space-y-3 ${isFetching ? "opacity-70 transition-opacity" : ""}`}
            >
              {items.map((r) => (
                <RequestRow key={r.id} request={r} onOpen={() => setSelected(r)} />
              ))}
            </div>
          )}
        </>
      )}

      <CreateCustomCakeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultShopId={shopId || null}
      />
      <CustomCakeDetailSheet
        request={selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
      <CustomCakeOptionsDrawer
        shopId={shopId}
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
      />
      <CustomCakeIntro
        open={introOpen}
        onClose={() => {
          localStorage.setItem(INTRO_SEEN_KEY, "1");
          setIntroOpen(false);
        }}
        onManageOptions={() => {
          localStorage.setItem(INTRO_SEEN_KEY, "1");
          setIntroOpen(false);
          setOptionsOpen(true);
        }}
      />
    </div>
  );
}

function RequestRow({
  request,
  onOpen,
}: {
  request: CustomCakeRequest;
  onOpen: () => void;
}) {
  const accent = CUSTOM_CAKE_STATUS_ACCENT[request.status];
  const summary = [request.weight, request.shape, request.cakeType, request.flavour]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-muted/40"
    >
      <div
        className="h-10 w-10 shrink-0 rounded-full"
        style={{ backgroundColor: `${accent}22` }}
      >
        <CakeSlice className="m-2.5 h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{request.contactName}</span>
          <span className="text-xs text-muted-foreground">
            {request.requestNumber}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {summary || "Custom cake request"}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        {request.neededDate && (
          <p className="text-xs text-muted-foreground">
            Needed {formatDate(request.neededDate)}
          </p>
        )}
        {request.quotedPrice && (
          <p className="text-sm font-medium">₹{request.quotedPrice}</p>
        )}
        {request.convertedOrderNumber && (
          <p className="font-mono text-xs text-muted-foreground">
            {request.convertedOrderNumber}
          </p>
        )}
      </div>
      {/* Once accepted, the cake's real state is its order's. Showing the
          request's own "Accepted" here forever is precisely what made the two
          screens look out of sync, so the order's status takes over the badge. */}
      {request.convertedOrderStatus ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            ORDER_STATUS_TONE[request.convertedOrderStatus],
          )}
        >
          {ORDER_STATUS_LABEL[request.convertedOrderStatus]}
        </span>
      ) : (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {CUSTOM_CAKE_STATUS_LABELS[request.status]}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <Eye className="mr-1 h-3.5 w-3.5" />
        View Details
      </Button>
    </Card>
  );
}
