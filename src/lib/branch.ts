/**
 * Shared branch-form helpers, used by both the Branches dialog and the
 * onboarding wizard. Extracted so the two can't drift — a map link that parses
 * in one and not the other would be a maddening bug to chase.
 */

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export const WEEKDAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

/** "09:30" -> "9:30 AM", for the time selects. */
export function formatTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** Half-hour slots across the day: 00:00, 00:30, … 23:30. */
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
  return { value, label: formatTimeLabel(value) };
});

/**
 * Pulls a "lat,lng" pair out of a pasted Google Maps URL (or a bare
 * "lat, lng" string). Handles the common `@lat,lng`, `?q=lat,lng`, and
 * `!3dlat!4dlng` shapes. Returns null when no plausible coordinates are found.
 *
 * Pasting a link is the only sane way to ask for this: nobody knows their
 * shop's latitude, and typing one wrong puts the branch in the sea.
 */
export function parseCoordinates(
  input: string,
): { lat: number; lng: number } | null {
  const text = input.trim();
  if (!text) return null;

  // `!3d<lat>!4d<lng>` (place URLs) is the most precise when present.
  const dm = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dm) return { lat: Number(dm[1]), lng: Number(dm[2]) };

  // `@lat,lng` (map view) or `q=lat,lng` / a bare "lat, lng" paste.
  const m =
    text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    text.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    text.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;

  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** A short, human confirmation of what a pasted link resolved to. */
export function formatCoordinates(
  lat?: string | number | null,
  lng?: string | number | null,
): string | null {
  // Guard null/undefined/"" explicitly: Number(null) is 0, which is finite —
  // so a missing latitude would render as 0.00000 and put the branch in the
  // Gulf of Guinea rather than saying "no location".
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `${a.toFixed(5)}, ${b.toFixed(5)}`;
}
