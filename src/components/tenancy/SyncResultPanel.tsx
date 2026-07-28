import { Badge } from "@/components/ui/badge";
import type { SyncResult, SyncTaskResult } from "@/types/tenancy";

const STATUS_VARIANT: Record<
  SyncTaskResult["status"],
  "success" | "warning" | "destructive" | "secondary"
> = {
  applied: "success",
  skipped: "secondary",
  locked: "warning",
  failed: "destructive",
};

/**
 * Outcome of a sync, task by task. Shown after both dry runs and real applies —
 * the two differ only in the banner, because the value of a rehearsal is seeing
 * exactly the same breakdown you would get for real.
 */
export function SyncResultPanel({ result }: { result: SyncResult }) {
  const interesting = result.results.filter((r) => r.status !== "skipped");

  return (
    <div className="rounded-lg border">
      <div
        className={`flex flex-wrap items-center gap-2 rounded-t-lg px-3 py-2 text-sm ${
          result.dryRun
            ? "bg-muted"
            : result.failedCount
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}
      >
        <span className="font-medium">
          {result.dryRun ? "Rehearsal — rolled back, nothing changed" : "Applied"}
        </span>
        <span className="text-muted-foreground">
          {result.appliedCount}/{result.totalTasks} ok
          {result.failedCount > 0 && ` · ${result.failedCount} failed`}
          {result.skippedCount > 0 && ` · ${result.skippedCount} skipped`}
        </span>
      </div>

      {interesting.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          Nothing to do — every targeted tenant already matches the registry.
        </p>
      ) : (
        <ul className="divide-y">
          {interesting.map((r, i) => (
            <li key={`${r.schemaName}-${r.migrationId}-${i}`} className="px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{r.schemaName}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.migrationId}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.durationMs > 0 && (
                    <span className="text-xs text-muted-foreground">{r.durationMs}ms</span>
                  )}
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                </div>
              </div>
              {r.error && (
                <pre className="mt-1 max-h-24 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {r.error}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
