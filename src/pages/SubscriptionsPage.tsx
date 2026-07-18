import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  useBillingSummaryQuery,
  useCancelSubscriptionMutation,
  useListSubscriptionsQuery,
} from "@/features/api/subscriptionsApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useListPlansQuery } from "@/features/api/plansApi";
import type { Subscription, SubscriptionStatus } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateSubscriptionDialog } from "@/components/subscriptions/CreateSubscriptionDialog";
import { MarkPaidDialog } from "@/components/subscriptions/MarkPaidDialog";
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

const STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
  suspended: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function SubscriptionsPage() {
  const { data: summary } = useBillingSummaryQuery();
  const { data, isLoading } = useListSubscriptionsQuery({ page: 1, limit: 50 });
  const { data: accounts } = useListAccountsQuery({ page: 1, limit: 100 });
  const { data: plans } = useListPlansQuery({ page: 1, limit: 100 });
  const [cancelSub] = useCancelSubscriptionMutation();
  const [payTarget, setPayTarget] = useState<Subscription | null>(null);

  const accountName = useMemo(() => {
    const m = new Map((accounts?.data ?? []).map((a) => [a.id, a.name]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [accounts]);
  const planName = useMemo(() => {
    const m = new Map((plans?.data ?? []).map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [plans]);

  const rows = data?.data ?? [];

  const doCancel = async (id: string) => {
    try {
      await cancelSub(id).unwrap();
      toast.success("Subscription cancelled");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Billing contracts & payments"
        actions={<CreateSubscriptionDialog />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR" value={summary ? `₹${Number(summary.mrr).toLocaleString("en-IN")}` : "—"} />
        <StatCard label="Collected" value={summary ? `₹${Number(summary.totalCollected).toLocaleString("en-IN")}` : "—"} />
        <StatCard label="Active" value={summary?.activeSubscriptions ?? "—"} />
        <StatCard label="Overdue" value={summary?.overdue ?? "—"} />
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Next billing</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No subscriptions yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{accountName(s.accountId)}</TableCell>
                  <TableCell>{planName(s.planId)}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[s.status])}>
                      {s.status}
                    </span>
                  </TableCell>
                  <TableCell>₹{Number(s.priceAtSubscription).toLocaleString("en-IN")}/{s.billingCycle.slice(0, 2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(s.nextBillingDate)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPayTarget(s)}>
                          Record payment
                        </DropdownMenuItem>
                        {s.status !== "cancelled" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => doCancel(s.id)}>
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MarkPaidDialog subscription={payTarget} onOpenChange={(o) => !o && setPayTarget(null)} />
    </>
  );
}
