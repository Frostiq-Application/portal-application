import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "@/components/ui/icons";
import {
  useListSyncRunsQuery,
  useListTenantMigrationsQuery,
  useListTenantsQuery,
  useSyncFleetMutation,
} from "@/features/api/tenancyApi";
import { formatDate } from "@/lib/utils";
import type { SyncResult } from "@/types/tenancy";
import { TenantHealthBadge } from "@/components/tenancy/TenantHealthBadge";
import { TenantDetailSheet } from "@/components/tenancy/TenantDetailSheet";
import { SyncResultPanel } from "@/components/tenancy/SyncResultPanel";
import { RunProgress } from "@/components/tenancy/RunProgress";

/**
 * Super Admin → Tenancy.
 *
 * Under schema-per-account, a released feature is only half-shipped: the code
 * is live for everyone, but the schema change lands per tenant. This page is
 * where you see who is behind and roll the change out — with a rehearsal step,
 * because the alternative is finding out from a customer.
 */
export function TenancyPage() {
  const [structural, setStructural] = useState(false);
  const [openSchema, setOpenSchema] = useState<string | null>(null);
  const [fleetResult, setFleetResult] = useState<SyncResult | null>(null);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);

  const { data: tenants, isLoading, isFetching, refetch } = useListTenantsQuery(
    { structural },
    { refetchOnMountOrArgChange: true },
  );
  const { data: catalogue } = useListTenantMigrationsQuery();
  const { data: runs, refetch: refetchRuns } = useListSyncRunsQuery({ limit: 15 });
  const [syncFleet, { isLoading: syncing }] = useSyncFleetMutation();

  const stats = useMemo(() => {
    const rows = tenants ?? [];
    return {
      total: rows.length,
      healthy: rows.filter((t) => t.health === "healthy").length,
      behind: rows.filter((t) => t.pendingCount > 0 && !t.orphaned).length,
      trouble: rows.filter((t) => t.driftCount > 0 || t.failedCount > 0).length,
      orphaned: rows.filter((t) => t.orphaned).length,
    };
  }, [tenants]);

  async function runFleet(dryRun: boolean) {
    try {
      // Real fleet syncs go to the background: at any real tenant count the
      // work outlives the request. Dry runs stay inline — they roll back and
      // are never recorded, so there is no run to poll.
      const background = !dryRun;
      const res = await syncFleet({ dryRun, repair: structural, background }).unwrap();

      if (res.background && res.runId) {
        setFleetResult(null);
        setLiveRunId(res.runId);
        toast.info(`Syncing ${res.totalTasks} task(s) in the background`);
        return;
      }

      setFleetResult(res);
      setLiveRunId(null);
      toast[res.failedCount ? "error" : "success"](
        dryRun
          ? `Rehearsal: ${res.appliedCount} would apply across the fleet`
          : `${res.appliedCount} applied, ${res.failedCount} failed`,
      );
      if (!dryRun) refetch();
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? "Sync failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Tenancy"
        description="Every brand gets its own Postgres schema. New features and fixes land here, tenant by tenant."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => runFleet(true)} disabled={syncing}>
              <PlayCircle className="size-4" />
              Dry run all
            </Button>
            <Button size="sm" onClick={() => runFleet(false)} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
              Sync all
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tenants" value={stats.total} />
        <StatCard label="Up to date" value={stats.healthy} tone="good" />
        <StatCard label="Behind" value={stats.behind} tone={stats.behind ? "warn" : undefined} />
        <StatCard
          label="Needs attention"
          value={stats.trouble}
          tone={stats.trouble ? "bad" : undefined}
        />
      </div>

      {liveRunId && (
        <div className="mb-5">
          <RunProgress
            runId={liveRunId}
            onFinished={() => {
              refetch();
              refetchRuns();
            }}
          />
        </div>
      )}

      {fleetResult && !liveRunId && (
        <div className="mb-5">
          <SyncResultPanel result={fleetResult} />
        </div>
      )}

      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="runs">History</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <Switch id="structural" checked={structural} onCheckedChange={setStructural} />
            <Label htmlFor="structural" className="text-sm font-normal">
              Deep check
            </Label>
            <span className="text-xs text-muted-foreground">
              Re-reads the live schema instead of trusting the ledger. Catches restores and manual
              edits, and lets "Sync all" repair them. Slower.
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schema</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Applied</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead>Last sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tenants ?? []).map((t) => (
                      <TableRow
                        key={t.schemaName}
                        className="cursor-pointer"
                        onClick={() => setOpenSchema(t.schemaName)}
                      >
                        <TableCell className="font-mono text-xs">
                          {t.schemaName}
                          {t.schemaName === "tenant_template" && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              blueprint
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.accountName ?? (
                            <span className="text-muted-foreground">
                              {t.orphaned ? "No account" : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <TenantHealthBadge health={t.health} />
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {t.appliedCount}/{t.totalMigrations}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {t.pendingCount || (
                            <CheckCircle2 className="ml-auto size-4 text-emerald-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.lastSyncedAt ? formatDate(t.lastSyncedAt) : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {stats.orphaned > 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              {stats.orphaned} schema{stats.orphaned > 1 ? "s have" : " has"} no owning account —
              left behind when a brand was deleted. They are still migrated so they stay restorable,
              but they are safe to drop once you are sure.
            </p>
          )}
        </TabsContent>

        <TabsContent value="migrations" className="mt-4">
          <div className="grid gap-3">
            {(catalogue ?? []).map((m) => {
              const complete = m.appliedTenants === m.totalTenants;
              return (
                <Card key={m.migrationId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="font-mono text-xs font-normal text-muted-foreground">
                          {m.migrationId}
                        </CardTitle>
                        <p className="mt-1 text-sm">{m.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {m.kind}
                        </Badge>
                        <Badge variant={complete ? "success" : "warning"}>
                          {m.appliedTenants}/{m.totalTenants}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{
                          width: `${m.totalTenants ? (m.appliedTenants / m.totalTenants) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead>Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{formatDate(r.startedAt)}</TableCell>
                      <TableCell className="text-xs">{r.trigger}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "succeeded"
                              ? "success"
                              : r.status === "running"
                                ? "secondary"
                                : r.status === "partial"
                                  ? "warning"
                                  : "destructive"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {r.appliedCount}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {r.failedCount}
                      </TableCell>
                      <TableCell className="max-w-[18rem] truncate font-mono text-xs text-muted-foreground">
                        {r.targetSchemas.length > 2
                          ? `${r.targetSchemas.length} schemas`
                          : r.targetSchemas.join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!runs?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No syncs recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TenantDetailSheet
        schema={openSchema}
        onOpenChange={(o) => !o && setOpenSchema(null)}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "bad";
}) {
  const colour =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-destructive"
          : "";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${colour}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
