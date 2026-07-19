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
  access: Record<Role, AccessLevel>;
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
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
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
        },
      },
      {
        key: "customers.view",
        label: "View customers",
        description: "Customer directory, spend & order history.",
        access: {
          platform_super_admin: "none",
          account_super_admin: "full",
          shop_admin: "scoped",
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
        },
      },
      {
        key: "team.manage",
        label: "Manage team",
        description: "Invite members & assign branches.",
        access: {
          platform_super_admin: "full",
          account_super_admin: "full",
          shop_admin: "none",
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
        },
      },
    ],
  },
];
