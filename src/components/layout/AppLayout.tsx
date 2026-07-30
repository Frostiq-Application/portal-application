import { Fragment, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Crown,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  UserRound,
  X,
} from "@/components/ui/icons";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { toggleTheme } from "@/features/ui/uiSlice";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  selectHasUnseenOrders,
  selectHasUnseenEnquiries,
} from "@/features/notifications/notificationsSlice";
import { FrostiqueMark } from "@/components/common/FrostiqueMark";
import { OrderNotifications } from "@/components/orders/OrderNotifications";
import { EnquiryNotifications } from "@/components/enquiries/EnquiryNotifications";
import { AccountDeactivatedGate } from "@/components/gating/AccountDeactivatedGate";
import { NoSubscriptionGate } from "@/components/gating/NoSubscriptionGate";
import { navFor, type NavItem } from "@/config/nav";
import { useCan } from "@/hooks/useCan";
import { roleLabel } from "@/lib/roles";
import { applyBrandTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GROUP_ORDER: NavItem["group"][] = [
  "Overview",
  // Sits high on purpose: for a chef or a rider this is the only group they
  // have, and it should be the first thing under the logo, not buried.
  "Floor",
  "Operations",
  "Platform",
  "Brand",
  "Configuration",
];

/**
 * The sidebar. Exported so its plan-gating behaviour can be tested directly —
 * locking the wrong item is a silent revenue bug, not a visual one.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth();
  const { can } = useCan();
  const { hasFeature } = useEntitlements();
  const hasUnseenOrders = useAppSelector(selectHasUnseenOrders);
  const hasUnseenEnquiries = useAppSelector(selectHasUnseenEnquiries);
  // Plan-gated items are shown, not hidden. A feature the bakery can't see is a
  // feature it will never buy — and a menu that silently changes shape after an
  // upgrade is disorienting.
  //
  // They're marked with a crown, not a lock, and keep normal text colour. A
  // padlock beside greyed-out text reads as "broken" or "not for you"; a gold
  // crown beside a live-looking item reads as "this is the good stuff" — which
  // is the feeling that actually sells an upgrade. The route still works and
  // still lands on the upgrade card.
  // Role first, then permission: a custom role in restrict mode can drop items
  // a role would normally carry, which is how a chef ends up with Kitchen and
  // nothing else in the sidebar.
  const items = navFor(role, can);
  const isLocked = (i: NavItem) =>
    Boolean(i.feature) && !hasFeature(i.feature!);

  return (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <div className="flex flex-col gap-1">
              {groupItems
                .filter((i) => !i.parent)
                .map((item) => (
                  <Fragment key={item.path}>
                    {renderItem(item)}
                    {/* Sub-items are parts of the parent feature. When the plan
                        doesn't include it there is nothing to nest and the
                        parent row already carries the upgrade prompt — a second
                        crowned row for the same add-on just reads as clutter. */}
                    {!isLocked(item) &&
                      items
                        .filter((c) => c.parent === item.path)
                        .map((child) => renderItem(child, true))}
                  </Fragment>
                ))}
            </div>
          </div>
        );
      })}
    </nav>
  );

  /** One sidebar row. `nested` indents a sub-item under its parent feature. */
  function renderItem(item: NavItem, nested = false) {
    const Icon = item.icon;
    if (item.soon) {
      return (
        <span
          key={item.path}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
          title="Coming soon"
        >
          <Icon className="h-4 w-4" />
          {item.label}
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
            soon
          </span>
        </span>
      );
    }
    const locked = isLocked(item);
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === "/" || item.exact}
        onClick={onNavigate}
        aria-label={locked ? `${item.label} — not in your plan` : undefined}
        data-locked={locked || undefined}
        title={
          locked
            ? `${item.label} isn't in your plan — tap to see upgrade options`
            : undefined
        }
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-foreground/80 hover:bg-muted",
            // Indented and quieter: a part of the row above it,
            // not a peer of it.
            nested && "ml-3 py-1.5 text-[13px]",
          )
        }
      >
        {/* Render-prop children so the crown can react to the
          active row, where amber on the brand fill would clash. */}
        {({ isActive }) => (
          <>
            <Icon className={nested ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {item.label}
            {locked && (
              /* Contained rather than a bare glyph: a floating
               icon at the row's edge reads as stray decoration,
               while a tinted chip reads as a deliberate mark and
               gives the amber somewhere to sit. */
              <span
                className={cn(
                  "ml-auto flex size-5 shrink-0 items-center justify-center rounded-md",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                )}
                aria-hidden
              >
                <Crown className="size-3" />
              </span>
            )}
            {item.path === "/orders" && hasUnseenOrders && (
              <span
                className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-500"
                title="New orders"
              />
            )}
            {item.path === "/queries" && hasUnseenEnquiries && (
              <span
                className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-500"
                title="New queries"
              />
            )}
          </>
        )}
      </NavLink>
    );
  }
}

/**
 * App-shell brand header. For brand & shop admins it renders their own
 * account's logo + name (from entitlements); for the platform admin — or before
 * the brand has loaded — it falls back to the default Frostique branding.
 */
function Brand({
  brand,
}: {
  brand: { name: string; logoUrl: string | null } | null;
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      {brand?.logoUrl ? (
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <FrostiqueMark className="h-8 w-8" />
      )}
      <div className="leading-tight">
        <p className="text-sm font-semibold">{brand?.name ?? "Frostique"}</p>
        <p className="text-xs text-muted-foreground">Admin Portal</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    isExempt,
    isLoading,
    hasActiveSubscription,
    isAccountDeactivated,
    isSubscriptionExpired,
    entitlements,
    brand,
    hasFeature,
  } = useEntitlements();
  const theme = useAppSelector((s) => s.ui.theme);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Reflect the brand in the browser tab so the whole portal reads as theirs.
  useEffect(() => {
    document.title = brand?.name ? `${brand.name} Portal` : "Frostique Portal";
  }, [brand?.name]);

  // Recolour the portal's primary accents with the brand's theme colour while a
  // brand/shop admin is signed in; clear it on logout (platform admin / login).
  useEffect(() => {
    applyBrandTheme(brand?.themeColor);
    return () => applyBrandTheme(null);
  }, [brand?.themeColor]);

  // Gated roles get one of two blocking screens when they can't use the app.
  // The whole shell is unreachable until the underlying issue is resolved.
  if (!isExempt) {
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
          Loading…
        </div>
      );
    }
    // The account itself is deactivated (suspended/rejected/pending) — a plan
    // can't fix it, so send them to contact the super admin.
    if (isAccountDeactivated) {
      return <AccountDeactivatedGate support={entitlements?.support} />;
    }
    // Subscription has expired — a hard lockout the brand can't self-serve
    // (only the platform admin records payments). Same gate, expiry message.
    if (isSubscriptionExpired) {
      return (
        <AccountDeactivatedGate
          support={entitlements?.support}
          reason="expired"
        />
      );
    }
    // Account is active but has no usable subscription — let them pick a plan.
    if (!hasActiveSubscription) {
      return <NoSubscriptionGate support={entitlements?.support} />;
    }
  }

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const doLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* App-wide order alerts: one SSE connection, bell + toast + sidebar dot. */}
      <OrderNotifications />
      {/* App-wide enquiry alerts (platform super admin only): same pattern. */}
      <EnquiryNotifications />

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
          <Brand brand={brand} />
          <SidebarNav />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto border-r bg-background">
            <div className="flex items-center justify-between pr-2">
              <Brand brand={brand} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {!isExempt && hasFeature("can_use_custom_cake") && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate("/custom-cakes")}
              >
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(toggleTheme())}
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full outline-none">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {roleLabel(user?.role)}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={doLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
