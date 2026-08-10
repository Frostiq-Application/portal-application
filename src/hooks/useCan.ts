import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { PermissionKey, Role } from "@/types";

/**
 * Fallback permission sets, used only when the session predates the server
 * sending `permissions` (a token persisted in localStorage before this
 * shipped). Mirrors `BASE_ROLE_PERMISSIONS` on the backend.
 *
 * This is a **compatibility shim, not a second source of truth** — the moment
 * `/auth/me` responds, the server's set wins. Do not add rules here that don't
 * exist server-side: `PermissionGuard` is the real enforcement, and anything
 * granted only here produces a page that renders and then 403s.
 */
const FALLBACK_PERMISSIONS: Record<Role, PermissionKey[]> = {
  platform_super_admin: [
    "team.manage",
    "analytics.view",
    "accounts.manage",
    "plans.manage",
    "subscriptions.manage",
  ],
  account_super_admin: [
    "orders.view",
    "orders.status",
    "orders.create",
    "orders.manage",
    "kitchen.view",
    "delivery.view",
    "catalog.manage",
    "custom_cakes.manage",
    "customers.view",
    "scheduling.manage",
    "coupons.manage",
    "cms.manage",
    "occasions.manage",
    "branches.view",
    "branches.manage",
    "team.manage",
    "analytics.view",
    "activity.view",
  ],
  shop_admin: [
    "orders.view",
    "orders.status",
    "orders.create",
    "orders.manage",
    "kitchen.view",
    "delivery.view",
    "catalog.manage",
    "custom_cakes.manage",
    "customers.view",
    "scheduling.manage",
    "coupons.manage",
    "cms.manage",
    "branches.view",
    "team.manage",
    "analytics.view",
  ],
  staff: [
    "orders.view",
    "orders.status",
    "orders.create",
    "orders.manage",
    "kitchen.view",
    "delivery.view",
  ],
  chef: ["orders.view", "orders.status", "kitchen.view"],
  delivery_manager: [
    "orders.view",
    "orders.status",
    "delivery.view",
    "customers.view",
  ],
};

/**
 * The one place the portal asks "may this user do X".
 *
 * Platform super admins short-circuit to true, matching `PermissionGuard` —
 * they hold every platform permission by definition and are never gated by a
 * custom role.
 */
export function useCan() {
  const { user, role } = useAuth();

  // Hoisted out of the dependency list: an optional-chained member expression
  // isn't a stable thing to depend on, so name the value first.
  const permissions = user?.permissions;
  const granted = useMemo(() => {
    if (permissions) return new Set(permissions);
    return new Set(role ? (FALLBACK_PERMISSIONS[role] ?? []) : []);
  }, [permissions, role]);

  const isExempt = role === "platform_super_admin";

  const can = useCallback(
    (key?: PermissionKey) => {
      if (!key) return true; // ungated
      if (isExempt) return true;
      return granted.has(key);
    },
    [granted, isExempt],
  );

  /** True when the user holds at least one of the keys. */
  const canAny = useCallback(
    (keys: PermissionKey[]) => keys.length === 0 || keys.some((k) => can(k)),
    [can],
  );

  return { can, canAny, permissions: granted, isExempt };
}
