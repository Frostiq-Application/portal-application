import { useMemo, useState } from "react";
import { Copy, KeyRound, MapPin, MoreHorizontal, Search, Store, UserCog, Users as UsersIcon } from "@/components/ui/icons";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdmin } from "@/lib/roles";
import { apiError } from "@/lib/apiError";
import {
  useListUsersQuery,
  useResetUserPasswordMutation,
  useUpdateUserMutation,
} from "@/features/api/usersApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { roleLabel } from "@/lib/roles";
import type { Role, User } from "@/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { InviteUserDialog } from "@/components/users/InviteUserDialog";
import {
  LimitCounter,
  LimitNotice,
  useLimitState,
} from "@/components/gating/LimitNotice";
import { BranchAssignmentDialog } from "@/components/users/BranchAssignmentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Which roles get a tab depends on who's viewing:
 *  - Platform Super Admin manages platform admins + Shop Owners.
 *  - Shop Owner manages their own Branch Owners (never platform admins).
 */
const PLATFORM_TAB_ROLES: Role[] = ["platform_super_admin", "account_super_admin"];
const OWNER_TAB_ROLES: Role[] = ["shop_admin"];
const SHOP_ADMIN_TAB_ROLES: Role[] = ["staff"];
const ROLE_ICON: Record<Role, typeof UserCog> = {
  platform_super_admin: UserCog,
  account_super_admin: Store,
  shop_admin: Store,
  staff: UsersIcon,
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function UsersPage() {
  const { role } = useAuth();
  const isPlatform = isPlatformAdmin(role);
  const isBranchOwner = role === "shop_admin";
  const tabRoles = isPlatform
    ? PLATFORM_TAB_ROLES
    : isBranchOwner
      ? SHOP_ADMIN_TAB_ROLES
      : OWNER_TAB_ROLES;

  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const { data, isLoading } = useListUsersQuery({
    page: 1,
    limit: 100,
    search: debounced || undefined,
  });
  const { data: shops } = useListShopsQuery({ page: 1, limit: 100 });
  const [updateUser] = useUpdateUserMutation();
  const [resetPassword] = useResetUserPasswordMutation();

  const [assignFor, setAssignFor] = useState<User | null>(null);

  const shopName = useMemo(() => {
    const m = new Map((shops?.data ?? []).map((s) => [s.id, s.branchName]));
    return (id: string) => m.get(id) ?? id.slice(0, 6);
  }, [shops]);

  const membersByRole = useMemo(() => {
    const rows = data?.data ?? [];
    return tabRoles.reduce(
      (acc, r) => {
        acc[r] = rows.filter((u) => u.role === r);
        return acc;
      },
      {} as Record<Role, User[]>,
    );
  }, [data, tabRoles]);

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateUser({ id, body: { isActive } }).unwrap();
      toast.success(isActive ? "Member activated" : "Member deactivated");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  /**
   * Emails the member a reset link, and copies the same link as a fallback.
   *
   * This used to copy `res.resetToken` — the bare JWT, which the recipient
   * could do nothing with. The link is what's useful, and now that the server
   * also mails it, the clipboard is only there for a bounced address.
   */
  const doReset = async (user: User) => {
    try {
      const res = await resetPassword(user.id).unwrap();
      await navigator.clipboard?.writeText(
        `${window.location.origin}/set-password?token=${res.resetToken}`,
      );
      toast.success(`Reset link sent to ${user.email}`, {
        description: "The link is also on your clipboard, in case it bounces.",
        icon: <Copy className="h-4 w-4" />,
      });
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const totalMembers = data?.data.length ?? 0;

  // Team-seat plan limit (gated roles only; platform admin is exempt → null cap).
  const { entitlements, isExempt } = useEntitlements();
  const seatCap = isExempt ? null : (entitlements?.maxTeamSeats ?? null);
  const seatsUsed = entitlements?.teamSeatsUsed ?? totalMembers;
  // Effective seat limit (plan + add-ons), matching what the server enforces.
  const seatLimit = useLimitState(seatsUsed, seatCap);
  const atSeatCap = seatLimit.atLimit;

  return (
    <>
      <PageHeader
        title="Team"
        description={
          isPlatform
            ? "Admin members, roles & branch assignments"
            : isBranchOwner
              ? "Your branch staff"
              : "Your branch owners & their branch assignments"
        }
        actions={
          <div className="flex items-center gap-3">
            <LimitCounter state={seatLimit} unit="seats" />
            {atSeatCap ? (
              <Button
                disabled
                title={`Your plan allows ${seatCap} team member(s). Upgrade or add capacity to invite more.`}
              >
                Invite member
              </Button>
            ) : (
              <InviteUserDialog />
            )}
          </div>
        }
      />

      <LimitNotice state={seatLimit} label="team members" unit="seats" />

      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={tabRoles[0]}>
          <TabsList>
            {tabRoles.map((r) => {
              const RoleIcon = ROLE_ICON[r];
              return (
                <TabsTrigger key={r} value={r} className="gap-1.5">
                  <RoleIcon className="h-4 w-4" />
                  {roleLabel(r)}
                  <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums">
                    {membersByRole[r].length}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabRoles.map((r) => {
            const members = membersByRole[r];
            return (
              <TabsContent key={r} value={r} className="mt-5">
                {members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-20 text-center">
                    <UsersIcon className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search
                        ? "No members match your search."
                        : `No ${roleLabel(r).toLowerCase()}s yet.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {members.map((u) => (
                      <MemberCard
                        key={u.id}
                        user={u}
                        shopName={shopName}
                        onManageBranch={() => setAssignFor(u)}
                        onReset={() => doReset(u)}
                        onToggleActive={() => toggleActive(u.id, !u.isActive)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <BranchAssignmentDialog
        user={assignFor}
        open={!!assignFor}
        onOpenChange={(o) => !o && setAssignFor(null)}
      />
    </>
  );
}

function MemberCard({
  user,
  shopName,
  onManageBranch,
  onReset,
  onToggleActive,
}: {
  user: User;
  shopName: (id: string) => string;
  onManageBranch: () => void;
  onReset: () => void;
  onToggleActive: () => void;
}) {
  const isShopAdmin = user.role === "shop_admin";
  // Platform admins toggle each other; Shop Owners toggle Branch Owners; Branch
  // Owners toggle their staff.
  const canToggleActive =
    user.role === "platform_super_admin" ||
    user.role === "shop_admin" ||
    user.role === "staff";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-background p-4 shadow-sm",
        !user.isActive && "opacity-70",
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
          {initials(user.name) || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{user.name}</p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              user.isActive
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground",
            )}
          >
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {user.phone || "No phone number"}
        </p>

        {isShopAdmin && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {user.shopIds.length > 0 ? (
              user.shopIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                >
                  <MapPin className="h-3 w-3 opacity-70" />
                  {shopName(id)}
                </span>
              ))
            ) : (
              <button
                type="button"
                onClick={onManageBranch}
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <MapPin className="h-3 w-3" />
                Assign a branch
              </button>
            )}
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="-mr-1 -mt-1 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isShopAdmin && (
            <DropdownMenuItem onClick={onManageBranch}>
              <Store className="mr-2 h-4 w-4" />
              Assign branch
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onReset}>
            <KeyRound className="mr-2 h-4 w-4" />
            Reset password
          </DropdownMenuItem>
          {canToggleActive && (
            <>
              <DropdownMenuSeparator />
              {user.isActive ? (
                <DropdownMenuItem className="text-destructive" onClick={onToggleActive}>
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onToggleActive}>Activate</DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
