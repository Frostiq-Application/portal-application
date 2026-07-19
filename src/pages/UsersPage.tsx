import { useMemo, useState } from "react";
import {
  Copy,
  KeyRound,
  MapPin,
  MoreHorizontal,
  Search,
  Sparkles,
  Store,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntitlements } from "@/hooks/useEntitlements";
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
import { BranchAssignmentDialog } from "@/components/users/BranchAssignmentDialog";
import { RoleAssignmentDialog } from "@/components/users/RoleAssignmentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Display order + icon for each role group. */
const ROLE_ORDER: Role[] = [
  "platform_super_admin",
  "account_super_admin",
  "shop_admin",
];
const ROLE_ICON: Record<Role, typeof UserCog> = {
  platform_super_admin: UserCog,
  account_super_admin: UserCog,
  shop_admin: Store,
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
  const [roleFor, setRoleFor] = useState<User | null>(null);

  const shopName = useMemo(() => {
    const m = new Map((shops?.data ?? []).map((s) => [s.id, s.branchName]));
    return (id: string) => m.get(id) ?? id.slice(0, 6);
  }, [shops]);

  const groups = useMemo(() => {
    const rows = data?.data ?? [];
    return ROLE_ORDER.map((role) => ({
      role,
      members: rows.filter((u) => u.role === role),
    })).filter((g) => g.members.length > 0);
  }, [data]);

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateUser({ id, body: { isActive } }).unwrap();
      toast.success(isActive ? "Member activated" : "Member deactivated");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const doReset = async (id: string) => {
    try {
      const res = await resetPassword(id).unwrap();
      await navigator.clipboard?.writeText(res.resetToken);
      toast.success("Reset token copied to clipboard", {
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
  const atSeatCap = seatCap != null && seatsUsed >= seatCap;

  return (
    <>
      <PageHeader
        title="Team"
        description="Admin members, roles & branch assignments"
        actions={
          <div className="flex items-center gap-3">
            {seatCap != null && (
              <span
                className={cn(
                  "text-xs tabular-nums rounded-md border px-2 py-1",
                  atSeatCap
                    ? "border-destructive/40 text-destructive"
                    : "text-muted-foreground",
                )}
                title="Team members used vs. your plan limit"
              >
                {seatsUsed} / {seatCap} seats
              </span>
            )}
            {atSeatCap ? (
              <Button
                disabled
                title="You've reached your plan's team-seat limit. Upgrade to add more."
              >
                Invite member
              </Button>
            ) : (
              <InviteUserDialog />
            )}
          </div>
        }
      />

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
      ) : totalMembers === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-20 text-center">
          <UsersIcon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "No members match your search." : "No team members yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => {
            const RoleIcon = ROLE_ICON[group.role];
            return (
              <section key={group.role}>
                <div className="mb-2.5 flex items-center gap-2">
                  <RoleIcon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    {roleLabel(group.role)}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {group.members.length}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {group.members.map((u) => (
                    <MemberCard
                      key={u.id}
                      user={u}
                      shopName={shopName}
                      onManageBranch={() => setAssignFor(u)}
                      onAssignRole={() => setRoleFor(u)}
                      onReset={() => doReset(u.id)}
                      onToggleActive={() => toggleActive(u.id, !u.isActive)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <BranchAssignmentDialog
        user={assignFor}
        open={!!assignFor}
        onOpenChange={(o) => !o && setAssignFor(null)}
      />

      <RoleAssignmentDialog
        user={roleFor}
        currentRoleId={roleFor?.customRoleId ?? null}
        open={!!roleFor}
        onOpenChange={(o) => !o && setRoleFor(null)}
      />
    </>
  );
}

function MemberCard({
  user,
  shopName,
  onManageBranch,
  onAssignRole,
  onReset,
  onToggleActive,
}: {
  user: User;
  shopName: (id: string) => string;
  onManageBranch: () => void;
  onAssignRole: () => void;
  onReset: () => void;
  onToggleActive: () => void;
}) {
  const isShopAdmin = user.role === "shop_admin";
  // Custom roles only apply to brand/shop members, never platform admins.
  const canHaveCustomRole = user.role !== "platform_super_admin";
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
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>

        {canHaveCustomRole && user.customRoleId && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
            <Sparkles className="h-3 w-3" />
            Custom role
          </span>
        )}

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
          {canHaveCustomRole && (
            <DropdownMenuItem onClick={onAssignRole}>
              <Sparkles className="mr-2 h-4 w-4" />
              Assign custom role
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onReset}>
            <KeyRound className="mr-2 h-4 w-4" />
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.isActive ? (
            <DropdownMenuItem className="text-destructive" onClick={onToggleActive}>
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onToggleActive}>Activate</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
