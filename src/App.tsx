import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { OnboardingGate } from "@/routes/OnboardingGate";
import { EmailVerifiedGate } from "@/routes/EmailVerifiedGate";
import { PermissionRoute } from "@/routes/PermissionRoute";
import { FeatureRoute } from "@/routes/FeatureRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { DemoDashboardPage } from "@/pages/DemoDashboardPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { PlansPage } from "@/pages/PlansPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { QueriesPage } from "@/pages/QueriesPage";
import { SubscriptionCouponsPage } from "@/pages/SubscriptionCouponsPage";
import { BillingSettingsPage } from "@/pages/BillingSettingsPage";
import { TenancyPage } from "@/pages/TenancyPage";
import { MySubscriptionPage } from "@/pages/MySubscriptionPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ShopsPage } from "@/pages/ShopsPage";
import { UsersPage } from "@/pages/UsersPage";
import { RolesPage } from "@/pages/RolesPage";
import { CouponsPage } from "@/pages/CouponsPage";
import { CmsPage } from "@/pages/CmsPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { KitchenPage } from "@/pages/KitchenPage";
import { DeliveryPage } from "@/pages/DeliveryPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomCakesPage } from "@/pages/CustomCakesPage";
import { SchedulingPage } from "@/pages/SchedulingPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { ActivityLogPage } from "@/pages/ActivityLogPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole, isFloorRole } from "@/lib/roles";
import { useCan } from "@/hooks/useCan";
import { useEntitlements } from "@/hooks/useEntitlements";
import { navFor } from "@/config/nav";
import { Toaster } from "@/components/ui/sonner";

/**
 * What "/" resolves to, which depends entirely on what the user may see.
 *
 * Floor roles have one screen that is their whole job. Everyone else gets the
 * dashboard — unless a restricted custom role has taken `analytics.view` away,
 * in which case the dashboard is a page of numbers they can't load, and the
 * honest answer is the first thing they *can* open. Falling through to a blank
 * dashboard would look like the app is broken.
 */
function HomeRoute() {
  const { role } = useAuth();
  const { can } = useCan();
  const { hasFeature } = useEntitlements();

  const available = navFor(role, can);
  const firstAvailable = available.find((i) => i.path !== "/")?.path;

  if (isFloorRole(role)) {
    const natural = homePathForRole(role);
    // A chef's home is the kitchen board — but only if the brand's plan
    // includes it. Landing them on the upgrade card every single login would
    // be a screen they can't act on (they can't buy a plan) in place of the
    // work they can still do, so fall back to the order queue.
    const boarded = role === "staff" || hasFeature("can_use_floor_boards");
    // …and only if they still hold the permission for it. A restrict-mode
    // custom role can take `orders.view` off a staff member, and sending them
    // to /orders anyway bounces off PermissionRoute straight back here —
    // a redirect loop, not a closed door.
    const permitted = available.some((i) => i.path === natural);
    const home = permitted && (boarded || !can("orders.view"))
      ? natural
      : (firstAvailable ?? "/profile");
    return <Navigate to={home} replace />;
  }
  if (can("analytics.view")) return <DashboardPage />;

  // Same reasoning for the board roles: with no reachable page at all, the
  // profile is the one screen nothing gates, so land there rather than loop.
  return firstAvailable ? (
    <Navigate to={firstAvailable} replace />
  ) : (
    <Navigate to="/profile" replace />
  );
}

function ThemeSync() {
  const theme = useAppSelector((s) => s.ui.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Public self-serve signup — the way a new bakery gets in. */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        {/* Self-serve recovery — the alternative was phoning support for a
            hand-minted token. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* Signed in but unverified: the code step of signup. */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* Public, backend-free replica of the owner dashboard — for marketing screenshots only */}
        <Route path="/demo-dashboard" element={<DemoDashboardPage />} />

        {/* Setup lives outside AppLayout: a half-configured account has no
            branches or plan yet, so the sidebar would be mostly locked doors. */}
        {/*
          Setup and checkout both sit OUTSIDE AppLayout.

          Not just for focus — AppLayout gates on having an active subscription,
          and renders "choose a plan" when there isn't one. Checkout is the
          screen you use to *get* a subscription, so leaving it inside meant the
          gate hid the cure: clicking "Go to checkout" showed "Start free"
          instead of a payment form.
        */}
        <Route element={<ProtectedRoute roles={["account_super_admin"]} />}>
          <Route element={<EmailVerifiedGate />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<EmailVerifiedGate />}>
          <Route element={<OnboardingGate />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Operations floor. The role list is the coarse gate; the
                permission is what a custom role actually moves, so a chef sees
                Kitchen and nothing else on this row. */}
            <Route
              element={
                <ProtectedRoute
                  roles={[
                    "account_super_admin",
                    "shop_admin",
                    "staff",
                    "chef",
                    "delivery_manager",
                  ]}
                />
              }
            >
              <Route element={<PermissionRoute permission="orders.view" />}>
                <Route path="/orders" element={<OrdersPage />} />
              </Route>
              {/* The floor boards are a plan module (Growth Plus & Pro), so
                  the feature gate sits outside the permission one: holding
                  `kitchen.view` says the role may work a board, not that the
                  brand has bought them. */}
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_floor_boards"
                    featureLabel="Kitchen & delivery boards"
                  />
                }
              >
                <Route element={<PermissionRoute permission="kitchen.view" />}>
                  <Route path="/kitchen" element={<KitchenPage />} />
                </Route>
                <Route element={<PermissionRoute permission="delivery.view" />}>
                  <Route path="/delivery" element={<DeliveryPage />} />
                </Route>
              </Route>
            </Route>

            {/* Platform super admin */}
            <Route element={<ProtectedRoute roles={["platform_super_admin"]} />}>
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route
                path="/subscription-coupons"
                element={<SubscriptionCouponsPage />}
              />
              <Route
                path="/billing-settings"
                element={<BillingSettingsPage />}
              />
              <Route path="/tenancy" element={<TenancyPage />} />
              <Route path="/queries" element={<QueriesPage />} />
            </Route>

            {/* Brand + shop admin (hidden from platform super admin) */}
            <Route
              element={
                <ProtectedRoute
                  roles={["account_super_admin", "shop_admin"]}
                />
              }
            >
              <Route element={<PermissionRoute permission="catalog.manage" />}>
                <Route path="/catalog" element={<CatalogPage />} />
              </Route>
              <Route
                element={<PermissionRoute permission="scheduling.manage" />}
              >
                <Route path="/scheduling" element={<SchedulingPage />} />
              </Route>
              <Route element={<PermissionRoute permission="analytics.view" />}>
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>
              <Route element={<PermissionRoute permission="branches.view" />}>
                <Route path="/shops" element={<ShopsPage />} />
              </Route>

              {/* Plan-gated feature modules */}
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_customer_data"
                    featureLabel="Customers"
                  />
                }
              >
                <Route
                  element={<PermissionRoute permission="customers.view" />}
                >
                  <Route path="/customers" element={<CustomersPage />} />
                </Route>
              </Route>
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_coupons"
                    featureLabel="Coupons"
                  />
                }
              >
                <Route
                  element={<PermissionRoute permission="coupons.manage" />}
                >
                  <Route path="/coupons" element={<CouponsPage />} />
                </Route>
              </Route>
              <Route
                element={
                  <FeatureRoute feature="can_use_cms" featureLabel="CMS" />
                }
              >
                <Route element={<PermissionRoute permission="cms.manage" />}>
                  <Route path="/cms" element={<CmsPage />} />
                </Route>
              </Route>
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_custom_cake"
                    featureLabel="Custom Cakes"
                  />
                }
              >
                <Route
                  element={
                    <PermissionRoute permission="custom_cakes.manage" />
                  }
                >
                  <Route path="/custom-cakes" element={<CustomCakesPage />} />
                  {/* Same page, gallery section preselected — so the sidebar
                      can point straight at it. */}
                  <Route
                    path="/custom-cakes/gallery"
                    element={<CustomCakesPage />}
                  />
                </Route>
              </Route>
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_audit_log"
                    featureLabel="Activity Log"
                  />
                }
              >
                <Route
                  element={<PermissionRoute permission="activity.view" />}
                >
                  <Route path="/activity-log" element={<ActivityLogPage />} />
                </Route>
              </Route>
            </Route>

            <Route
              element={
                <ProtectedRoute
                  roles={[
                    "platform_super_admin",
                    "account_super_admin",
                    "shop_admin",
                  ]}
                />
              }
            >
              <Route element={<PermissionRoute permission="team.manage" />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>

            {/* Roles & Permissions. Now open to shop owners: they decide what
                their chefs and riders can reach, so locking them out of this
                screen made the whole custom-role system unusable by the people
                it was built for. */}
            <Route
              element={
                <ProtectedRoute
                  roles={["platform_super_admin", "account_super_admin"]}
                />
              }
            >
              <Route element={<PermissionRoute permission="team.manage" />}>
                <Route path="/roles" element={<RolesPage />} />
              </Route>
            </Route>

            {/* Account super admin — read-only view of their own subscription */}
            <Route
              element={<ProtectedRoute roles={["account_super_admin"]} />}
            >
              <Route
                path="/my-subscription"
                element={<MySubscriptionPage />}
              />
            </Route>
          </Route>
          </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
