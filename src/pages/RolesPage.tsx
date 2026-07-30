import { useState } from "react";
import { Check, Lock, Minus, MoreHorizontal, Pencil, Plus, ShieldCheck, Sparkles, Store, Trash2 } from "@/components/ui/icons";
import { toast } from "sonner";
import {
  accessFor,
  PERMISSION_CATALOG,
  type AccessLevel,
} from "@/config/permissions";
import { isPlatformAdmin, roleLabel } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import { apiError } from "@/lib/apiError";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import {
  useDeleteCustomRoleMutation,
  useListCustomRolesQuery,
  type CustomRole,
} from "@/features/api/rolesApi";
import { CustomRoleDialog } from "@/components/roles/CustomRoleDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES: Role[] = [
  "platform_super_admin",
  "account_super_admin",
  "shop_admin",
  "staff",
  "chef",
  "delivery_manager",
];

/** The matrix a shop owner sees — their own floor, not the platform's roles. */
const BRAND_ROLES: Role[] = [
  "account_super_admin",
  "shop_admin",
  "staff",
  "chef",
  "delivery_manager",
];

const ROLE_BLURB: Record<Role, string> = {
  platform_super_admin: "Runs the platform — brands, plans & subscriptions.",
  account_super_admin: "Owns a brand — full control across all its branches.",
  shop_admin: "Runs a single branch — scoped to their assigned outlet.",
  staff: "Branch team member — day-to-day order operations only.",
  chef: "Works the kitchen — the bake queue and nothing else.",
  delivery_manager: "Runs dispatch — what's ready, where it goes, who to call.",
};

export function RolesPage() {
  const { role } = useAuth();
  // A shop owner has no business reading the platform's own role definitions,
  // and the extra columns only make the matrix harder to scan on their screen.
  const columns = isPlatformAdmin(role) ? ROLES : BRAND_ROLES;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description={
          isPlatformAdmin(role)
            ? "What each role can access across the portal"
            : "What each role on your team can reach — and the custom roles you've defined"
        }
      />

      {/* Role summary cards */}
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {columns.map((r) => (
          <Card key={r}>
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                {r === "shop_admin" ? (
                  <Store className="h-4 w-4 text-primary" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                )}
                <h3 className="font-semibold">{roleLabel(r)}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {ROLE_BLURB[r]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Legend />

      {/* Matrix */}
      <div className="mt-4 overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-semibold">Capability</th>
              {columns.map((r) => (
                <th
                  key={r}
                  className="px-3 py-3 text-center font-semibold"
                >
                  {roleLabel(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_CATALOG.map((group) => (
              <GroupRows
                key={group.group}
                group={group.group}
                rows={group.rows}
                columns={columns}
              />
            ))}
          </tbody>
        </table>
      </div>

      <CustomRolesSection />
    </>
  );
}

function CustomRolesSection() {
  const { data: roles, isLoading } = useListCustomRolesQuery();
  const [remove] = useDeleteCustomRoleMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (r: CustomRole) => {
    setEditing(r);
    setDialogOpen(true);
  };
  const doDelete = async (r: CustomRole) => {
    try {
      await remove(r.id).unwrap();
      toast.success("Role deleted");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Custom roles
          </h2>
          <p className="text-sm text-muted-foreground">
            Define roles with exactly the permissions you need.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          New role
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (roles ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-12 text-center">
          <Sparkles className="mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No custom roles yet. Create one to tailor access.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(roles ?? []).map((r) => (
            <CustomRoleCard
              key={r.id}
              role={r}
              onEdit={() => openEdit(r)}
              onDelete={() => doDelete(r)}
            />
          ))}
        </div>
      )}

      <CustomRoleDialog
        role={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </section>
  );
}

function CustomRoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: CustomRole;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background p-4 shadow-sm",
        !role.isActive && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{role.name}</h3>
            {role.isTemplate && (
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                Template
              </span>
            )}
            {!role.isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          {role.description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {role.description}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {role.permissions.length === 0 ? (
          <span className="text-xs text-muted-foreground">No permissions</span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {role.permissions.length} permission
            {role.permissions.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupRows({
  group,
  rows,
  columns,
}: {
  group: string;
  rows: (typeof PERMISSION_CATALOG)[number]["rows"];
  columns: Role[];
}) {
  return (
    <>
      <tr className="border-b bg-muted/20">
        <td
          colSpan={1 + columns.length}
          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {group}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="border-b last:border-b-0">
          <td className="px-4 py-3">
            <div className="flex items-center gap-1.5 font-medium">
              {row.label}
              {row.feature && (
                <span
                  title="Requires a plan that includes this feature"
                  className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                >
                  Plan
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{row.description}</p>
          </td>
          {columns.map((r) => (
            <td key={r} className="px-3 py-3 text-center">
              <AccessCell level={accessFor(row, r)} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function AccessCell({ level }: { level: AccessLevel }) {
  if (level === "full") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
      </span>
    );
  }
  if (level === "scoped") {
    return (
      <span
        title="Limited to the role's own branch"
        className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-semibold text-sky-600"
      >
        <Store className="h-3 w-3" />
        Branch
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
      <Minus className="h-3.5 w-3.5" />
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
          <Check className="h-3 w-3" strokeWidth={2.6} />
        </span>
        Full access
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 font-semibold text-sky-600">
          <Store className="h-3 w-3" />
          Branch
        </span>
        Limited to own branch
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
          <Minus className="h-3 w-3" />
        </span>
        No access
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-600">
          Plan
        </span>
        <Lock className="h-3 w-3" />
        Requires plan feature
      </span>
    </div>
  );
}
