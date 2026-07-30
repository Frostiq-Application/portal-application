import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Heart, Package, ShoppingCart } from "@/components/ui/icons";
import { useWishlistAnalyticsQuery } from "@/features/api/analyticsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WishlistAnalytics as WishlistAnalyticsData } from "@/types";

const ACCENT = "#8b5cf6"; // wishlist accent (violet), from the shared palette

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Compact tooltip reusing theme tokens (matches ShopDashboard). */
function trendTooltip() {
  return (
    <Tooltip
      cursor={{ stroke: "hsl(var(--border))" }}
      contentStyle={{
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        fontSize: 12,
      }}
      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
      formatter={(v: number) => [`${v} save${v === 1 ? "" : "s"}`, ""]}
    />
  );
}

function MiniKpi({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${ACCENT}1a` }}
      >
        <Icon className="h-4 w-4" style={{ color: ACCENT }} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <div className="text-lg font-bold">
          {loading ? <Skeleton className="h-5 w-12" /> : value}
        </div>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: WishlistAnalyticsData }) {
  // Running cumulative net saves reads better than noisy per-day deltas. Built
  // with a plain loop rather than a `map` closing over a counter: the running
  // total is only clamped for display, so it has to stay a true cumulative.
  const rows: { date: string; saves: number }[] = [];
  let running = 0;
  for (const p of data.trend) {
    running += p.saves;
    rows.push({ date: p.date.slice(5), saves: Math.max(0, running) });
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No wishlist activity in this period yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={rows} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="wishlistFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          width={28}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        {trendTooltip()}
        <Area
          type="monotone"
          dataKey="saves"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#wishlistFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MostWishlisted({ data }: { data: WishlistAnalyticsData }) {
  if (data.topProducts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No saved products in this period yet.
      </p>
    );
  }
  const max = data.topProducts[0].saves || 1;

  return (
    <ul className="divide-y">
      {data.topProducts.map((p, i) => (
        <li key={p.productId} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
            {i + 1}
          </span>
          {p.image ? (
            <img
              src={p.image}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Package className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className="h-full rounded-full"
              style={{ width: `${(p.saves / max) * 100}%`, backgroundColor: ACCENT }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-medium">
            {p.saves} saved
          </span>
          <span
            className="w-20 shrink-0 text-right text-xs text-muted-foreground"
            title={`${p.ordered} of ${p.saves} savers ordered it`}
          >
            {pct(p.conversionRate)} conv.
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Wishlist interest analytics for the selected branch. Renders alongside the
 * order analytics; caller is responsible for the plan gate + providing shopId.
 */
export function WishlistAnalytics({
  shopId,
  from,
  to,
}: {
  shopId: string;
  from?: string;
  to?: string;
}) {
  const { data, isLoading, isFetching } = useWishlistAnalyticsQuery(
    { shopId, from, to },
    { skip: !shopId },
  );

  return (
    <WishlistAnalyticsView data={data} loading={isLoading || isFetching || !data} />
  );
}

/**
 * The charts alone, fed from props. Split out from the fetching wrapper so a
 * plan-locked section can render the identical report from sample data without
 * calling an endpoint that would 403.
 */
export function WishlistAnalyticsView({
  data,
  loading,
}: {
  data?: WishlistAnalyticsData;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniKpi
          label="Total saves"
          value={data?.totalSaves ?? 0}
          icon={Heart}
          loading={loading}
        />
        <MiniKpi
          label="Products wishlisted"
          value={data?.uniqueProducts ?? 0}
          icon={Package}
          loading={loading}
        />
        <MiniKpi
          label="Wishlist → order"
          value={data ? pct(data.overallConversionRate) : "—"}
          icon={ShoppingCart}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Saves over time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <TrendChart data={data} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Most wishlisted</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <MostWishlisted data={data} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
