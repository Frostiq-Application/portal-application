import { Check, LogOut, Mail, MessageCircle, Sparkles } from "lucide-react";
import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { useNavigate } from "react-router-dom";
import { usePublicPlansQuery } from "@/features/api/plansApi";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entitlements, Plan } from "@/types";

const FEATURE_LABELS: Record<string, string> = {
  can_use_coupons: "Coupons",
  can_use_analytics: "Analytics",
  can_use_cms: "Content management",
  can_clone_catalog: "Catalog cloning",
  priority_support: "Priority support",
};

function planFeatureLabels(plan: Plan): string[] {
  return Object.entries(plan.features ?? {})
    .filter(([, on]) => on)
    .map(([key]) => FEATURE_LABELS[key] ?? key);
}

function PlanCard({ plan }: { plan: Plan }) {
  const features = planFeatureLabels(plan);
  return (
    <div className="flex flex-col rounded-xl border bg-background p-6 text-left shadow-sm">
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      {plan.description && (
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      )}
      <div className="mt-4">
        <span className="text-2xl font-bold">₹{plan.priceMonthly}</span>
        <span className="text-sm text-muted-foreground"> / month</span>
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          {plan.maxShops == null
            ? "Unlimited branches"
            : `Up to ${plan.maxShops} branch${plan.maxShops === 1 ? "" : "es"}`}
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          {plan.maxProductsPerShop == null
            ? "Unlimited products per branch"
            : `${plan.maxProductsPerShop} products per branch`}
        </li>
        {features.map((label) => (
          <li key={label} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Full-screen screen shown to brand/shop admins whose account is active but has
 * no usable subscription. Presents the available plans; activation is done by
 * the platform admin, so the admin is directed to get in touch to subscribe.
 */
export function NoSubscriptionGate({
  support,
}: {
  support?: Entitlements["support"];
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePublicPlansQuery();

  const doLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a subscription plan
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Your brand doesn’t have a subscription yet. Pick the plan that fits
            your business and get in touch to activate it — you’ll have full
            access to the portal once a plan is active.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))
          ) : plans && plans.length > 0 ? (
            plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)
          ) : (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              No plans are available right now. Please contact support to get
              set up.
            </p>
          )}
        </div>

        {(support?.email || support?.whatsapp) && (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Ready to subscribe? Contact us to activate your plan:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {support?.email && (
                <Button asChild variant="outline">
                  <a href={`mailto:${support.email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    {support.email}
                  </a>
                </Button>
              )}
              {support?.whatsapp && (
                <Button asChild variant="outline">
                  <a
                    href={`https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {support.whatsapp}
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={doLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
