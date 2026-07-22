import { useSseStream, type StreamStatus } from "./useSseStream";
import type { EnquiryEvent } from "@/types";

export type { StreamStatus };

/**
 * Subscribes to the realtime enquiry stream (SSE) and invokes `onEvent` for
 * each new landing-page submission. Platform-wide (not brand-scoped), so
 * `requireAccount: false` — platform admins have no `accountId` but must
 * still be able to connect.
 */
export function useEnquiryStream(
  onEvent: (e: EnquiryEvent) => void,
  enabled = true,
): StreamStatus {
  return useSseStream<EnquiryEvent>("/enquiries/stream", onEvent, enabled, {
    requireAccount: false,
  });
}
