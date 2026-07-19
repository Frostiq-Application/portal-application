import { Check, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import {
  useAssignShopMutation,
  useUnassignShopMutation,
} from "@/features/api/usersApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
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
 * (Re)assign a shop admin to a single branch. A shop admin manages exactly one
 * branch, so picking a new one unassigns the previous — presented as a radio
 * list, applied immediately per tap.
 */
export function BranchAssignmentDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: shops, isLoading } = useListShopsQuery(
    open ? { page: 1, limit: 100 } : undefined,
    { skip: !open },
  );
  const [assign, { isLoading: assigning }] = useAssignShopMutation();
  const [unassign, { isLoading: unassigning }] = useUnassignShopMutation();
  const busy = assigning || unassigning;

  const current = user?.shopIds[0] ?? null;

  const pick = async (shopId: string) => {
    if (!user || shopId === current) return;
    try {
      if (current) await unassign({ id: user.id, shopId: current }).unwrap();
      await assign({ id: user.id, shopId }).unwrap();
      toast.success("Branch updated");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign branch</DialogTitle>
          <DialogDescription>
            {user?.name} manages one branch. Selecting a branch moves them there.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1.5 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (shops?.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              No branches available.
            </div>
          ) : (
            (shops?.data ?? []).map((s) => {
              const selected = s.id === current;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Store className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.branchName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[s.displayArea, s.city].filter(Boolean).join(" · ") ||
                        `/${s.slug}`}
                    </p>
                  </div>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
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
