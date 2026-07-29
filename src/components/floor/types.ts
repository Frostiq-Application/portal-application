import type { OrderStatus } from "@/types";

/** One step this board can advance an order through — also a legal drop. */
export interface QueueAction {
  /** Status the order must be in for this action to show. */
  from: OrderStatus;
  to: OrderStatus;
  label: string;
  /** Rendered as the primary button rather than an outline one. */
  primary?: boolean;
}

/** One column of the board. */
export interface FloorLane {
  status: OrderStatus;
  label: string;
  hint: string;
}
