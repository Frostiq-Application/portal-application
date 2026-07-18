import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
} from "@/features/api/catalogApi";
import { apiError } from "@/lib/apiError";
import type { Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ImageUploader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shopId: string;
  category?: Category | null;
}

export function CategoryDialog({ open, onOpenChange, shopId, category }: Props) {
  const isEdit = Boolean(category);
  const [createCategory, { isLoading: creating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Kept as a raw string so the field can be cleared instead of snapping to 0.
  const [sortOrder, setSortOrder] = useState("0");

  // Reset the form whenever the dialog opens or the target category changes.
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setImageUrl(category?.imageUrl ?? null);
    setSortOrder(category ? String(category.sortOrder) : "0");
  }, [open, category]);

  const saving = creating || updating;

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const body = {
      name: name.trim(),
      imageUrl,
      sortOrder: Number(sortOrder) || 0,
    };
    try {
      if (isEdit && category) {
        await updateCategory({ id: category.id, body }).unwrap();
        toast.success("Category updated");
      } else {
        await createCategory({ shopId, ...body }).unwrap();
        toast.success("Category added");
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
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Categories group products in the storefront.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Birthday Cakes"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-sort">Sort order</Label>
            <Input
              id="category-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Image (optional)</Label>
            <ImageUploader
              value={imageUrl ? [imageUrl] : []}
              onChange={(urls) => setImageUrl(urls[0] ?? null)}
              folder="categories"
              max={1}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
