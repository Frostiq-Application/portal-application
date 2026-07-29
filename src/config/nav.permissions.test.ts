import { describe, expect, it } from "vitest";
import { navFor } from "@/config/nav";
import type { PermissionKey, Role } from "@/types";

/**
 * The permission-gating contract for the sidebar.
 *
 * Distinct from `SidebarNav.test.tsx`, which protects *plan* gating — where a
 * locked item is deliberately still shown, because the lock is the upsell.
 * Permission gating is the opposite rule: an item the user has no permission
 * for is **absent**. There is nothing to sell a chef by showing them Coupons,
 * and every visible-but-forbidden item is a 403 waiting to look like a bug.
 */

/** A `can` for a fixed permission set, matching `useCan`'s contract. */
function canFrom(keys: PermissionKey[]) {
  const set = new Set(keys);
  return (key?: PermissionKey) => (key ? set.has(key) : true);
}

const CHEF_PERMISSIONS = ["orders.view", "orders.status", "kitchen.view"];
const DELIVERY_PERMISSIONS = [
  "orders.view",
  "orders.status",
  "delivery.view",
  "customers.view",
];

const pathsFor = (role: Role, keys: PermissionKey[]) =>
  navFor(role, canFrom(keys)).map((i) => i.path);

describe("nav permission gating", () => {
  it("gives a chef the kitchen and nothing they cannot use", () => {
    const paths = pathsFor("chef", CHEF_PERMISSIONS);

    expect(paths).toContain("/kitchen");
    expect(paths).toContain("/orders");
    // The whole point of the role: no catalog, no pricing, no team, no CMS.
    expect(paths).not.toContain("/catalog");
    expect(paths).not.toContain("/coupons");
    expect(paths).not.toContain("/cms");
    expect(paths).not.toContain("/users");
    expect(paths).not.toContain("/shops");
    expect(paths).not.toContain("/delivery");
  });

  it("gives a delivery manager dispatch and the customer details a drop needs", () => {
    const paths = pathsFor("delivery_manager", DELIVERY_PERMISSIONS);

    expect(paths).toContain("/delivery");
    expect(paths).toContain("/customers");
    // Customer contact is the one thing they get that a chef does not.
    expect(pathsFor("chef", CHEF_PERMISSIONS)).not.toContain("/customers");
    expect(paths).not.toContain("/kitchen");
    expect(paths).not.toContain("/catalog");
  });

  it("drops an item when a restrict-mode role revokes its permission", () => {
    // A branch admin who has been given a restricted custom role covering only
    // the kitchen keeps the *role* but loses the pages.
    const full = pathsFor("shop_admin", [
      "orders.view",
      "catalog.manage",
      "kitchen.view",
      "team.manage",
    ]);
    expect(full).toContain("/catalog");
    expect(full).toContain("/users");

    const restricted = pathsFor("shop_admin", ["kitchen.view"]);
    expect(restricted).toEqual(["/kitchen"]);
  });

  it("keeps the role filter above the permission filter", () => {
    // Holding a platform permission must not surface a platform page to a
    // brand user — the two are different products, not different access levels.
    const paths = pathsFor("account_super_admin", [
      "accounts.manage",
      "plans.manage",
      "subscriptions.manage",
    ]);
    expect(paths).not.toContain("/accounts");
    expect(paths).not.toContain("/plans");
    expect(paths).not.toContain("/subscriptions");
  });

  it("shows an owner the Roles page so they can edit what their floor sees", () => {
    expect(pathsFor("account_super_admin", ["team.manage"])).toContain("/roles");
  });
});
