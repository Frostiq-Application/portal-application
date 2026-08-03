import { useCallback, useMemo, useState } from "react";
import {
  Cake,
  CakeSlice,
  CalendarClock,
  Images,
  Phone,
  ScrollText,
  Search,
  ShoppingBag,
  Store,
  Tags,
  Users as UsersIcon,
  X,
  type IconComponent,
} from "@/components/ui/icons";
import {
  useActivityFiltersQuery,
  useListActivityQuery,
} from "@/features/api/activityApi";
import type { ActivityEntry } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;

/** "Any" needs a non-empty value: Radix Select reserves "" for the placeholder. */
const ANY = "__any__";

/** Icon per entity bucket, so the eye can skim by kind before reading. */
const ENTITY_ICON: Record<string, IconComponent> = {
  product: Cake,
  category: Tags,
  addon: Tags,
  catalog: Cake,
  order: ShoppingBag,
  coupon: Tags,
  cms: Images,
  scheduling: CalendarClock,
  shop: Store,
  user: UsersIcon,
  role: UsersIcon,
  custom_cake: CakeSlice,
  gallery: Images,
  enquiry: Phone,
};

const ENTITY_LABEL: Record<string, string> = {
  product: "Product",
  category: "Category",
  addon: "Add-on",
  catalog: "Catalog",
  order: "Order",
  coupon: "Coupon",
  cms: "Storefront",
  scheduling: "Scheduling",
  shop: "Branch",
  user: "Team",
  role: "Roles",
  custom_cake: "Custom cake",
  gallery: "Gallery",
  enquiry: "Enquiry",
};

const entityLabel = (key: string): string =>
  ENTITY_LABEL[key] ?? key.replace(/_/g, " ");

/** Deletions read differently from everything else, so they look different. */
const isDestructive = (action: string): boolean =>
  /\.(deleted|removed|cancelled|suspended|unassigned)$/.test(action);

function initials(entry: ActivityEntry): string {
  const source = entry.actorName ?? entry.actorEmail ?? "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Today" / "Yesterday" / "Mon, 12 Jul 2026" — the heading for each day group. */
function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupByDay(entries: ActivityEntry[]): [string, ActivityEntry[]][] {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const key = dayHeading(entry.createdAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.entries()];
}

/**
 * The brand's audit trail — who on the team changed what, and when (Pro plan,
 * `can_use_audit_log`).
 *
 * Presented as a day-grouped timeline rather than a table on purpose: the
 * question this page answers is almost always "what happened around <when>",
 * and a wall of uniform rows makes that the hardest thing to see. Each row
 * expands to the recorded detail — the exact fields that changed, and the IP it
 * came from — for the rarer case where the sentence isn't enough.
 */
export function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState(ANY);
  const [actorUserId, setActorUserId] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filterArgs = useMemo(
    () => ({
      entityType: entityType === ANY ? undefined : entityType,
      actorUserId: actorUserId === ANY ? undefined : actorUserId,
      search: search.trim() || undefined,
      // The date inputs are days; widen them to cover the whole day, otherwise
      // "to = today" would exclude everything that happened today.
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    [entityType, actorUserId, search, from, to],
  );

  const { data, isLoading, isFetching } = useListActivityQuery({
    ...filterArgs,
    page,
    limit: PAGE_SIZE,
  });
  const { data: filters } = useActivityFiltersQuery();

  // Any filter change restarts paging; without this the next page would be
  // appended to results from the previous filter set. Done during render so the
  // reset lands before the stale page is painted under the new filters.
  const [seenFilters, setSeenFilters] = useState(filterArgs);
  if (filterArgs !== seenFilters) {
    setSeenFilters(filterArgs);
    setPage(1);
  }

  const [seenData, setSeenData] = useState<typeof data>(undefined);
  if (data && data !== seenData) {
    setSeenData(data);
    setItems((prev) =>
      data.meta.page === 1
        ? data.data
        : [
            ...prev.filter((p) => !data.data.some((n) => n.id === p.id)),
            ...data.data,
          ],
    );
  }

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (!isFetching) setPage((p) => p + 1);
  }, [isFetching]);

  const filtersActive =
    search !== "" || entityType !== ANY || actorUserId !== ANY || from !== "" || to !== "";

  const clearFilters = () => {
    setSearch("");
    setEntityType(ANY);
    setActorUserId(ANY);
    setFrom("");
    setTo("");
  };

  const grouped = useMemo(() => groupByDay(items), [items]);

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="Every change your team makes, in the order it happened"
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search what happened, or who did it…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Kind</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Anything" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Anything</SelectItem>
              {(filters?.entityTypes ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {entityLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Who</Label>
          <Select value={actorUserId} onValueChange={setActorUserId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Anyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Anyone</SelectItem>
              {(filters?.actors ?? [])
                .filter((a) => a.userId)
                .map((a) => (
                  <SelectItem key={a.userId} value={a.userId as string}>
                    {a.name ?? a.email ?? "Removed user"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <DatePicker
            className="w-40"
            placeholder="Any date"
            value={from}
            max={to || undefined}
            onChange={setFrom}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <DatePicker
            className="w-40"
            placeholder="Any date"
            value={to}
            min={from || undefined}
            onChange={setTo}
          />
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filtersActive
              ? "Nothing matches these filters."
              : "No activity recorded yet. Changes your team makes will appear here."}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {total.toLocaleString("en-IN")}{" "}
            {total === 1 ? "entry" : "entries"}
            {filtersActive ? " matching your filters" : ""}
          </p>

          <InfiniteScroll
            hasMore={hasMore}
            loading={isFetching}
            onLoadMore={loadMore}
            loader={
              <div className="space-y-2 py-3">
                <Skeleton className="h-16 w-full" />
              </div>
            }
            endMessage={
              <p className="py-6 text-center text-xs text-muted-foreground">
                That's the whole history.
              </p>
            }
          >
            <div className="space-y-6">
              {grouped.map(([day, entries]) => (
                <section key={day}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {day}
                  </h2>
                  <div className="overflow-hidden rounded-lg border bg-background">
                    {entries.map((entry, i) => (
                      <ActivityRow
                        key={entry.id}
                        entry={entry}
                        first={i === 0}
                        expanded={expanded === entry.id}
                        onToggle={() =>
                          setExpanded((cur) =>
                            cur === entry.id ? null : entry.id,
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </InfiniteScroll>
        </>
      )}
    </>
  );
}

function ActivityRow({
  entry,
  first,
  expanded,
  onToggle,
}: {
  entry: ActivityEntry;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = ENTITY_ICON[entry.entityType] ?? ScrollText;
  const destructive = isDestructive(entry.action);
  const hasDetail = Boolean(entry.metadata) || Boolean(entry.ipAddress);

  return (
    <div className={first ? "" : "border-t"}>
      <button
        type="button"
        onClick={hasDetail ? onToggle : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left ${
          hasDetail ? "hover:bg-muted/50" : "cursor-default"
        }`}
      >
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium"
          title={entry.actorEmail ?? undefined}
        >
          {initials(entry)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">
              {/* The email is the identity that survives the person leaving. */}
              {entry.actorName ?? entry.actorEmail ?? "Removed user"}
            </span>
            <Badge
              variant={destructive ? "destructive" : "secondary"}
              className="gap-1 text-[10px]"
            >
              <Icon className="h-3 w-3" />
              {entityLabel(entry.entityType)}
            </Badge>
            {entry.shopName && (
              <span className="text-xs text-muted-foreground">
                {entry.shopName}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {entry.summary ?? entry.action}
          </span>
        </span>

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {timeOfDay(entry.createdAt)}
        </span>
      </button>

      {expanded && hasDetail && (
        <div className="border-t bg-muted/30 px-4 py-3 text-xs">
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            <span>
              Action <code className="text-foreground">{entry.action}</code>
            </span>
            {entry.actorRole && <span>Role at the time: {entry.actorRole}</span>}
            {entry.ipAddress && <span>IP {entry.ipAddress}</span>}
          </div>
          {entry.metadata && (
            <pre className="max-h-64 overflow-auto rounded bg-background p-3 text-[11px] leading-relaxed">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
