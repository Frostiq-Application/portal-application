import { useState } from "react";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import {
  useCreateCouponMutation,
  useUpdateCouponMutation,
  type CreateCouponBody,
} from "@/features/api/couponsApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { useMeQuery } from "@/features/api/authApi";
import { apiError } from "@/lib/apiError";
import type { Coupon, CouponType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coupon?: Coupon | null;
}

export function CouponDialog({ open, onOpenChange, coupon }: Props) {
  const isEdit = Boolean(coupon);
  const { data: user } = useMeQuery();
  const isBranchManager = user?.role === "shop_admin";
  const { data: shops } = useListShopsQuery({ page: 1, limit: 100 });
  const [createCoupon, { isLoading: creating }] = useCreateCouponMutation();
  const [updateCoupon, { isLoading: updating }] = useUpdateCouponMutation();

  const [shopId, setShopId] = useState("");
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponType>("flat");
  const [discountValue, setDiscountValue] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [usageTotal, setUsageTotal] = useState("");
  const [usageUnlimited, setUsageUnlimited] = useState(true);
  const [usagePerCustomer, setUsagePerCustomer] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [displayLabel, setDisplayLabel] = useState("");
  const [applicableBranchIds, setApplicableBranchIds] = useState<Set<string>>(
    new Set(),
  );

  // Seeded during render rather than in an effect so the fields are correct on
  // first paint instead of flashing the previous coupon's values for a frame.
  const seedKey = open ? (coupon?.id ?? "new") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setShopId(coupon?.shopId ?? "");
    setCode(coupon?.code ?? "");
    setDiscountType(coupon?.discountType ?? "flat");
    setDiscountValue(coupon ? String(Number(coupon.discountValue)) : "0");
    setMaxDiscount(
      coupon?.maxDiscountAmount ? String(Number(coupon.maxDiscountAmount)) : "",
    );
    setMinOrder(
      coupon?.minOrderAmount ? String(Number(coupon.minOrderAmount)) : "",
    );
    setUsageTotal(
      coupon?.usageLimitTotal != null ? String(coupon.usageLimitTotal) : "",
    );
    setUsageUnlimited(coupon?.usageLimitTotal == null);
    setUsagePerCustomer(
      coupon?.usageLimitPerCustomer != null
        ? String(coupon.usageLimitPerCustomer)
        : "",
    );
    setValidFrom(toLocalInput(coupon?.validFrom));
    setValidUntil(toLocalInput(coupon?.validUntil));
    setIsPublic(coupon?.isPublic ?? false);
    setDisplayLabel(coupon?.displayLabel ?? "");
    setApplicableBranchIds(new Set(coupon?.applicableBranchIds ?? []));
  }

  const submit = async () => {
    if (!isEdit && !shopId) return toast.error("Select a branch");
    if (!code.trim()) return toast.error("Code is required");
    if (!validFrom || !validUntil)
      return toast.error("Validity window is required");
    if (new Date(validUntil) <= new Date(validFrom))
      return toast.error("“Valid until” must be after “Valid from”");
    if (!usageUnlimited && (usageTotal === "" || Number(usageTotal) < 1))
      return toast.error("Enter a total usage limit, or turn on “Unlimited”");

    // Branch managers can't create multi-branch coupons
    if (isBranchManager && applicableBranchIds.size > 1) {
      return toast.error(
        "Branch managers can only create single-branch coupons",
      );
    }

    const common = {
      discountType,
      discountValue: Number(discountValue) || 0,
      maxDiscountAmount: maxDiscount === "" ? undefined : Number(maxDiscount),
      minOrderAmount: minOrder === "" ? undefined : Number(minOrder),
      usageLimitTotal: usageUnlimited ? undefined : Number(usageTotal),
      usageLimitPerCustomer:
        usagePerCustomer === "" ? undefined : Number(usagePerCustomer),
      validFrom: new Date(validFrom).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      isPublic,
      displayLabel: displayLabel.trim() || undefined,
      applicableBranchIds:
        applicableBranchIds.size > 0
          ? Array.from(applicableBranchIds)
          : undefined,
    };
    try {
      if (isEdit && coupon) {
        await updateCoupon({ id: coupon.id, body: common }).unwrap();
        toast.success("Coupon updated");
      } else {
        const body: CreateCouponBody = {
          shopId,
          code: code.trim().toUpperCase(),
          ...common,
        };
        await createCoupon(body).unwrap();
        toast.success("Coupon created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to save coupon"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit coupon" : "New coupon"}</DialogTitle>
          <DialogDescription>
            Shop-funded discount with validation rules.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {!isEdit && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Owning branch</Label>
              <Select value={shopId} onValueChange={setShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {(shops?.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isEdit && !isBranchManager && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Apply to branches</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {(shops?.data ?? []).map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={s.id}
                      checked={applicableBranchIds.has(s.id)}
                      onCheckedChange={(checked) => {
                        const updated = new Set(applicableBranchIds);
                        if (checked) updated.add(s.id);
                        else updated.delete(s.id);
                        setApplicableBranchIds(updated);
                      }}
                    />
                    <Label
                      htmlFor={s.id}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {s.branchName}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select branches where this coupon will be valid. If none
                selected, defaults to owning branch only.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FLAT100"
              disabled={isEdit}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType(v as CouponType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat ₹</SelectItem>
                <SelectItem value="percentage">Percentage %</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>
              {discountType === "percentage" ? "Percent" : "Amount (₹)"}
            </Label>
            <Input
              type="number"
              min={0}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          {discountType === "percentage" && (
            <div className="flex flex-col gap-1.5">
              <Label>Max discount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder="No cap"
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Min order (₹)</Label>
            <Input
              type="number"
              min={0}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="None"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Total usage limit</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="usageUnlimited"
                  checked={usageUnlimited}
                  onCheckedChange={setUsageUnlimited}
                />
                <Label
                  htmlFor="usageUnlimited"
                  className="cursor-pointer text-xs font-normal text-muted-foreground"
                >
                  Unlimited
                </Label>
              </div>
            </div>
            {usageUnlimited ? (
              <Input value="Unlimited" disabled />
            ) : (
              <Input
                type="number"
                min={1}
                value={usageTotal}
                onChange={(e) => setUsageTotal(e.target.value)}
                placeholder="Enter count"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Per-customer limit</Label>
            <Input
              type="number"
              min={1}
              value={usagePerCustomer}
              onChange={(e) => setUsagePerCustomer(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Valid from</Label>
            <Input
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Valid until</Label>
            <Input
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="pub" checked={isPublic} onCheckedChange={setIsPublic} />
            <Label htmlFor="pub" className="cursor-pointer">
              Public banner
            </Label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Display label</Label>
            <Input
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              placeholder="Flat ₹100 OFF"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={creating || updating}>
            {(creating || updating) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
