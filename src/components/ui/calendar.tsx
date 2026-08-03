import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

export type CalendarProps = DayPickerProps;

/**
 * The month grid behind every date field, styled to the app's tokens rather
 * than react-day-picker's stylesheet — nothing is imported from the library's
 * CSS, so a theme change here follows the rest of the UI.
 *
 * Selection state lands on the day *cell* in v9 while the clickable element is
 * the button inside it, hence the `[&>button]` selectors: they beat the ghost
 * button's own hover colours on specificity, in either class order.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-4",
        // Nav is a sibling of the months in v9, so it spans the whole header.
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 disabled:opacity-30",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 disabled:opacity-30",
        ),
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-sm font-medium",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[0.8rem] font-normal text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative size-9 p-0 text-center text-sm focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 rounded-md p-0 font-normal",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "[&>button]:text-muted-foreground [&>button]:opacity-50",
        // The button carries `disabled`, so buttonVariants already dims it —
        // this only takes the colour down with it.
        disabled: "[&>button]:text-muted-foreground",
        range_start: "rounded-l-md",
        range_end: "rounded-r-md",
        range_middle:
          "bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chevronClassName)} />
          ) : (
            <ChevronRight className={cn("size-4", chevronClassName)} />
          ),
      }}
      {...props}
    />
  );
}
