import { useState } from "react";
import { Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateFeatureMutation,
  useDeleteFeatureMutation,
  useListFeaturesQuery,
  useUpdateFeatureMutation,
  type CreateFeatureBody,
  type Feature,
  type FeatureKind,
} from "@/features/api/featuresApi";
import { apiError } from "@/lib/apiError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const EMPTY = {
  key: "",
  label: "",
  category: "marketing",
  kind: "boolean" as FeatureKind,
  description: "",
  sortOrder: "0",
};

export function FeaturesManagerDialog({ open, onOpenChange }: Props) {
  const { data: features, isLoading } = useListFeaturesQuery(undefined, {
    skip: !open,
  });
  const [createFeature, { isLoading: creating }] = useCreateFeatureMutation();
  const [updateFeature, { isLoading: updating }] = useUpdateFeatureMutation();
  const [deleteFeature] = useDeleteFeatureMutation();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const isEdit = editingKey !== null;
  const busy = creating || updating;

  const resetForm = () => {
    setEditingKey(null);
    setForm({ ...EMPTY });
  };

  const startEdit = (f: Feature) => {
    setEditingKey(f.key);
    setForm({
      key: f.key,
      label: f.label,
      category: f.category,
      kind: f.kind,
      description: f.description ?? "",
      sortOrder: String(f.sortOrder),
    });
  };

  const submit = async () => {
    if (!isEdit && !/^[a-z][a-z0-9_]*$/.test(form.key)) {
      toast.error("Key must be lowercase snake_case (e.g. can_use_loyalty)");
      return;
    }
    if (form.label.trim().length < 2) {
      toast.error("Label is required");
      return;
    }
    try {
      if (isEdit) {
        await updateFeature({
          key: editingKey,
          body: {
            label: form.label.trim(),
            description: form.description.trim() || undefined,
            category: form.category.trim(),
            kind: form.kind,
            sortOrder: Number(form.sortOrder) || 0,
          },
        }).unwrap();
        toast.success("Feature updated");
      } else {
        const body: CreateFeatureBody = {
          key: form.key.trim(),
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim(),
          kind: form.kind,
          sortOrder: Number(form.sortOrder) || 0,
        };
        await createFeature(body).unwrap();
        toast.success("Feature added");
      }
      resetForm();
    } catch (err) {
      toast.error(apiError(err, "Failed to save feature"));
    }
  };

  const onDelete = async (f: Feature) => {
    if (
      !window.confirm(
        `Delete "${f.label}"? It will be removed from every plan. This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteFeature(f.key).unwrap();
      toast.success("Feature deleted");
      if (editingKey === f.key) resetForm();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete feature"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage features</DialogTitle>
          <DialogDescription>
            The feature catalog. Adding a boolean feature makes it toggleable in
            every plan; it only starts blocking a route once a developer wires a{" "}
            <code>@RequiresFeature</code> guard to its key.
          </DialogDescription>
        </DialogHeader>

        {/* Add / edit form */}
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {isEdit ? `Edit “${editingKey}”` : "Add a feature"}
            </span>
            {isEdit && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel edit
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Key</Label>
              <Input
                placeholder="can_use_loyalty"
                value={form.key}
                disabled={isEdit}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Label</Label>
              <Input
                placeholder="Loyalty program"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Input
                placeholder="marketing"
                list="feature-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="feature-categories">
                <option value="marketing" />
                <option value="insight" />
                <option value="product" />
                <option value="scale" />
                <option value="core" />
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm({ ...form, kind: v as FeatureKind })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Boolean (on/off)</SelectItem>
                  <SelectItem value="limit">Limit (number)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Input
                placeholder="Points & rewards for repeat customers."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sort order</Label>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: e.target.value })
                }
              />
            </div>
            <div className="flex items-end">
              <Button onClick={submit} disabled={busy} className="w-full">
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isEdit ? (
                  <Pencil className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {isEdit ? "Save changes" : "Add feature"}
              </Button>
            </div>
          </div>
        </div>

        {/* Catalog list */}
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (
            (features ?? []).map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-2 border-b p-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {f.label}
                    </span>
                    {f.isProtected && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <code className="text-[11px] text-muted-foreground">
                    {f.key}
                  </code>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {f.category}
                </Badge>
                <Badge variant="outline" className="shrink-0">
                  {f.kind}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => startEdit(f)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  disabled={f.isProtected}
                  title={
                    f.isProtected ? "System feature — cannot delete" : "Delete"
                  }
                  onClick={() => onDelete(f)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
