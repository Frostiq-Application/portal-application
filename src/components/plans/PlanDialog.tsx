import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreatePlanMutation,
  useUpdatePlanMutation,
  type CreatePlanBody,
  type PlanFeatures,
} from "@/features/api/plansApi";
import { useListFeaturesQuery } from "@/features/api/featuresApi";
import { apiError } from "@/lib/apiError";
import type { Plan } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Limit keys that have their own dedicated numeric inputs (not toggles). */
const COLUMN_BACKED = new Set([
  "max_shops",
  "max_products_per_shop",
  "max_team_seats",
]);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan?: Plan | null;
}

export function PlanDialog({ open, onOpenChange, plan }: Props) {
  const isEdit = Boolean(plan);
  const [createPlan, { isLoading: creating }] = useCreatePlanMutation();
  const [updatePlan, { isLoading: updating }] = useUpdatePlanMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("0");
  const [priceAnnual, setPriceAnnual] = useState("");
  const [monthsFree, setMonthsFree] = useState("");
  const [maxShops, setMaxShops] = useState("");
  const [maxProducts, setMaxProducts] = useState("");
  const [maxTeamSeats, setMaxTeamSeats] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isPublic, setIsPublic] = useState(true);
  const [features, setFeatures] = useState<Record<string, boolean | number | null>>(
    {},
  );

  // The feature catalog drives which toggles render — add/remove a feature in
  // the Features manager and it appears/disappears here automatically.
  const { data: catalog } = useListFeaturesQuery();
  const toggleFeatures = (catalog ?? []).filter(
    (f) => f.kind === "boolean" && !COLUMN_BACKED.has(f.key) && f.category !== "core",
  );

  useEffect(() => {
    if (open) {
      setName(plan?.name ?? "");
      setDescription(plan?.description ?? "");
      setPriceMonthly(plan ? String(Number(plan.priceMonthly)) : "0");
      setPriceAnnual(
        plan?.priceAnnual != null ? String(Number(plan.priceAnnual)) : "",
      );
      // Derive the "months free" helper from the stored annual price.
      const m = plan ? Number(plan.priceMonthly) : 0;
      const a = plan?.priceAnnual != null ? Number(plan.priceAnnual) : null;
      setMonthsFree(
        a != null && m > 0
          ? String(+((m * 12 - a) / m).toFixed(2)).replace(/\.00$/, "")
          : "",
      );
      setMaxShops(plan?.maxShops != null ? String(plan.maxShops) : "");
      setMaxProducts(
        plan?.maxProductsPerShop != null ? String(plan.maxProductsPerShop) : "",
      );
      setSortOrder(plan?.sortOrder != null ? String(plan.sortOrder) : "0");
      setIsPublic(plan?.isPublic ?? true);
      const f = (plan?.features as Record<string, boolean | number | null>) ?? {};
      setFeatures(f);
      setMaxTeamSeats(
        f.max_team_seats != null ? String(f.max_team_seats) : "",
      );
    }
  }, [open, plan]);

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error("Name is required");
      return;
    }
    const body: CreatePlanBody = {
      name: name.trim(),
      description: description.trim() || undefined,
      priceMonthly: Number(priceMonthly) || 0,
      priceAnnual: priceAnnual === "" ? null : Number(priceAnnual),
      maxShops: maxShops === "" ? null : Number(maxShops),
      maxProductsPerShop: maxProducts === "" ? null : Number(maxProducts),
      features: {
        ...features,
        max_team_seats: maxTeamSeats === "" ? null : Number(maxTeamSeats),
      } as PlanFeatures,
      isPublic,
      sortOrder: Number(sortOrder) || 0,
    };
    try {
      if (isEdit && plan) {
        await updatePlan({ id: plan.id, body }).unwrap();
        toast.success("Plan updated");
      } else {
        await createPlan(body).unwrap();
        toast.success("Plan created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to save plan"));
    }
  };

  // ---- Annual pricing helpers (annual price is the saved source of truth) ----
  const monthlyNum = Number(priceMonthly) || 0;
  const annualNum = priceAnnual === "" ? null : Number(priceAnnual);
  const fullYear = monthlyNum * 12;
  const savingsPct =
    annualNum != null && fullYear > 0
      ? Math.round((1 - annualNum / fullYear) * 100)
      : null;

  /** "Months free" → fill the annual price (monthly × (12 − N)). */
  const onMonthsFreeChange = (raw: string) => {
    setMonthsFree(raw);
    if (raw === "") return;
    const n = Number(raw);
    if (!Number.isNaN(n) && monthlyNum > 0) {
      setPriceAnnual(String(+(monthlyNum * (12 - n)).toFixed(2)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogDescription>
            Pricing tier and feature gating for client brands.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Up to 3 branches with analytics & CMS."
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Monthly price (₹)</Label>
            <Input
              type="number"
              min={0}
              value={priceMonthly}
              onChange={(e) => setPriceMonthly(e.target.value)}
            />
          </div>

          {/* Annual pricing */}
          <div className="rounded-md border p-3 sm:col-span-2">
            <div className="mb-2 text-sm font-medium">Annual pricing</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Months free</Label>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  step="0.5"
                  placeholder="e.g. 2"
                  value={monthsFree}
                  onChange={(e) => onMonthsFreeChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Annual price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="No annual option"
                  value={priceAnnual}
                  onChange={(e) => setPriceAnnual(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {annualNum == null
                ? "Leave blank to offer monthly billing only."
                : `Billed ₹${annualNum.toLocaleString("en-IN")}/year${
                    savingsPct != null && savingsPct > 0
                      ? ` — save ${savingsPct}% vs ₹${fullYear.toLocaleString("en-IN")} monthly`
                      : ""
                  }.`}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Max branches</Label>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxShops}
              onChange={(e) => setMaxShops(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Max products / branch</Label>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxProducts}
              onChange={(e) => setMaxProducts(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Max team members</Label>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxTeamSeats}
              onChange={(e) => setMaxTeamSeats(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Display order</Label>
            <Input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
            <Label htmlFor="public" className="cursor-pointer">
              Public on pricing page
            </Label>
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-2 block">Features</Label>
            {toggleFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gateable features in the catalog yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {toggleFeatures.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                    title={f.description ?? undefined}
                  >
                    <Switch
                      checked={features[f.key] === true}
                      onCheckedChange={(v) =>
                        setFeatures((prev) => ({ ...prev, [f.key]: v }))
                      }
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            )}
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
