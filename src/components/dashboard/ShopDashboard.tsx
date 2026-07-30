import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { ArrowRight, Ban, IndianRupee, Receipt, ShoppingBag, Store, TrendingUp } from "@/components/ui/icons";
import { useShopAnalyticsQuery } from "@/features/api/analyticsApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import { ShopSelect } from "@/components/ShopSelect";
import {
  WishlistAnalytics,
  WishlistAnalyticsView,
} from "@/components/dashboard/WishlistAnalytics";
import { UpgradeOverlay } from "@/components/analytics/UpgradeOverlay";
import { TrialStatusStrip } from "@/components/billing/TrialStatusStrip";
import {
  PREVIEW_SHOP,
  PREVIEW_WISHLIST,
} from "@/components/analytics/previewData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShopAnalytics } from "@/types";

/**
 * Categorical palette — validated colorblind-safe against light & dark
 * surfaces (dataviz skill validate_palette.js). Assigned in fixed order.
 */
const SERIES = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
const DELIVERY_COLORS = { delivery: "#3b82f6", pickup: "#f59e0b" };

/** Order-status labels, in pipeline order. */
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

function inr(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  loading?: boolean;
  accent?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className="h-4 w-4 text-muted-foreground"
          style={accent ? { color: accent } : undefined}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? <Skeleton className="h-7 w-20" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

/** Shared recharts tooltip using theme tokens (not the series color). */
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
      formatter={
        formatter
          ? (v: number) => [formatter(v), ""]
          : undefined
      }
    />
  );
}

function StatusChart({ data }: { data: ShopAnalytics }) {
  const rows = Object.entries(data.statusBreakdown)
    .map(([status, count]) => ({
      status,
      label: STATUS_LABEL[status] ?? status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No orders in this period yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 40)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        {chartTooltip((v) => `${v} order${v === 1 ? "" : "s"}`)}
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {rows.map((r, i) => (
            <Cell
              key={r.status}
              fill={r.status === "cancelled" ? "#ef4444" : SERIES[i % SERIES.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DeliveryChart({ data }: { data: ShopAnalytics }) {
  const rows = [
    { key: "delivery", label: "Delivery", value: data.deliverySplit.delivery },
    { key: "pickup", label: "Pickup", value: data.deliverySplit.pickup },
  ].filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No fulfilled orders yet.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={180}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius={45}
            outerRadius={72}
            paddingAngle={2}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {rows.map((r) => (
              <Cell
                key={r.key}
                fill={DELIVERY_COLORS[r.key as keyof typeof DELIVERY_COLORS]}
              />
            ))}
          </Pie>
          {chartTooltip((v) => `${v} order${v === 1 ? "" : "s"}`)}
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor:
                  DELIVERY_COLORS[r.key as keyof typeof DELIVERY_COLORS],
              }}
            />
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground">
              {r.value} · {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShopDashboard() {
  const selectedBranch = useAppSelector(selectSelectedBranchId);
  // Analytics needs a concrete branch; the "all" sentinel isn't valid here.
  const shopId = selectedBranch === ALL_BRANCHES ? "" : selectedBranch;
  const { hasFeature } = useEntitlements();
  const canUseAnalytics = hasFeature("can_use_analytics");
  const canUseWishlist = hasFeature("can_use_wishlist_analytics");
  const { data, isLoading, isFetching } = useShopAnalyticsQuery(
    { shopId },
    // Without the feature the endpoint 403s, so don't ask — the locked view
    // renders from sample data instead.
    { skip: !shopId || !canUseAnalytics },
  );
  const loading = isLoading || isFetching || !data;

  // Same query key as ShopSelect's, so this reads its cache rather than firing
  // a second request. A brand with no branch yet has nothing to report on, and
  // the skipped analytics query would otherwise leave the page in skeletons
  // forever.
  const { data: shops, isLoading: shopsLoading } = useListShopsQuery({
    page: 1,
    limit: 100,
  });
  const hasNoBranches = !shopsLoading && (shops?.data.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      {/* Above the numbers, because a trial deadline outranks yesterday's
          revenue — and this is the screen people actually open. */}
      <TrialStatusStrip />

      {hasNoBranches ? (
        <NoBranchYet />
      ) : (
        <>
      <div className="flex items-center justify-end">
        <ShopSelect />
      </div>

      {/* The whole report, live or previewed. Every number here comes from the
          same plan-gated endpoint, so a locked plan blurs the lot rather than
          leaving a row of zeroed KPI cards behind an empty state. */}
      {canUseAnalytics ? (
        <OrderAnalytics data={data} loading={loading} />
      ) : (
        <UpgradeOverlay
          feature="can_use_analytics"
          description="Track revenue, order flow, delivery split and your best-selling products, branch by branch."
        >
          <OrderAnalytics data={PREVIEW_SHOP} loading={false} />
        </UpgradeOverlay>
      )}

      {/* Wishlist interest — what shoppers are saving vs. buying (Growth+) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Wishlist insights</h3>
          <p className="text-sm text-muted-foreground">
            What shoppers are saving for later — and how often it turns into an order.
          </p>
        </div>
        {canUseWishlist ? (
          shopId && <WishlistAnalytics shopId={shopId} />
        ) : (
          <UpgradeOverlay
            feature="can_use_wishlist_analytics"
            description="See what customers save but don’t buy, which products they save most, and the save→order conversion rate."
          >
            <WishlistAnalyticsView data={PREVIEW_WISHLIST} loading={false} />
          </UpgradeOverlay>
        )}
      </div>
        </>
      )}
    </div>
  );
}

/**
 * A brand that hasn't created a branch yet. Every number on this page is
 * per-branch, so there is nothing to show and nothing to load — say so, and
 * point at the one action that fixes it.
 */
function NoBranchYet() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
          <Store className="size-5 text-primary" />
        </div>
        <p className="text-sm font-medium">No branch yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Orders, revenue and product insights are all per branch. Create your
          first one to start seeing them here.
        </p>
        <Button asChild className="mt-2">
          <Link to="/shops">
            Add a branch
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** KPI cards, order charts and top products — live data or a blurred preview. */
function OrderAnalytics({
  data,
  loading,
}: {
  data?: ShopAnalytics;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total orders"
          value={data?.totalOrders ?? 0}
          icon={ShoppingBag}
          loading={loading}
          accent="#3b82f6"
        />
        <KpiCard
          label="Revenue"
          value={data ? inr(data.revenue) : "—"}
          icon={TrendingUp}
          loading={loading}
          accent="#10b981"
        />
        <KpiCard
          label="Avg order value"
          value={data ? inr(data.averageOrderValue) : "—"}
          icon={IndianRupee}
          loading={loading}
        />
        <KpiCard
          label="Pending payment"
          value={data ? inr(data.pendingPaymentTotal) : "—"}
          icon={Receipt}
          loading={loading}
          accent="#f59e0b"
        />
        <KpiCard
          label="Cancelled orders"
          value={data?.cancelledOrders ?? 0}
          icon={Ban}
          loading={loading}
          accent="#ef4444"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <StatusChart data={data} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery vs pickup</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <DeliveryChart data={data} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No product sales in this period yet.
            </p>
          ) : (
            <ul className="divide-y">
              {data.topProducts.map((p, i) => {
                const max = data.topProducts[0].quantity || 1;
                return (
                  <li
                    key={p.name}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-muted sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.quantity / max) * 100}%`,
                          backgroundColor: "#3b82f6",
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right font-medium">
                      {p.quantity} sold
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
