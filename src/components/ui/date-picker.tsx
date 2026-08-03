import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { Calendar as CalendarIcon, X } from "@/components/ui/icons";
import { cn, formatDate } from "@/lib/utils";
import {
  parseDateValue,
  timePart,
  toDateValue,
} from "@/lib/dateValue";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BaseProps {
  /** Empty string means "no date chosen". */
  value: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  title?: string;
  /** Offer a Clear button. On by default — pass false for a required field. */
  clearable?: boolean;
}

export interface DatePickerProps extends BaseProps {
  /** Emits `YYYY-MM-DD`, or "" when cleared — same shape as the input it replaced. */
  onChange: (value: string) => void;
}

/** `min`/`max` as day-picker matchers, so bounded fields grey out properly. */
function boundsOf(min?: string, max?: string): Matcher[] {
  const bounds: Matcher[] = [];
  const before = parseDateValue(min);
  const after = parseDateValue(max);
  if (before) bounds.push({ before });
  if (after) bounds.push({ after });
  return bounds;
}

function TriggerLabel({
  text,
  placeholder,
}: {
  text: string | null;
  placeholder: string;
}) {
  return (
    <>
      <CalendarIcon className="mr-2 size-4 shrink-0 opacity-70" />
      <span className={cn("truncate", !text && "text-muted-foreground")}>
        {text ?? placeholder}
      </span>
    </>
  );
}

/**
 * The app's date field: a button showing the chosen day, opening a calendar.
 *
 * It takes and emits the same `YYYY-MM-DD` string as `<input type="date">`, so
 * it drops into existing state and request bodies untouched — while giving
 * every screen one calendar instead of whatever each browser felt like
 * rendering (Safari, notably, drew no picker at all).
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  disabled,
  id,
  className,
  title,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          title={title}
          className={cn("justify-start px-3 font-normal", className)}
        >
          <TriggerLabel
            text={selected ? formatDate(selected) : null}
            placeholder={placeholder}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          selected={selected}
          defaultMonth={selected}
          disabled={boundsOf(min, max)}
          onSelect={(date) => {
            if (!date) return;
            onChange(toDateValue(date));
            setOpen(false);
          }}
        />
        {clearable && value && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <X className="mr-1.5 size-3.5" />
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export interface DateTimePickerProps extends BaseProps {
  /** Emits `YYYY-MM-DDTHH:mm`, or "" when cleared. */
  onChange: (value: string) => void;
  /** Time to use when a day is picked before any time has been set. */
  defaultTime?: string;
}

/**
 * Date **and** time, for the fields that were `<input type="datetime-local">`.
 * Picking a day keeps whatever time is already set, so adjusting the date of a
 * coupon window doesn't silently reset it to midnight.
 */
export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date and time",
  disabled,
  id,
  className,
  title,
  clearable = true,
  defaultTime = "00:00",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const time = timePart(value, defaultTime);

  const label = selected ? `${formatDate(selected)}, ${time}` : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          title={title}
          className={cn("justify-start px-3 font-normal", className)}
        >
          <TriggerLabel text={label} placeholder={placeholder} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          selected={selected}
          defaultMonth={selected}
          disabled={boundsOf(min, max)}
          onSelect={(date) => {
            if (!date) return;
            onChange(`${toDateValue(date)}T${time}`);
          }}
        />
        <div className="flex items-center gap-2 border-t p-2">
          <label
            htmlFor={id ? `${id}-time` : undefined}
            className="text-xs text-muted-foreground"
          >
            Time
          </label>
          <input
            id={id ? `${id}-time` : undefined}
            type="time"
            value={time}
            disabled={!selected}
            onChange={(e) => {
              if (!selected) return;
              onChange(`${toDateValue(selected)}T${e.target.value || "00:00"}`);
            }}
            className="h-8 flex-1 rounded-md border bg-transparent px-2 text-sm disabled:opacity-50"
          />
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
