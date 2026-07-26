import { useState } from "react";
import { Check, ChevronDown, Mail, Phone, Search, Store } from "@/components/ui/icons";
import { toast } from "sonner";
import {
  useEnquiryStatusCountsQuery,
  useListEnquiriesQuery,
  useUpdateEnquiryStatusMutation,
} from "@/features/api/queriesApi";
import {
  ENQUIRY_STATUS_ACCENT,
  ENQUIRY_STATUS_LABEL,
  ENQUIRY_STATUS_ORDER,
  ENQUIRY_STATUS_TONE,
  ENQUIRY_TYPE_LABEL,
  ENQUIRY_TYPE_TONE,
} from "@/lib/enquiries";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedStrip, type SegmentedItem } from "@/components/SegmentedStrip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Enquiry, EnquiryStatus, EnquiryType } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_ORDER: EnquiryType[] = [
  "general",
  "demo",
  "custom_quote",
  "partnership",
  "enterprise",
  "other",
];

/** `monthlyOrders` → `Monthly orders`. */
function prettyKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Whether a row carries more than a phone number worth showing. */
function hasBrief(e: Enquiry): boolean {
  return Boolean(
    e.name ||
      e.email ||
      e.shopName ||
      e.message ||
      (e.details && Object.keys(e.details).length > 0),
  );
}

/**
 * The expanded brief.
 *
 * Enterprise enquiries arrive with a full sales intake — scale, volume, the
 * features they ticked and what they need that we don't build. None of that
 * was reachable when the table only showed a phone number, which made the
 * richest lead on the page look identical to a bare landing-page one.
 */
function Brief({ enquiry }: { enquiry: Enquiry }) {
  const details = Object.entries(enquiry.details ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
  );

  return (
    <div className="grid gap-6 bg-muted/40 px-4 py-5 md:grid-cols-2">
      <dl className="space-y-2 text-sm">
        {enquiry.shopName && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Business</dt>
            <dd className="font-medium">{enquiry.shopName}</dd>
          </div>
        )}
        {enquiry.name && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Contact</dt>
            <dd className="font-medium">{enquiry.name}</dd>
          </div>
        )}
        {enquiry.email && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Email</dt>
            <dd>
              <a
                href={`mailto:${enquiry.email}`}
                className="font-medium underline underline-offset-4"
              >
                {enquiry.email}
              </a>
            </dd>
          </div>
        )}
        {details.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">
              {prettyKey(key)}
            </dt>
            <dd className="min-w-0">
              {Array.isArray(value) ? (
                <span className="flex flex-wrap gap-1">
                  {value.map((v) => (
                    <span
                      key={String(v)}
                      className="rounded-full border bg-background px-2 py-0.5 text-xs"
                    >
                      {String(v)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="font-medium">{String(value)}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What they need
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm">
          {enquiry.message || (
            <span className="text-muted-foreground">
              Nothing written in — worth asking on the call.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * The status badge, which is also the control that changes it.
 *
 * A separate "edit" affordance would be one click of ceremony on a page whose
 * whole job is triaging a list, so the badge itself opens the menu. Clicks are
 * stopped from reaching the row, which otherwise toggles the brief open.
 */
function StatusPicker({ enquiry }: { enquiry: Enquiry }) {
  const [update, { isLoading }] = useUpdateEnquiryStatusMutation();

  const move = async (status: EnquiryStatus) => {
    if (status === enquiry.status) return;
    try {
      await update({ id: enquiry.id, status }).unwrap();
      toast.success(`Marked ${ENQUIRY_STATUS_LABEL[status].toLowerCase()}`);
    } catch {
      toast.error("Couldn't update the status. Please try again.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50",
            ENQUIRY_STATUS_TONE[enquiry.status] ??
              "bg-muted text-muted-foreground",
          )}
        >
          {ENQUIRY_STATUS_LABEL[enquiry.status] ?? enquiry.status}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="w-44"
      >
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {ENQUIRY_STATUS_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => void move(s)}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: ENQUIRY_STATUS_ACCENT[s] }}
              />
              {ENQUIRY_STATUS_LABEL[s]}
            </span>
            {s === enquiry.status && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QueriesPage() {
  const [status, setStatus] = useState<EnquiryStatus | "all">("all");
  const [type, setType] = useState<EnquiryType | "all">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useListEnquiriesQuery({
    page: 1,
    limit: 100,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
    search: debouncedSearch || undefined,
  });
  const rows = data?.data ?? [];

  // Whole-inbox counts, so the strip keeps telling you what's waiting even
  // while you're looking at a filtered slice of it.
  const { data: counts } = useEnquiryStatusCountsQuery();
  const total = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : undefined;

  const statusItems: SegmentedItem<EnquiryStatus | "all">[] = [
    { value: "all", label: "All", count: total },
    ...ENQUIRY_STATUS_ORDER.map((s) => ({
      value: s,
      label: ENQUIRY_STATUS_LABEL[s],
      accent: ENQUIRY_STATUS_ACCENT[s],
      count: counts?.[s],
    })),
  ];

  const filtered = status !== "all" || type !== "all" || Boolean(debouncedSearch);

  return (
    <>
      <PageHeader
        title="Queries"
        description="Callback requests and Enterprise briefs"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search phone, name, email or business…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={type}
          onValueChange={(v) => setType(v as EnquiryType | "all")}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {ENQUIRY_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SegmentedStrip
        className="mb-4"
        value={status}
        items={statusItems}
        onChange={setStatus}
      />

      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-background",
          isFetching && !isLoading && "opacity-70 transition-opacity",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Who</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {filtered
                    ? "No queries match these filters."
                    : "No queries yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => {
                const expandable = hasBrief(e);
                const open = openId === e.id;
                return [
                  <TableRow
                    key={e.id}
                    className={cn(expandable && "cursor-pointer")}
                    onClick={() =>
                      expandable && setOpenId(open ? null : e.id)
                    }
                  >
                    <TableCell className="font-medium">
                      {/* Business and contact lead where we have them — a
                          column of identical phone numbers tells you nothing
                          about which lead to call back first. */}
                      {e.shopName || e.name ? (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Store className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {e.shopName || e.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-xs font-normal text-muted-foreground">
                            {e.name && e.shopName && <span>{e.name}</span>}
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-3" />
                              {e.phone}
                            </span>
                            {e.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="size-3" />
                                {e.email}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Phone className="size-4 text-muted-foreground" />
                          {e.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          // Falls back rather than rendering an empty cell if
                          // the backend ever adds a type the portal doesn't
                          // know about yet.
                          ENQUIRY_TYPE_TONE[e.type] ??
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {ENQUIRY_TYPE_LABEL[e.type] ?? e.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPicker enquiry={e} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {expandable && (
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      )}
                    </TableCell>
                  </TableRow>,
                  open ? (
                    <TableRow key={`${e.id}-brief`} className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <Brief enquiry={e} />
                      </TableCell>
                    </TableRow>
                  ) : null,
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
