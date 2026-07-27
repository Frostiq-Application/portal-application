import { useCallback, useMemo, useState } from "react";
import { CakeSlice, Eye, Search, Settings2 } from "@/components/ui/icons";
import { toast } from "sonner";
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
  CUSTOM_CAKE_STATUS_ACCENT,
  CUSTOM_CAKE_STATUS_LABELS,
} from "@/features/api/customCakeApi";
import type { CustomCakeStreamEvent } from "@/types";
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
import { useCustomCakeStream } from "@/hooks/useCustomCakeStream";
import { CustomCakeDetailSheet } from "@/components/custom-cake/CustomCakeDetailSheet";
import { CustomCakeOptionsDrawer } from "@/components/custom-cake/CustomCakeOptionsDrawer";
import { CustomCakeIntro } from "@/components/custom-cake/CustomCakeIntro";

const INTRO_SEEN_KEY = "frostique-portal-custom-cake-intro";

type StatusFilter = "all" | CustomCakeStatus;

const STATUS_ORDER: CustomCakeStatus[] = [
  "submitted",
  "under_review",
  "quotation_sent",
  "accepted",
  "preparing",
  "ready",
  "delivered",
  "rejected",
  "cancelled",
];

export function CustomCakesPage() {
  const dispatch = useAppDispatch();
  const branchId = useAppSelector(selectSelectedBranchId);
  const shopId = branchId === ALL_BRANCHES ? "" : branchId;
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [selected, setSelected] = useState<CustomCakeRequest | null>(null);
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

  const items = data?.items ?? [];

  // Realtime: when a request changes for this brand, refresh the affected
  // request + the list so every open tab reflects it live. New requests toast.
  const onEvent = useCallback(
    (e: CustomCakeStreamEvent) => {
      // A branch is always selected on this page; ignore other branches.
      if (shopId && e.shopId !== shopId) return;
      dispatch(
        customCakeApi.util.invalidateTags([
          { type: "CustomCake", id: e.requestId },
          { type: "CustomCake", id: "LIST" },
          { type: "CustomCake", id: `events:${e.requestId}` },
        ]),
      );
      if (e.type === "created") {
        toast.info(`New custom cake request ${e.requestNumber}`, {
          description: "A fresh request just landed in the queue.",
        });
      }
    },
    [dispatch, shopId],
  );
  // Realtime is a plan feature (Growth+); without it the list still works,
  // just no live updates and no Live indicator. Also needs the custom-cake add-on.
  const { hasFeature } = useEntitlements();
  const realtimeEnabled =
    hasFeature("can_use_realtime") && hasFeature("can_use_custom_cake");
  const streamStatus = useCustomCakeStream(onEvent, realtimeEnabled);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of items) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [items]);

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
            Review made-to-order cake requests, send quotes, and convert them
            into orders.
          </p>
        </div>
        <div className="flex items-end gap-2">
          {realtimeEnabled && <LiveIndicator status={streamStatus} />}
          <ShopSelect />
          <Button
            variant="outline"
            onClick={() => setOptionsOpen(true)}
            disabled={!shopId}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Form options
          </Button>
        </div>
      </div>

      {!shopId ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Select a branch to view its custom cake requests.
        </Card>
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
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        {CUSTOM_CAKE_STATUS_LABELS[request.status]}
      </span>
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
