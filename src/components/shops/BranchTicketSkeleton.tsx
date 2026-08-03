import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shaped like the branch ticket — photo, headline, feature strip. */
export function BranchTicketSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Photo */}
      <div className="relative aspect-video w-full shrink-0 bg-muted">
        <Skeleton className="absolute bottom-2 left-2 h-5 w-16 rounded-full" />
      </div>

      {/* Headline + share button */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="mt-2 h-3 w-2/3" />
        <Skeleton className="mt-2.5 h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-full rounded-md" />
      </div>

      {/* Feature strip */}
      <div className="mt-auto grid grid-cols-3 divide-x border-t bg-muted/30">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface GridProps {
  count?: number;
  className?: string;
}

/** The branch grid, in placeholder form — same columns and gutters. */
export function BranchTicketSkeletonGrid({ count = 6, className }: GridProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <BranchTicketSkeleton key={i} />
      ))}
    </div>
  );
}
