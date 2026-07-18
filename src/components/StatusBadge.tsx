import { cn } from "@/lib/utils";
import { ACCOUNT_STATUS_TONE, SHOP_STATUS_TONE } from "@/lib/roles";
import type { AccountStatus, ShopStatus } from "@/types";

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const tone = ACCOUNT_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone.className,
      )}
    >
      {tone.label}
    </span>
  );
}

export function ShopStatusBadge({ status }: { status: ShopStatus }) {
  const tone = SHOP_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone.className,
      )}
    >
      {tone.label}
    </span>
  );
}
