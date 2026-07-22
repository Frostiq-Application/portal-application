import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { FeatureRoute } from "@/routes/FeatureRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";
import { DemoDashboardPage } from "@/pages/DemoDashboardPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { PlansPage } from "@/pages/PlansPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { QueriesPage } from "@/pages/QueriesPage";
import { MySubscriptionPage } from "@/pages/MySubscriptionPage";
import { ShopsPage } from "@/pages/ShopsPage";
import { UsersPage } from "@/pages/UsersPage";
import { RolesPage } from "@/pages/RolesPage";
import { CouponsPage } from "@/pages/CouponsPage";
import { CmsPage } from "@/pages/CmsPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomCakesPage } from "@/pages/CustomCakesPage";
import { SchedulingPage } from "@/pages/SchedulingPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

/** Staff have no dashboard — their whole job is Orders, so send them there. */
function HomeRoute() {
  const { role } = useAuth();
  return role === "staff" ? <Navigate to="/orders" replace /> : <DashboardPage />;
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
        <Route path="/set-password" element={<SetPasswordPage />} />
        {/* Public, backend-free replica of the owner dashboard — for marketing screenshots only */}
        <Route path="/demo-dashboard" element={<DemoDashboardPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Orders — the one operational area branch staff can reach. */}
            <Route
              element={
                <ProtectedRoute
                  roles={["account_super_admin", "shop_admin", "staff"]}
                />
              }
            >
              <Route path="/orders" element={<OrdersPage />} />
            </Route>

            {/* Platform super admin */}
            <Route element={<ProtectedRoute roles={["platform_super_admin"]} />}>
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
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
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/scheduling" element={<SchedulingPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/shops" element={<ShopsPage />} />

              {/* Plan-gated feature modules */}
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_customer_data"
                    featureLabel="Customers"
                  />
                }
              >
                <Route path="/customers" element={<CustomersPage />} />
              </Route>
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_coupons"
                    featureLabel="Coupons"
                  />
                }
              >
                <Route path="/coupons" element={<CouponsPage />} />
              </Route>
              <Route
                element={
                  <FeatureRoute feature="can_use_cms" featureLabel="CMS" />
                }
              >
                <Route path="/cms" element={<CmsPage />} />
              </Route>
              <Route
                element={
                  <FeatureRoute
                    feature="can_use_custom_cake"
                    featureLabel="Custom Cakes"
                  />
                }
              >
                <Route path="/custom-cakes" element={<CustomCakesPage />} />
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
              <Route path="/users" element={<UsersPage />} />
            </Route>

            {/* Roles & Permissions — platform super admin only */}
            <Route
              element={<ProtectedRoute roles={["platform_super_admin"]} />}
            >
              <Route path="/roles" element={<RolesPage />} />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
