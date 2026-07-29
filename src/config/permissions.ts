import type { PlanFeatureKey, Role } from "@/types";

/**
 * Declarative catalog of what each role can do, mirroring the backend @Roles
 * guards and the plan-feature gating. This is the single source the read-only
 * Roles & Permissions matrix renders from — and the foundation the custom-roles
 * module will build on.
 *
 * Access levels:
 *  - "full"  → the role can use the capability
 *  - "scoped"→ allowed, but limited to the role's own branch(es) / account
 *  - "none"  → not available to this role
 */
export type AccessLevel = "full" | "scoped" | "none";

export interface PermissionRow {
  key: string;
  label: string;
  description: string;
  /** Plan feature that must be unlocked for brand roles (gated). */
  feature?: PlanFeatureKey;
  /**
   * Access by role. **A role left out means "none"** — with six roles and
   * seventeen rows, spelling out every cell would be a hundred entries of
   * which the overwhelming majority are the same word, and the exceptions are
   * what a reader is actually scanning for.
   */
  access: Partial<Record<Role, AccessLevel>>;
}

/** Access for a role, treating an absent entry as no access. */
export function accessFor(row: PermissionRow, role: Role): AccessLevel {
  return row.access[role] ?? "none";
}

export interface PermissionGroup {
  group: string;
  rows: PermissionRow[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    group: "Operations",
    rows: [
      {
        key: "orders.view",
        label: "View orders",
        description: "See the order queue and order details.",
        access: {
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "scoped",
          chef: "scoped",
          delivery_manager: "scoped",
        },
      },
      {
        key: "orders.status",
        label: "Advance order status",
        description:
          "Move an order along the pipeline — confirmed, baking, ready, delivered.",
        access: {
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "scoped",
          chef: "scoped",
          delivery_manager: "scoped",
        },
      },
      {
        key: "kitchen.view",
        label: "Kitchen board",
        description:
          "The production queue: what to bake and by when. No prices or customer details.",
        feature: "can_use_floor_boards",
        access: {
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "scoped",
          chef: "scoped",
        },
      },
      {
        key: "delivery.view",
        label: "Delivery board",
        description:
          "The dispatch queue, with the delivery address and contact number.",
        feature: "can_use_floor_boards",
        access: {
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "scoped",
          delivery_manager: "scoped",
        },
      },
      {
        key: "orders.manage",
        label: "Update & cancel orders",
        description: "Advance status, mark paid, cancel orders.",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "scoped",
        },
      },
      {
        key: "catalog.manage",
        label: "Manage catalog",
        description: "Products, variants, flavours, categories & add-ons.",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "custom_cakes.manage",
        label: "Custom cake requests",
        description: "Quote, accept and reject bespoke cake enquiries.",
        feature: "can_use_custom_cake",
        access: {
          account_super_admin: "full",
          shop_admin: "scoped",
        },
      },
      {
        key: "customers.view",
        label: "View customers",
        description: "Customer directory, spend & order history.",
        access: {
          account_super_admin: "full",
          shop_admin: "scoped",
          // A rider needs the address and a number to ring on arrival — the
          // one thing they get that a chef deliberately does not.
          delivery_manager: "scoped",
        },
      },
    ],
  },
  {
    group: "Configuration",
    rows: [
      {
        key: "scheduling.manage",
        label: "Manage scheduling",
        description: "Slot settings, cutoffs & blackout dates.",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "coupons.manage",
        label: "Manage coupons",
        description: "Create & edit discount codes.",
        feature: "can_use_coupons",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "cms.manage",
        label: "Manage storefront (CMS)",
        description: "Banners, announcements & featured products.",
        feature: "can_use_cms",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "occasions.manage",
        label: "Create occasions",
        description: "Add or rename storefront occasions.",
        feature: "can_use_cms",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "none",
          staff: "none",
        },
      },
    ],
  },
  {
    group: "Brand",
    rows: [
      {
        key: "branches.view",
        label: "View branch details",
        description: "See branch profile, hours & contact.",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "branches.manage",
        label: "Create & edit branches",
        description: "Add branches, edit any branch's settings.",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "none",
          staff: "none",
        },
      },
      {
        key: "team.manage",
        label: "Manage team",
        description: "Invite members & assign branches.",
        access: {
          platform_super_admin: "full",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "analytics.view",
        label: "View analytics",
        description: "Sales, best sellers & reports.",
        feature: "can_use_analytics",
        access: {
          platform_super_admin: "full",
          account_super_admin: "full",
          shop_admin: "scoped",
          staff: "none",
        },
      },
      {
        key: "activity.view",
        label: "View activity log",
        description:
          "The brand's audit trail: who on the team changed what, and when.",
        feature: "can_use_audit_log",
        access: {
          // The owner's by default. A branch admin appears in the log as often
          // as anyone, so granting it to them is a deliberate choice made
          // through a custom role, not something they inherit.
          account_super_admin: "full",
          shop_admin: "none",
          staff: "none",
        },
      },
    ],
  },
  {
    group: "Platform",
    rows: [
      {
        key: "accounts.manage",
        label: "Manage brands (accounts)",
        description: "Approve, suspend & configure brand accounts.",
        access: {
          platform_super_admin: "full",
          account_super_admin: "none",
          shop_admin: "none",
          staff: "none",
        },
      },
      {
        key: "plans.manage",
        label: "Manage plans",
        description: "Create & edit subscription plans.",
        access: {
          platform_super_admin: "full",
          account_super_admin: "none",
          shop_admin: "none",
          staff: "none",
        },
      },
      {
        key: "subscriptions.manage",
        label: "Manage subscriptions",
        description: "Assign plans & billing across brands.",
        access: {
          platform_super_admin: "full",
          account_super_admin: "none",
          shop_admin: "none",
          staff: "none",
        },
      },
    ],
  },
];
