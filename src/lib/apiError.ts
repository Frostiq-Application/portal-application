/** Extracts a human-readable message from an RTK Query / fetch error. */
export function apiError(err: unknown, fallback = "Something went wrong."): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return fallback;
}
