import { useState } from "react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import {
  useArchivePlanMutation,
  useDeletePlanMutation,
  useListPlansQuery,
  useUnarchivePlanMutation,
} from "@/features/api/plansApi";
import { apiError } from "@/lib/apiError";
import type { Plan } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanDialog } from "@/components/plans/PlanDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FEATURE_KEYS = [
  "can_use_coupons",
  "can_use_analytics",
  "can_use_cms",
  "can_clone_catalog",
  "priority_support",
] as const;

function FeatureDot({ on }: { on: boolean }) {
  return on ? (
    <Check className="h-4 w-4 text-emerald-600" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40" />
  );
}

export function PlansPage() {
  const { data, isLoading } = useListPlansQuery({ page: 1, limit: 50 });
  const [archivePlan] = useArchivePlanMutation();
  const [unarchivePlan] = useUnarchivePlanMutation();
  const [deletePlan] = useDeletePlanMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setDialogOpen(true);
  };

  const rows = data?.data ?? [];

  const doArchive = async (id: string) => {
    try {
      await archivePlan(id).unwrap();
      toast.success("Plan archived");
    } catch (err) {
      toast.error(apiError(err));
    }
  };
  const doUnarchive = async (id: string) => {
    try {
      await unarchivePlan(id).unwrap();
      toast.success("Plan unarchived");
    } catch (err) {
      toast.error(apiError(err));
    }
  };
  const doDelete = async (id: string) => {
    try {
      await deletePlan(id).unwrap();
      toast.success("Plan deleted");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Plans"
        description="Subscription tiers & feature gating"
        actions={<Button onClick={openNew}>New plan</Button>}
      />

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Price / mo</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead className="text-center">Coupons</TableHead>
              <TableHead className="text-center">Analytics</TableHead>
              <TableHead className="text-center">CMS</TableHead>
              <TableHead className="text-center">Cloning</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No plans yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const f = (p.features ?? {}) as Record<string, boolean>;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground">{p.description}</div>
                      )}
                    </TableCell>
                    <TableCell>₹{Number(p.priceMonthly).toLocaleString("en-IN")}</TableCell>
                    <TableCell>{p.maxShops ?? "∞"}</TableCell>
                    {FEATURE_KEYS.map((k) => (
                      <TableCell key={k} className="text-center">
                        <div className="flex justify-center">
                          <FeatureDot on={!!f[k]} />
                        </div>
                      </TableCell>
                    ))}
                    <TableCell>
                      <span
                        className={
                          p.isActive
                            ? "text-xs text-emerald-600"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {p.isActive ? "Active" : "Archived"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            Edit
                          </DropdownMenuItem>
                          {p.isActive ? (
                            <DropdownMenuItem onClick={() => doArchive(p.id)}>
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => doUnarchive(p.id)}>
                              Unarchive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => doDelete(p.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PlanDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={editing} />
    </>
  );
}
