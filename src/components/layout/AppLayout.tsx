import { Fragment, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Crown,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserRound,
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
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
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
export function SidebarNav() {
  const { role } = useAuth();
  const { can } = useCan();
  const { hasFeature } = useEntitlements();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
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

  // Active state is derived here rather than left to NavLink's render prop:
  // collapsed to icons, the highlight comes from the menu button's own
  // `data-active`, which needs the answer as a prop before it renders.
  const isActivePath = (item: NavItem) =>
    item.exact || item.path === "/"
      ? pathname === item.path
      : pathname === item.path || pathname.startsWith(`${item.path}/`);

  /** Tapping a destination on mobile should close the drawer behind it. */
  const closeOnMobile = () => setOpenMobile(false);

  return (
    <>
      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupItems
                  .filter((i) => !i.parent)
                  .map((item) => (
                    <Fragment key={item.path}>{renderItem(item)}</Fragment>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );

  /** One top-level row, plus its sub-items when the plan carries the parent. */
  function renderItem(item: NavItem) {
    const Icon = item.icon;

    if (item.soon) {
      return (
        <SidebarMenuItem>
          <SidebarMenuButton disabled tooltip={`${item.label} — coming soon`}>
            <Icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
          <SidebarMenuBadge>soon</SidebarMenuBadge>
        </SidebarMenuItem>
      );
    }

    const locked = isLocked(item);
    // Sub-items are parts of the parent feature. When the plan doesn't include
    // it there is nothing to nest and the parent row already carries the
    // upgrade prompt — a second crowned row for the same add-on reads as
    // clutter.
    const children = locked
      ? []
      : items.filter((c) => c.parent === item.path);

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActivePath(item)}
          tooltip={locked ? `${item.label} — not in your plan` : item.label}
        >
          <NavLink
            to={item.path}
            end={item.path === "/" || item.exact}
            onClick={closeOnMobile}
            aria-label={locked ? `${item.label} — not in your plan` : undefined}
            data-locked={locked || undefined}
            title={
              locked
                ? `${item.label} isn't in your plan — tap to see upgrade options`
                : undefined
            }
          >
            <Icon />
            <span>{item.label}</span>
            {locked && (
              /* Contained rather than a bare glyph: a floating icon at the
                 row's edge reads as stray decoration, while a tinted chip
                 reads as a deliberate mark and gives the amber somewhere to
                 sit. Collapsed to icons there is no room for it — the tooltip
                 says the same thing. */
              <span
                className={cn(
                  "ml-auto flex size-5 shrink-0 items-center justify-center rounded-md",
                  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  "group-data-[active=true]/menu-item:bg-sidebar-accent-foreground/15",
                  "group-data-[collapsible=icon]:hidden",
                )}
                aria-hidden
              >
                <Crown className="size-3" />
              </span>
            )}
            {unseen(item.path) && (
              /* Survives the collapse: the whole point is to be seen when the
                 label isn't there, so it moves to the icon's corner. */
              <span
                className="ml-auto size-2 shrink-0 rounded-full bg-red-500 group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:ml-0"
                title={item.path === "/orders" ? "New orders" : "New queries"}
              />
            )}
          </NavLink>
        </SidebarMenuButton>

        {children.length > 0 && (
          <SidebarMenuSub>
            {children.map((child) => {
              const ChildIcon = child.icon;
              return (
                <SidebarMenuSubItem key={child.path}>
                  <SidebarMenuSubButton asChild isActive={isActivePath(child)}>
                    <NavLink
                      to={child.path}
                      end={child.exact}
                      onClick={closeOnMobile}
                    >
                      <ChildIcon />
                      <span>{child.label}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  function unseen(path: string) {
    if (path === "/orders") return hasUnseenOrders;
    if (path === "/queries") return hasUnseenEnquiries;
    return false;
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
    // The mark keeps its size through the collapse and stays centred in the
    // icon rail; only the wordmark beside it goes.
    <div className="flex items-center gap-2 p-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
      {brand?.logoUrl ? (
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <FrostiqueMark className="size-8 shrink-0" />
      )}
      <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-semibold">
          {brand?.name ?? "Frostique"}
        </p>
        <p className="truncate text-xs text-muted-foreground">Admin Portal</p>
      </div>
    </div>
  );
}

/**
 * The app shell's sidebar: brand, then the role's navigation.
 *
 * `collapsible="icon"` — it narrows to an icon rail rather than sliding away,
 * so the whole menu stays one click from anywhere. Toggled by the trigger in
 * the header, the rail's own edge, or ⌘/Ctrl+B, and the choice is remembered
 * in a cookie across sessions.
 */
function AppSidebar({
  brand,
}: {
  brand: { name: string; logoUrl: string | null } | null;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Brand brand={brand} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
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
    <SidebarProvider>
      {/* App-wide order alerts: one SSE connection, bell + toast + sidebar dot. */}
      <OrderNotifications />
      {/* App-wide enquiry alerts (platform super admin only): same pattern. */}
      <EnquiryNotifications />

      <AppSidebar brand={brand} />

      <SidebarInset className="min-w-0 bg-muted/30">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
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

        <div className="flex-1 p-4 sm:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
