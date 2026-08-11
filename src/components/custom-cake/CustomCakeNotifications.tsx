import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CakeSlice } from "@/components/ui/icons";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { useCan } from "@/hooks/useCan";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useCustomCakeStream } from "@/hooks/useCustomCakeStream";
import { playBell } from "@/lib/bell";
import { customCakeApi } from "@/features/api/customCakeApi";
import {
  customCakeArrived,
  customCakesSeen,
  setCustomCakeStreamStatus,
} from "@/features/notifications/notificationsSlice";
import type { CustomCakeStreamEvent } from "@/types";

const CUSTOM_CAKES_PATH = "/custom-cakes";

/**
 * App-wide custom-cake-stream listener, mirroring {@link OrderNotifications}.
 * Rendered once inside the authenticated shell, it owns the single SSE
 * subscription for the whole portal:
 *
 *  - every event refreshes the custom-cake cache so an open queue stays live;
 *  - a *new* request arriving while the user is elsewhere rings a bell, shows a
 *    clickable toast that jumps to the queue, and raises the sidebar dot;
 *  - the live connection status is mirrored into Redux for the queue's
 *    indicator.
 *
 * It used to live on CustomCakesPage, which meant a request landing while the
 * owner sat on Orders (or the Gallery tab) passed unnoticed — the whole point
 * of the dot is that it fires from any screen.
 *
 * Deliberately *not* filtered by the selected branch: the dot says "something
 * arrived for this brand", and a request for the branch you aren't currently
 * looking at is exactly the one you'd otherwise miss.
 */
export function CustomCakeNotifications() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { can } = useCan();
  const { hasFeature } = useEntitlements();
  // Realtime is a plan feature (Growth+) and the custom-cake queue is an add-on;
  // the permission check keeps a role that can't open the queue from being
  // pinged about it (the stream would 403 for them anyway).
  const enabled =
    hasFeature("can_use_realtime") &&
    hasFeature("can_use_custom_cake") &&
    can("custom_cakes.manage");

  // The queue is "seen" whenever the user is actually on it — clear the dot.
  // The Gallery sub-route doesn't count: the requests aren't on screen there.
  const onQueue = location.pathname === CUSTOM_CAKES_PATH;
  useEffect(() => {
    if (onQueue) dispatch(customCakesSeen());
  }, [onQueue, dispatch]);

  const onEvent = useCallback(
    (e: CustomCakeStreamEvent) => {
      // Keep every open custom-cake view fresh regardless of which screen we're
      // on.
      dispatch(
        customCakeApi.util.invalidateTags([
          { type: "CustomCake", id: e.requestId },
          { type: "CustomCake", id: "LIST" },
          { type: "CustomCake", id: `events:${e.requestId}` },
        ]),
      );

      if (e.type !== "created") return;

      // On the queue the new row appears live — no need to interrupt.
      if (window.location.pathname === CUSTOM_CAKES_PATH) return;

      playBell();
      dispatch(customCakeArrived());
      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              navigate(CUSTOM_CAKES_PATH);
            }}
            className="flex w-full items-center gap-3 rounded-lg border bg-background p-4 text-left shadow-lg transition hover:bg-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CakeSlice className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                New custom cake request {e.requestNumber}
              </span>
              <span className="block text-xs text-muted-foreground">
                A fresh request just landed. Tap to open the queue.
              </span>
            </span>
          </button>
        ),
        { duration: 10000 },
      );
    },
    [dispatch, navigate],
  );

  const status = useCustomCakeStream(onEvent, enabled);
  useEffect(() => {
    dispatch(setCustomCakeStreamStatus(status));
  }, [status, dispatch]);

  return null;
}
