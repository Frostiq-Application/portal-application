import { LayoutDashboard, Building2, Store, Users as UsersIcon, Contact, CalendarClock, ShieldCheck, BarChart3, CreditCard, Tags, Image as ImageIcon, ScrollText, ShoppingBag, Cake, CakeSlice, Phone, BadgePercent, Settings2, type IconComponent } from "@/components/ui/icons";
import type { PlanFeatureKey, Role } from "@/types";

export interface NavItem {
  label: string;
  path: string;
  icon: IconComponent;
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
    // Everyone except staff, who land straight on Orders (their only workspace).
    roles: ["platform_super_admin", "account_super_admin", "shop_admin"],
    group: "Overview",
  },

  // Operations (branch-facing) — hidden from platform super admin
  {
    label: "Orders",
    path: "/orders",
    icon: ShoppingBag,
    roles: [...NON_PLATFORM_ADMINS, "staff"],
    group: "Operations",
  },
  {
    label: "Catalog",
    path: "/catalog",
    icon: Cake,
    roles: NON_PLATFORM_ADMINS,
    group: "Operations",
  },
  {
    label: "Customers",
    path: "/customers",
    icon: Contact,
    roles: NON_PLATFORM_ADMINS,
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
    group: "Brand",
  },
  {
    label: "Scheduling",
    path: "/scheduling",
    icon: CalendarClock,
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
    roles: ["platform_super_admin", "account_super_admin", "shop_admin"],
    group: "Brand",
  },
  {
    label: "Roles",
    path: "/roles",
    icon: ShieldCheck,
    roles: ["platform_super_admin"],
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
  {
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
    roles: NON_PLATFORM_ADMINS,
    feature: "can_use_analytics",
    group: "Configuration",
  },
];

export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}
