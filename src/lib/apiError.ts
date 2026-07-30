/** Extracts a human-readable message from an RTK Query / fetch error. */

type ErrorShape = {
  status?: number | string;
  originalStatus?: number;
  data?: { message?: string | string[] } | string;
  message?: string;
};

/**
 * A request that never reached the API has no response body to read, so the
 * only thing we could do with one was fall back to a generic string. That made
 * a dev server that was down — or a blocked CORS preflight — indistinguishable
 * from a genuine rejection by the server. Name those cases instead.
 */
export function apiError(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  const e = (err ?? {}) as ErrorShape;

  switch (e.status) {
    case "FETCH_ERROR":
      return "Cannot reach the server. Check that the API is running and that this origin is allowed by CORS.";
    case "TIMEOUT_ERROR":
      return "The server took too long to respond. Please try again.";
    case "PARSING_ERROR":
      return `The server returned an unexpected response (HTTP ${e.originalStatus ?? "?"}).`;
  }

  // Nest sends `{ message: string | string[] }`; class-validator uses the array
  // form, one entry per failed constraint.
  const msg = typeof e.data === "object" ? e.data?.message : undefined;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;

  // Plain-text error bodies, then RTK's SerializedError.
  if (typeof e.data === "string" && e.data) return e.data;
  if (typeof e.message === "string" && e.message) return e.message;

  return fallback;
}
