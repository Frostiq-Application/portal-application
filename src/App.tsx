import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { FeatureRoute } from "@/routes/FeatureRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { PlansPage } from "@/pages/PlansPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { MySubscriptionPage } from "@/pages/MySubscriptionPage";
import { ShopsPage } from "@/pages/ShopsPage";
import { UsersPage } from "@/pages/UsersPage";
import { CouponsPage } from "@/pages/CouponsPage";
import { CmsPage } from "@/pages/CmsPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { Toaster } from "@/components/ui/sonner";

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

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Platform super admin */}
            <Route element={<ProtectedRoute roles={["platform_super_admin"]} />}>
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
            </Route>

            {/* Brand + shop admin (hidden from platform super admin) */}
            <Route
              element={
                <ProtectedRoute
                  roles={["account_super_admin", "shop_admin"]}
                />
              }
            >
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/shops" element={<ShopsPage />} />

              {/* Plan-gated feature modules */}
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
            </Route>

            <Route
              element={
                <ProtectedRoute
                  roles={["platform_super_admin", "account_super_admin"]}
                />
              }
            >
              <Route path="/users" element={<UsersPage />} />
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
