import { useCallback, useMemo, useState } from "react";
import { Plus, Sparkles, Search, Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { useAuth } from "@/hooks/useAuth";
import { isAccountAdmin } from "@/lib/roles";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import {
  useAssignOccasionProductsMutation,
  useCreateOccasionMutation,
  useGetOccasionProductsQuery,
  useListOccasionsQuery,
  useUpdateOccasionMutation,
} from "@/features/api/cmsApi";
import { useListProductsQuery } from "@/features/api/catalogApi";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import type { Occasion, Product } from "@/types";
import { ShopSelect } from "@/components/ShopSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/** Rows per product request in the picker — one screenful plus a little. */
const PRODUCT_PAGE_SIZE = 20;

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

  // Default to the first occasion once loaded. Derived rather than pushed into
  // state by an effect, so the list is never briefly rendered with nothing
  // selected on the paint the occasions arrive.
  const effectiveId = selectedId ?? occasions?.[0]?.id ?? null;
  const selected = occasions?.find((o) => o.id === effectiveId) ?? null;

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* Occasion list */}
      <div className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ul className="space-y-1">
            {(occasions ?? []).map((o) => (
              <OccasionRow
                key={o.id}
                occasion={o}
                isSelected={o.id === effectiveId}
                canManage={canManageOccasions}
                onSelect={() => setSelectedId(o.id)}
              />
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

/**
 * One occasion in the sidebar: selects the occasion, and — for admins who may
 * manage them — switches it on or off. The switch sits beside the select
 * button rather than inside it, so neither swallows the other's clicks.
 */
function OccasionRow({
  occasion,
  isSelected,
  canManage,
  onSelect,
}: {
  occasion: Occasion;
  isSelected: boolean;
  canManage: boolean;
  onSelect: () => void;
}) {
  const [updateOccasion, { isLoading }] = useUpdateOccasionMutation();

  const toggle = async (isActive: boolean) => {
    try {
      await updateOccasion({ id: occasion.id, body: { isActive } }).unwrap();
      toast.success(
        isActive
          ? `${occasion.name} is live on the storefront`
          : `${occasion.name} hidden from the storefront`,
      );
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-md pr-2 transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
          isSelected && "font-medium text-primary",
          !occasion.isActive && !isSelected && "text-muted-foreground",
        )}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">{occasion.name}</span>
      </button>
      {canManage ? (
        <Switch
          checked={occasion.isActive}
          onCheckedChange={toggle}
          disabled={isLoading}
          className="shrink-0"
          aria-label={`${occasion.isActive ? "Deactivate" : "Activate"} ${occasion.name}`}
        />
      ) : (
        !occasion.isActive && (
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
            off
          </span>
        )
      )}
    </li>
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

  // A branch's catalogue can run to thousands of products, so the picker never
  // asks for all of them: a page at a time, and the next page as the box is
  // scrolled. Keyed on the branch and the settled search term, so either one
  // changing drops the accumulated pages and starts back at page 1.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const {
    page,
    items: rows,
    hasMore,
    ingest,
    loadMore: loadNextPage,
  } = useInfiniteList<Product>(`${shopId}|${debouncedSearch}`);

  // `currentData`, not `data`: RTK keeps the PREVIOUS args' response in `data`
  // while the new one is in flight, which reads to the accumulator as "nothing
  // changed" and silently drops the page.
  const { currentData: products, isFetching: loadingProducts } =
    useListProductsQuery({
      page,
      limit: PRODUCT_PAGE_SIZE,
      shopId,
      search: debouncedSearch || undefined,
    });
  ingest(products);

  // Memoized: InfiniteScroll rebuilds its IntersectionObserver whenever this
  // identity changes, and a fresh observer re-fires on a sentinel already in
  // view — which would skip a page.
  const loadMore = useCallback(() => {
    if (!loadingProducts) loadNextPage();
  }, [loadingProducts, loadNextPage]);

  const { data: current, isFetching: loadingCurrent } =
    useGetOccasionProductsQuery({ occasionId: occasion.id, shopId });
  const [assign, { isLoading: saving }] = useAssignOccasionProductsMutation();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Seed the selection from the saved assignment when it (re)loads. Done during
  // render so the checkboxes are right on the paint the assignment arrives.
  const [seeded, setSeeded] = useState<typeof current>(undefined);
  if (current && current !== seeded) {
    setSeeded(current);
    setSelected(new Set(current.productIds));
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const savedSet = useMemo(
    () => new Set(current?.productIds ?? []),
    [current],
  );
  const dirty = useMemo(() => {
    if (selected.size !== savedSet.size) return true;
    for (const id of selected) if (!savedSet.has(id)) return true;
    return false;
  }, [selected, savedSet]);

  // Skeletons only while there is nothing to show for what was asked. Paging
  // deeper keeps the loaded rows up and puts the loader underneath them.
  const loadingFirstPage = page === 1 && loadingProducts && !products;

  const save = async () => {
    try {
      // Preserve picker order by walking the loaded product rows.
      const ordered = rows
        .map((p) => p.id)
        .filter((id) => selected.has(id));
      // Include any selected ids that are not among the loaded rows — a
      // saved product on a page never scrolled to, or filtered out by the
      // search box, must survive the save rather than be dropped.
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
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{occasion.name}</h3>
            {!occasion.isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {selected.size} selected
            {!occasion.isActive && " · hidden from the storefront until active"}
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

      <div ref={setListEl} className="max-h-[28rem] overflow-y-auto p-2">
        {loadingFirstPage || loadingCurrent ? (
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
          <InfiniteScroll
            root={listEl}
            rootMargin="120px"
            hasMore={hasMore}
            loading={loadingProducts}
            onLoadMore={loadMore}
            loader={
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </div>
            }
          >
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
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
}
