import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Loader2, PlayCircle, RefreshCw, Search, X, Zap } from "@/components/ui/icons";
import {
  useAdminSubscriptionsQuery,
  useBillingReportsQuery,
  useRunBillingCycleMutation,
} from "@/features/api/billingAdminApi";
import {
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  inr,
  inrShort,
  relativeDays,
} from "@/lib/billing";
import { cn, formatDate } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubscriptionDetailSheet } from "@/components/billing/SubscriptionDetailSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES: SubscriptionStatus[] = [
  "trial",
  "active",
  "grace",
  "locked",
  "cancelled",
];

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warn" | "bad";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold tabular-nums",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "bad" && "text-destructive",
          )}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Subscription oversight (SA-15/18).
 *
 * The table leads with what a platform admin actually scans for: who's about to
 * renew, who's in dunning, and who has a change queued. Money summaries sit on
 * top so the health of the book is legible before any row is read.
 */
export function SubscriptionsPage() {
  const [status, setStatus] = useState<SubscriptionStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  // The Accounts page links here as `?accountId=…` to answer "what is this one
  // brand on?". Without honouring it that link dropped the admin into the
  // unfiltered book of every subscription — technically a page, practically a
  // dead end.
  const [params, setParams] = useSearchParams();
  const accountId = params.get("accountId");

  const { data, isLoading, isFetching } = useAdminSubscriptionsQuery({
    page,
    limit: 20,
    ...(status !== "all" ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(accountId ? { accountId } : {}),
  });
  const { data: reports } = useBillingReportsQuery();
  const [runCycle, { isLoading: running }] = useRunBillingCycleMutation();

  const mrr = (reports?.revenueByPlan ?? []).reduce(
    (s, r) => s + Number(r.mrr),
    0,
  );
  const counts = reports?.statusCounts ?? {};
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Every account's plan, renewal, dunning state and scheduled changes."
        actions={
          <Button
          variant="outline"
          disabled={running}
          onClick={async () => {
            try {
              const result = await runCycle().unwrap();
              toast.success(
                `Sweep done: ${result.renewalsProcessed} renewal(s), ${result.charged} charged, ${result.movedToGrace} into grace, ${result.locked} locked, ${result.remindersSent} reminder(s).`,
              );
            } catch {
              toast.error("Couldn't run the billing sweep.");
            }
          }}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PlayCircle className="size-4" />
          )}
            Run billing sweep
          </Button>
        }
      />

      {/* ---- health ------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="MRR"
          value={inrShort(mrr)}
          hint="Live subscriptions, normalised monthly"
        />
        <Stat label="Active" value={counts.active ?? 0} hint="Paying" />
        <Stat label="Trials" value={counts.trial ?? 0} hint="No card yet" />
        <Stat
          label="In grace"
          value={counts.grace ?? 0}
          hint="Storefront still live"
          tone={counts.grace ? "warn" : undefined}
        />
        <Stat
          label="Locked"
          value={counts.locked ?? 0}
          hint="Storefront offline"
          tone={counts.locked ? "bad" : undefined}
        />
      </div>

      {(reports?.failedPayments30d ?? 0) > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong className="font-semibold">
                {reports!.failedPayments30d} failed payment
                {reports!.failedPayments30d === 1 ? "" : "s"}
              </strong>{" "}
              in the last 30 days. Accounts in grace are still serving customers.
              Retries run on days 1, 3, 5 and 7.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- filters ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by account name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as SubscriptionStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SUBSCRIPTION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {accountId && (
          <Badge variant="outline" className="gap-1.5 py-1.5">
            One account
            <button
              type="button"
              aria-label="Show all accounts"
              onClick={() => {
                setParams({}, { replace: true });
                setPage(1);
              }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}
        {isFetching && (
          <RefreshCw className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* ---- table -------------------------------------------------------- */}
      <Card>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-2 px-6 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (data?.data ?? []).length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No subscriptions match those filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Renews</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.data.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(row.id)}
                    >
                      <TableCell>
                        <p className="font-medium">{row.accountName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.ownerEmail}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p>{row.planName}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {row.billingCycle}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className={SUBSCRIPTION_STATUS_TONE[row.status]}>
                          {SUBSCRIPTION_STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.currentPeriodEnd)}
                        <p className="text-xs text-muted-foreground">
                          {relativeDays(row.currentPeriodEnd)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inr(row.lockedMonthlyPrice)}
                      </TableCell>
                      <TableCell>
                        {row.autopayEnabled ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Zap className="size-3.5 text-amber-500" />
                            Autopay
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Manual
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.dunningAttempt > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              Retry {row.dunningAttempt}
                            </Badge>
                          )}
                          {row.hasScheduledChange && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <CalendarClock className="size-3" />
                              Change queued
                            </Badge>
                          )}
                          {row.cancelAtPeriodEnd && (
                            <Badge variant="outline" className="text-xs">
                              Cancelling
                            </Badge>
                          )}
                          {row.deleteReadyAt && (
                            <Badge variant="destructive" className="text-xs">
                              Delete-ready
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Read defensively: a pagination footer is never worth white-screening
          the whole page over if the envelope shape ever shifts again. */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} · {meta.total} subscriptions
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ---- reports ------------------------------------------------------ */}
      {reports && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revenue by plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.revenueByPlan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No live subscriptions yet.
                </p>
              ) : (
                reports.revenueByPlan.map((r, i) => (
                  <div
                    key={`${r.plan}-${r.cycle}-${i}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {r.plan}
                      <span className="ml-1 text-xs capitalize text-muted-foreground">
                        {r.cycle}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {inrShort(r.mrr)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {r.subscribers}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Coupon performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.couponPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No coupons created yet.
                </p>
              ) : (
                reports.couponPerformance.slice(0, 8).map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate font-mono text-xs">{c.code}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.redemptions} used · {inrShort(c.discountGiven)} given
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Why accounts leave</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.cancellations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No cancellations. Good.
                </p>
              ) : (
                reports.cancellations.map((c) => (
                  <div
                    key={c.reason}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate capitalize">
                      {c.reason.replace(/_/g, " ")}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.count}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <SubscriptionDetailSheet
        subscriptionId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}
