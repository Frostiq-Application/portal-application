import {
  LayoutDashboard,
  Building2,
  Store,
  Users as UsersIcon,
  CreditCard,
  Tags,
  Image as ImageIcon,
  ScrollText,
  ShoppingBag,
  Cake,
  type LucideIcon,
} from "lucide-react";
import type { PlanFeatureKey, Role } from "@/types";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** roles allowed to see this item; omit for all authenticated admins */
  roles?: Role[];
  /** plan feature that must be unlocked for this item to appear (gated roles) */
  feature?: PlanFeatureKey;
  group: "Overview" | "Operations" | "Platform" | "Brand" | "Configuration";
  /** not yet implemented — rendered as a disabled "soon" item */
  soon?: boolean;
}

const NON_PLATFORM_ADMINS: Role[] = ["account_super_admin", "shop_admin"];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    group: "Overview",
  },

  // Operations (branch-facing) — hidden from platform super admin
  {
    label: "Orders",
    path: "/orders",
    icon: ShoppingBag,
    roles: NON_PLATFORM_ADMINS,
    group: "Operations",
  },
  {
    label: "Catalog",
    path: "/catalog",
    icon: Cake,
    roles: NON_PLATFORM_ADMINS,
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
    label: "Plans",
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

  // Brand (account super admin) + shop admin — Branches hidden from platform super admin (accessed via Clients drill-down instead)
  {
    label: "Branches",
    path: "/shops",
    icon: Store,
    roles: NON_PLATFORM_ADMINS,
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
    roles: ["platform_super_admin", "account_super_admin"],
    group: "Brand",
  },

  // Configuration (later modules) — hidden from platform super admin
  {
    label: "Coupons",
    path: "/coupons",
    icon: Tags,
    roles: NON_PLATFORM_ADMINS,
    feature: "can_use_coupons",
    group: "Configuration",
  },
  {
    label: "CMS",
    path: "/cms",
    icon: ImageIcon,
    roles: NON_PLATFORM_ADMINS,
    feature: "can_use_cms",
    group: "Configuration",
  },
];

export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}
