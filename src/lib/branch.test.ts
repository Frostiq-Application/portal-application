import { describe, expect, it } from "vitest";
import { TIME_SLOTS, formatCoordinates, formatTimeLabel, parseCoordinates } from "./branch";

/**
 * Map-link parsing.
 *
 * This is the only way a branch gets coordinates — there are no latitude and
 * longitude boxes any more, because nobody knows their shop's latitude and a
 * mistyped one silently puts the branch in the sea. So the parser has to cope
 * with whatever Google's Share button actually produces.
 */
describe("parseCoordinates", () => {
  it("reads the precise !3d/!4d pair from a place URL", () => {
    expect(
      parseCoordinates(
        "https://www.google.com/maps/place/Shop/@18.5,73.8,17z/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d18.5074!4d73.8077",
      ),
    ).toEqual({ lat: 18.5074, lng: 73.8077 });
  });

  it("prefers !3d/!4d over the less precise @ pair in the same URL", () => {
    // The @ pair is the map viewport; !3d/!4d is the pin itself.
    const r = parseCoordinates(
      "https://maps.google.com/maps/@18.1,73.1,17z/data=!3d18.5074!4d73.8077",
    );
    expect(r).toEqual({ lat: 18.5074, lng: 73.8077 });
  });

  it("falls back to the @ viewport pair", () => {
    expect(parseCoordinates("https://www.google.com/maps/@18.5074,73.8077,15z")).toEqual({
      lat: 18.5074,
      lng: 73.8077,
    });
  });

  it("reads a ?q= query pair", () => {
    expect(parseCoordinates("https://maps.google.com/?q=18.5074,73.8077")).toEqual({
      lat: 18.5074,
      lng: 73.8077,
    });
  });

  it("accepts a bare pasted pair", () => {
    expect(parseCoordinates("18.5074, 73.8077")).toEqual({
      lat: 18.5074,
      lng: 73.8077,
    });
    expect(parseCoordinates("-33.8688,151.2093")).toEqual({
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  it("returns null for anything unusable", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("   ")).toBeNull();
    expect(parseCoordinates("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(parseCoordinates("Kothrud, Pune")).toBeNull();
  });

  it("rejects out-of-range coordinates rather than accepting nonsense", () => {
    // 91° latitude doesn't exist; better to say "no location" than plot it.
    expect(parseCoordinates("91.0, 73.8")).toBeNull();
    expect(parseCoordinates("18.5, 181.0")).toBeNull();
  });
});

describe("formatCoordinates", () => {
  it("renders a readable confirmation", () => {
    expect(formatCoordinates(18.50741234, 73.80772345)).toBe("18.50741, 73.80772");
  });

  it("accepts the string form the API returns", () => {
    expect(formatCoordinates("18.5074", "73.8077")).toBe("18.50740, 73.80770");
  });

  it("returns null when either side is missing", () => {
    expect(formatCoordinates(null, 73.8)).toBeNull();
    expect(formatCoordinates(18.5, undefined)).toBeNull();
    expect(formatCoordinates("not a number", "73.8")).toBeNull();
  });
});

describe("time slots", () => {
  it("covers the whole day in half-hour steps", () => {
    expect(TIME_SLOTS).toHaveLength(48);
    expect(TIME_SLOTS[0]).toEqual({ value: "00:00", label: "12:00 AM" });
    expect(TIME_SLOTS.at(-1)).toEqual({ value: "23:30", label: "11:30 PM" });
  });

  it("formats noon and midnight as 12, not 0", () => {
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
    expect(formatTimeLabel("09:30")).toBe("9:30 AM");
    expect(formatTimeLabel("21:00")).toBe("9:00 PM");
  });
});
