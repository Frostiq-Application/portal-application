/**
 * Standalone, backend-free replica of the owner (account_super_admin) dashboard.
 * Reuses the portal's real UI primitives + the ShopDashboard rendering code with
 * hardcoded sample data, so it can be screenshotted for marketing without a login
 * or API. Mounted at the public route `/demo-dashboard`. Not part of the app flow.
 */
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
import {
  Ban,
  BarChart3,
  Bell,
  Cake,
  CalendarClock,
  Contact,
  CakeSlice,
  CreditCard,
  IndianRupee,
  LayoutDashboard,
  Moon,
  Plus,
  Receipt,
  ShoppingBag,
  Store,
  Tags,
  TrendingUp,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const SERIES = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
const DELIVERY_COLORS = { delivery: "#3b82f6", pickup: "#f59e0b" };

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DATA = {
  totalOrders: 128,
  revenue: 94200,
  averageOrderValue: 736,
  pendingPaymentTotal: 12400,
  cancelledOrders: 3,
  statusBreakdown: {
    completed: 42,
    confirmed: 14,
    preparing: 9,
    placed: 8,
    ready: 7,
    cancelled: 3,
  } as Record<string, number>,
  deliverySplit: { delivery: 38, pickup: 52 },
  topProducts: [
    { name: "Velvet Truffle · 1 Kg", quantity: 64 },
    { name: "Berry Cupcakes · Box of 6", quantity: 48 },
    { name: "Belgian Chocolate Box", quantity: 36 },
    { name: "Lemon Drizzle · 500 g", quantity: 29 },
    { name: "Red Velvet · 2 Kg", quantity: 22 },
  ],
};

function inr(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const NAV: { group: string; items: { label: string; icon: LucideIcon; active?: boolean }[] }[] = [
  { group: "Overview", items: [{ label: "Dashboard", icon: LayoutDashboard, active: true }] },
  {
    group: "Operations",
    items: [
      { label: "Orders", icon: ShoppingBag },
      { label: "Catalog", icon: Cake },
      { label: "Customers", icon: Contact },
      { label: "Custom Cakes", icon: CakeSlice },
    ],
  },
  {
    group: "Brand",
    items: [
      { label: "Branches", icon: Store },
      { label: "Scheduling", icon: CalendarClock },
      { label: "Analytics", icon: BarChart3 },
      { label: "Team", icon: UsersIcon },
    ],
  },
  {
    group: "Configuration",
    items: [
      { label: "Coupons", icon: Tags },
      { label: "Subscription", icon: CreditCard },
    ],
  },
];

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  accent?: string;
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
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusChart() {
  const rows = Object.entries(DATA.statusBreakdown)
    .map(([status, count]) => ({ status, label: STATUS_LABEL[status] ?? status, count }))
    .sort((a, b) => b.count - a.count);
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 40)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {rows.map((r, i) => (
            <Cell key={r.status} fill={r.status === "cancelled" ? "#ef4444" : SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DeliveryChart() {
  const rows = [
    { key: "delivery", label: "Delivery", value: DATA.deliverySplit.delivery },
    { key: "pickup", label: "Pickup", value: DATA.deliverySplit.pickup },
  ];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={180}>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="label" innerRadius={45} outerRadius={72} paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
            {rows.map((r) => (
              <Cell key={r.key} fill={DELIVERY_COLORS[r.key as keyof typeof DELIVERY_COLORS]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: DELIVERY_COLORS[r.key as keyof typeof DELIVERY_COLORS] }} />
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

export function DemoDashboardPage() {
  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Cake className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Bloom &amp; Batter</p>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>
        <nav className="flex flex-col gap-6 px-3 py-4">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {g.group}
              </p>
              <div className="flex flex-col gap-1">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span
                      key={item.label}
                      className={
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                        (item.active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/80 hover:bg-muted")
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                      {item.label === "Orders" && (
                        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Order
            </Button>
            <Button variant="ghost" size="icon" title="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Toggle theme">
              <Moon className="h-5 w-5" />
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback>AK</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Header row with shop selector */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, Aisha — here&apos;s how Bloom &amp; Batter is doing.
                </p>
              </div>
              <button className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm">
                <Store className="h-4 w-4 text-muted-foreground" />
                Koregaon Park
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard label="Total orders" value={DATA.totalOrders} icon={ShoppingBag} accent="#3b82f6" />
              <KpiCard label="Revenue" value={inr(DATA.revenue)} icon={TrendingUp} accent="#10b981" />
              <KpiCard label="Avg order value" value={inr(DATA.averageOrderValue)} icon={IndianRupee} />
              <KpiCard label="Pending payment" value={inr(DATA.pendingPaymentTotal)} icon={Receipt} accent="#f59e0b" />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Orders by status</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Delivery vs pickup</CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryChart />
                </CardContent>
              </Card>
            </div>

            {/* Top products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top products</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {DATA.topProducts.map((p, i) => {
                    const max = DATA.topProducts[0].quantity || 1;
                    return (
                      <li key={p.name} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full rounded-full" style={{ width: `${(p.quantity / max) * 100}%`, backgroundColor: "#3b82f6" }} />
                        </div>
                        <span className="w-14 shrink-0 text-right font-medium">{p.quantity} sold</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
