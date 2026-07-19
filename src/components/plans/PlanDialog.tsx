import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreatePlanMutation,
  useUpdatePlanMutation,
  type CreatePlanBody,
  type PlanFeatures,
} from "@/features/api/plansApi";
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

/** Boolean feature toggles (max_team_seats is a numeric field, handled separately). */
const FEATURE_LABELS: { key: keyof PlanFeatures; label: string }[] = [
  { key: "can_use_coupons", label: "Coupons" },
  { key: "can_use_cms", label: "CMS" },
  { key: "can_clone_catalog", label: "Catalog cloning" },
  { key: "can_use_realtime", label: "Realtime orders" },
  { key: "can_use_analytics", label: "Analytics" },
  { key: "can_use_wishlist_analytics", label: "Wishlist analytics" },
  { key: "can_use_advanced_analytics", label: "Advanced analytics" },
  { key: "can_use_audit_log", label: "Audit log" },
  { key: "priority_support", label: "Priority support" },
];

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
  const [maxShops, setMaxShops] = useState("");
  const [maxProducts, setMaxProducts] = useState("");
  const [maxTeamSeats, setMaxTeamSeats] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [features, setFeatures] = useState<PlanFeatures>({});

  useEffect(() => {
    if (open) {
      setName(plan?.name ?? "");
      setDescription(plan?.description ?? "");
      setPriceMonthly(plan ? String(Number(plan.priceMonthly)) : "0");
      setMaxShops(plan?.maxShops != null ? String(plan.maxShops) : "");
      setMaxProducts(
        plan?.maxProductsPerShop != null ? String(plan.maxProductsPerShop) : "",
      );
      setIsPublic(plan?.isPublic ?? true);
      const f = (plan?.features as PlanFeatures) ?? {};
      setFeatures(f);
      setMaxTeamSeats(f.max_team_seats != null ? String(f.max_team_seats) : "");
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
      maxShops: maxShops === "" ? null : Number(maxShops),
      maxProductsPerShop: maxProducts === "" ? null : Number(maxProducts),
      features: {
        ...features,
        max_team_seats: maxTeamSeats === "" ? null : Number(maxTeamSeats),
      },
      isPublic,
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
          <div className="flex items-end gap-2">
            <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
            <Label htmlFor="public" className="cursor-pointer">
              Public on pricing page
            </Label>
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-2 block">Features</Label>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_LABELS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm"
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
