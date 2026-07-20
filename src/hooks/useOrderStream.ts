import { useSseStream, type StreamStatus } from "./useSseStream";
import type { OrderEvent } from "@/types";

export type { StreamStatus };

/**
 * Subscribes to the realtime order stream (SSE) and invokes `onEvent` for each
 * change. Thin wrapper over {@link useSseStream}. Pass `enabled: false` (e.g.
 * when the brand's plan doesn't include realtime) to skip connecting entirely.
 */
export function useOrderStream(
  onEvent: (e: OrderEvent) => void,
  enabled = true,
): StreamStatus {
  return useSseStream<OrderEvent>("/orders/stream", onEvent, enabled);
}
