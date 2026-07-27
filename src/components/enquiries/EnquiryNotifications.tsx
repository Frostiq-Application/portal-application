import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone } from "@/components/ui/icons";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useEnquiryStream } from "@/hooks/useEnquiryStream";
import { playBell } from "@/lib/bell";
import { ENQUIRY_TYPE_LABEL } from "@/lib/enquiries";
import { queriesApi } from "@/features/api/queriesApi";
import {
  enquiryArrived,
  enquiriesSeen,
  setEnquiryStreamStatus,
} from "@/features/notifications/notificationsSlice";
import type { EnquiryEvent } from "@/types";

const QUERIES_PATH = "/queries";

/**
 * App-wide enquiry-stream listener, mirroring OrderNotifications. Rendered
 * once inside the authenticated shell; only connects for the platform super
 * admin (Queries is platform-wide, not a per-brand or plan-gated feature).
 */
export function EnquiryNotifications() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const enabled = role === "platform_super_admin";

  const onQueries = location.pathname === QUERIES_PATH;
  useEffect(() => {
    if (onQueries) dispatch(enquiriesSeen());
  }, [onQueries, dispatch]);

  const onEvent = useCallback(
    (e: EnquiryEvent) => {
      dispatch(
        queriesApi.util.invalidateTags([{ type: "Enquiry", id: "LIST" }]),
      );

      if (window.location.pathname === QUERIES_PATH) return;

      playBell();
      dispatch(enquiryArrived());
      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              navigate(QUERIES_PATH);
            }}
            className="flex w-full items-center gap-3 rounded-lg border bg-background p-4 text-left shadow-lg transition hover:bg-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Phone className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                New enquiry — {e.phone}
              </span>
              <span className="block text-xs text-muted-foreground">
                {ENQUIRY_TYPE_LABEL[e.type]} — tap to open Queries.
              </span>
            </span>
          </button>
        ),
        { duration: 10000 },
      );
    },
    [dispatch, navigate],
  );

  const status = useEnquiryStream(onEvent, enabled);
  useEffect(() => {
    dispatch(setEnquiryStreamStatus(status));
  }, [status, dispatch]);

  return null;
}
