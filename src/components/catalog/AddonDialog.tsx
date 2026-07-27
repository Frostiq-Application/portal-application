import { useEffect, useState } from "react";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import {
  useCreateAddonMutation,
  useUpdateAddonMutation,
} from "@/features/api/catalogApi";
import { apiError } from "@/lib/apiError";
import type { Addon, UnitType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ImageUploader";
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

const UNIT_TYPES: UnitType[] = ["piece", "kg", "gram", "box"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shopId: string;
  addon?: Addon | null;
}

export function AddonDialog({ open, onOpenChange, shopId, addon }: Props) {
  const isEdit = Boolean(addon);
  const [createAddon, { isLoading: creating }] = useCreateAddonMutation();
  const [updateAddon, { isLoading: updating }] = useUpdateAddonMutation();

  const [name, setName] = useState("");
  // Kept as a raw string so the field can be cleared instead of snapping to 0.
  const [price, setPrice] = useState("0");
  const [unitType, setUnitType] = useState<UnitType>("piece");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [trackInventory, setTrackInventory] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("");

  // Reset the form whenever the dialog opens or the target add-on changes.
  useEffect(() => {
    if (!open) return;
    setName(addon?.name ?? "");
    setPrice(addon ? String(Number(addon.price)) : "0");
    setUnitType(addon?.unitType ?? "piece");
    setImageUrl(addon?.imageUrl ?? null);
    setTrackInventory(addon?.trackInventory ?? false);
    setStockQuantity(
      addon?.stockQuantity != null ? String(addon.stockQuantity) : "",
    );
  }, [open, addon]);

  const saving = creating || updating;

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const body = {
      name: name.trim(),
      price: Number(price) || 0,
      unitType,
      imageUrl,
      trackInventory,
      stockQuantity: trackInventory ? Number(stockQuantity) || 0 : undefined,
    };
    try {
      if (isEdit && addon) {
        await updateAddon({ id: addon.id, body }).unwrap();
        toast.success("Add-on updated");
      } else {
        await createAddon({ shopId, ...body }).unwrap();
        toast.success("Add-on added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit add-on" : "New add-on"}</DialogTitle>
          <DialogDescription>
            Add-ons appear as optional extras at checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="addon-name">Name</Label>
            <Input
              id="addon-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Birthday Candles"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="addon-price">Price (₹)</Label>
              <Input
                id="addon-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={unitType}
                onValueChange={(v) => setUnitType(v as UnitType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((u) => (
                    <SelectItem key={u} value={u} className="capitalize">
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Image (optional)</Label>
            <ImageUploader
              value={imageUrl ? [imageUrl] : []}
              onChange={(urls) => setImageUrl(urls[0] ?? null)}
              folder="addons"
              max={1}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="addon-track" className="text-sm">
                Track inventory
              </Label>
              <p className="text-xs text-muted-foreground">
                Deduct stock as this add-on sells.
              </p>
            </div>
            <Switch
              id="addon-track"
              checked={trackInventory}
              onCheckedChange={setTrackInventory}
            />
          </div>

          {trackInventory && (
            <div className="space-y-1.5">
              <Label htmlFor="addon-stock">Stock quantity</Label>
              <Input
                id="addon-stock"
                type="number"
                min={0}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add add-on"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
