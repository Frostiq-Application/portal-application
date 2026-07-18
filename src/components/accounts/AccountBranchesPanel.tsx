import { useState } from "react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import {
  useActivateShopMutation,
  useListShopsQuery,
  useSuspendShopMutation,
} from "@/features/api/shopsApi";
import type { Shop } from "@/types";
import { ShopStatusBadge } from "@/components/StatusBadge";
import { ShopDialog } from "@/components/shops/ShopDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ban, Check, MoreHorizontal, Pencil, Plus, Store } from "lucide-react";

export function AccountBranchesPanel({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const { data, isLoading } = useListShopsQuery({
    page: 1,
    limit: 100,
    accountId,
  });
  const [suspend] = useSuspendShopMutation();
  const [activate] = useActivateShopMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);

  const rows = data?.data ?? [];

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: Shop) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Branches
          {!isLoading && rows.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums normal-case tracking-normal">
              {rows.length}
            </span>
          )}
        </p>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add branch
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-md border border-dashed bg-background py-8 text-center">
          <Store className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No branches yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add the first outlet for {accountName}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add branch
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-md border bg-background">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.branchName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  /{s.slug}
                  {s.city ? ` · ${s.city}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ShopStatusBadge status={s.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${s.branchName}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(s)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      View / Edit
                    </DropdownMenuItem>
                    {s.status === "active" ? (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          run(() => suspend(s.id).unwrap(), "Branch deactivated")
                        }
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() =>
                          run(() => activate(s.id).unwrap(), "Branch activated")
                        }
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Activate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShopDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shop={editing}
        defaultAccountId={accountId}
        defaultAccountName={accountName}
      />
    </div>
  );
}
