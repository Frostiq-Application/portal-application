import { useMemo, useState } from "react";
import { ArrowRight, Copy, Loader2, Lock, Sparkles } from "@/components/ui/icons";
import { toast } from "sonner";
import {
  useCloneCatalogMutation,
  useListProductsQuery,
} from "@/features/api/catalogApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** The branch to copy FROM — the one currently selected in the catalog. */
  sourceShopId: string;
  sourceShopName?: string;
}

/**
 * Copies a branch's catalog into another branch of the same account. Full copies
 * everything (products, categories, add-ons); selective copies chosen products
 * only. Gated by the `can_clone_catalog` plan feature — non-entitled brands see
 * an upgrade prompt instead of the form.
 */
export function CloneCatalogDialog({
  open,
  onOpenChange,
  sourceShopId,
  sourceShopName,
}: Props) {
  const { hasFeature } = useEntitlements();
  const canClone = hasFeature("can_clone_catalog");

  const [targetShopId, setTargetShopId] = useState("");
  const [mode, setMode] = useState<"full" | "selective">("full");
  const [copyPrices, setCopyPrices] = useState(true);
  const [productIds, setProductIds] = useState<string[]>([]);

  const { data: shops, isLoading: shopsLoading } = useListShopsQuery(
    open ? { limit: 100, status: "active" } : undefined,
    { skip: !open || !canClone },
  );
  // Only the source branch's products can be selectively cloned.
  const { data: products, isLoading: productsLoading } = useListProductsQuery(
    // The products endpoint caps limit at 100; a branch rarely holds more, and
    // the picker is for choosing a subset anyway.
    open && mode === "selective" && sourceShopId
      ? { shopId: sourceShopId, limit: 100 }
      : undefined,
    { skip: !open || mode !== "selective" || !sourceShopId },
  );

  const [clone, { isLoading: cloning }] = useCloneCatalogMutation();

  // Cleared during render rather than in an effect, so a reopened dialog never
  // paints the previous run's selection for a frame before resetting.
  const [seeded, setSeeded] = useState(false);
  if (open !== seeded) {
    setSeeded(open);
    if (open) {
      setTargetShopId("");
      setMode("full");
      setCopyPrices(true);
      setProductIds([]);
    }
  }

  // Branches you can copy INTO — every active branch except the source.
  const targets = useMemo(
    () => (shops?.data ?? []).filter((s) => s.id !== sourceShopId),
    [shops, sourceShopId],
  );

  const toggleProduct = (id: string) =>
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = async () => {
    if (!targetShopId) return toast.error("Choose a target branch");
    if (mode === "selective" && productIds.length === 0) {
      return toast.error("Select at least one product to clone");
    }
    try {
      const res = await clone({
        sourceShopId,
        targetShopId,
        mode,
        copyPrices,
        ...(mode === "selective" ? { productIds } : {}),
      }).unwrap();
      toast.success(
        `Cloned ${res.productsCreated} product(s), ${res.categoriesCreated} categor${
          res.categoriesCreated === 1 ? "y" : "ies"
        }` + (res.addonsCreated ? `, ${res.addonsCreated} add-on(s)` : ""),
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to clone catalog"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Clone catalog
          </DialogTitle>
          <DialogDescription>
            {sourceShopName
              ? `Copy ${sourceShopName}'s catalog into another branch.`
              : "Copy this branch's catalog into another branch of your account."}
          </DialogDescription>
        </DialogHeader>

        {!canClone ? (
          <UpgradePrompt />
        ) : (
          <div className="space-y-5 py-1">
            {/* Target branch */}
            <div className="flex flex-col gap-1.5">
              <Label>Copy into</Label>
              {shopsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : targets.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  You need a second branch to clone into. Create another branch
                  first.
                </p>
              ) : (
                <Select value={targetShopId} onValueChange={setTargetShopId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Mode */}
            <div className="flex flex-col gap-1.5">
              <Label>What to copy</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "full", t: "Everything", d: "Products, categories & add-ons" },
                    { v: "selective", t: "Selected products", d: "Pick individual products" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setMode(o.v)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      mode === o.v
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="text-sm font-medium">{o.t}</div>
                    <div className="text-xs text-muted-foreground">{o.d}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selective product list */}
            {mode === "selective" && (
              <div className="flex flex-col gap-1.5">
                <Label>Products ({productIds.length} selected)</Label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                  {productsLoading ? (
                    [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)
                  ) : (products?.data ?? []).length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      This branch has no products to clone.
                    </p>
                  ) : (
                    (products?.data ?? []).map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={productIds.includes(p.id)}
                          onCheckedChange={() => toggleProduct(p.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {p.productType}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Copy prices */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Copy prices</div>
                <div className="text-xs text-muted-foreground">
                  Off = target items start at ₹0 for you to reprice.
                </div>
              </div>
              <Switch checked={copyPrices} onCheckedChange={setCopyPrices} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {canClone ? "Cancel" : "Close"}
          </Button>
          {canClone && (
            <Button onClick={submit} disabled={cloning || targets.length === 0}>
              {cloning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Clone
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shown in place of the form when the plan doesn't include cloning. */
function UpgradePrompt() {
  const { entitlements } = useEntitlements();
  return (
    <div className="rounded-xl border bg-muted/30 p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-medium">Catalog cloning is a Growth &amp; Pro feature</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        Set up a new branch in seconds by copying an existing branch's products,
        categories and add-ons
        {entitlements?.planName ? ` — not included in ${entitlements.planName}` : ""}.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Upgrade to unlock
      </div>
    </div>
  );
}
