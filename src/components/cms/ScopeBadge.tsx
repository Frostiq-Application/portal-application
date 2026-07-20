import { Building2, Globe, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where a piece of CMS content applies. Branch content overrides account
 * content, which overrides platform-wide content on the storefront.
 */
export function ScopeBadge({
  shopId,
  accountId,
  className,
}: {
  shopId: string | null;
  accountId: string | null;
  className?: string;
}) {
  const scope = shopId
    ? { label: "Branch", Icon: Store, tone: "text-blue-600 bg-blue-500/10" }
    : accountId
      ? { label: "Account", Icon: Building2, tone: "text-violet-600 bg-violet-500/10" }
      : { label: "Platform", Icon: Globe, tone: "text-emerald-600 bg-emerald-500/10" };
  const { label, Icon, tone } = scope;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
