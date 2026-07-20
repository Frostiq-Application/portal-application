import type { AccountStatus, Role, ShopStatus } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  platform_super_admin: "Platform Super Admin",
  account_super_admin: "Shop Owner",
  shop_admin: "Branch Owner",
};

export function roleLabel(role?: Role): string {
  return role ? ROLE_LABELS[role] : "—";
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
