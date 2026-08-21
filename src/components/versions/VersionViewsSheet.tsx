import { useVersionViewsQuery } from "@/features/api/versionsApi";
import { roleLabel } from "@/lib/roles";
import { formatDateTime } from "@/lib/billing";
import type { AppVersion } from "@/types/versions";
import type { Role } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The read log for one release — the answer to "did this actually reach
 * anyone", which is the whole reason the seen state is a table rather than
 * something kept in each browser.
 */
export function VersionViewsSheet({
  version,
  onOpenChange,
}: {
  /** null closes the sheet. */
  version: AppVersion | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isFetching } = useVersionViewsQuery(version?.id ?? "", {
    skip: !version,
  });

  return (
    <Sheet open={Boolean(version)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Who has read {version?.version}</SheetTitle>
          <SheetDescription>
            {data
              ? `${data.seen.length} read it, ${data.pending} still to see it.`
              : "Loading the read log…"}
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-6 mt-4 flex-1 overflow-y-auto px-6">
          {isFetching && !data ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (data?.seen.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nobody has opened this note yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data?.seen.map((view) => (
                <li key={view.userId} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{view.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {view.accountName
                        ? `${view.accountName} · ${roleLabel(view.role as Role)}`
                        : roleLabel(view.role as Role)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(view.seenAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
