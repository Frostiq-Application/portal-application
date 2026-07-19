import { useEffect, useMemo, useState } from "react";
import { CalendarOff, Clock, Plus, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import {
  useAddBlackoutDateMutation,
  useGetSchedulingSettingsQuery,
  useGetSlotsQuery,
  useListBlackoutDatesQuery,
  useRemoveBlackoutDateMutation,
  useUpsertSchedulingSettingsMutation,
} from "@/features/api/schedulingApi";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <>
      <PageHeader
        title="Scheduling"
        description="Pickup & delivery slots, cutoffs, and closed days"
        actions={<ShopSelect />}
      />
      {!shopId ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a branch to manage its schedule.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SettingsCard shopId={shopId} />
          <SlotPreviewCard shopId={shopId} />
          <BlackoutCard shopId={shopId} />
        </div>
      )}
    </>
  );
}

function SettingsCard({ shopId }: { shopId: string }) {
  const { data, isLoading } = useGetSchedulingSettingsQuery(shopId);
  const [save, { isLoading: saving }] = useUpsertSchedulingSettingsMutation();

  const [slotDuration, setSlotDuration] = useState(60);
  const [cutoff, setCutoff] = useState<string>("");
  const [maxDays, setMaxDays] = useState(7);

  useEffect(() => {
    if (!data) return;
    setSlotDuration(data.slotDurationMinutes);
    setCutoff(data.dailyCutoffTime?.slice(0, 5) ?? "");
    setMaxDays(data.maxAdvanceDays);
  }, [data]);

  const onSave = async () => {
    try {
      await save({
        shopId,
        slotDurationMinutes: slotDuration,
        dailyCutoffTime: cutoff || undefined,
        maxAdvanceDays: maxDays,
      }).unwrap();
      toast.success("Scheduling settings saved");
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
        </CardTitle>
        <CardDescription>
          How pickup &amp; delivery time slots are generated for this branch.
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

            <div className="flex flex-col gap-1.5">
              <Label>Booking horizon (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={maxDays}
                onChange={(e) => setMaxDays(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                How far ahead customers can schedule an order.
              </p>
            </div>

            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
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
            <Input
              type="date"
              min={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
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

function SlotPreviewCard({ shopId }: { shopId: string }) {
  const [date, setDate] = useState(todayIso());
  const { data, isFetching } = useGetSlotsQuery(
    { shopId, date },
    { skip: !date },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Slot preview
        </CardTitle>
        <CardDescription>
          Bookable slots on a date, computed from hours, settings &amp; closures.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            min={todayIso()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>

        {isFetching ? (
          <Skeleton className="h-24 w-full" />
        ) : !data ? null : !data.open ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            Closed on this date
            {data.closedReason ? ` — ${data.closedReason}` : ""}.
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
                className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium"
              >
                {s.start}–{s.end}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
