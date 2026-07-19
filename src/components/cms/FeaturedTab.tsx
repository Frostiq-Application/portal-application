import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { useAuth } from "@/hooks/useAuth";
import { isAccountAdmin } from "@/lib/roles";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useAssignOccasionProductsMutation,
  useCreateOccasionMutation,
  useGetOccasionProductsQuery,
  useListOccasionsQuery,
} from "@/features/api/cmsApi";
import { useListProductsQuery } from "@/features/api/catalogApi";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import type { Occasion } from "@/types";
import { ShopSelect } from "@/components/ShopSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function FeaturedTab() {
  const branchId = useAppSelector(selectSelectedBranchId);
  const shopId = branchId === ALL_BRANCHES ? "" : branchId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Feature products under an occasion on the storefront.
        </p>
        <ShopSelect />
      </div>
      {!shopId ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a branch to manage its featured products.
          </CardContent>
        </Card>
      ) : (
        <FeaturedEditor shopId={shopId} />
      )}
    </div>
  );
}

function FeaturedEditor({ shopId }: { shopId: string }) {
  const { role } = useAuth();
  const canManageOccasions = isAccountAdmin(role);
  const { data: occasions, isLoading } = useListOccasionsQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default-select the first occasion once loaded.
  useEffect(() => {
    if (!selectedId && occasions && occasions.length > 0) {
      setSelectedId(occasions[0].id);
    }
  }, [occasions, selectedId]);

  const selected = occasions?.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* Occasion list */}
      <div className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ul className="space-y-1">
            {(occasions ?? []).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    o.id === selectedId
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{o.name}</span>
                  {!o.isActive && (
                    <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                      off
                    </span>
                  )}
                </button>
              </li>
            ))}
            {(occasions ?? []).length === 0 && (
              <p className="px-1 py-4 text-sm text-muted-foreground">
                No occasions yet.
              </p>
            )}
          </ul>
        )}
        {canManageOccasions && <NewOccasion />}
      </div>

      {/* Product picker */}
      <div>
        {selected ? (
          <ProductPicker shopId={shopId} occasion={selected} />
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              {canManageOccasions
                ? "Create an occasion to start featuring products."
                : "No occasions available. Ask your brand admin to add one."}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function NewOccasion() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [create, { isLoading }] = useCreateOccasionMutation();

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await create({ name: name.trim() }).unwrap();
      setName("");
      setAdding(false);
      toast.success("Occasion added");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  if (!adding) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setAdding(true)}
      >
        <Plus className="mr-1 h-4 w-4" />
        New occasion
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        autoFocus
        placeholder="Occasion name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button size="sm" onClick={submit} disabled={isLoading}>
        Add
      </Button>
    </div>
  );
}

function ProductPicker({
  shopId,
  occasion,
}: {
  shopId: string;
  occasion: Occasion;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const { data: products, isLoading: loadingProducts } = useListProductsQuery({
    shopId,
    limit: 100,
    search: debouncedSearch || undefined,
  });
  const { data: current, isFetching: loadingCurrent } =
    useGetOccasionProductsQuery({ occasionId: occasion.id, shopId });
  const [assign, { isLoading: saving }] = useAssignOccasionProductsMutation();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Seed the selection from the saved assignment when it (re)loads.
  useEffect(() => {
    if (current) setSelected(new Set(current.productIds));
  }, [current, occasion.id]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = products?.data ?? [];

  const savedSet = useMemo(
    () => new Set(current?.productIds ?? []),
    [current],
  );
  const dirty = useMemo(() => {
    if (selected.size !== savedSet.size) return true;
    for (const id of selected) if (!savedSet.has(id)) return true;
    return false;
  }, [selected, savedSet]);

  const save = async () => {
    try {
      // Preserve picker order by walking the product list.
      const ordered = rows
        .map((p) => p.id)
        .filter((id) => selected.has(id));
      // Include any selected ids not on the current (filtered) page.
      for (const id of selected) if (!ordered.includes(id)) ordered.push(id);
      const res = await assign({
        occasionId: occasion.id,
        shopId,
        productIds: ordered,
      }).unwrap();
      toast.success(
        res.assigned === 0
          ? "Cleared featured products"
          : `${res.assigned} product${res.assigned === 1 ? "" : "s"} featured`,
      );
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <div className="min-w-0">
          <h3 className="font-medium">{occasion.name}</h3>
          <p className="text-xs text-muted-foreground">
            {selected.size} selected
          </p>
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="max-h-[28rem] overflow-y-auto p-2">
        {loadingProducts || loadingCurrent ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {search ? "No products match." : "No products in this branch yet."}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((p) => {
              const checked = selected.has(p.id);
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    {p.images[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-9 w-9 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {p.productType}
                        {!p.isActive && " · hidden"}
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
