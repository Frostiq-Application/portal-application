import { Link } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Clock,
  IndianRupee,
  PauseCircle,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { roleLabel, isPlatformAdmin } from "@/lib/roles";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useBillingSummaryQuery } from "@/features/api/subscriptionsApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountStatusBadge } from "@/components/StatusBadge";
import { ShopDashboard } from "@/components/dashboard/ShopDashboard";
import type { AccountStatus } from "@/types";

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "—" : value}</div>
      </CardContent>
    </Card>
  );
}

function WelcomeBanner({ name }: { name?: string }) {
  return (
    <Card className="relative mb-6 overflow-hidden border-none bg-slate-50">
      <svg
        className="absolute inset-y-0 right-0 h-full w-1/2 min-w-[320px]"
        viewBox="0 0 640 160"
        preserveAspectRatio="xMaxYMid slice"
        aria-hidden="true"
      >
        {/* backdrop */}
        <rect width="640" height="160" fill="#e8effc" />
        <circle cx="420" cy="30" r="6" fill="#bfd3f5" />
        <circle cx="595" cy="18" r="4" fill="#bfd3f5" />
        <circle cx="330" cy="120" r="5" fill="#cfdcf7" />
        {/* tiered cake */}
        <g>
          <rect x="352" y="146" width="136" height="10" rx="4" fill="#94a3b8" />
          <rect x="368" y="96" width="104" height="52" rx="6" fill="#f6d0e0" />
          <path
            d="M368 102 q13 14 26 0 q13 14 26 0 q13 14 26 0 q13 14 26 0 v-8 h-104 z"
            fill="#fdf2f8"
          />
          <rect x="386" y="52" width="68" height="46" rx="6" fill="#f9a8c9" />
          <path
            d="M386 58 q8.5 12 17 0 q8.5 12 17 0 q8.5 12 17 0 q8.5 12 17 0 v-8 h-68 z"
            fill="#fdf2f8"
          />
          <rect x="417" y="30" width="6" height="24" rx="3" fill="#f43f5e" />
          <circle cx="420" cy="26" r="7" fill="#fbbf24" />
        </g>
        {/* cupcake with blue wrapper */}
        <g>
          <path d="M508 108 h64 l-10 48 h-44 z" fill="#2563eb" />
          <path d="M519 110 l6 44 M540 110 v44 M561 110 l-6 44" stroke="#1d4ed8" strokeWidth="4" />
          <path
            d="M506 108 q-8-26 14-26 q2-16 20-16 q18 0 20 16 q22 0 14 26 z"
            fill="#fdf2f8"
          />
          <circle cx="540" cy="60" r="7" fill="#f43f5e" />
        </g>
        {/* chocolate bar, blue wrapper half-open */}
        <g transform="rotate(-8 610 128)">
          <rect x="586" y="92" width="52" height="68" rx="4" fill="#7c4a21" />
          <line x1="612" y1="94" x2="612" y2="158" stroke="#5d3517" strokeWidth="3" />
          <line x1="588" y1="114" x2="636" y2="114" stroke="#5d3517" strokeWidth="3" />
          <line x1="588" y1="136" x2="636" y2="136" stroke="#5d3517" strokeWidth="3" />
          <path d="M582 122 h60 v42 q-30 10 -60 0 z" fill="#3b82f6" />
          <path d="M582 122 h60 l-8 10 h-44 z" fill="#60a5fa" />
        </g>
        {/* fade into card background */}
        <rect width="640" height="160" fill="url(#banner-fade)" />
        <defs>
          <linearGradient id="banner-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f8fafc" stopOpacity="1" />
            <stop offset="0.45" stopColor="#f8fafc" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <CardContent className="relative z-10 flex max-w-[60%] flex-col justify-center gap-1 py-8">
        <h2 className="text-2xl font-bold text-slate-900">
          Welcome back, {name ?? "Admin"}
        </h2>
        <p className="text-sm text-slate-600">
          Here&apos;s an overview of your site&apos;s content.
        </p>
      </CardContent>
    </Card>
  );
}

function useAccountCount(status?: AccountStatus) {
  const { data, isLoading } = useListAccountsQuery({ page: 1, limit: 1, status });
  return { total: data?.meta.total ?? 0, isLoading };
}

function PlatformDashboard() {
  const all = useAccountCount();
  const pending = useAccountCount("pending");
  const active = useAccountCount("active");
  const suspended = useAccountCount("suspended");
  const { data: pendingList } = useListAccountsQuery({
    page: 1,
    limit: 5,
    status: "pending",
  });
  const { data: billing } = useBillingSummaryQuery();

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total accounts" value={all.total} icon={Building2} loading={all.isLoading} />
        <StatCard label="Pending approval" value={pending.total} icon={Clock} loading={pending.isLoading} />
        <StatCard label="Active" value={active.total} icon={CheckCircle2} loading={active.isLoading} />
        <StatCard label="Suspended" value={suspended.total} icon={PauseCircle} loading={suspended.isLoading} />
        <StatCard
          label="MRR"
          value={billing ? `₹${Number(billing.mrr).toLocaleString("en-IN")}` : "—"}
          icon={TrendingUp}
          loading={!billing}
        />
        <StatCard
          label="Collected"
          value={billing ? `₹${Number(billing.totalCollected).toLocaleString("en-IN")}` : "—"}
          icon={IndianRupee}
          loading={!billing}
        />
        <StatCard label="Trials" value={billing?.trialSubscriptions ?? "—"} icon={Clock} loading={!billing} />
        <StatCard label="Overdue" value={billing?.overdue ?? "—"} icon={PauseCircle} loading={!billing} />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Awaiting approval</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/accounts">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!pendingList || pendingList.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No accounts are waiting for approval. 🎉
            </p>
          ) : (
            <ul className="divide-y">
              {pendingList.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.ownerEmail} · /{a.appSlug}
                    </p>
                  </div>
                  <AccountStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${roleLabel(user?.role)}`}
      />
      <WelcomeBanner name={user?.name} />
      {isPlatformAdmin(user?.role) ? <PlatformDashboard /> : <ShopDashboard />}
    </>
  );
}
