import { useSseStream, type StreamStatus } from "./useSseStream";
import type { CustomCakeStreamEvent } from "@/types";

export type { StreamStatus };

/**
 * Subscribes to the realtime custom-cake stream (SSE) and invokes `onEvent` for
 * each request change. Thin wrapper over {@link useSseStream}. Pass
 * `enabled: false` (plan without realtime / custom-cake) to skip connecting.
 */
export function useCustomCakeStream(
  onEvent: (e: CustomCakeStreamEvent) => void,
  enabled = true,
): StreamStatus {
  return useSseStream<CustomCakeStreamEvent>(
    "/custom-cake/stream",
    onEvent,
    enabled,
  );
}
