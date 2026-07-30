/**
 * Date-range presets for the analytics screens.
 *
 * Kept out of DateRangePicker.tsx so that file exports only components —
 * a module mixing components with plain helpers drops out of Fast Refresh.
 */
export interface DateRangeValue {
  /** ISO date (YYYY-MM-DD) or undefined for "all time" defaults. */
  from?: string;
  to?: string;
}

export type Preset = "7d" | "30d" | "90d" | "mtd" | "custom";

export const PRESET_LABELS: Record<Preset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  mtd: "This month",
  custom: "Custom range",
};

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute {from,to} for a preset. `to` is exclusive-friendly (today). */
export function rangeFor(preset: Exclude<Preset, "custom">): DateRangeValue {
  const now = new Date();
  const to = iso(now);
  if (preset === "mtd") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(first), to };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: iso(from), to };
}

/**
 * Preset-driven date range control for analytics. Emits ISO date strings via
 * onChange; "Last 30 days" is the sensible default. Custom range reveals two
 * native date inputs (no extra calendar dependency).
 */

/** The default range a page should start with (last 30 days). */
export function defaultRange(): DateRangeValue {
  return rangeFor("30d");
}
