import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import { selectStreamStatus } from "@/features/notifications/notificationsSlice";
import { useUpdateOrderStatusMutation } from "@/features/api/ordersApi";
import { apiError } from "@/lib/apiError";
import { useCan } from "@/hooks/useCan";
import { useEntitlements } from "@/hooks/useEntitlements";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { LiveIndicator } from "@/components/LiveIndicator";
import { RefreshCw } from "@/components/ui/icons";
import { FloorLaneColumn } from "./FloorLaneColumn";
import { FloorOrderSheet } from "./FloorOrderSheet";
import { useLaneDrag } from "./useLaneDrag";
import type { FloorLane, QueueAction } from "./types";

export type { FloorLane, QueueAction } from "./types";

export interface FloorBoardProps {
  /** Statuses this board shows, in column order. */
  lanes: FloorLane[];
  actions: QueueAction[];
  /** Extra detail under the item list — the address for delivery, nothing for the kitchen. */
  renderDetail?: (order: Order) => React.ReactNode;
  /** Show who the order is for in the detail sheet. Delivery yes, kitchen no. */
  showContact?: boolean;
  emptyLabel: string;
}

/** How long the "you can't drop that there" shake runs. */
const DENY_MS = 450;
/** Refresh cadence when the brand's plan has no realtime stream to lean on. */
const FALLBACK_POLL_MS = 30_000;

/**
 * The shared shape of both floor screens: a kanban board with a lane per
 * status, cards inside, and two ways to move an order along — drag it into the
 * next lane, or press the button on the card.
 *
 * Built as lanes rather than a filterable table on purpose. The people using
 * this are standing at a bench or a bike with one hand free — the question they
 * need answered is "what's next and what do I press", not "how do I filter".
 * Everything is set a size or two larger than the admin screens for the same
 * reason: this is read at arm's length, in a hurry, by someone who should not
 * have to lean in.
 *
 * Money, payment state and cancellation are all deliberately absent from the
 * cards: none of them are a floor decision, and `orders.status` is the only
 * write permission these roles hold anyway.
 *
 * Dragging is the fast path, never the only one. Every drop has an equivalent
 * button, because a drag needs a working pointer and both hands free, and a
 * chef holding a piping bag has neither.
 *
 * This component fetches nothing itself — each {@link FloorLaneColumn} loads
 * its own status ten at a time.
 */
export function FloorBoard({
  lanes,
  actions,
  renderDetail,
  showContact,
  emptyLabel,
}: FloorBoardProps) {
  // Shared with the Orders queue, so a branch picked there carries over here.
  // Only honoured for the roles that can see the picker: a chef sharing a
  // browser with an owner would otherwise inherit a persisted branch id and
  // have no control on screen to clear it. Floor roles are scoped server-side
  // regardless, which is the same answer the picker would have given them.
  const { can } = useCan();
  const branchId = useAppSelector(selectSelectedBranchId);
  const shopId =
    can("branches.view") && branchId && branchId !== ALL_BRANCHES
      ? branchId
      : undefined;

  // The single order SSE connection lives in <OrderNotifications /> (app shell)
  // and invalidates the orders cache on every event, so the lanes refresh
  // themselves. Here we only read its status for the indicator — and fall back
  // to polling for brands whose plan doesn't include the stream, because a
  // kitchen board that never changes is worse than no board.
  const { hasFeature } = useEntitlements();
  const realtime = hasFeature("can_use_realtime");
  const streamStatus = useAppSelector(selectStreamStatus);
  const live = realtime && streamStatus === "open";

  const [updateStatus] = useUpdateOrderStatusMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [deniedId, setDeniedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [totals, setTotals] = useState<Partial<Record<OrderStatus, number>>>({});

  const onTotal = useCallback((status: OrderStatus, total: number) => {
    setTotals((prev) => (prev[status] === total ? prev : { ...prev, [status]: total }));
  }, []);

  // The card under the pointer, stashed at pick-up. The lane that rendered it
  // may well have dropped it from its page by the time the drag ends.
  const draggedRef = useRef<Order | null>(null);
  const actionsRef = useRef<QueueAction[]>(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const denyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(denyTimer.current), []);

  const deny = useCallback((id: string) => {
    setDeniedId(id);
    window.clearTimeout(denyTimer.current);
    denyTimer.current = window.setTimeout(() => setDeniedId(null), DENY_MS);
  }, []);

  const advance = useCallback(
    async (order: Order, action: QueueAction) => {
      setBusyId(order.id);
      // Set before the request: the optimistic cache patch moves the card into
      // its new lane immediately, and it should bounce as it arrives.
      setLandedId(order.id);
      try {
        await updateStatus({ id: order.id, status: action.to }).unwrap();
        toast.success(`${order.orderNumber} → ${action.label.toLowerCase()}`);
      } catch (err) {
        deny(order.id);
        toast.error(apiError(err, "Couldn't update that order"));
      } finally {
        setBusyId(null);
      }
    },
    [updateStatus, deny],
  );

  const handleDrop = useCallback(
    (id: string, from: string, to: string) => {
      const order = draggedRef.current;
      draggedRef.current = null;
      if (!order || order.id !== id) return;
      const action = actionsRef.current.find(
        (a) => a.from === from && a.to === to,
      );
      // Dropping backwards, or onto a lane the pipeline can't reach from here.
      if (!action) return deny(id);
      void advance(order, action);
    },
    [advance, deny],
  );

  const { drag, startDrag, registerLane } = useLaneDrag({ onDrop: handleDrop });

  const handlePointerDown = useCallback(
    (order: Order, e: React.PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("button, a, input, [data-no-drag]")) return;
      // A finger only picks a card up by its grab bar, so swiping anywhere else
      // still scrolls the board. A mouse can grab the card anywhere — there's
      // nothing it needs to scroll past.
      if (e.pointerType !== "mouse" && !el.closest("[data-drag-handle]")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      draggedRef.current = order;
      startDrag(order.id, order.status, e);
    },
    [startDrag],
  );

  /** Would a card picked up from `drag.from` be allowed to land in `status`? */
  const accepts = useCallback(
    (status: string) =>
      !!drag &&
      drag.from !== status &&
      actions.some((a) => a.from === drag.from && a.to === status),
    [drag, actions],
  );

  // True once every lane has reported in and none of them holds anything.
  const counted = lanes.filter((l) => totals[l.status] !== undefined);
  const boardEmpty =
    counted.length === lanes.length &&
    counted.every((l) => totals[l.status] === 0);

  const dropAccepted = !!drag?.over && accepts(drag.over);

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        {realtime ? (
          <LiveIndicator status={streamStatus} />
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground"
            title="This board refreshes itself every 30 seconds"
          >
            <RefreshCw className="size-3" />
            Refreshing every 30s
          </span>
        )}
        {live && (
          <span className="text-sm text-muted-foreground">
            Updates as orders change
          </span>
        )}
      </div>

      {boardEmpty && (
        <Card className="mb-4 rounded-3xl">
          <CardContent className="py-14 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              {emptyLabel}
            </p>
          </CardContent>
        </Card>
      )}

      <div
        className={cn(
          "grid gap-5",
          lanes.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {lanes.map((lane) => (
          <FloorLaneColumn
            key={lane.status}
            lane={lane}
            actions={actions}
            shopId={shopId}
            pollingInterval={realtime ? 0 : FALLBACK_POLL_MS}
            registerLane={registerLane}
            drag={drag}
            accepted={accepts(lane.status)}
            busyId={busyId}
            landedId={landedId}
            deniedId={deniedId}
            dropAccepted={dropAccepted}
            onPointerDown={handlePointerDown}
            onAdvance={advance}
            onOpen={setOpenId}
            onTotal={onTotal}
            renderDetail={renderDetail}
          />
        ))}
      </div>

      <FloorOrderSheet
        orderId={openId}
        actions={actions}
        showContact={showContact}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </>
  );
}
