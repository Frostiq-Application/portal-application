import type { IconComponent } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface SegmentedItem<T extends string> {
  value: T;
  label: string;
  icon?: IconComponent;
  /** Raw hex accent used to tint the active chip's icon, underline and count pill. */
  accent?: string;
  /** Optional count pill. */
  count?: number;
}

interface Props<T extends string> {
  value: T;
  items: SegmentedItem<T>[];
  onChange: (value: T) => void;
  className?: string;
  /**
   * "primary" (default) — the boxed, elevated strip used for top-level tabs.
   * "secondary" — a lighter, quieter sub-filter that sits below a primary strip
   * without competing with it (no container box, smaller chips, pill-style
   * active state).
   */
  variant?: "primary" | "secondary";
}

const DEFAULT_ACCENT = "hsl(var(--primary))";

/**
 * Horizontally-scrollable segmented "chip" strip — the same visual language as
 * the Orders queue status strip. The active chip lifts (bg-background + shadow),
 * tints its icon/label/underline with the item accent, and shows a filled count
 * pill; inactive chips are muted with a hover state.
 */
export function SegmentedStrip<T extends string>({
  value,
  items,
  onChange,
  className,
  variant = "primary",
}: Props<T>) {
  const secondary = variant === "secondary";
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className={cn(
          "inline-flex min-w-full items-stretch",
          secondary
            ? "gap-1.5"
            : "gap-1 rounded-xl border bg-muted/40 p-1",
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const accent = item.accent ?? DEFAULT_ACCENT;
          const active = value === item.value;

          if (secondary) {
            // Quieter sub-filter: compact outlined pill, no container box, no
            // accent tint — reads clearly as subordinate to the primary strip.
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange(item.value)}
                aria-pressed={active}
                className={cn(
                  "group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-foreground/20 bg-foreground/[0.06] text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                {item.label}
                {item.count != null && item.count > 0 && (
                  <span
                    className={cn(
                      "min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-none tabular-nums",
                      active
                        ? "text-foreground/70"
                        : "text-muted-foreground/70",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          }

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={cn(
                "group relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
              style={active ? { color: accent } : undefined}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {item.label}
              {item.count != null && item.count > 0 && (
                <span
                  className={cn(
                    "ml-0.5 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none",
                    active
                      ? "text-white"
                      : "bg-muted text-muted-foreground group-hover:bg-background",
                  )}
                  style={active ? { backgroundColor: accent } : undefined}
                >
                  {item.count}
                </span>
              )}
              {active && (
                <span
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
