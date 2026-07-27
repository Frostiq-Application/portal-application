import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A number that counts to its new value instead of snapping to it.
 *
 * Worth the animation on quantity steppers whose step size isn't 1: tapping
 * "+" on a pack of ten products should read as *ten more*, and a number that
 * travels there says so in a way an instant jump doesn't.
 *
 * `debounce` is what makes it usable on server-quoted money. The order total
 * re-quotes on every keystroke and every stepper tap, so an undebounced
 * counter would restart its tween two or three times per interaction and read
 * as a flicker rather than a count. Waiting for the value to settle first
 * means one smooth run to the number that actually mattered.
 */
export function AnimatedNumber({
  value,
  duration = 300,
  debounce = 0,
  format,
  className,
}: {
  value: number;
  /** Milliseconds for a full tween, however far it has to travel. */
  duration?: number;
  /** Milliseconds of quiet required before the tween starts. */
  debounce?: number;
  /** Renders each frame — e.g. a currency formatter. */
  format?: (n: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  // What's on screen right now, so an interrupted tween resumes from there
  // rather than snapping back to where the last one started.
  const shownRef = useRef(value);
  const frame = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (shownRef.current === value) return;

    const settle = () => {
      shownRef.current = value;
      setShown(value);
    };

    // Someone who's asked the OS to cut motion gets the number, not the trip.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }

    const run = () => {
      const from = shownRef.current;
      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        if (t >= 1) {
          settle();
          return;
        }
        // easeOutCubic: quick off the mark, gentle into the final value.
        const eased = 1 - Math.pow(1 - t, 3);
        const next = from + (value - from) * eased;
        shownRef.current = next;
        setShown(next);
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    };

    if (debounce > 0) timer.current = setTimeout(run, debounce);
    else run();

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, [value, duration, debounce]);

  return (
    <span className={cn("tabular-nums", className)}>
      {format ? format(shown) : Math.round(shown)}
    </span>
  );
}
