import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateProductMutation,
  useListCategoriesQuery,
  useUpdateProductMutation,
  type CreateProductBody,
  type FlavorInput,
  type VariantInput,
} from "@/features/api/catalogApi";
import { apiError } from "@/lib/apiError";
import type { Product, ProductType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

const TYPES: ProductType[] = ["cake", "cupcake", "chocolate"];

// Local editing rows keep price fields as raw strings so the user can clear
// the input (empty string) instead of it snapping back to 0. Converted to
// numbers on submit.
type VariantRow = Omit<VariantInput, "price"> & { price: string };
type FlavorRow = Omit<FlavorInput, "priceDelta"> & { priceDelta: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shopId: string;
  product?: Product | null;
}

export function ProductDialog({ open, onOpenChange, shopId, product }: Props) {
  const isEdit = Boolean(product);
  const { data: categories } = useListCategoriesQuery({ shopId, limit: 100 });
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();

  const [name, setName] = useState("");
  const [productType, setProductType] = useState<ProductType>("cake");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isEggless, setIsEggless] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [minOrderHours, setMinOrderHours] = useState("0");
  const [variants, setVariants] = useState<VariantRow[]>([
    { label: "", price: "", isDefault: true },
  ]);
  const [flavors, setFlavors] = useState<FlavorRow[]>([]);

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setProductType(product?.productType ?? "cake");
      setCategoryId(product?.categoryId ?? "none");
      setDescription(product?.description ?? "");
      setImages(product?.images ?? []);
      setIsEggless(product?.isEggless ?? false);
      setIsFeatured(product?.isFeatured ?? false);
      setMinOrderHours(String(product?.minOrderHours ?? 0));
      setVariants(
        product && product.variants.length
          ? product.variants.map((v) => ({
              label: v.label,
              price: String(Number(v.price)),
              unitType: v.unitType,
              isDefault: v.isDefault,
              sku: v.sku ?? undefined,
            }))
          : [{ label: "", price: "", isDefault: true }],
      );
      setFlavors(
        (product?.flavorOptions ?? []).map((f) => ({
          flavorName: f.flavorName,
          priceDelta: String(Number(f.priceDelta)),
        })),
      );
    }
  }, [open, product]);

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const setFlavor = (i: number, patch: Partial<FlavorRow>) =>
    setFlavors((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const submit = async () => {
    if (name.trim().length < 1) return toast.error("Name is required");
    if (categoryId === "none") return toast.error("Category is required");
    const cleanVariants = variants
      .filter((v) => v.label.trim())
      .map((v) => ({ ...v, label: v.label.trim(), price: Number(v.price) || 0 }));
    if (cleanVariants.length === 0) return toast.error("At least one variant is required");

    const body: CreateProductBody = {
      productType,
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      images,
      isEggless,
      isFeatured,
      minOrderHours: Number(minOrderHours) || 0,
      variants: cleanVariants,
      flavorOptions: flavors
        .filter((f) => f.flavorName.trim())
        .map((f) => ({ flavorName: f.flavorName.trim(), priceDelta: Number(f.priceDelta) || 0 })),
    };

    try {
      if (isEdit && product) {
        await updateProduct({ id: product.id, body }).unwrap();
        toast.success("Product updated");
      } else {
        await createProduct({ ...body, shopId }).unwrap();
        toast.success("Product created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to save product"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>Cake, cupcake, or chocolate with variants & flavours.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {(categories?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Min order hours (lead time)</Label>
            <Input type="number" min={0} value={minOrderHours} onChange={(e) => setMinOrderHours(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Images</Label>
            <ImageUploader value={images} onChange={setImages} folder="products" max={8} />
          </div>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isEggless} onCheckedChange={setIsEggless} /> Eggless
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} /> Featured
            </label>
          </div>

          {/* Variants */}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <Label>Variants</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVariants((p) => [...p, { label: "", price: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Label (e.g. 1 Kg)"
                    value={v.label}
                    onChange={(e) => setVariant(i, { label: e.target.value })}
                  />
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      className="pl-6"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="Price"
                      value={v.price}
                      onChange={(e) => setVariant(i, { price: e.target.value })}
                    />
                  </div>
                  <label className="flex w-20 items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="defaultVariant"
                      checked={!!v.isDefault}
                      onChange={() =>
                        setVariants((prev) =>
                          prev.map((x, idx) => ({ ...x, isDefault: idx === i })),
                        )
                      }
                    />
                    default
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setVariants((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Flavours */}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <Label>Flavours (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFlavors((p) => [...p, { flavorName: "", priceDelta: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {flavors.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Flavour (e.g. Red Velvet)"
                    value={f.flavorName}
                    onChange={(e) => setFlavor(i, { flavorName: e.target.value })}
                  />
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      +₹
                    </span>
                    <Input
                      className="pl-8"
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={f.priceDelta}
                      onChange={(e) => setFlavor(i, { priceDelta: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFlavors((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={creating || updating}>
            {(creating || updating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
