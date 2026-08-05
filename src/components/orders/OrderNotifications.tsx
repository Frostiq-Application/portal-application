import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag } from "@/components/ui/icons";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useOrderStream } from "@/hooks/useOrderStream";
import { playBell } from "@/lib/bell";
import { ordersApi } from "@/features/api/ordersApi";
import {
  newOrderArrived,
  ordersSeen,
  setStreamStatus,
} from "@/features/notifications/notificationsSlice";
import type { OrderEvent } from "@/types";

const ORDERS_PATH = "/orders";

/**
 * App-wide order-stream listener. Rendered once inside the authenticated shell,
 * it owns the single SSE subscription for the whole portal:
 *
 *  - every event refreshes the orders cache so an open Orders screen stays live;
 *  - a *new* order arriving while the user is elsewhere rings a bell, shows a
 *    clickable toast that jumps to the queue, and raises the sidebar dot;
 *  - the live connection status is mirrored into Redux for the Orders indicator.
 *
 * Keeping this here (not on OrdersPage) means alerts fire from any screen and
 * there's exactly one connection.
 */
export function OrderNotifications() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { hasFeature } = useEntitlements();
  const realtimeEnabled = hasFeature("can_use_realtime");

  // The queue is "seen" whenever the user is actually on it — clear the dot.
  const onOrders = location.pathname === ORDERS_PATH;
  useEffect(() => {
    if (onOrders) dispatch(ordersSeen());
  }, [onOrders, dispatch]);

  const onEvent = useCallback(
    (e: OrderEvent) => {
      // Keep every open orders view fresh regardless of which screen we're on.
      dispatch(
        ordersApi.util.invalidateTags([
          { type: "Order", id: e.orderId },
          { type: "Order", id: "LIST" },
        ]),
      );

      if (e.type !== "created") return;

      // On the Orders screen the new row appears live — no need to interrupt.
      if (window.location.pathname === ORDERS_PATH) return;

      playBell();
      dispatch(newOrderArrived());
      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              navigate(ORDERS_PATH);
            }}
            className="flex w-full items-center gap-3 rounded-lg border bg-background p-4 text-left shadow-lg transition hover:bg-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                New order {e.orderNumber}
              </span>
              <span className="block text-xs text-muted-foreground">
                A fresh order just landed. Tap to open the queue.
              </span>
            </span>
          </button>
        ),
        { duration: 10000 },
      );
    },
    [dispatch, navigate],
  );

  const status = useOrderStream(onEvent, realtimeEnabled);
  useEffect(() => {
    dispatch(setStreamStatus(status));
  }, [status, dispatch]);

  return null;
}
