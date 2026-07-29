import { Layers, LayoutDashboard, Building2, Store, Users as UsersIcon, Contact, CalendarClock, ShieldCheck, BarChart3, CreditCard, Tags, Image as ImageIcon, ScrollText, ShoppingBag, Cake, CakeSlice, Phone, BadgePercent, Settings2, type IconComponent } from "@/components/ui/icons";
import type { PermissionKey, PlanFeatureKey, Role } from "@/types";

export interface NavItem {
  label: string;
  path: string;
  icon: IconComponent;
  /**
   * Coarse role filter. Kept for the platform/brand split, which is about
   * *which product* you're looking at rather than what you may do — a shop
   * owner holding `accounts.manage` still has no business on /accounts.
   */
  roles?: Role[];
  /**
   * Granular permission required to see this item. This is the gate that
   * custom roles move: a restrict-mode role that doesn't grant the key drops
   * the item from the sidebar entirely.
   */
  permission?: PermissionKey;
  /** plan feature that must be unlocked for this item to appear (gated roles) */
  feature?: PlanFeatureKey;
  group:
    | "Overview"
    | "Operations"
    | "Platform"
    | "Brand"
    | "Configuration"
    | "Floor";
  /** not yet implemented — rendered as a disabled "soon" item */
  soon?: boolean;
}

const NON_PLATFORM_ADMINS: Role[] = ["account_super_admin", "shop_admin"];

/** Everyone who works a branch floor, admins included. */
const BRANCH_ROLES: Role[] = [
  ...NON_PLATFORM_ADMINS,
  "staff",
  "chef",
  "delivery_manager",
];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    // Everyone except staff, who land straight on Orders (their only workspace).
    roles: ["platform_super_admin", "account_super_admin", "shop_admin"],
    group: "Overview",
  },
  {
    // Sits beside the dashboard rather than under Configuration: both answer
    // "how is the business doing", and neither is something you set up.
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
    roles: NON_PLATFORM_ADMINS,
    feature: "can_use_analytics",
    group: "Overview",
  },

  // Operations (branch-facing) — hidden from platform super admin
  {
    label: "Orders",
    path: "/orders",
    icon: ShoppingBag,
    roles: BRANCH_ROLES,
    permission: "orders.view",
    group: "Operations",
  },
  {
    label: "Kitchen",
    path: "/kitchen",
    icon: ChefHat,
    roles: BRANCH_ROLES,
    permission: "kitchen.view",
    group: "Floor",
  },
  {
    label: "Delivery",
    path: "/delivery",
    icon: Truck,
    roles: BRANCH_ROLES,
    permission: "delivery.view",
    group: "Floor",
  },
  {
    label: "Catalog",
    path: "/catalog",
    icon: Cake,
    roles: NON_PLATFORM_ADMINS,
    permission: "catalog.manage",
    group: "Operations",
  },
  {
    label: "Customers",
    path: "/customers",
    icon: Contact,
    roles: [...NON_PLATFORM_ADMINS, "delivery_manager"],
    permission: "customers.view",
    feature: "can_use_customer_data",
    group: "Operations",
  },
  {
    label: "Custom Cakes",
    path: "/custom-cakes",
    icon: CakeSlice,
    roles: NON_PLATFORM_ADMINS,
    feature: "can_use_custom_cake",
    group: "Operations",
  },

  // Platform super admin
  {
    label: "Shops",
    path: "/accounts",
    icon: Building2,
    roles: ["platform_super_admin"],
    group: "Platform",
  },
  {
    label: "Catalogue",
    path: "/plans",
    icon: CreditCard,
    roles: ["platform_super_admin"],
    group: "Platform",
  },
  {
    label: "Subscriptions",
    path: "/subscriptions",
    icon: ScrollText,
    roles: ["platform_super_admin"],
    group: "Platform",
  },
  {
    // Platform coupons discount a bakery's SUBSCRIPTION bill — a different
    // animal entirely from the /coupons page a bakery uses for its customers.
    label: "Sub. coupons",
    path: "/subscription-coupons",
    icon: BadgePercent,
    roles: ["platform_super_admin"],
    group: "Platform",
  },
  {
    label: "Billing settings",
    path: "/billing-settings",
    icon: Settings2,
    roles: ["platform_super_admin"],
    group: "Platform",
  },
  {
    // Schema-per-account means a shipped feature still has to reach each
    // brand's schema. This is where you see who is behind and roll it out.
    label: "Tenancy",
    path: "/tenancy",
    icon: Layers,
    roles: ["platform_super_admin"],
    group: "Platform",
  },
  {
    label: "Queries",
    path: "/queries",
    icon: Phone,
    roles: ["platform_super_admin"],
    group: "Platform",
  },

  // Brand (account super admin) + shop admin — Branches hidden from platform super admin (accessed via Clients drill-down instead)
  {
    label: "Branches",
    path: "/shops",
    icon: Store,
    roles: NON_PLATFORM_ADMINS,
    permission: "branches.view",
    group: "Brand",
  },
  {
    label: "Scheduling",
    path: "/scheduling",
    icon: CalendarClock,
    roles: NON_PLATFORM_ADMINS,
    permission: "scheduling.manage",
    group: "Brand",
  },
  {
    label: "Subscription",
    path: "/my-subscription",
    icon: CreditCard,
    roles: ["account_super_admin"],
    group: "Brand",
  },
  {
    label: "Team",
    path: "/users",
    icon: UsersIcon,
    roles: ["platform_super_admin", "account_super_admin", "shop_admin"],
    permission: "team.manage",
    group: "Brand",
  },
  {
    // Now reachable by shop owners: they're the ones who decide what a chef or
    // a rider can see, and until this opened up they couldn't get to the screen
    // that says so.
    label: "Roles",
    path: "/roles",
    icon: ShieldCheck,
    roles: ["platform_super_admin", "account_super_admin"],
    permission: "team.manage",
    group: "Brand",
  },

  // Configuration (later modules) — hidden from platform super admin
  {
    label: "Coupons",
    path: "/coupons",
    icon: Tags,
    roles: NON_PLATFORM_ADMINS,
    permission: "coupons.manage",
    feature: "can_use_coupons",
    group: "Configuration",
  },
  {
    label: "CMS",
    path: "/cms",
    icon: ImageIcon,
    roles: NON_PLATFORM_ADMINS,
    permission: "cms.manage",
    feature: "can_use_cms",
    group: "Configuration",
  },
];

/**
 * Coarse role filter only. Kept as its own function because the role split is
 * about which product surface you're on (platform vs. brand), which no amount
 * of permission granting should cross.
 */
export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}

/**
 * Role filter, then permission filter. This is what the sidebar renders from —
 * an item whose `permission` the user doesn't hold is simply absent, which is
 * the behaviour a chef should get for Catalog or Coupons.
 */
export function navFor(
  role: Role | undefined,
  can: (key?: PermissionKey) => boolean,
): NavItem[] {
  return navForRole(role).filter((i) => can(i.permission));
}
