import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/ui/icons";
import { useUpsertFeatureMutation } from "@/features/api/billingAdminApi";
import type { BillingFeature, FeatureDataType } from "@/types/billing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ["core", "scale", "marketing", "insight", "support"];

/**
 * Feature editor (SA-01/02/03/04).
 *
 * The data type is the consequential choice, and the form says so plainly:
 * picking **Boolean** hides the add-on fields entirely, because a boolean
 * feature can never be sold as an add-on — that's the rule that keeps a higher
 * tier worth paying for, and the database enforces it too.
 */
export function FeatureEditorDialog({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: BillingFeature | null;
}) {
  const [upsert, { isLoading }] = useUpsertFeatureMutation();

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("core");
  const [dataType, setDataType] = useState<FeatureDataType>("boolean");
  const [addonStep, setAddonStep] = useState("");
  const [addonPrice, setAddonPrice] = useState("");
  const [trialLimit, setTrialLimit] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  // Seeded during render rather than in an effect so the fields are correct on
  // first paint instead of flashing the previous feature's values for a frame.
  const seedKey = open ? (feature?.key ?? "new") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setKey(feature?.key ?? "");
    setLabel(feature?.label ?? "");
    setDescription(feature?.description ?? "");
    setCategory(feature?.category ?? "core");
    setDataType(feature?.dataType ?? "boolean");
    setAddonStep(feature?.addonStep != null ? String(feature.addonStep) : "");
    setAddonPrice(
      feature?.addonPriceMonthly != null
        ? String(Number(feature.addonPriceMonthly))
        : "",
    );
    setTrialLimit(feature?.trialLimit != null ? String(feature.trialLimit) : "");
    setSortOrder(String(feature?.sortOrder ?? 0));
    setIsActive(feature?.isActive ?? true);
  }

  const isCount = dataType === "count";

  async function handleSave() {
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(key)) {
      toast.error("Key must be lowercase snake_case, at least 3 characters.");
      return;
    }
    if (!label.trim()) {
      toast.error("Give the feature a display name.");
      return;
    }

    try {
      await upsert({
        key,
        label: label.trim(),
        description: description.trim() || undefined,
        category,
        dataType,
        addonStep: isCount && addonStep ? Number(addonStep) : null,
        addonPriceMonthly: (isCount && addonPrice
          ? Number(addonPrice)
          : null) as unknown as string | null,
        trialLimit: isCount && trialLimit !== "" ? Number(trialLimit) : null,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      }).unwrap();
      toast.success(`${label} saved.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't save that feature.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {feature ? `Edit ${feature.label}` : "New feature"}
          </DialogTitle>
          <DialogDescription>
            Features are the building blocks every plan, trial and add-on is made
            of.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-key">Key</Label>
              <Input
                id="f-key"
                value={key}
                disabled={!!feature}
                onChange={(e) =>
                  setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                }
                placeholder="can_use_cms"
                className="font-mono text-sm"
              />
              {feature && (
                <p className="text-xs text-muted-foreground">
                  Keys are referenced by code gates and can't change.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-label">Display name</Label>
              <Input
                id="f-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Storefront content"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-desc">Description</Label>
            <Textarea
              id="f-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-type">Data type</Label>
              <Select
                value={dataType}
                onValueChange={(v) => setDataType(v as FeatureDataType)}
                disabled={!!feature}
              >
                <SelectTrigger id="f-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Boolean (on/off)</SelectItem>
                  <SelectItem value="count">Count (numeric limit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-cat">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="f-cat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-order">Order</Label>
              <Input
                id="f-order"
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          {isCount ? (
            <>
              <Separator />
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Add-on & trial</h3>
                  <p className="text-xs text-muted-foreground">
                    Leaving the price empty disables add-on sales for this
                    feature — accounts will only get what their plan includes.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="f-step">Step size</Label>
                    <Input
                      id="f-step"
                      inputMode="numeric"
                      value={addonStep}
                      onChange={(e) =>
                        setAddonStep(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Units per step
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-price">₹ / step / month</Label>
                    <Input
                      id="f-price"
                      inputMode="decimal"
                      value={addonPrice}
                      onChange={(e) =>
                        setAddonPrice(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      placeholder="199"
                    />
                    <p className="text-xs text-muted-foreground">
                      Empty = not sold
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-trial">Trial cap</Label>
                    <Input
                      id="f-trial"
                      inputMode="numeric"
                      value={trialLimit}
                      onChange={(e) =>
                        setTrialLimit(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Empty = the plan's own limit
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Boolean features are obtained only by upgrading a plan. They can
              never be sold as add-ons — that's what protects tier value.
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="f-active" className="font-medium">
                Active platform-wide
              </Label>
              <p className="text-xs text-muted-foreground">
                Deactivating hides it everywhere without deleting anything.
              </p>
            </div>
            <Switch id="f-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Save feature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
