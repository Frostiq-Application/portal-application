import { useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Eye, EyeOff, Loader2, Pencil, Plus, Search } from "@/components/ui/icons";
import {
  useAdminCouponsQuery,
  useAdminCyclesQuery,
  useAdminPlansQuery,
  useCreateSubCouponMutation,
  useSetSubCouponActiveMutation,
  useUpdateSubCouponMutation,
} from "@/features/api/billingAdminApi";
import { inr, inrShort } from "@/lib/billing";
import { cn, formatDate } from "@/lib/utils";
import type { DiscountType, SubscriptionCoupon } from "@/types/billing";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Subscription coupons (SA-11/12) — Pronttera discounting a bakery's
 * **subscription bill**.
 *
 * Not to be confused with the Coupons page a bakery uses for its own cake
 * customers: different table, different audience, different product. This one
 * only ever appears for the platform super admin.
 */
export function SubscriptionCouponsPage() {
  const [search, setSearch] = useState("");
  const { data: coupons, isLoading } = useAdminCouponsQuery(
    search.trim() || undefined,
  );
  const { data: plans } = useAdminPlansQuery();
  const { data: cycles } = useAdminCyclesQuery();
  const [setActive] = useSetSubCouponActiveMutation();

  const [editing, setEditing] = useState<SubscriptionCoupon | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription coupons"
        description="Promotional discounts on what bakeries pay you. Applied to the plan price only — never to add-ons."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            New coupon
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-2 px-6 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (coupons ?? []).length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No coupons yet. Create one to run a launch or festival campaign.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Runs for</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons!.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="flex items-center gap-1.5 font-mono text-sm font-semibold">
                          {c.visibility === "public" ? (
                            <Eye className="size-3.5 text-emerald-600" />
                          ) : (
                            <EyeOff className="size-3.5 text-muted-foreground" />
                          )}
                          {c.code}
                        </p>
                        {c.internalNote && (
                          <p className="max-w-48 truncate text-xs text-muted-foreground">
                            {c.internalNote}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {c.discountType === "percent" ? (
                          <>
                            {Number(c.discountValue)}%
                            {c.maxDiscountAmount && (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                max {inrShort(c.maxDiscountAmount)}
                              </span>
                            )}
                          </>
                        ) : (
                          inr(c.discountValue)
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {c.durationCycles === 1
                          ? "First payment"
                          : `First ${c.durationCycles} cycles`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.planIds.length === 0 && c.cycleCodes.length === 0 ? (
                            <Badge variant="outline" className="text-xs">
                              Everything
                            </Badge>
                          ) : (
                            <>
                              {c.planIds.map((id) => (
                                <Badge
                                  key={id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {plans?.find((p) => p.id === id)?.name ?? "plan"}
                                </Badge>
                              ))}
                              {c.cycleCodes.map((code) => (
                                <Badge
                                  key={code}
                                  variant="outline"
                                  className="text-xs capitalize"
                                >
                                  {code}
                                </Badge>
                              ))}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {c.redemptionCount}
                        {c.maxRedemptions != null && ` / ${c.maxRedemptions}`}
                        <p className="text-xs text-muted-foreground">
                          {c.perAccountLimit} per account
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {c.validFrom || c.validUntil ? (
                          <>
                            {c.validFrom ? formatDate(c.validFrom) : "—"} →{" "}
                            {c.validUntil ? formatDate(c.validUntil) : "—"}
                          </>
                        ) : (
                          "Always"
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.isActive}
                          onCheckedChange={(v) =>
                            setActive({ id: c.id, isActive: v })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CouponEditor
        open={open}
        onOpenChange={setOpen}
        coupon={editing}
        plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name }))}
        cycles={(cycles ?? []).map((c) => ({ code: c.code, name: c.name }))}
      />
    </div>
  );
}

function CouponEditor({
  open,
  onOpenChange,
  coupon,
  plans,
  cycles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: SubscriptionCoupon | null;
  plans: { id: string; name: string }[];
  cycles: { code: string; name: string }[];
}) {
  const [create, { isLoading: creating }] = useCreateSubCouponMutation();
  const [update, { isLoading: updating }] = useUpdateSubCouponMutation();

  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [value, setValue] = useState("20");
  const [cap, setCap] = useState("");
  const [durationCycles, setDurationCycles] = useState("1");
  const [isPublic, setIsPublic] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perAccountLimit, setPerAccountLimit] = useState("1");
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [cycleCodes, setCycleCodes] = useState<string[]>([]);

  // Seeded during render rather than in an effect so the fields are correct on
  // first paint instead of flashing the previous coupon's values for a frame.
  const seedKey = open ? (coupon?.id ?? "new") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setCode(coupon?.code ?? "");
    setNote(coupon?.internalNote ?? "");
    setDiscountType(coupon?.discountType ?? "percent");
    setValue(coupon ? String(Number(coupon.discountValue)) : "20");
    setCap(
      coupon?.maxDiscountAmount ? String(Number(coupon.maxDiscountAmount)) : "",
    );
    setDurationCycles(String(coupon?.durationCycles ?? 1));
    setIsPublic(coupon?.visibility === "public");
    setValidFrom(coupon?.validFrom?.slice(0, 10) ?? "");
    setValidUntil(coupon?.validUntil?.slice(0, 10) ?? "");
    setMaxRedemptions(
      coupon?.maxRedemptions != null ? String(coupon.maxRedemptions) : "",
    );
    setPerAccountLimit(String(coupon?.perAccountLimit ?? 1));
    setPlanIds(coupon?.planIds ?? []);
    setCycleCodes(coupon?.cycleCodes ?? []);
  }

  const busy = creating || updating;
  const isPercent = discountType === "percent";

  async function handleSave() {
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
      toast.error("Codes are 3–40 characters: letters, numbers, - and _.");
      return;
    }
    const body = {
      code: code.toUpperCase(),
      internalNote: note.trim() || undefined,
      discountType,
      discountValue: Number(value) || 0,
      maxDiscountAmount: isPercent && cap ? Number(cap) : null,
      durationCycles: Number(durationCycles) || 1,
      visibility: (isPublic ? "public" : "private") as "public" | "private",
      validFrom: validFrom ? new Date(validFrom).toISOString() : null,
      validUntil: validUntil
        ? new Date(`${validUntil}T23:59:59`).toISOString()
        : null,
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      perAccountLimit: Number(perAccountLimit) || 1,
      planIds,
      cycleCodes,
    };

    try {
      if (coupon) await update({ id: coupon.id, body }).unwrap();
      else await create(body).unwrap();
      toast.success(`${body.code} saved.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't save that coupon.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {coupon ? `Edit ${coupon.code}` : "New subscription coupon"}
          </DialogTitle>
          <DialogDescription>
            Discounts the plan portion of a bakery's bill — never add-ons, and
            never stacked with another coupon.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-code">Code</Label>
              <Input
                id="c-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DIWALI20"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-duration">Runs for (cycles)</Label>
              <Input
                id="c-duration"
                inputMode="numeric"
                value={durationCycles}
                onChange={(e) =>
                  setDurationCycles(e.target.value.replace(/\D/g, ""))
                }
              />
              <p className="text-xs text-muted-foreground">
                1 = first payment only
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-note">Internal note</Label>
            <Textarea
              id="c-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Diwali campaign 2026 — admin only, never shown to bakeries."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-type">Type</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as DiscountType)}
              >
                <SelectTrigger id="c-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="flat">Flat ₹</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-value">{isPercent ? "Percent" : "Amount ₹"}</Label>
              <Input
                id="c-value"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-cap">Max discount ₹</Label>
              <Input
                id="c-cap"
                inputMode="decimal"
                disabled={!isPercent}
                value={cap}
                onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={isPercent ? "2000" : "Percent only"}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="c-public" className="font-medium">
                Public
              </Label>
              <p className="text-xs text-muted-foreground">
                Listed at checkout for anyone it applies to. Private coupons work
                by code entry only.
              </p>
            </div>
            <Switch id="c-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-from">Valid from</Label>
              <DatePicker
                id="c-from"
                className="w-full"
                placeholder="No start date"
                max={validUntil || undefined}
                value={validFrom}
                onChange={setValidFrom}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-until">Valid until</Label>
              <DatePicker
                id="c-until"
                className="w-full"
                placeholder="No end date"
                min={validFrom || undefined}
                value={validUntil}
                onChange={setValidUntil}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-max">Total redemptions</Label>
              <Input
                id="c-max"
                inputMode="numeric"
                value={maxRedemptions}
                onChange={(e) =>
                  setMaxRedemptions(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-per">Per account</Label>
              <Input
                id="c-per"
                inputMode="numeric"
                value={perAccountLimit}
                onChange={(e) =>
                  setPerAccountLimit(e.target.value.replace(/\D/g, ""))
                }
              />
            </div>
          </div>

          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Scope</h3>
              <p className="text-xs text-muted-foreground">
                Select nothing to apply everywhere.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plans</Label>
              <div className="flex flex-wrap gap-2">
                {plans.map((p) => {
                  const on = planIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        on ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) =>
                          setPlanIds((ids) =>
                            v ? [...ids, p.id] : ids.filter((x) => x !== p.id),
                          )
                        }
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cycles</Label>
              <div className="flex flex-wrap gap-2">
                {cycles.map((c) => {
                  const on = cycleCodes.includes(c.code);
                  return (
                    <label
                      key={c.code}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        on ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) =>
                          setCycleCodes((codes) =>
                            v
                              ? [...codes, c.code]
                              : codes.filter((x) => x !== c.code),
                          )
                        }
                      />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <BadgePercent className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Preview on a ₹2,499/month plan billed yearly (₹24,990):{" "}
              <strong className="text-foreground">
                {isPercent
                  ? inr(
                      Math.min(
                        (24990 * (Number(value) || 0)) / 100,
                        cap ? Number(cap) : Number.POSITIVE_INFINITY,
                      ),
                    )
                  : inr(Math.min(Number(value) || 0, 24990))}{" "}
                off
              </strong>
              , for {durationCycles === "1" ? "the first payment" : `${durationCycles} cycles`}.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save coupon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
