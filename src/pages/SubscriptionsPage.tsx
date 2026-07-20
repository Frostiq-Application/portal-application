import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  CreditCard,
  MoreHorizontal,
  Receipt,
  Store,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  BILLING_CYCLE_SHORT,
  RENEWAL_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  getRenewalInfo,
} from "@/lib/subscriptions";
import {
  useBillingSummaryQuery,
  useCancelSubscriptionMutation,
  useListSubscriptionsQuery,
} from "@/features/api/subscriptionsApi";
import {
  useGetAccountQuery,
  useListAccountsQuery,
} from "@/features/api/accountsApi";
import { useListPlansQuery } from "@/features/api/plansApi";
import type { Account, Subscription, SubscriptionStatus } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChangePlanDialog } from "@/components/subscriptions/ChangePlanDialog";
import { CreateSubscriptionDialog } from "@/components/subscriptions/CreateSubscriptionDialog";
import { MarkPaidDialog } from "@/components/subscriptions/MarkPaidDialog";
import { RenewalAlerts } from "@/components/subscriptions/RenewalAlerts";
import { SubscriptionDetailSheet } from "@/components/subscriptions/SubscriptionDetailSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FilterKey = "all" | "active" | "trial" | "due_soon" | "overdue";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "trial", label: "Trial" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
];

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warn" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "danger" && "text-red-600 dark:text-red-400",
          )}
        >
          {value}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scopedAccountId = searchParams.get("accountId") ?? undefined;

  const [filter, setFilter] = useState<FilterKey>("all");

  const { data: summary } = useBillingSummaryQuery();
  const { data, isLoading } = useListSubscriptionsQuery({
    page: 1,
    limit: 100,
    accountId: scopedAccountId,
  });
  const { data: accounts } = useListAccountsQuery({ page: 1, limit: 100 });
  const { data: plans } = useListPlansQuery({ page: 1, limit: 100 });
  const { data: scopedAccount } = useGetAccountQuery(scopedAccountId ?? "", {
    skip: !scopedAccountId,
  });

  const [cancelSub] = useCancelSubscriptionMutation();
  const [payTarget, setPayTarget] = useState<Subscription | null>(null);
  const [detailTarget, setDetailTarget] = useState<Subscription | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [changePlanTarget, setChangePlanTarget] = useState<Subscription | null>(
    null,
  );

  const accountName = useMemo(() => {
    const m = new Map((accounts?.data ?? []).map((a) => [a.id, a.name]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [accounts]);
  const accountLogo = useMemo(() => {
    const m = new Map(
      (accounts?.data ?? []).map((a) => [a.id, a.logoUrl] as const),
    );
    return (id: string) => m.get(id) ?? null;
  }, [accounts]);
  const planName = useMemo(() => {
    const m = new Map((plans?.data ?? []).map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [plans]);

  const allRows = data?.data ?? [];

  const rows = useMemo(() => {
    return allRows.filter((s) => {
      const r = getRenewalInfo(s.status, s.nextBillingDate);
      switch (filter) {
        case "active":
          return s.status === "active";
        case "trial":
          return s.status === "trial";
        case "due_soon":
          return r.urgency === "soon";
        case "overdue":
          return r.urgency === "overdue";
        default:
          return true;
      }
    });
  }, [allRows, filter]);

  const filterCounts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: allRows.length,
      active: 0,
      trial: 0,
      due_soon: 0,
      overdue: 0,
    };
    for (const s of allRows) {
      if (s.status === "active") c.active += 1;
      if (s.status === "trial") c.trial += 1;
      const r = getRenewalInfo(s.status, s.nextBillingDate);
      if (r.urgency === "soon") c.due_soon += 1;
      if (r.urgency === "overdue") c.overdue += 1;
    }
    return c;
  }, [allRows]);

  const clearScope = () => {
    searchParams.delete("accountId");
    setSearchParams(searchParams, { replace: true });
  };

  const doCancel = async (s: Subscription) => {
    try {
      await cancelSub(s.id).unwrap();
      toast.success("Subscription cancelled");
      setDetailTarget((d) => (d?.id === s.id ? null : d));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCancelTarget(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Billing contracts, renewals & payments"
        actions={
          <CreateSubscriptionDialog defaultAccountId={scopedAccountId} />
        }
      />

      {/* Account-scoped banner (arrived from a shop) */}
      {scopedAccountId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              Showing subscriptions for{" "}
              <strong>
                {(scopedAccount as Account | undefined)?.name ??
                  accountName(scopedAccountId)}
              </strong>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearScope}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All subscriptions
          </Button>
        </div>
      )}

      {!scopedAccountId && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="MRR"
            value={summary ? money(summary.mrr) : "—"}
            hint="Monthly recurring revenue"
          />
          <StatCard
            label="Collected"
            value={summary ? money(summary.totalCollected) : "—"}
            hint="All-time payments"
          />
          <StatCard
            label="Due soon"
            value={summary?.dueSoon ?? "—"}
            hint="Renewing within 7 days"
            tone={summary?.dueSoon ? "warn" : undefined}
          />
          <StatCard
            label="Overdue"
            value={summary?.overdue ?? "—"}
            hint="Past renewal date"
            tone={summary?.overdue ? "danger" : undefined}
          />
        </div>
      )}

      {/* Renewals needing attention */}
      <RenewalAlerts
        subscriptions={allRows}
        accountName={accountName}
        onRecordPayment={setPayTarget}
        onOpen={setDetailTarget}
      />

      {/* Filter segmented control */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                filter === f.key
                  ? "bg-primary-foreground/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {filterCounts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {allRows.length === 0
                    ? "No subscriptions yet."
                    : "No subscriptions match this filter."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => {
                const renewal = getRenewalInfo(s.status, s.nextBillingDate);
                const logo = accountLogo(s.accountId);
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setDetailTarget(s)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        {logo ? (
                          <img
                            src={logo}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full border object-cover"
                          />
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                            {accountName(s.accountId).slice(0, 2)}
                          </span>
                        )}
                        <span className="truncate">
                          {accountName(s.accountId)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{planName(s.planId)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          SUBSCRIPTION_STATUS_TONE[s.status],
                        )}
                      >
                        {SUBSCRIPTION_STATUS_LABEL[s.status]}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {money(s.priceAtSubscription)}
                      <span className="text-xs text-muted-foreground">
                        /{BILLING_CYCLE_SHORT[s.billingCycle]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {renewal.urgency === "none" ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            RENEWAL_TONE[renewal.urgency],
                          )}
                          title={formatDate(s.nextBillingDate)}
                        >
                          {renewal.label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailTarget(s)}>
                            <Receipt className="mr-2 h-4 w-4" />
                            View history
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPayTarget(s)}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Record payment
                          </DropdownMenuItem>
                          {s.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() => setChangePlanTarget(s)}
                            >
                              <ArrowLeftRight className="mr-2 h-4 w-4" />
                              Change plan
                            </DropdownMenuItem>
                          )}
                          {s.status !== "cancelled" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setCancelTarget(s)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}
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

      <SubscriptionDetailSheet
        subscription={detailTarget}
        accountName={detailTarget ? accountName(detailTarget.accountId) : ""}
        planName={detailTarget ? planName(detailTarget.planId) : ""}
        onOpenChange={(o) => !o && setDetailTarget(null)}
        onRecordPayment={setPayTarget}
        onChangePlan={setChangePlanTarget}
        onCancel={setCancelTarget}
      />

      <ChangePlanDialog
        subscription={changePlanTarget}
        accountName={
          changePlanTarget ? accountName(changePlanTarget.accountId) : ""
        }
        currentPlanName={
          changePlanTarget ? planName(changePlanTarget.planId) : ""
        }
        onOpenChange={(o) => !o && setChangePlanTarget(null)}
        onSuccess={(s) =>
          setDetailTarget((d) => (d?.id === s.id ? s : d))
        }
      />

      <MarkPaidDialog
        subscription={payTarget}
        onOpenChange={(o) => !o && setPayTarget(null)}
        onSuccess={(s) =>
          setDetailTarget((d) => (d?.id === s.id ? null : d))
        }
      />

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels{" "}
              <strong>
                {cancelTarget ? accountName(cancelTarget.accountId) : ""}
              </strong>
              &rsquo;s subscription and turns off auto-renew. Their app access
              may be blocked until a new subscription is created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && doCancel(cancelTarget)}
            >
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
