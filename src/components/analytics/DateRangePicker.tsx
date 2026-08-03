import { useMemo, useState } from "react";
import { CalendarRange } from "@/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  PRESET_LABELS,
  rangeFor,
  iso,
  type DateRangeValue,
  type Preset,
} from "@/lib/dateRange";

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
          <DatePicker
            className="w-[150px]"
            placeholder="From"
            max={value.to ?? today}
            value={value.from ?? ""}
            onChange={(v) => onChange({ ...value, from: v || undefined })}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <DatePicker
            className="w-[150px]"
            placeholder="To"
            min={value.from}
            max={today}
            value={value.to ?? ""}
            onChange={(v) => onChange({ ...value, to: v || undefined })}
          />
        </div>
      )}
    </div>
  );
}
