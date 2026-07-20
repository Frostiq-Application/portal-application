import { useMemo, useState } from "react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import {
  useArchivePlanMutation,
  useDeletePlanMutation,
  useListPlansQuery,
  useUnarchivePlanMutation,
} from "@/features/api/plansApi";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanDialog } from "@/components/plans/PlanDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Comparison-matrix rows. Each row reads a value off a plan and renders the
 * per-column cell — a check/cross for booleans, or a formatted value/limit.
 */
type Row = {
  label: string;
  render: (plan: Plan) => React.ReactNode;
};

function Yes() {
  return <Check className="mx-auto h-5 w-5 text-emerald-600" />;
}
function No() {
  return <X className="mx-auto h-5 w-5 text-muted-foreground/30" />;
}
function bool(plan: Plan, key: string) {
  return (plan.features as Record<string, boolean>)?.[key] ? <Yes /> : <No />;
}
function limit(value: number | null | undefined) {
  return (
    <span className="text-sm">{value == null ? "Unlimited" : value}</span>
  );
}

const ROWS: Row[] = [
  { label: "Branches", render: (p) => limit(p.maxShops) },
  { label: "Products / branch", render: (p) => limit(p.maxProductsPerShop) },
  {
    label: "Team members",
    render: (p) =>
      limit(
        (p.features as unknown as Record<string, number | null>)
          ?.max_team_seats ?? null,
      ),
  },
  { label: "Coupons", render: (p) => bool(p, "can_use_coupons") },
  { label: "CMS", render: (p) => bool(p, "can_use_cms") },
  { label: "Catalog cloning", render: (p) => bool(p, "can_clone_catalog") },
  { label: "Realtime orders", render: (p) => bool(p, "can_use_realtime") },
  { label: "Analytics", render: (p) => bool(p, "can_use_analytics") },
  {
    label: "Wishlist analytics",
    render: (p) => bool(p, "can_use_wishlist_analytics"),
  },
  {
    label: "Advanced analytics",
    render: (p) => bool(p, "can_use_advanced_analytics"),
  },
  { label: "Audit log", render: (p) => bool(p, "can_use_audit_log") },
  { label: "Custom cake", render: (p) => bool(p, "can_use_custom_cake") },
  {
    label: "WhatsApp checkout",
    render: (p) => bool(p, "can_use_whatsapp_checkout"),
  },
  { label: "Priority support", render: (p) => bool(p, "priority_support") },
];

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

  // Ordered by the plan's sortOrder (API already sorts, but keep it robust).
  const plans = useMemo(
    () =>
      [...(data?.data ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || Number(a.priceMonthly) - Number(b.priceMonthly),
      ),
    [data],
  );

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

  // Highlight the mid tier as "popular" (visual accent only).
  const popularId = plans.length ? plans[Math.floor((plans.length - 1) / 2)].id : null;

  return (
    <>
      <PageHeader
        title="Plans"
        description="Subscription tiers & feature gating"
        actions={<Button onClick={openNew}>New plan</Button>}
      />

      {isLoading ? (
        <div className="rounded-lg border bg-background p-6">
          <div className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border bg-background py-16 text-center text-sm text-muted-foreground">
          No plans yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {/* Corner cell */}
                <th className="w-56 border-b p-5 text-left align-bottom">
                  <div className="text-lg font-semibold">Choose your plan</div>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    Columns are ordered by each plan's display order.
                  </p>
                </th>
                {plans.map((p) => {
                  const popular = p.id === popularId;
                  return (
                    <th
                      key={p.id}
                      className={cn(
                        "border-b border-l p-5 text-left align-top",
                        popular && "bg-emerald-50/60 dark:bg-emerald-950/20",
                        !p.isActive && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">
                              {p.name}
                            </span>
                            {popular && (
                              <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-200">
                                Popular
                              </Badge>
                            )}
                            {!p.isActive && (
                              <Badge variant="secondary">Archived</Badge>
                            )}
                          </div>
                          {p.description && (
                            <p className="mt-1 max-w-[13rem] text-xs font-normal text-muted-foreground">
                              {p.description}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mr-2 -mt-2 shrink-0">
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
                      </div>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-bold tracking-tight">
                          ₹{Number(p.priceMonthly).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          / mo
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                        Order #{p.sortOrder}
                        {!p.isPublic && " · Hidden"}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.label} className={cn(i % 2 === 1 && "bg-muted/30")}>
                  <td className="border-b p-4 text-sm font-medium">
                    {row.label}
                  </td>
                  {plans.map((p) => {
                    const popular = p.id === popularId;
                    return (
                      <td
                        key={p.id}
                        className={cn(
                          "border-b border-l p-4 text-center",
                          popular && "bg-emerald-50/40 dark:bg-emerald-950/10",
                          !p.isActive && "opacity-60",
                        )}
                      >
                        {row.render(p)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={editing} />
    </>
  );
}
