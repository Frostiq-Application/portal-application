import { useMemo, useState } from "react";
import { MoreHorizontal, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useCreateAddonMutation,
  useCreateCategoryMutation,
  useDeleteAddonMutation,
  useDeleteCategoryMutation,
  useDeleteProductMutation,
  useListAddonsQuery,
  useListCategoriesQuery,
  useListProductsQuery,
  useToggleProductMutation,
  useUpdateAddonMutation,
  useUpdateCategoryMutation,
} from "@/features/api/catalogApi";
import type { Product, ProductType } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import { ImageUploader } from "@/components/ImageUploader";
import { ProductDialog } from "@/components/catalog/ProductDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function ProductsTab({ shopId }: { shopId: string }) {
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState<ProductType | "all">("all");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");
  const debouncedSearch = useDebouncedValue(search, 350);

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

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "all" | "active" | "hidden")}
          disabled={!shopId}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
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
          New product
        </Button>
      </div>
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
  const { data } = useListCategoriesQuery(shopId ? { shopId } : undefined, { skip: !shopId });
  const [createCategory, { isLoading }] = useCreateCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const rows = data?.data ?? [];

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createCategory({ shopId, name: name.trim(), imageUrl }).unwrap();
      toast.success("Category added");
      setName("");
      setImageUrl(null);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const setRowImage = async (id: string, url: string | null) => {
    try {
      await updateCategory({ id, body: { imageUrl: url } }).unwrap();
      toast.success(url ? "Image updated" : "Image removed");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Birthday Cakes" disabled={!shopId} />
            <Button onClick={add} disabled={isLoading || !shopId}>Add</Button>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Category image (optional)</p>
            <ImageUploader
              value={imageUrl ? [imageUrl] : []}
              onChange={(urls) => setImageUrl(urls[0] ?? null)}
              folder="categories"
              max={1}
            />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-md border bg-background p-3">
            <ImageUploader
              value={c.imageUrl ? [c.imageUrl] : []}
              onChange={(urls) => setRowImage(c.id, urls[0] ?? null)}
              folder="categories"
              max={1}
            />
            <span className="flex-1 text-sm font-medium">{c.name}</span>
            <Button variant="ghost" size="icon" onClick={() => deleteCategory(c.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
      </div>
    </div>
  );
}

function AddonsTab({ shopId }: { shopId: string }) {
  const { data } = useListAddonsQuery(shopId ? { shopId } : undefined, { skip: !shopId });
  const [createAddon, { isLoading }] = useCreateAddonMutation();
  const [updateAddon] = useUpdateAddonMutation();
  const [deleteAddon] = useDeleteAddonMutation();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const rows = data?.data ?? [];

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createAddon({ shopId, name: name.trim(), price: Number(price) || 0, imageUrl }).unwrap();
      toast.success("Add-on added");
      setName("");
      setPrice("0");
      setImageUrl(null);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const setRowImage = async (id: string, url: string | null) => {
    try {
      await updateAddon({ id, body: { imageUrl: url } }).unwrap();
      toast.success(url ? "Image updated" : "Image removed");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Birthday Candles" disabled={!shopId} />
            <Input className="w-32" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button onClick={add} disabled={isLoading || !shopId}>Add</Button>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Add-on image (optional)</p>
            <ImageUploader
              value={imageUrl ? [imageUrl] : []}
              onChange={(urls) => setImageUrl(urls[0] ?? null)}
              folder="addons"
              max={1}
            />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-md border bg-background p-3">
            <ImageUploader
              value={a.imageUrl ? [a.imageUrl] : []}
              onChange={(urls) => setRowImage(a.id, urls[0] ?? null)}
              folder="addons"
              max={1}
            />
            <div className="flex-1 text-sm">
              <span className="font-medium">{a.name}</span>
              <span className="ml-2 text-muted-foreground">₹{Number(a.price)}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteAddon(a.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No add-ons yet.</p>}
      </div>
    </div>
  );
}

export function CatalogPage() {
  const [shopId, setShopId] = useState("");

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Products, categories & add-ons"
        actions={<ShopSelect value={shopId} onChange={setShopId} />}
      />
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <ProductsTab shopId={shopId} />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab shopId={shopId} />
        </TabsContent>
        <TabsContent value="addons" className="mt-4">
          <AddonsTab shopId={shopId} />
        </TabsContent>
      </Tabs>
    </>
  );
}
