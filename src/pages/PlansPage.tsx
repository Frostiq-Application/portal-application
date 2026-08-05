import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, EyeOff, Gift, Pencil, Plus, Ticket, Users } from "@/components/ui/icons";
import {
  useAdminCyclesQuery,
  useAdminFeaturesQuery,
  useAdminPlansQuery,
  useArchivePlanMutation,
  useSetCycleActiveMutation,
  useSetFeatureActiveMutation,
} from "@/features/api/billingAdminApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { inr, inrShort } from "@/lib/billing";
import { cn } from "@/lib/utils";
import type { AdminPlan, BillingCycle, BillingFeature } from "@/types/billing";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanEditorDialog } from "@/components/billing/PlanEditorDialog";
import { FeatureEditorDialog } from "@/components/billing/FeatureEditorDialog";
import { CycleEditorDialog } from "@/components/billing/CycleEditorDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The plan row scrolls sideways instead of wrapping. `pb-2` keeps the cards'
 * shadow from being shaved off by the scroll container's clip.
 */
const PLAN_ROW_CLASS = "flex gap-4 overflow-x-auto pb-2";

/**
 * `shrink-0` is what forces the overflow: cards hold their floor width instead
 * of squeezing, so the row scrolls. `grow basis-*` still lets a short catalogue
 * spread across the full width.
 */
const PLAN_CARD_CLASS = "shrink-0 grow basis-[19rem]";

/**
 * The Super Admin catalogue (SA-01 … SA-10): what is sold, at what price, on
 * what cycles.
 *
 * Three tabs because they're three different jobs — plans are the packaging,
 * features are the building blocks, cycles are the billing rhythm.
 */
export function PlansPage() {
  const { data: plans, isLoading } = useAdminPlansQuery();
  const { data: features } = useAdminFeaturesQuery();
  const { data: cycles } = useAdminCyclesQuery();
  // 100 is the server's cap (`PaginationDto` is `@Max(100)`); asking for 200
  // fails validation, so this picker was silently coming back empty.
  const { data: accounts } = useListAccountsQuery({ page: 1, limit: 100 });

  const [archivePlan] = useArchivePlanMutation();
  const [setFeatureActive] = useSetFeatureActiveMutation();
  const [setCycleActive] = useSetCycleActiveMutation();

  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [featureEditing, setFeatureEditing] = useState<BillingFeature | null>(
    null,
  );
  const [featureOpen, setFeatureOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleEditing, setCycleEditing] = useState<BillingCycle | null>(null);

  const countFeatures = (features ?? []).filter((f) => f.dataType === "count");
  const unpricedAddons = countFeatures.filter(
    (f) => f.addonPriceMonthly == null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue"
        description="Plans, features and billing cycles: everything that defines what accounts can buy."
      />

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="cycles">Billing cycles</TabsTrigger>
        </TabsList>

        {/* ================================================== plans ======== */}
        <TabsContent value="plans" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditing(null);
                setPlanOpen(true);
              }}
            >
              <Plus className="size-4" />
              New plan
            </Button>
          </div>

          {/*
            One scrollable row rather than a wrapping grid: the catalogue grows a
            plan at a time, and side-by-side comparison is the whole point of this
            screen. Cards never go below PLAN_CARD_MIN — they grow to fill the row
            while they fit, and overflow into a horizontal scroll once they don't.
          */}
          {isLoading ? (
            <div className={PLAN_ROW_CLASS}>
              <Skeleton className={cn(PLAN_CARD_CLASS, "h-56 rounded-xl")} />
              <Skeleton className={cn(PLAN_CARD_CLASS, "h-56 rounded-xl")} />
              <Skeleton className={cn(PLAN_CARD_CLASS, "h-56 rounded-xl")} />
            </div>
          ) : (
            <div className={PLAN_ROW_CLASS}>
              {(plans ?? []).map((plan) => (
                <Card
                  key={plan.id}
                  className={cn(
                    PLAN_CARD_CLASS,
                    plan.isArchived && "opacity-60",
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                        {plan.name}
                        {plan.badge && (
                          <Badge variant="secondary">{plan.badge}</Badge>
                        )}
                        {plan.trialDays > 0 && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                          >
                            <Gift className="size-3" />
                            {plan.trialDays}-day trial
                          </Badge>
                        )}
                        {plan.visibility === "hidden" && (
                          <Badge variant="outline" className="gap-1">
                            <EyeOff className="size-3" />
                            Hidden
                          </Badge>
                        )}
                        {plan.isArchived && (
                          <Badge variant="outline">Archived</Badge>
                        )}
                      </CardTitle>
                      {plan.tagline && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {plan.tagline}
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        {inrShort(plan.priceMonthly)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /mo
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {plan.cyclePrices.map((c) => (
                          <span
                            key={c.code}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums"
                            title={`${c.payableMonths}× monthly`}
                          >
                            {c.name}: {inrShort(c.price)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="size-3.5" />
                      {plan.subscriberCount} subscriber
                      {plan.subscriberCount === 1 ? "" : "s"}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditing(plan);
                          setPlanOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={plan.isArchived ? "Restore" : "Archive"}
                        onClick={async () => {
                          try {
                            await archivePlan({
                              id: plan.id,
                              archived: !plan.isArchived,
                            }).unwrap();
                            toast.success(
                              plan.isArchived
                                ? `${plan.name} is back on sale.`
                                : `${plan.name} archived. Existing subscribers keep it; new signups can't pick it.`,
                            );
                          } catch {
                            toast.error("Couldn't update that plan.");
                          }
                        }}
                      >
                        {plan.isArchived ? (
                          <ArchiveRestore className="size-3.5" />
                        ) : (
                          <Archive className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Plans are never deleted. Archiving takes one off sale while every
            existing subscription carries on untouched.
          </p>
        </TabsContent>

        {/* ================================================ features ======= */}
        <TabsContent value="features" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Boolean features are obtained by upgrading a plan. They're never
              sold as add-ons. Count features are numeric limits, extendable with
              add-ons on any plan.
            </p>
            <Button
              onClick={() => {
                setFeatureEditing(null);
                setFeatureOpen(true);
              }}
            >
              <Plus className="size-4" />
              New feature
            </Button>
          </div>

          {unpricedAddons.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 py-4">
                <Ticket className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong className="font-semibold">
                    Add-on prices aren't set yet
                  </strong>{" "}
                  for {unpricedAddons.map((f) => f.label).join(", ")}. Until a
                  per-step price is configured, accounts can't buy extra capacity
                  for those.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Add-on</TableHead>
                      <TableHead>Trial cap</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(features ?? []).map((f) => (
                      <TableRow key={f.key}>
                        <TableCell>
                          <p className="font-medium">{f.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {f.key}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              f.dataType === "count" ? "secondary" : "outline"
                            }
                          >
                            {f.dataType === "count" ? "Count" : "Boolean"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {f.category}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {f.dataType !== "count" ? (
                            <span className="text-xs text-muted-foreground">
                              Plan only
                            </span>
                          ) : f.addonPriceMonthly == null ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              Not on sale
                            </span>
                          ) : (
                            <span className="text-sm tabular-nums">
                              {inr(f.addonPriceMonthly)} / +{f.addonStep}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {f.dataType === "count" ? (f.trialLimit ?? "-") : "-"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={f.isActive}
                            onCheckedChange={(v) =>
                              setFeatureActive({ key: f.key, isActive: v })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => {
                              setFeatureEditing(f);
                              setFeatureOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================== cycles ======= */}
        <TabsContent value="cycles" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              A cycle is total months plus free months, nothing else. The
              discount is always expressed as months free rather than a
              percentage, so it can never stack with itself. Adding a cycle needs
              no code change.
            </p>
            <Button
              onClick={() => {
                setCycleEditing(null);
                setCycleOpen(true);
              }}
            >
              <Plus className="size-4" />
              New cycle
            </Button>
          </div>

          <Card>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Months</TableHead>
                      <TableHead>Free</TableHead>
                      <TableHead>Multiplier</TableHead>
                      <TableHead>At ₹2,499/mo</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(cycles ?? []).map((c) => {
                      const payable = c.months - c.freeMonths;
                      return (
                        <TableRow key={c.code}>
                          <TableCell>
                            <p className="font-medium">{c.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {c.code}
                            </p>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {c.months}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {c.freeMonths}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payable}×</Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {inrShort(2499 * payable)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={c.isActive}
                              onCheckedChange={(v) =>
                                setCycleActive({ code: c.code, isActive: v })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title={`Edit ${c.name}`}
                              onClick={() => {
                                setCycleEditing(c);
                                setCycleOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PlanEditorDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        plan={editing}
        features={features ?? []}
        cycles={cycles ?? []}
        accounts={(accounts?.data ?? []).map((a) => ({
          id: a.id,
          name: a.name,
        }))}
      />
      <FeatureEditorDialog
        open={featureOpen}
        onOpenChange={setFeatureOpen}
        feature={featureEditing}
      />
      <CycleEditorDialog
        open={cycleOpen}
        onOpenChange={setCycleOpen}
        cycle={cycleEditing}
      />
    </div>
  );
}
