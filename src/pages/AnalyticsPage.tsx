import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Ban,
  Clock,
  IndianRupee,
  Lock,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  useAccountAnalyticsQuery,
  useShopAnalyticsQuery,
} from "@/features/api/analyticsApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useAuth } from "@/hooks/useAuth";
import { isAccountAdmin } from "@/lib/roles";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import type { AccountAnalytics, ShopAnalytics } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import {
  DateRangePicker,
  defaultRange,
  type DateRangeValue,
} from "@/components/analytics/DateRangePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BAR = "#3b82f6";

function inr(v: string | number): string {
  return `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** 24h → "6 PM" style label. */
function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${period}`;
}

function chartTooltip(formatter?: (v: number) => string) {
  return (
    <Tooltip
      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
      contentStyle={{
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        fontSize: 12,
      }}
      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
      formatter={formatter ? (v: number) => [formatter(v), ""] : undefined}
    />
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" style={accent ? { color: accent } : undefined} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? <Skeleton className="h-7 w-20" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPage() {
  const { role } = useAuth();
  const { hasFeature } = useEntitlements();
  const canUse = hasFeature("can_use_analytics");
  // Brand (cross-branch) analytics is a higher tier + account-admin only.
  const showBrandTab =
    isAccountAdmin(role) && hasFeature("can_use_advanced_analytics");

  const [range, setRange] = useState<DateRangeValue>(defaultRange());

  if (!canUse) {
    return (
      <>
        <PageHeader
          title="Analytics"
          description="Sales, best sellers, peak times & coupon performance"
        />
        <LockedCard />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Sales, best sellers, peak times & coupon performance"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {showBrandTab ? (
        <Tabs defaultValue="branch">
          <TabsList>
            <TabsTrigger value="branch">Branch</TabsTrigger>
            <TabsTrigger value="brand">Brand (all branches)</TabsTrigger>
          </TabsList>
          <TabsContent value="branch" className="mt-4">
            <BranchAnalytics range={range} />
          </TabsContent>
          <TabsContent value="brand" className="mt-4">
            <BrandAnalytics range={range} />
          </TabsContent>
        </Tabs>
      ) : (
        <BranchAnalytics range={range} />
      )}
    </>
  );
}

function LockedCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Analytics not available</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Reports aren’t included in your current plan. Contact your
          administrator to upgrade.
        </p>
      </CardContent>
    </Card>
  );
}

function BranchAnalytics({ range }: { range: DateRangeValue }) {
  const branchId = useAppSelector(selectSelectedBranchId);
  const shopId = branchId === ALL_BRANCHES ? "" : branchId;

  const { data, isLoading, isFetching } = useShopAnalyticsQuery(
    { shopId, from: range.from, to: range.to },
    { skip: !shopId },
  );
  const loading = isLoading || isFetching || !data;

  if (!shopId) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Select a branch to view its analytics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ShopSelect />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total orders" value={data?.totalOrders ?? 0} icon={ShoppingBag} accent="#3b82f6" loading={loading} />
        <Kpi label="Revenue" value={data ? inr(data.revenue) : "—"} icon={TrendingUp} accent="#10b981" loading={loading} />
        <Kpi label="Avg order value" value={data ? inr(data.averageOrderValue) : "—"} icon={IndianRupee} loading={loading} />
        <Kpi label="Cancelled" value={data?.cancelledOrders ?? 0} icon={Ban} accent="#ef4444" loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BestSellers data={data} loading={loading} />
        <PeakHours data={data} loading={loading} />
      </div>

      <CouponReport data={data} loading={loading} />
    </div>
  );
}

function BrandAnalytics({ range }: { range: DateRangeValue }) {
  const { data, isLoading, isFetching } = useAccountAnalyticsQuery({
    from: range.from,
    to: range.to,
  });
  const loading = isLoading || isFetching || !data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total orders" value={data?.totalOrders ?? 0} icon={ShoppingBag} accent="#3b82f6" loading={loading} />
        <Kpi label="Revenue" value={data ? inr(data.revenue) : "—"} icon={TrendingUp} accent="#10b981" loading={loading} />
        <Kpi label="Avg order value" value={data ? inr(data.averageOrderValue) : "—"} icon={IndianRupee} loading={loading} />
        <Kpi
          label="Repeat rate"
          value={data ? `${Number(data.repeatRatePct).toFixed(1)}%` : "—"}
          icon={Users}
          accent="#8b5cf6"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Customers" value={data?.totalCustomers ?? 0} icon={Users} loading={loading} />
        <Kpi label="Returning" value={data?.returningCustomers ?? 0} icon={Users} accent="#8b5cf6" loading={loading} />
      </div>

      <BranchComparison data={data} loading={loading} />
    </div>
  );
}

function BranchComparison({
  data,
  loading,
}: {
  data?: AccountAnalytics;
  loading: boolean;
}) {
  const rows = [...(data?.branchComparison ?? [])].sort(
    (a, b) => Number(b.revenue) - Number(a.revenue),
  );
  const maxRevenue = rows.length ? Number(rows[0].revenue) || 1 : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Branch comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No branch activity in this period yet.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((b, i) => (
              <li key={b.shopId} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{b.branchName}</span>
                    <span className="shrink-0 font-medium">{inr(b.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(Number(b.revenue) / maxRevenue) * 100}%`,
                          backgroundColor: "#10b981",
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                      {b.orders} order{b.orders === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BestSellers({ data, loading }: { data?: ShopAnalytics; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Best selling products</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data || data.topProducts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No product sales in this period yet.
          </p>
        ) : (
          <ul className="divide-y">
            {data.topProducts.map((p, i) => {
              const max = data.topProducts[0].quantity || 1;
              return (
                <li key={p.name} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(p.quantity / max) * 100}%`, backgroundColor: BAR }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-medium">{p.quantity} sold</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PeakHours({ data, loading }: { data?: ShopAnalytics; loading: boolean }) {
  const rows = (data?.peakHours ?? []).map((p) => ({
    ...p,
    label: hourLabel(p.hour),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Peak ordering time</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No orders in this period yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                width={28}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              {chartTooltip((v) => `${v} order${v === 1 ? "" : "s"}`)}
              <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.hour} fill={BAR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function CouponReport({ data, loading }: { data?: ShopAnalytics; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          Coupon report
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : !data || data.couponReport.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No coupons were redeemed in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 text-right font-medium">Redemptions</th>
                  <th className="pb-2 text-right font-medium">Discount given</th>
                </tr>
              </thead>
              <tbody>
                {data.couponReport.map((c) => (
                  <tr key={c.code} className="border-b last:border-b-0">
                    <td className="py-2.5 font-mono font-medium">{c.code}</td>
                    <td className="py-2.5 text-right">{c.redemptions}</td>
                    <td className="py-2.5 text-right font-medium">{inr(c.totalDiscount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
