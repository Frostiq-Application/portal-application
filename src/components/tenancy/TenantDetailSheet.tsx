import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, PlayCircle, RefreshCw } from "@/components/ui/icons";
import {
  useGetTenantQuery,
  useSyncTenantMutation,
} from "@/features/api/tenancyApi";
import { formatDate } from "@/lib/utils";
import type { SyncResult } from "@/types/tenancy";
import { MigrationStateBadge } from "./TenantHealthBadge";
import { migrationStateHint } from "@/lib/tenancy";
import { SyncResultPanel } from "./SyncResultPanel";

/**
 * One tenant's migration ledger, always structurally verified — opening this
 * sheet is the moment you actually want the slow, truthful check rather than
 * the cached list view.
 */
export function TenantDetailSheet({
  schema,
  onOpenChange,
}: {
  schema: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isFetching, refetch } = useGetTenantQuery(schema as string, {
    skip: !schema,
  });
  const [sync, { isLoading: syncing }] = useSyncTenantMutation();
  const [result, setResult] = useState<SyncResult | null>(null);

  const pending = data?.migrations.filter((m) => m.state !== "applied") ?? [];

  async function run(dryRun: boolean) {
    if (!schema) return;
    try {
      const res = await sync({ schema, dryRun }).unwrap();
      setResult(res);
      toast[res.failedCount ? "error" : "success"](
        dryRun
          ? `Rehearsal: ${res.appliedCount} would apply, ${res.failedCount} would fail`
          : `${res.appliedCount} applied, ${res.failedCount} failed`,
      );
      if (!dryRun) refetch();
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? "Sync failed");
    }
  }

  return (
    <Sheet
      open={!!schema}
      onOpenChange={(o) => {
        if (!o) setResult(null);
        onOpenChange(o);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{schema}</SheetTitle>
          <SheetDescription>
            {data?.meta?.accountName ? (
              <>
                {data.meta.accountName}
                {data.meta.appSlug && (
                  <span className="text-muted-foreground"> · {data.meta.appSlug}</span>
                )}
              </>
            ) : (
              "No account maps to this schema."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run(true)} disabled={syncing || !pending.length}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            Dry run
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => run(false)}
            disabled={syncing || !pending.length}
          >
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sync {pending.length ? `(${pending.length})` : ""}
          </Button>
        </div>
        {!pending.length && !isFetching && (
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing pending. This tenant matches the registry.
          </p>
        )}

        {result && (
          <div className="mt-4">
            <SyncResultPanel result={result} />
          </div>
        )}

        <Separator className="my-5" />

        <div className="space-y-3">
          {isFetching && !data
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            : data?.migrations.map((m) => (
                <div key={m.migrationId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {m.migrationId}
                      </p>
                      <p className="mt-0.5 text-sm">{m.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <MigrationStateBadge state={m.state} />
                      <Badge variant="outline" className="text-[10px]">
                        {m.kind}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {migrationStateHint(m.state)}
                  </p>

                  {m.appliedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(m.appliedAt)}
                      {m.durationMs != null && ` · ${m.durationMs}ms`}
                    </p>
                  )}
                  {m.error && (
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
                      {m.error}
                    </pre>
                  )}
                </div>
              ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
