import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Cell height. Roomy enough that digits don't clip as they roll past. */
const CELL = "1.25em";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * One rolling digit column — a 0–9 strip inside a fixed-height window.
 *
 * The strip is exactly ten cells tall, so shifting it by `digit × 10%` of its
 * own height lands the right number in the window. That's the whole trick;
 * the browser tweens the transform on the compositor, which is why this stays
 * smooth where a per-frame React counter would not.
 */
function Reel({ digit, delay }: { digit: number; delay: number }) {
  return (
    <span
      className="relative inline-block overflow-hidden align-bottom"
      style={{ height: CELL }}
    >
      <span
        // Arbitrary property rather than the ease- shorthand: Tailwind calls a
        // bracketed cubic-bezier there ambiguous and silently drops the
        // utility, leaving this on the default easing.
        className="flex flex-col transition-transform duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{
          transform: `translateY(-${digit * 10}%)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="flex items-center justify-center"
            style={{ height: CELL }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * A number that rolls to its new value the way a vehicle's odometer does.
 *
 * Chosen over both a counting tween and a fade-in reveal because it's the one
 * that reads as a *value settling* rather than as a value being uncertain:
 * the digits that didn't change don't move, so the eye is drawn only to the
 * part of the total that actually shifted.
 *
 * `debounce` is load-bearing. The order total re-quotes on every keystroke and
 * every stepper tap, and without a settling window the reels would reverse
 * mid-roll and read as a glitch. Waiting for quiet gives one clean roll to the
 * figure that mattered.
 */
export function Odometer({
  text,
  debounce = 140,
  stagger = 45,
  className,
}: {
  /** Pre-formatted value, e.g. "₹25,584.76" — non-digits render static. */
  text: string;
  /** Milliseconds of quiet required before the reels roll. */
  debounce?: number;
  /** Milliseconds each column waits behind the one to its left. */
  stagger?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (shown === text) return;
    const t = setTimeout(() => setShown(text), debounce);
    return () => clearTimeout(t);
  }, [text, debounce, shown]);

  // Digit columns are staggered among themselves, so separators and the
  // currency symbol don't leave gaps in the cascade.
  let column = 0;

  return (
    <span className={cn("inline-flex items-end tabular-nums", className)}>
      {/* Screen readers get the value whole; the split is decorative. */}
      <span className="sr-only">{shown}</span>
      <span aria-hidden="true" className="inline-flex items-end leading-none">
        {Array.from(shown).map((ch, i) => {
          if (ch >= "0" && ch <= "9") {
            const delay = column++ * stagger;
            return (
              <Reel
                key={shown.length - i}
                digit={Number(ch)}
                delay={delay}
              />
            );
          }
          return (
            <span
              key={shown.length - i}
              className="inline-flex items-center justify-center"
              style={{ height: CELL }}
            >
              {ch === " " ? " " : ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}
