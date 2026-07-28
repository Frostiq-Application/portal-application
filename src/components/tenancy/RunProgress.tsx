import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "@/components/ui/icons";
import { useGetSyncRunQuery } from "@/features/api/tenancyApi";

/**
 * Live progress for a background fleet sync.
 *
 * Polls while the run is `running` and stops the moment it settles — a finished
 * run is immutable, so continuing to poll would just be noise. Rendered instead
 * of the result panel, because a background sync has no per-task results to
 * show until it is done.
 */
export function RunProgress({
  runId,
  onFinished,
}: {
  runId: string;
  onFinished?: () => void;
}) {
  const { data: run } = useGetSyncRunQuery(runId, {
    pollingInterval: 2000,
    skipPollingIfUnfocused: true,
  });

  const done = !!run && run.status !== "running";

  useEffect(() => {
    if (done) onFinished?.();
  }, [done, onFinished]);

  if (!run) return null;

  const settled = run.appliedCount + run.failedCount + run.skippedCount;
  const pct = run.totalTasks ? Math.round((settled / run.totalTasks) * 100) : 100;

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
        {!done && <Loader2 className="size-4 animate-spin" />}
        <span className="font-medium">
          {done ? "Fleet sync finished" : "Fleet sync running"}
        </span>
        <Badge
          variant={
            run.status === "succeeded"
              ? "success"
              : run.status === "running"
                ? "secondary"
                : run.status === "partial"
                  ? "warning"
                  : "destructive"
          }
        >
          {run.status}
        </Badge>
        <span className="text-muted-foreground">
          {settled}/{run.totalTasks} tasks · {run.appliedCount} applied
          {run.failedCount > 0 && ` · ${run.failedCount} failed`}
          {run.skippedCount > 0 && ` · ${run.skippedCount} skipped`}
        </span>
      </div>

      <div className="px-3 py-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              run.failedCount ? "bg-amber-500" : done ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {run.targetSchemas.length} schema{run.targetSchemas.length === 1 ? "" : "s"} ·{" "}
          {run.targetMigrations.length} migration
          {run.targetMigrations.length === 1 ? "" : "s"} · triggered {run.trigger}
        </p>
        {run.error && (
          <pre className="mt-2 max-h-24 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
            {run.error}
          </pre>
        )}
      </div>
    </div>
  );
}
