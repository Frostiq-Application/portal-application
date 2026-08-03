import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shaped like {@link AccountCard} — same banner, body and footer. */
export function AccountCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Banner */}
      <div className="relative aspect-video w-full shrink-0 bg-muted">
        <Skeleton className="absolute left-2 top-2 h-5 w-16 rounded-full" />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2.5">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>

      {/* Owner, slug, counts */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-5 w-24 rounded" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="mt-auto h-9 w-full rounded-md" />
      </div>
    </div>
  );
}

interface GridProps {
  count?: number;
  className?: string;
}

/** The card grid, in placeholder form — same columns and gutters as the real one. */
export function AccountCardSkeletonGrid({ count = 6, className }: GridProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <AccountCardSkeleton key={i} />
      ))}
    </div>
  );
}
