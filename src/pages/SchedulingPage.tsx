import { useMemo, useState } from "react";
import { CalendarClock, CalendarOff, Clock, Plus, Sun, Trash2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  useAddBlackoutDateMutation,
  useGetSchedulingSettingsQuery,
  useGetSlotsQuery,
  useListBlackoutDatesQuery,
  useListWeeklyHoursQuery,
  useRemoveBlackoutDateMutation,
  useUpsertSchedulingSettingsMutation,
  useUpsertWeeklyHoursMutation,
} from "@/features/api/schedulingApi";
import type { SchedulingScope } from "@/types";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SLOT_DURATIONS = [15, 30, 45, 60, 90, 120];

const SCOPES: { value: SchedulingScope; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
];

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Half-hour cutoff options across the day (00:00 … 23:30). */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${m}`;
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { value, label: `${hour}:${m} ${period}` };
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SchedulingPage() {
  const branchId = useAppSelector(selectSelectedBranchId);
  // Scheduling is always scoped to one concrete branch.
  const shopId = branchId === ALL_BRANCHES ? "" : branchId;
  const [scope, setScope] = useState<SchedulingScope>("all");

  return (
    <>
      <PageHeader
        title="Scheduling"
        description="Pickup & delivery slots, hours, cutoffs, and closed days, per branch"
        actions={<ShopSelect />}
      />
      {!shopId ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a branch to manage its schedule.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Tabs value={scope} onValueChange={(v) => setScope(v as SchedulingScope)}>
            <TabsList>
              {SCOPES.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="grid gap-6 lg:grid-cols-2">
            <SettingsCard shopId={shopId} scope={scope} />
            <SlotPreviewCard shopId={shopId} scope={scope} />
            <WeeklyHoursCard shopId={shopId} scope={scope} />
            <BlackoutCard shopId={shopId} />
          </div>
        </div>
      )}
    </>
  );
}

function SettingsCard({
  shopId,
  scope,
}: {
  shopId: string;
  scope: SchedulingScope;
}) {
  const { data, isLoading } = useGetSchedulingSettingsQuery({
    shopId,
    fulfilmentType: scope,
  });
  const [save, { isLoading: saving }] = useUpsertSchedulingSettingsMutation();

  const [slotDuration, setSlotDuration] = useState(60);
  const [cutoff, setCutoff] = useState<string>("");
  const [maxDays, setMaxDays] = useState(7);
  const [capacity, setCapacity] = useState<string>("");

  // Seeded during render rather than in an effect so the controls show the
  // saved settings on the paint they arrive instead of one frame later.
  const [seeded, setSeeded] = useState<typeof data>(undefined);
  if (data && data !== seeded) {
    setSeeded(data);
    setSlotDuration(data.slotDurationMinutes);
    setCutoff(data.dailyCutoffTime?.slice(0, 5) ?? "");
    setMaxDays(data.maxAdvanceDays);
    setCapacity(data.slotCapacity != null ? String(data.slotCapacity) : "");
  }

  // The backend falls back to the 'all' row when this scope has none saved.
  const inherited = scope !== "all" && data != null && data.fulfilmentType !== scope;

  const onSave = async () => {
    try {
      await save({
        shopId,
        fulfilmentType: scope,
        slotDurationMinutes: slotDuration,
        dailyCutoffTime: cutoff || undefined,
        maxAdvanceDays: maxDays,
        slotCapacity: capacity === "" ? null : Number(capacity),
      }).unwrap();
      toast.success(
        scope === "all"
          ? "Scheduling settings saved"
          : `${scope === "delivery" ? "Delivery" : "Pickup"} settings saved`,
      );
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Slot settings
          {scope !== "all" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
              {scope}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {scope === "all"
            ? "Branch defaults for how time slots are generated."
            : inherited
              ? "Currently inheriting the branch defaults. Saving creates separate rules for this fulfilment type."
              : "Separate rules for this fulfilment type (override the branch defaults)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Slot duration</Label>
              <Select
                value={String(slotDuration)}
                onValueChange={(v) => setSlotDuration(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Daily cutoff</Label>
              <Select
                value={cutoff || "none"}
                onValueChange={(v) => setCutoff(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No cutoff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No cutoff</SelectItem>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Orders placed after this time roll over to the next day.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Booking horizon (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={maxDays}
                  onChange={(e) => setMaxDays(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Orders per slot</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Slot capacity marks a slot as full once that many active orders are
              booked into it. Leave empty for unlimited.
            </p>

            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type DayMode = "default" | "open" | "closed";
interface DayDraft {
  mode: DayMode;
  openTime: string;
  closeTime: string;
}

function WeeklyHoursCard({
  shopId,
  scope,
}: {
  shopId: string;
  scope: SchedulingScope;
}) {
  const { data: rows, isLoading } = useListWeeklyHoursQuery(shopId);
  const [save, { isLoading: saving }] = useUpsertWeeklyHoursMutation();

  const [draft, setDraft] = useState<DayDraft[]>([]);

  // Rebuild the 7-day draft whenever the branch, scope, or saved rows change.
  // Done during render so switching branch or scope never paints the previous
  // one's hours for a frame — these are per-branch settings, and showing the
  // wrong branch's opening times even briefly is worth avoiding.
  const draftKey = `${shopId}:${scope}:${rows?.length ?? -1}`;
  const [draftSeeded, setDraftSeeded] = useState<string | null>(null);
  if (draftKey !== draftSeeded) {
    setDraftSeeded(draftKey);
    const next: DayDraft[] = WEEKDAY_LABELS.map((_, weekday) => {
      const row = (rows ?? []).find(
        (r) => r.fulfilmentType === scope && r.weekday === weekday,
      );
      if (!row) return { mode: "default", openTime: "09:00", closeTime: "21:00" };
      if (row.closed) return { mode: "closed", openTime: "09:00", closeTime: "21:00" };
      return {
        mode: "open",
        openTime: row.openTime?.slice(0, 5) ?? "09:00",
        closeTime: row.closeTime?.slice(0, 5) ?? "21:00",
      };
    });
    setDraft(next);
  }

  const patchDay = (weekday: number, patch: Partial<DayDraft>) =>
    setDraft((prev) =>
      prev.map((d, i) => (i === weekday ? { ...d, ...patch } : d)),
    );

  const onSave = async () => {
    // The PUT replaces every row for the branch, so keep other scopes' rows.
    const otherRows = (rows ?? [])
      .filter((r) => r.fulfilmentType !== scope)
      .map((r) => ({
        fulfilmentType: r.fulfilmentType,
        weekday: r.weekday,
        closed: r.closed,
        openTime: r.openTime?.slice(0, 5) ?? null,
        closeTime: r.closeTime?.slice(0, 5) ?? null,
      }));
    const scopeRows = draft
      .map((d, weekday) => ({ d, weekday }))
      .filter(({ d }) => d.mode !== "default")
      .map(({ d, weekday }) => ({
        fulfilmentType: scope,
        weekday,
        closed: d.mode === "closed",
        openTime: d.mode === "open" ? d.openTime : null,
        closeTime: d.mode === "open" ? d.closeTime : null,
      }));
    try {
      await save({ shopId, rows: [...otherRows, ...scopeRows] }).unwrap();
      toast.success("Weekly hours saved");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sun className="h-4 w-4 text-muted-foreground" />
          Weekly hours
          {scope !== "all" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
              {scope}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Per-weekday opening hours for this branch.{" "}
          {scope === "all"
            ? "Days set to “Branch hours” use the branch's base opening/closing time."
            : "Days set to “Branch hours” fall back to the “All orders” hours, then the branch's base hours."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            {WEEKDAY_LABELS.map((label, weekday) => {
              const d = draft[weekday];
              if (!d) return null;
              return (
                <div
                  key={label}
                  className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <span className="w-24 text-sm font-medium">{label}</span>
                  <Select
                    value={d.mode}
                    onValueChange={(v) => patchDay(weekday, { mode: v as DayMode })}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Branch hours</SelectItem>
                      <SelectItem value="open">Custom hours</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  {d.mode === "open" && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={d.openTime}
                        onChange={(e) =>
                          patchDay(weekday, { openTime: e.target.value })
                        }
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={d.closeTime}
                        onChange={(e) =>
                          patchDay(weekday, { closeTime: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save weekly hours"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BlackoutCard({ shopId }: { shopId: string }) {
  const { data, isLoading } = useListBlackoutDatesQuery(shopId);
  const [add, { isLoading: adding }] = useAddBlackoutDateMutation();
  const [remove] = useRemoveBlackoutDateMutation();

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [data],
  );

  const onAdd = async () => {
    if (!date) return toast.error("Pick a date to close");
    try {
      await add({ shopId, date, reason: reason.trim() || undefined }).unwrap();
      setDate("");
      setReason("");
      toast.success("Closed day added");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const onRemove = async (id: string) => {
    try {
      await remove({ id, shopId }).unwrap();
      toast.success("Closed day removed");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarOff className="h-4 w-4 text-muted-foreground" />
          Closed days &amp; blackout dates
        </CardTitle>
        <CardDescription>
          Specific dates the branch takes no orders (holidays, maintenance).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <DatePicker
              min={todayIso()}
              value={date}
              onChange={setDate}
              className="w-44"
            />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g. Diwali"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button onClick={onAdd} disabled={adding}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No blackout dates. The branch follows its normal weekly hours.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div>
                  <span className="text-sm font-medium">
                    {formatDate(b.date)}
                  </span>
                  {b.reason && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      · {b.reason}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(b.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SlotPreviewCard({
  shopId,
  scope,
}: {
  shopId: string;
  scope: SchedulingScope;
}) {
  const [date, setDate] = useState(todayIso());
  const { data, isFetching } = useGetSlotsQuery(
    {
      shopId,
      date,
      ...(scope !== "all" ? { deliveryType: scope } : {}),
    },
    { skip: !date },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Slot preview
          {scope !== "all" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
              {scope}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Bookable slots on a date, computed from hours, settings &amp; closures.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label>Date</Label>
          <DatePicker
            min={todayIso()}
            value={date}
            onChange={setDate}
            className="w-44"
          />
        </div>

        {isFetching ? (
          <Skeleton className="h-24 w-full" />
        ) : !data ? null : !data.open ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            Closed on this date
            {data.closedReason ? `: ${data.closedReason}` : ""}.
          </div>
        ) : data.slots.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No bookable slots remain for this date.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.slots.map((s) => (
              <span
                key={`${s.start}-${s.end}`}
                className={
                  s.available
                    ? "rounded-md border bg-background px-2.5 py-1 text-xs font-medium"
                    : "rounded-md border border-dashed bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground line-through"
                }
                title={
                  !s.available
                    ? "Fully booked"
                    : s.remaining != null
                      ? `${s.remaining} order(s) left`
                      : undefined
                }
              >
                {s.start}–{s.end}
                {s.available && s.remaining != null ? ` · ${s.remaining} left` : ""}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
