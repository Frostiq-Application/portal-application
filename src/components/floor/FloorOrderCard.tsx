import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_ACCENT,
  formatSlotRange,
  isoToday,
  relativeDayLabel,
  shortDayDate,
} from "@/lib/orders";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Eye, GripVertical, Loader2 } from "@/components/ui/icons";
import type { QueueAction } from "./types";

/** How the card is being dragged right now, or null when it's sitting still. */
export interface CardDragState {
  dx: number;
  dy: number;
  /** Smoothed pan speed — what the card leans into. */
  vx: number;
  active: boolean;
  /** True when the lane under the pointer would actually accept the drop. */
  accepted: boolean;
}

/** Furthest the card leans while being panned, in degrees. */
const MAX_LEAN = 12;

/**
 * A stable little lean per card, derived from its id.
 *
 * Random-per-render would re-roll on every refetch and make the board twitch;
 * hashing the id means a card keeps the same angle for its whole life, so the
 * board looks like pinned paper notes rather than a shuffling deck.
 */
function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Math.round(((h % 100) / 100) * 30 - 15) / 10; // −1.5° … +1.5°
}

export interface FloorOrderCardProps {
  order: Order;
  actions: QueueAction[];
  /** Position in its lane — staggers the entrance so cards deal in, not blink in. */
  index: number;
  busy: boolean;
  /** Just arrived by drag: play the landing bounce instead of the entrance. */
  landed: boolean;
  /** Dropped somewhere the pipeline won't allow: shake it off. */
  denied: boolean;
  drag: CardDragState | null;
  onPointerDown: (order: Order, e: React.PointerEvent) => void;
  onAdvance: (order: Order, action: QueueAction) => void;
  onOpen: (id: string) => void;
  renderDetail?: (order: Order) => ReactNode;
}

export const FloorOrderCard = memo(function FloorOrderCard({
  order,
  actions,
  index,
  busy,
  landed,
  denied,
  drag,
  onPointerDown,
  onAdvance,
  onOpen,
  renderDetail,
}: FloorOrderCardProps) {
  const tilt = useMemo(() => tiltFor(order.id), [order.id]);
  const accent = ORDER_STATUS_ACCENT[order.status];
  const today = isoToday();
  const day =
    relativeDayLabel(order.scheduledDate, today) ??
    shortDayDate(order.scheduledDate);
  const slot = formatSlotRange(order.scheduledSlotStart, order.scheduledSlotEnd);

  const dragging = !!drag?.active;
  // The card leans into the pan, the way a held sheet of paper would: driven by
  // speed rather than distance, so it swings upright the moment you stop.
  const lean = dragging
    ? Math.max(-MAX_LEAN, Math.min(MAX_LEAN, drag.vx * 1.6))
    : 0;

  const style: CSSProperties = {
    ["--tilt" as string]: `${tilt}deg`,
    borderLeftColor: accent,
    // Cards deal into the lane one after another. A card that just landed by
    // drag skips the queue — it's already where the eye is.
    animationDelay: landed ? undefined : `${Math.min(index, 8) * 45}ms`,
  };
  if (dragging) {
    style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0) rotate(${(
      tilt + lean
    ).toFixed(2)}deg) scale(1.04)`;
    style.willChange = "transform";
  }

  return (
    <div className="relative" style={dragging ? { zIndex: 40 } : undefined}>
      {/* The hole the card left behind, so a lane never looks like it lost one. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5" />
      )}

      <Card
        style={style}
        onPointerDown={(e) => onPointerDown(order, e)}
        className={cn(
          "group relative select-none rounded-2xl border-l-[6px]",
          dragging
            ? "cursor-grabbing shadow-2xl ring-2 transition-none"
            : [
                // Arbitrary *property* rather than the ease- shorthand:
                // Tailwind calls a bracketed cubic-bezier there ambiguous and
                // silently drops the utility.
                "[transform:rotate(var(--tilt))] transition-[transform,box-shadow] duration-300 [transition-timing-function:cubic-bezier(.2,1.1,.35,1)]",
                "hover:z-10 hover:shadow-xl hover:[transform:rotate(0deg)_translateY(-4px)]",
                "md:cursor-grab",
              ],
          dragging && (drag.accepted ? "ring-emerald-500/70" : "ring-primary/40"),
          !dragging &&
            (landed
              ? "motion-safe:animate-card-land"
              : "motion-safe:animate-card-in"),
          denied && "motion-safe:animate-card-deny",
          busy && "opacity-90",
        )}
      >
        {/* Grab bar. `touch-action: none` is scoped to just this strip so a
            finger can still scroll the page from anywhere else on the card. */}
        <div
          data-drag-handle
          className="flex touch-none items-center justify-between gap-3 rounded-t-2xl px-4 pt-4"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground/40 transition-colors group-hover:bg-muted group-hover:text-muted-foreground">
              <GripVertical className="size-5" />
            </span>
            <span className="truncate font-mono text-lg font-bold tracking-tight">
              {order.orderNumber}
            </span>
          </div>
          <span className="shrink-0 text-right">
            <span className="block text-base font-semibold leading-tight">
              {day}
            </span>
            {slot && (
              <span className="block text-sm tabular-nums text-muted-foreground">
                {slot}
              </span>
            )}
          </span>
        </div>

        <div className="grid gap-4 px-4 pb-4 pt-4">
          {/* What to make. Quantity first — it's the number that changes what
              you do, so it's a block you can read from across the bench. */}
          <ul className="grid gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-lg font-bold tabular-nums">
                  {item.quantity}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-base font-semibold leading-snug">
                    {item.productName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {[item.variantLabel, item.flavorName]
                      .filter(Boolean)
                      .join(" · ")}
                    {item.addons.length > 0 && (
                      <>
                        {" · "}
                        {item.addons.map((a) => a.name).join(", ")}
                      </>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {order.customerNote && (
            <p className="rounded-xl bg-amber-100 px-4 py-3 text-base font-medium leading-snug text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
              {order.customerNote}
            </p>
          )}

          {renderDetail?.(order)}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpen(order.id)}
              className="h-12 shrink-0 rounded-xl px-4 text-base font-semibold"
            >
              <Eye className="mr-2 size-5" />
              Details
            </Button>
            {actions.map((a) => (
              <Button
                key={a.to}
                variant={a.primary ? "default" : "outline"}
                disabled={busy}
                onClick={() => onAdvance(order, a)}
                className="group/btn h-12 min-w-0 flex-1 rounded-xl text-base font-semibold"
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                <span className="truncate">{a.label}</span>
                <ArrowRight className="ml-2 size-5 shrink-0 transition-transform duration-200 group-hover/btn:translate-x-1" />
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
});
