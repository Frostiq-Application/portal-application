import { useCallback, useEffect, useRef, useState } from "react";

/** A drag in flight over the board. */
export interface LaneDrag {
  /** Id of the card being dragged. */
  id: string;
  /** Lane the card was picked up from. */
  from: string;
  /** Pixels travelled since the pointer went down. */
  dx: number;
  dy: number;
  /**
   * Smoothed horizontal speed, px per move event. Drives the card's lean, so
   * it whips while you're panning and settles upright when you pause — a lean
   * taken from `dx` alone would leave the card stuck at an angle instead.
   */
  vx: number;
  /** False until the pointer clears the slop threshold — a tap is not a drag. */
  active: boolean;
  /** Lane currently under the pointer, if any. */
  over: string | null;
}

interface DragInternals extends LaneDrag {
  pointerId: number;
  originX: number;
  originY: number;
  lastX: number;
}

/** How much of the previous frame's speed carries over. Higher = looser card. */
const VELOCITY_DECAY = 0.72;

/** Movement before a press becomes a drag, so a tap still reads as a tap. */
const THRESHOLD = 6;
/** Distance from the viewport edge where the page starts scrolling itself. */
const EDGE = 96;
const MAX_SPEED = 18;

function laneAt(
  lanes: Map<string, HTMLElement>,
  x: number,
  y: number,
): string | null {
  for (const [id, el] of lanes) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
  }
  return null;
}

/**
 * Pointer-driven card dragging for a lane board.
 *
 * Deliberately hand-rolled on Pointer Events rather than HTML5 drag-and-drop:
 * the people using these boards are on a tablet propped against a bench, and
 * HTML5 `dragstart` never fires from a touchscreen. Pointer events are the one
 * API that treats a finger, a stylus and a mouse identically.
 *
 * The hook owns *where the pointer is* and *which lane it's over*; what a drop
 * means is the board's business, delivered through `onDrop`.
 */
export function useLaneDrag({
  onDrop,
}: {
  onDrop: (cardId: string, from: string, to: string) => void;
}) {
  const dragRef = useRef<DragInternals | null>(null);
  const [drag, setDrag] = useState<LaneDrag | null>(null);
  const lanes = useRef(new Map<string, HTMLElement>());
  const pointer = useRef({ x: 0, y: 0 });

  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  // One stable ref callback per lane, cached — a fresh closure each render
  // would make React detach and re-attach every lane on every drag frame.
  const laneRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const registerLane = useCallback((laneId: string) => {
    let fn = laneRefs.current.get(laneId);
    if (!fn) {
      fn = (el: HTMLElement | null) => {
        if (el) lanes.current.set(laneId, el);
        else lanes.current.delete(laneId);
      };
      laneRefs.current.set(laneId, fn);
    }
    return fn;
  }, []);

  const startDrag = useCallback(
    (cardId: string, laneId: string, e: React.PointerEvent) => {
      if (dragRef.current) return;
      dragRef.current = {
        id: cardId,
        from: laneId,
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        lastX: e.clientX,
        dx: 0,
        dy: 0,
        vx: 0,
        active: false,
        over: laneId,
      };
      pointer.current = { x: e.clientX, y: e.clientY };
      setDrag({
        id: cardId,
        from: laneId,
        dx: 0,
        dy: 0,
        vx: 0,
        active: false,
        over: laneId,
      });
    },
    [],
  );

  // Listeners live on the window, not the card: a fast drag routinely outruns
  // the element, and the drop still has to land when the pointer comes up over
  // a lane, the page chrome, or nothing at all. Re-attached only when a
  // *different* card is picked up, never on the per-frame position updates.
  const dragId = drag?.id;
  useEffect(() => {
    if (!dragId) return;
    let frame = 0;

    const publish = () => {
      const d = dragRef.current;
      if (!d) return;
      setDrag({
        id: d.id,
        from: d.from,
        dx: d.dx,
        dy: d.dy,
        vx: d.vx,
        active: d.active,
        over: d.over,
      });
    };

    /** Set by every pointermove, cleared by the frame loop that consumed it. */
    let panned = false;

    const track = (x: number, y: number) => {
      const d = dragRef.current;
      if (!d) return;
      pointer.current = { x, y };
      d.vx = d.vx * VELOCITY_DECAY + (x - d.lastX) * (1 - VELOCITY_DECAY);
      d.lastX = x;
      d.dx = x - d.originX;
      d.dy = y - d.originY;
      d.over = laneAt(lanes.current, x, y);
      panned = true;
    };

    /**
     * One frame loop for the two things that have to keep happening while the
     * pointer is simply *held*:
     *
     *  - **Edge scrolling.** Near the top or bottom of the viewport the page
     *    scrolls itself, or a lane below the fold is unreachable by finger.
     *    Scrolling moves the card's layout box too, so the drag origin shifts
     *    by exactly what was scrolled to keep the card under the pointer.
     *  - **Settling the lean.** Pan speed only updates on pointermove, so a
     *    card held still would stay frozen mid-lean; bleeding the speed off
     *    every frame lets it swing back upright instead.
     */
    const tick = () => {
      const d = dragRef.current;
      if (!d?.active) return;
      const { x, y } = pointer.current;
      const h = window.innerHeight;
      let step = 0;
      if (y < EDGE) step = -Math.ceil(((EDGE - y) / EDGE) * MAX_SPEED);
      else if (y > h - EDGE)
        step = Math.ceil(((y - (h - EDGE)) / EDGE) * MAX_SPEED);

      let dirty = false;
      if (step !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, step);
        const scrolled = window.scrollY - before;
        if (scrolled !== 0) {
          d.originY -= scrolled;
          track(x, y);
          dirty = true;
        }
      }

      if (!panned && Math.abs(d.vx) > 0.05) {
        d.vx *= VELOCITY_DECAY;
        dirty = true;
      }
      panned = false;

      if (dirty) publish();
      frame = requestAnimationFrame(tick);
    };

    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        const far = Math.hypot(e.clientX - d.originX, e.clientY - d.originY);
        if (far < THRESHOLD) return;
        d.active = true;
        d.lastX = e.clientX;
        document.body.style.userSelect = "none";
        frame = requestAnimationFrame(tick);
      }
      if (e.cancelable) e.preventDefault();
      track(e.clientX, e.clientY);
      publish();
    };

    const finish = (e: PointerEvent, cancelled: boolean) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      document.body.style.userSelect = "";
      cancelAnimationFrame(frame);
      if (!cancelled && d.active && d.over && d.over !== d.from) {
        onDropRef.current(d.id, d.from, d.over);
      }
    };

    const up = (e: PointerEvent) => finish(e, false);
    const cancel = (e: PointerEvent) => finish(e, true);

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      cancelAnimationFrame(frame);
      document.body.style.userSelect = "";
    };
  }, [dragId]);

  return { drag, startDrag, registerLane };
}
