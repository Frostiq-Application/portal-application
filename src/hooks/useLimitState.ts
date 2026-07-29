/**
 * Lives outside LimitNotice.tsx so that file exports only components: a
 * module mixing components with other exports drops out of Fast Refresh, and
 * four pages import this without wanting the notice UI.
 */
export interface LimitState {
  /** Live count of active items. Archived ones never count. */
  used: number;
  /** The **effective** limit: plan value + purchased add-ons. Null = unlimited. */
  limit: number | null;
  atLimit: boolean;
  nearLimit: boolean;
  remaining: number | null;
}

/**
 * Resolve a Count limit into everything the UI needs to warn about it.
 *
 * `limit` must be the **effective** limit the server enforces (plan + add-ons),
 * never the raw plan value — warning at the plan value would nag a bakery that
 * has already paid for extra capacity, and blocking there would be a bug.
 */
export function useLimitState(
  used: number,
  limit: number | null,
): LimitState {
  if (limit == null) {
    return { used, limit: null, atLimit: false, nearLimit: false, remaining: null };
  }
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    atLimit: used >= limit,
    // One slot left on a small plan is worth flagging; on a 500-product plan
    // it isn't. 80% catches both without crying wolf.
    nearLimit: used < limit && (remaining <= 1 || used / limit >= 0.8),
    remaining,
  };
}
