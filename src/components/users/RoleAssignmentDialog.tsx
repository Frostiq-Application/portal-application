import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import {
  useAssignRoleToUserMutation,
  useListCustomRolesQuery,
} from "@/features/api/rolesApi";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Assign (or clear) a member's custom role. The base role stays; a custom role
 * layers extra permissions on top. Applied immediately on selection.
 */
export function RoleAssignmentDialog({
  user,
  currentRoleId,
  open,
  onOpenChange,
}: {
  user: User | null;
  currentRoleId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: roles, isLoading } = useListCustomRolesQuery(undefined, {
    skip: !open,
  });
  const [assign, { isLoading: saving }] = useAssignRoleToUserMutation();

  const pick = async (roleId: string | null) => {
    if (!user) return;
    try {
      await assign({ userId: user.id, customRoleId: roleId }).unwrap();
      toast.success(roleId ? "Role assigned" : "Custom role cleared");
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const active = (roles ?? []).filter((r) => r.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign custom role</DialogTitle>
          <DialogDescription>
            {user?.name} keeps their base access; a custom role adds permissions
            on top.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1.5 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <RoleRow
                label="No custom role"
                sub="Base role permissions only"
                selected={!currentRoleId}
                disabled={saving}
                onClick={() => pick(null)}
              />
              {active.map((r) => (
                <RoleRow
                  key={r.id}
                  label={r.name}
                  sub={
                    r.isTemplate
                      ? `Template · ${r.permissions.length} permissions`
                      : `${r.permissions.length} permissions`
                  }
                  selected={currentRoleId === r.id}
                  disabled={saving}
                  onClick={() => pick(r.id)}
                />
              ))}
              {active.length === 0 && (
                <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                  No custom roles yet. Create one on the Roles page.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleRow({
  label,
  sub,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
        selected ? "border-primary bg-primary/5" : "border-input hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}
