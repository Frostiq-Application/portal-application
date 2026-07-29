import { describe, expect, it } from "vitest";
import {
  dayDistanceLabel,
  daysBetween,
  formatSlotRange,
  isOverdue,
  isoToday,
  relativeDayLabel,
} from "./orders";

/**
 * The delivery-day tabs and the "Late" flag are only trustworthy if "today"
 * means the shop's calendar day. The classic bug here is `toISOString()`,
 * which is UTC — in IST that moves everything after 5:30pm into tomorrow.
 */
describe("isoToday", () => {
  it("uses the local calendar day, not UTC", () => {
    // 2026-07-29 23:30 local: still the 29th wherever the runner sits.
    expect(isoToday(new Date(2026, 6, 29, 23, 30))).toBe("2026-07-29");
  });

  it("pads single-digit months and days", () => {
    expect(isoToday(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });
});

describe("daysBetween", () => {
  it("counts whole days forward and back", () => {
    expect(daysBetween("2026-07-29", "2026-07-31")).toBe(2);
    expect(daysBetween("2026-07-29", "2026-07-28")).toBe(-1);
    expect(daysBetween("2026-07-29", "2026-07-29")).toBe(0);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-07-31", "2026-08-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("ignores a time component on the input", () => {
    expect(daysBetween("2026-07-29", "2026-07-30T00:00:00.000Z")).toBe(1);
  });
});

describe("relativeDayLabel", () => {
  it("names the three queue days and yesterday", () => {
    const today = "2026-07-29";
    expect(relativeDayLabel("2026-07-29", today)).toBe("Today");
    expect(relativeDayLabel("2026-07-30", today)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-07-31", today)).toBe("Day after");
    expect(relativeDayLabel("2026-07-28", today)).toBe("Yesterday");
  });

  it("returns null past the named range, so the row shows a date instead", () => {
    expect(relativeDayLabel("2026-08-03", "2026-07-29")).toBeNull();
    expect(relativeDayLabel("2026-07-20", "2026-07-29")).toBeNull();
  });
});

describe("dayDistanceLabel", () => {
  it("reads forwards and backwards", () => {
    expect(dayDistanceLabel("2026-08-03", "2026-07-29")).toBe("in 5 days");
    expect(dayDistanceLabel("2026-07-24", "2026-07-29")).toBe("5 days ago");
    expect(dayDistanceLabel("2026-07-29", "2026-07-29")).toBe("");
  });
});

describe("formatSlotRange", () => {
  it("renders the window the way staff say it", () => {
    expect(formatSlotRange("10:00:00", "12:00:00")).toBe("10:00 AM – 12:00 PM");
    expect(formatSlotRange("09:30", "21:00")).toBe("9:30 AM – 9:00 PM");
    expect(formatSlotRange("00:00", "12:00")).toBe("12:00 AM – 12:00 PM");
  });

  it("falls back to the start alone when there is no end", () => {
    expect(formatSlotRange("16:15:00", null)).toBe("4:15 PM");
  });

  it("returns null with no slot at all, so the cell can say 'Any time'", () => {
    expect(formatSlotRange(null, null)).toBeNull();
    expect(formatSlotRange(undefined, "12:00")).toBeNull();
  });
});

describe("isOverdue", () => {
  const today = "2026-07-29";

  it("flags open orders whose delivery day has passed", () => {
    expect(isOverdue("2026-07-28", "preparing", today)).toBe(true);
  });

  it("leaves today's and future orders alone", () => {
    expect(isOverdue("2026-07-29", "preparing", today)).toBe(false);
    expect(isOverdue("2026-07-30", "placed", today)).toBe(false);
  });

  it("never flags finished orders — they are not outstanding work", () => {
    expect(isOverdue("2026-07-20", "delivered", today)).toBe(false);
    expect(isOverdue("2026-07-20", "cancelled", today)).toBe(false);
  });
});
