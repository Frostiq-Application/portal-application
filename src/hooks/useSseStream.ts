import { useEffect, useRef, useState } from "react";
import {
  fetchEventSource,
  EventStreamContentType,
} from "@microsoft/fetch-event-source";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout, setTokens } from "@/features/auth/authSlice";
import type { LoginResponse } from "@/types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

/** Thrown to signal fetchEventSource it should stop retrying (auth is dead). */
class FatalStreamError extends Error {}

export type StreamStatus = "connecting" | "open" | "closed";

/**
 * Subscribes to a brand-scoped realtime SSE endpoint and invokes `onEvent` for
 * each parsed message. Uses fetch-event-source (not native EventSource) so it
 * can send the Bearer token as a header and transparently refresh it on 401 —
 * mirroring the RTK Query baseApi reauth flow.
 *
 * Returns the live connection status for a UI indicator. The subscription is
 * torn down on unmount and re-established if the token changes.
 *
 * `path` is appended to the API base (e.g. "/orders/stream"). Pass
 * `enabled: false` (e.g. when the brand's plan doesn't include realtime) to skip
 * connecting entirely — the server would 403 anyway, so we report "closed".
 */
export function useSseStream<T>(
  path: string,
  onEvent: (e: T) => void,
  enabled = true,
): StreamStatus {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const accountId = useAppSelector((s) => s.auth.user?.accountId);

  const [status, setStatus] = useState<StreamStatus>("connecting");

  // Keep the latest callback without re-subscribing on every render.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    // Disabled by plan, or brand-scoped stream for a user without a brand
    // (platform admins have no accountId) → don't connect.
    if (!enabled || !accessToken || !accountId) {
      setStatus("closed");
      return;
    }

    const controller = new AbortController();
    // A mutable token we can rotate in place when we refresh mid-stream.
    let token = accessToken;
    // Exponential backoff (capped) so a flapping server isn't hammered.
    let retryMs = 1000;

    const tryRefresh = async (): Promise<boolean> => {
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as LoginResponse;
        if (data.accessToken && data.refreshToken) {
          token = data.accessToken;
          dispatch(
            setTokens({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            }),
          );
          return true;
        }
      } catch {
        /* fall through to failure */
      }
      return false;
    };

    setStatus("connecting");

    fetchEventSource(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      // Keep the connection alive when the tab is backgrounded.
      openWhenHidden: true,
      headers: { authorization: `Bearer ${token}` },

      async onopen(res) {
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && ct.includes(EventStreamContentType)) {
          setStatus("open");
          retryMs = 1000; // reset backoff on a healthy connection
          return;
        }
        if (res.status === 401) {
          const refreshed = await tryRefresh();
          if (!refreshed) {
            dispatch(logout());
            throw new FatalStreamError("Session expired");
          }
          // Retry with the rotated token (throwing a retriable error).
          throw new Error("Token refreshed, retrying");
        }
        // 403 (platform admin / plan gate) or other non-retriable statuses: stop.
        throw new FatalStreamError(`Stream failed: ${res.status}`);
      },

      onmessage(msg) {
        if (!msg.data) return;
        try {
          onEventRef.current(JSON.parse(msg.data) as T);
        } catch {
          /* ignore malformed frames */
        }
      },

      onerror(err) {
        if (err instanceof FatalStreamError) {
          setStatus("closed");
          throw err; // stop retrying
        }
        // Retriable: reconnect after an (exponentially growing, capped) delay.
        setStatus("connecting");
        const delay = retryMs;
        retryMs = Math.min(retryMs * 2, 30_000);
        return delay; // ms until the next reconnect attempt
      },

      onclose() {
        setStatus("closed");
      },

      // Send the current (possibly refreshed) token on every (re)connect.
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...init?.headers, authorization: `Bearer ${token}` },
        }),
    }).catch(() => {
      // Aborts and fatal errors land here — nothing more to do.
      setStatus("closed");
    });

    return () => controller.abort();
  }, [enabled, accessToken, refreshToken, accountId, dispatch, path]);

  return status;
}
