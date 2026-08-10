import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export interface FloorOrderCardSkeletonProps {
  /** The lane's colour, so the placeholder wears the same left edge as a real card. */
  accent: string;
  /** Position in the lane — staggers the pulse the way real cards stagger their deal-in. */
  index: number;
  /** Reserve the address block the delivery board renders under the items. */
  withDetail?: boolean;
  /** Item rows to draw. Two is the common case; one keeps the column from looking uniform. */
  items?: number;
}

/**
 * Placeholder shaped like {@link FloorOrderCard} — same grab bar, item rows and
 * button row, at the same heights.
 *
 * Matching the real card's anatomy rather than dropping in a plain block is the
 * whole point of it: the board settles into place instead of jumping a lane's
 * worth of height the moment the orders land, and someone glancing at a tablet
 * across the bench can already see how many cakes are coming before they can
 * read what they are.
 */
export function FloorOrderCardSkeleton({
  accent,
  index,
  withDetail,
  items = 2,
}: FloorOrderCardSkeletonProps) {
  return (
    <Card
      aria-hidden
      style={{
        borderLeftColor: `${accent}66`,
        animationDelay: `${Math.min(index, 8) * 45}ms`,
      }}
      className="select-none rounded-2xl border-l-[6px] motion-safe:animate-card-in"
    >
      {/* Grab bar: grip, order number, then the deadline on the right. */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 pt-4">
        {/* What to make — quantity chip, product name, variant line. */}
        <ul className="grid gap-3">
          {Array.from({ length: items }, (_, i) => (
            <li key={i} className="flex gap-3">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <Skeleton className={i % 2 ? "h-5 w-1/2" : "h-5 w-3/4"} />
                <Skeleton className="h-4 w-2/5" />
              </div>
            </li>
          ))}
        </ul>

        {withDetail && <Skeleton className="h-24 w-full rounded-xl" />}

        <div className="flex items-center gap-2">
          <Skeleton className="h-12 w-28 shrink-0 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </Card>
  );
}

export interface FloorLaneSkeletonProps {
  accent: string;
  withDetail?: boolean;
  /** Cards to draw. Two fills a lane without pretending to know how busy it is. */
  count?: number;
}

/** A lane's worth of placeholder cards, in the same gutters as the real list. */
export function FloorLaneSkeleton({
  accent,
  withDetail,
  count = 2,
}: FloorLaneSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <FloorOrderCardSkeleton
          key={i}
          accent={accent}
          index={i}
          withDetail={withDetail}
          items={i % 2 === 0 ? 2 : 1}
        />
      ))}
    </>
  );
}
