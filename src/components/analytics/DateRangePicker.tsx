import { useMemo, useState } from "react";
import { CalendarRange } from "@/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export interface DateRangeValue {
  /** ISO date (YYYY-MM-DD) or undefined for "all time" defaults. */
  from?: string;
  to?: string;
}

type Preset = "7d" | "30d" | "90d" | "mtd" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  mtd: "This month",
  custom: "Custom range",
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute {from,to} for a preset. `to` is exclusive-friendly (today). */
function rangeFor(preset: Exclude<Preset, "custom">): DateRangeValue {
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
export function DateRangePicker({
  value,
  onChange,
  defaultPreset = "30d",
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  defaultPreset?: Preset;
}) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);

  const today = useMemo(() => iso(new Date()), []);

  const onPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") onChange(rangeFor(p));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => onPreset(v as Preset)}>
        <SelectTrigger className="w-[160px]">
          <CalendarRange className="mr-1 h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <SelectItem key={p} value={p}>
              {PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-[150px]"
            max={value.to ?? today}
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-[150px]"
            min={value.from}
            max={today}
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
}

/** The default range a page should start with (last 30 days). */
export function defaultRange(): DateRangeValue {
  return rangeFor("30d");
}
