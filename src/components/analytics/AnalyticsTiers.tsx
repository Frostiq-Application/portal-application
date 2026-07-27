import { BarChart3, Check, Heart, Lock, Mail, MessageCircle, Sparkles, TrendingUp } from "@/components/ui/icons";
import { useEntitlements } from "@/hooks/useEntitlements";
import { cn } from "@/lib/utils";
import type { PlanFeatureKey } from "@/types";

interface Tier {
  key: PlanFeatureKey;
  label: string;
  description: string;
  /** Plan a locked tier unlocks on — drives the upsell badge. */
  plan: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Mirrors the seed: analytics = all plans, wishlist = Growth+, advanced = Pro. */
const TIERS: Tier[] = [
  {
    key: "can_use_analytics",
    label: "Branch analytics",
    description: "Sales, best sellers, peak times & coupon performance.",
    plan: "Starter",
    icon: BarChart3,
  },
  {
    key: "can_use_wishlist_analytics",
    label: "Wishlist analytics",
    description: "See what shoppers save vs. buy, and the save→order conversion.",
    plan: "Growth",
    icon: Heart,
  },
  {
    key: "can_use_advanced_analytics",
    label: "Advanced brand analytics",
    description: "Cross-branch comparison, repeat rate & customer insights.",
    plan: "Pro",
    icon: TrendingUp,
  },
];

/**
 * Upsell strip for the three analytics tiers. Unlocked tiers show a check;
 * locked ones show which plan (Growth / Pro) unlocks them, nudging an upgrade.
 * Renders nothing when every tier is already unlocked.
 */
export function AnalyticsTiers() {
  const { hasFeature, entitlements } = useEntitlements();
  const support = entitlements?.support;

  const tiers = TIERS.map((t) => ({ ...t, unlocked: hasFeature(t.key) }));
  const anyLocked = tiers.some((t) => !t.unlocked);
  if (!anyLocked) return null;

  return (
    <div className="mb-6 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Unlock more insights</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.key}
            className={cn(
              "rounded-lg border p-3",
              t.unlocked ? "bg-background" : "border-dashed bg-muted/30",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <t.icon
                className={cn(
                  "h-4 w-4",
                  t.unlocked ? "text-primary" : "text-muted-foreground",
                )}
              />
              {t.unlocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <Check className="h-3 w-3" />
                  Included
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Lock className="h-3 w-3" />
                  {t.plan}
                </span>
              )}
            </div>
            <div className="text-sm font-medium">{t.label}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
          </div>
        ))}
      </div>

      {(support?.email || support?.whatsapp) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Upgrade to Growth or Pro — contact your administrator:</span>
          {support?.email && (
            <a
              href={`mailto:${support.email}`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {support.email}
            </a>
          )}
          {support?.whatsapp && (
            <a
              href={`https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {support.whatsapp}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
