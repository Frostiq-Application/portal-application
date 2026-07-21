import { useMemo, useState } from "react";
import {
  Boxes,
  Cake,
  CheckCircle2,
  Copy,
  EyeOff,
  LayoutGrid,
  Layers,
  Lock,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useDeleteAddonMutation,
  useDeleteCategoryMutation,
  useDeleteProductMutation,
  useListAddonsQuery,
  useListCategoriesQuery,
  useListProductsQuery,
  useToggleProductMutation,
  useUpdateAddonMutation,
} from "@/features/api/catalogApi";
import type { Addon, Category, Product, ProductType } from "@/types";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import { useEntitlements } from "@/hooks/useEntitlements";
import { CloneCatalogDialog } from "@/components/catalog/CloneCatalogDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import { SegmentedStrip } from "@/components/SegmentedStrip";
import { ProductDialog } from "@/components/catalog/ProductDialog";
import { AddonDialog } from "@/components/catalog/AddonDialog";
import { CategoryDialog } from "@/components/catalog/CategoryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRODUCT_TYPES: ProductType[] = ["cake", "cupcake", "chocolate"];

function ProductsTab({
  shopId,
  used,
  cap,
}: {
  shopId: string;
  /** Total products in this branch (unfiltered), for the plan cap. */
  used: number;
  /** Plan's max products per branch. null = unlimited. */
  cap: number | null;
}) {
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState<ProductType | "all">("all");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");
  const debouncedSearch = useDebouncedValue(search, 350);
  const atCap = cap != null && used >= cap;

  const { data, isLoading } = useListProductsQuery(
    shopId
      ? {
          shopId,
          limit: 100,
          search: debouncedSearch || undefined,
          productType: productType === "all" ? undefined : productType,
          categoryId: categoryId === "all" ? undefined : categoryId,
        }
      : undefined,
    { skip: !shopId },
  );
  const { data: categories } = useListCategoriesQuery(
    shopId ? { shopId } : undefined,
    { skip: !shopId },
  );
  const [toggleProduct] = useToggleProductMutation();
  const [deleteProduct] = useDeleteProductMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // isActive isn't a server filter — narrow the current page client-side.
  const rows = useMemo(() => {
    const all = data?.data ?? [];
    if (statusFilter === "all") return all;
    return all.filter((p) =>
      statusFilter === "active" ? p.isActive : !p.isActive,
    );
  }, [data, statusFilter]);

  // Live counts for the status strip, from the current (already-fetched) page.
  const statusItems = useMemo(() => {
    const all = data?.data ?? [];
    const active = all.filter((p) => p.isActive).length;
    return [
      { value: "all" as const, label: "All", icon: LayoutGrid, count: all.length },
      {
        value: "active" as const,
        label: "Active",
        icon: CheckCircle2,
        accent: "#10b981",
        count: active,
      },
      {
        value: "hidden" as const,
        label: "Hidden",
        icon: EyeOff,
        accent: "#94a3b8",
        count: all.length - active,
      },
    ];
  }, [data]);

  const hasFilters =
    !!search ||
    productType !== "all" ||
    categoryId !== "all" ||
    statusFilter !== "all";

  const clearAll = () => {
    setSearch("");
    setProductType("all");
    setCategoryId("all");
    setStatusFilter("all");
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      {/* Secondary sub-filter (active/hidden) — quieter than the tab strip. */}
      <SegmentedStrip
        variant="secondary"
        className="mb-3"
        value={statusFilter}
        items={statusItems}
        onChange={(v) => setStatusFilter(v)}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!shopId}
          />
        </div>

        <Select
          value={productType}
          onValueChange={(v) => setProductType(v as ProductType | "all")}
          disabled={!shopId}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          disabled={!shopId}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories?.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {cap != null && (
            <span
              className={cn(
                "text-xs font-medium",
                atCap ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {used} / {cap} products
            </span>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={!shopId || atCap}
            title={
              atCap
                ? `Your plan allows up to ${cap} products per branch. Upgrade to add more.`
                : undefined
            }
          >
            New product
          </Button>
        </div>
      </div>
      {atCap && (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          You’ve reached your plan’s limit of {cap} products for this branch.
          Upgrade to Growth or Pro to add more.
        </p>
      )}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No products. Add your first one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const min = p.variants.length
                  ? Math.min(...p.variants.map((v) => Number(v.price)))
                  : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.isEggless && (
                        <span className="text-[10px] uppercase text-emerald-600">Eggless</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{p.productType}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.variants.length}</TableCell>
                    <TableCell className="text-sm">₹{min}</TableCell>
                    <TableCell>
                      <span className={p.isActive ? "text-xs text-emerald-600" : "text-xs text-muted-foreground"}>
                        {p.isActive ? "Active" : "Hidden"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(p); setDialogOpen(true); }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => run(() => toggleProduct({ id: p.id, isActive: !p.isActive }).unwrap(), "Updated")}
                          >
                            {p.isActive ? "Hide" : "Show"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => run(() => deleteProduct(p.id).unwrap(), "Deleted")}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {shopId && (
        <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} shopId={shopId} product={editing} />
      )}
    </>
  );
}

function CategoriesTab({ shopId }: { shopId: string }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const { data, isLoading } = useListCategoriesQuery(
    shopId ? { shopId, search: debouncedSearch || undefined } : undefined,
    { skip: !shopId },
  );
  const [deleteCategory] = useDeleteCategoryMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const rows = data?.data ?? [];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!shopId}
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          disabled={!shopId}
        >
          New category
        </Button>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Category</TableHead>
              <TableHead>Sort order</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No categories yet. Add your first one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.sortOrder}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setDialogOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            run(() => deleteCategory(c.id).unwrap(), "Deleted")
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {shopId && (
        <CategoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          shopId={shopId}
          category={editing}
        />
      )}
    </>
  );
}

function AddonsTab({ shopId }: { shopId: string }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const { data, isLoading } = useListAddonsQuery(
    shopId ? { shopId, search: debouncedSearch || undefined } : undefined,
    { skip: !shopId },
  );
  const [updateAddon] = useUpdateAddonMutation();
  const [deleteAddon] = useDeleteAddonMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const rows = data?.data ?? [];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search add-ons…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!shopId}
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          disabled={!shopId}
        >
          New add-on
        </Button>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Add-on</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No add-ons yet. Add your first one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.imageUrl ? (
                      <img
                        src={a.imageUrl}
                        alt={a.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-sm">
                    ₹{Number(a.price)}
                    <span className="text-muted-foreground"> / {a.unitType}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.trackInventory ? (a.stockQuantity ?? 0) : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        a.isActive
                          ? "text-xs text-emerald-600"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {a.isActive ? "Active" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(a);
                            setDialogOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () =>
                                updateAddon({
                                  id: a.id,
                                  body: { isActive: !a.isActive },
                                }).unwrap(),
                              "Updated",
                            )
                          }
                        >
                          {a.isActive ? "Hide" : "Show"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            run(() => deleteAddon(a.id).unwrap(), "Deleted")
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {shopId && (
        <AddonDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          shopId={shopId}
          addon={editing}
        />
      )}
    </>
  );
}

type CatalogTab = "products" | "categories" | "addons";

/** Accent per tab — mirrors the Orders strip's per-stage colour language. */
const TAB_ACCENT: Record<CatalogTab, string> = {
  products: "#f59e0b", // amber
  categories: "#6366f1", // indigo
  addons: "#14b8a6", // teal
};

export function CatalogPage() {
  const shopId = useAppSelector(selectSelectedBranchId);
  // Catalog is always scoped to a concrete branch; "all" isn't meaningful here.
  const effectiveShopId = shopId === ALL_BRANCHES ? "" : shopId;
  const [tab, setTab] = useState<CatalogTab>("products");
  const [cloneOpen, setCloneOpen] = useState(false);
  const { hasFeature, entitlements } = useEntitlements();
  const canClone = hasFeature("can_clone_catalog");

  // Lightweight count queries (limit 1 → only meta.total is used) so the strip
  // shows how many items live under each tab. Shared cache with the tab bodies.
  const { data: productCount } = useListProductsQuery(
    effectiveShopId ? { shopId: effectiveShopId, limit: 1 } : undefined,
    { skip: !effectiveShopId },
  );
  const { data: categoryCount } = useListCategoriesQuery(
    effectiveShopId ? { shopId: effectiveShopId, limit: 1 } : undefined,
    { skip: !effectiveShopId },
  );
  const { data: addonCount } = useListAddonsQuery(
    effectiveShopId ? { shopId: effectiveShopId, limit: 1 } : undefined,
    { skip: !effectiveShopId },
  );

  const tabItems = useMemo(
    () => [
      {
        value: "products" as const,
        label: "Products",
        icon: Cake,
        accent: TAB_ACCENT.products,
        count: productCount?.meta.total,
      },
      {
        value: "categories" as const,
        label: "Categories",
        icon: Layers,
        accent: TAB_ACCENT.categories,
        count: categoryCount?.meta.total,
      },
      {
        value: "addons" as const,
        label: "Add-ons",
        icon: Boxes,
        accent: TAB_ACCENT.addons,
        count: addonCount?.meta.total,
      },
    ],
    [productCount, categoryCount, addonCount],
  );

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Products, categories & add-ons"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCloneOpen(true)}
              disabled={!effectiveShopId}
              title={
                effectiveShopId
                  ? undefined
                  : "Select a branch to clone its catalog"
              }
            >
              {canClone ? (
                <Copy className="mr-2 h-4 w-4" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Clone catalog
            </Button>
            <ShopSelect />
          </div>
        }
      />

      <SegmentedStrip
        className="mb-4"
        value={tab}
        items={tabItems}
        onChange={setTab}
      />

      {tab === "products" && (
        <ProductsTab
          shopId={effectiveShopId}
          used={productCount?.meta.total ?? 0}
          cap={entitlements?.maxProductsPerShop ?? null}
        />
      )}
      {tab === "categories" && <CategoriesTab shopId={effectiveShopId} />}
      {tab === "addons" && <AddonsTab shopId={effectiveShopId} />}

      {effectiveShopId && (
        <CloneCatalogDialog
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          sourceShopId={effectiveShopId}
        />
      )}
    </>
  );
}
