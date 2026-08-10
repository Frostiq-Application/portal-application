import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useListBoardOrdersQuery } from "@/features/api/ordersApi";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_ACCENT } from "@/lib/orders";
import type { Order, OrderStatus, Paginated } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Loader2 } from "@/components/ui/icons";
import { FloorOrderCard } from "./FloorOrderCard";
import { FloorLaneSkeleton } from "./FloorOrderCardSkeleton";
import type { FloorLane, QueueAction } from "./types";
import type { LaneDrag } from "./useLaneDrag";

/** Orders fetched per chunk. One press of "Show more" adds another chunk. */
export const LANE_PAGE_SIZE = 10;

export interface FloorLaneColumnProps {
  lane: FloorLane;
  actions: QueueAction[];
  shopId?: string;
  /** 0 disables polling — set when the realtime stream is carrying updates. */
  pollingInterval: number;
  registerLane: (laneId: string) => (el: HTMLElement | null) => void;
  drag: LaneDrag | null;
  /** Whether a card picked up from the current drag's lane may land here. */
  accepted: boolean;
  busyId: string | null;
  landedId: string | null;
  deniedId: string | null;
  /** True when the card in flight would be accepted by whatever lane it's over. */
  dropAccepted: boolean;
  onPointerDown: (order: Order, e: React.PointerEvent) => void;
  onAdvance: (order: Order, action: QueueAction) => void;
  onOpen: (id: string) => void;
  /** Reports this lane's server-side total so the board can tell if it's empty. */
  onTotal: (status: OrderStatus, total: number) => void;
  renderDetail?: (order: Order) => ReactNode;
}

/**
 * One column of the board, and the only thing that talks to the API.
 *
 * Each lane fetches **its own status, ten at a time** rather than the board
 * pulling one big page and slicing it up. A branch with three hundred orders in
 * the pipeline shouldn't cost a chef a three-hundred-row download to see the
 * four cakes in front of them, and the count on the header is the server's
 * total either way — so "10 of 46" is honest without fetching 46.
 *
 * "Show more" widens this lane's page rather than appending a second one: one
 * cache entry per lane means a realtime invalidation refetches exactly what's
 * on screen and can't leave earlier chunks stale behind newer ones.
 */
export function FloorLaneColumn({
  lane,
  actions,
  shopId,
  pollingInterval,
  registerLane,
  drag,
  accepted,
  busyId,
  landedId,
  deniedId,
  dropAccepted,
  onPointerDown,
  onAdvance,
  onOpen,
  onTotal,
  renderDetail,
}: FloorLaneColumnProps) {
  const [shown, setShown] = useState(LANE_PAGE_SIZE);

  const { data, isLoading, isFetching } = useListBoardOrdersQuery(
    { page: 1, limit: shown, status: lane.status, shopId },
    {
      pollingInterval,
      // A board lives open on a tablet for a whole shift. Coming back to it —
      // from another tab, from sleep, from a dropped connection — has to show
      // the kitchen as it is now, not as it was hours ago.
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    },
  );

  // Widening the page is a new cache key, so `data` is briefly undefined.
  // Holding the last page means "Show more" grows the list instead of blanking
  // the column and refilling it.
  //
  // Held in state, updated during render, rather than in a ref: a render can be
  // thrown away and replayed, and a ref written during that render would keep
  // the discarded value. State is rolled back with the render, so the column
  // can't end up displaying a page React decided never happened.
  const [previous, setPrevious] = useState<Paginated<Order> | undefined>(
    undefined,
  );
  if (data && data !== previous) setPrevious(data);
  const page = data ?? previous;

  const orders = useMemo(
    () =>
      [...(page?.data ?? [])].sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate),
      ),
    [page],
  );

  const total = page?.meta.total ?? 0;
  const remaining = Math.max(0, total - orders.length);

  // Report only once a page has actually landed. `total` reads 0 before the
  // first response, and reporting that would have every lane claim to be empty
  // on mount — which is how the board came to print "nothing to go out" over a
  // set of loading placeholders. Silence until we know is the honest answer.
  useEffect(() => {
    if (!page) return;
    onTotal(lane.status, total);
  }, [lane.status, total, onTotal, page]);

  const accent = ORDER_STATUS_ACCENT[lane.status];
  // Nothing has ever arrived for this lane. A refetch keeps the page it's
  // already showing — swapping settled cards for placeholders every thirty
  // seconds would make a board that's up all shift look permanently broken.
  const loading = isLoading && !page;
  const dragging = !!drag?.active;
  const isTarget = dragging && accepted && drag.over === lane.status;
  const action = actions.find(
    (a) => drag && a.from === drag.from && a.to === lane.status,
  );

  return (
    <section
      ref={registerLane(lane.status)}
      className={cn(
        "relative min-w-0 rounded-3xl border bg-muted/25 p-4 transition-all duration-200",
        isTarget && "-translate-y-1 border-transparent bg-muted/60",
        dragging && !accepted && drag.from !== lane.status && "opacity-40 saturate-50",
      )}
      style={
        isTarget
          ? { boxShadow: `0 0 0 3px ${accent}, 0 18px 36px -18px ${accent}` }
          : undefined
      }
    >
      <div className="mb-4 flex items-center gap-3 px-1">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ background: accent }}
        />
        <h2 className="text-lg font-bold tracking-tight">{lane.label}</h2>
        {/* A count is a fact someone acts on — "two to bake" sends a chef to
            the bench. Showing a confident 0 before the lane has answered is
            worse than showing that we're still asking. */}
        {loading ? (
          <Skeleton
            className="h-8 w-11 rounded-full"
            style={{ background: `${accent}22` }}
          />
        ) : (
          <span
            className="rounded-full px-3 py-1 text-base font-bold tabular-nums"
            style={{ background: `${accent}22`, color: accent }}
          >
            {total}
          </span>
        )}
        <p className="ml-auto hidden truncate text-sm font-medium text-muted-foreground lg:block">
          {lane.hint}
        </p>
      </div>

      {/* Only appears mid-drag, and only on lanes that would take the card —
          the board answers "where can this go" before you ask. */}
      {dragging && accepted && (
        <div className="pointer-events-none absolute inset-x-0 -top-4 z-30 flex justify-center">
          <span
            className={cn(
              "rounded-full px-5 py-2 text-base font-bold text-white shadow-lg transition-all duration-200",
              isTarget
                ? "scale-100 opacity-100 motion-safe:animate-lane-pulse"
                : "scale-90 opacity-70",
            )}
            style={{ background: accent }}
          >
            {isTarget ? `Release: ${action?.label ?? lane.label}` : "Drop here"}
          </span>
        </div>
      )}

      <div className="grid gap-4">
        {loading ? (
          <FloorLaneSkeleton accent={accent} withDetail={!!renderDetail} />
        ) : orders.length === 0 && !isTarget ? (
          <div className="rounded-2xl border-2 border-dashed py-12 text-center text-base font-medium text-muted-foreground">
            Nothing here
          </div>
        ) : (
          orders.map((order, i) => (
            <FloorOrderCard
              key={order.id}
              order={order}
              index={i}
              actions={actions.filter((a) => a.from === order.status)}
              busy={busyId === order.id}
              landed={landedId === order.id}
              denied={deniedId === order.id}
              drag={
                drag?.id === order.id
                  ? {
                      dx: drag.dx,
                      dy: drag.dy,
                      vx: drag.vx,
                      active: drag.active,
                      accepted: dropAccepted,
                    }
                  : null
              }
              onPointerDown={onPointerDown}
              onAdvance={onAdvance}
              onOpen={onOpen}
              renderDetail={renderDetail}
            />
          ))
        )}

        {/* The empty slot the card is about to drop into. */}
        {isTarget && (
          <div
            className="h-20 rounded-2xl border-2 border-dashed motion-safe:animate-card-in"
            style={{ borderColor: accent, background: `${accent}12` }}
          />
        )}

        {remaining > 0 && (
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => setShown((s) => s + LANE_PAGE_SIZE)}
            className="h-12 rounded-xl text-base font-semibold"
          >
            {isFetching ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : (
              <ChevronDown className="mr-2 size-5" />
            )}
            Show {Math.min(LANE_PAGE_SIZE, remaining)} more
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({remaining} left)
            </span>
          </Button>
        )}
      </div>
    </section>
  );
}
