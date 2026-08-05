import type { AccountStatus, Role, ShopStatus } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  platform_super_admin: "Platform Super Admin",
  account_super_admin: "Shop Owner",
  shop_admin: "Branch Owner",
  staff: "Branch Staff",
  chef: "Chef",
  delivery_manager: "Delivery Manager",
};

/** Branch-scoped roles a shop owner or branch admin invites onto a floor. */
export const FLOOR_ROLES: Role[] = ["staff", "chef", "delivery_manager"];

/**
 * Where a role lands on sign-in, and where a blocked route sends them.
 *
 * Each floor role has exactly one screen that is their whole job, so dropping
 * them on a dashboard they can't read would just be a redirect they have to
 * click through every time.
 */
export function homePathForRole(role?: Role): string {
  switch (role) {
    case "chef":
      return "/kitchen";
    case "delivery_manager":
      return "/delivery";
    case "staff":
      return "/orders";
    default:
      return "/";
  }
}

export function roleLabel(role?: Role): string {
  return role ? ROLE_LABELS[role] : "-";
}

export function isPlatformAdmin(role?: Role): boolean {
  return role === "platform_super_admin";
}

export function isAccountAdmin(role?: Role): boolean {
  return role === "account_super_admin";
}

export function isShopAdmin(role?: Role): boolean {
  return role === "shop_admin";
}

export function isStaff(role?: Role): boolean {
  return role === "staff";
}

/** True for any branch-floor role — staff, chef or rider. */
export function isFloorRole(role?: Role): boolean {
  return !!role && FLOOR_ROLES.includes(role);
}

/** Tailwind badge variant/tone per account status. */
export const ACCOUNT_STATUS_TONE: Record<
  AccountStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  active: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  suspended: {
    label: "Suspended",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
};

export const SHOP_STATUS_TONE: Record<
  ShopStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  suspended: {
    label: "Suspended",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
};
