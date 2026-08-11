import { baseApi } from "./baseApi";
import type {
  Addon,
  Category,
  Paginated,
  PaginationQuery,
  Product,
  ProductType,
  UnitType,
} from "@/types";

// ---- Categories ----
export interface CreateCategoryBody {
  shopId?: string;
  name: string;
  imageUrl?: string | null;
  sortOrder?: number;
}

// ---- Products ----
export interface VariantInput {
  id?: string;
  label: string;
  price: number;
  unitType?: UnitType;
  isDefault?: boolean;
  sku?: string;
  sortOrder?: number;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
}
export interface FlavorInput {
  id?: string;
  flavorName: string;
  priceDelta?: number;
  sortOrder?: number;
}
export interface CreateProductBody {
  shopId?: string;
  categoryId?: string;
  productType: ProductType;
  name: string;
  description?: string;
  images?: string[];
  isEggless?: boolean;
  minOrderHours?: number;
  isFeatured?: boolean;
  variants: VariantInput[];
  flavorOptions?: FlavorInput[];
}

// ---- Add-ons ----
export interface CreateAddonBody {
  shopId?: string;
  name: string;
  imageUrl?: string | null;
  price: number;
  unitType?: UnitType;
  trackInventory?: boolean;
  stockQuantity?: number;
}

// ---- Catalog clone ----
export interface CloneCatalogBody {
  sourceShopId: string;
  targetShopId: string;
  mode: "full" | "selective";
  /** Selective mode only — product ids to copy. */
  productIds?: string[];
  /** Copy prices (false = target variants/add-ons start at 0). */
  copyPrices?: boolean;
}
export interface CloneResult {
  categoriesCreated: number;
  productsCreated: number;
  variantsCreated: number;
  addonsCreated: number;
}

// ---- Bulk upload ----
export interface BulkRowIssue {
  /** Excel row number, as the user sees it in their sheet. */
  row: number;
  name: string;
  reason: string;
}
export interface BulkSheetReport {
  sheet: string;
  found: boolean;
  total: number;
  created: number;
  skipped: BulkRowIssue[];
  failed: BulkRowIssue[];
}
export interface BulkUploadReport {
  categories: BulkSheetReport;
  products: BulkSheetReport;
  addons: BulkSheetReport;
  /** Failed rows as a fix-and-reupload .xlsx, base64. Null when all clean. */
  errorReportBase64: string | null;
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Categories
    listCategories: build.query<
      Paginated<Category>,
      (PaginationQuery & { shopId?: string }) | void
    >({
      query: (params) => ({
        url: "/categories",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 100,
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.search ? { search: params.search } : {}),
        },
      }),
      providesTags: [{ type: "Category", id: "LIST" }],
    }),
    createCategory: build.mutation<Category, CreateCategoryBody>({
      query: (body) => ({ url: "/categories", method: "POST", body }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),
    updateCategory: build.mutation<
      Category,
      { id: string; body: { name?: string; imageUrl?: string | null; sortOrder?: number } }
    >({
      query: ({ id, body }) => ({ url: `/categories/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),
    deleteCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/categories/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    // Products
    listProducts: build.query<
      Paginated<Product>,
      (PaginationQuery & {
        shopId?: string;
        categoryId?: string;
        productType?: ProductType;
        activeOnly?: boolean;
      }) | void
    >({
      query: (params) => ({
        url: "/products",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 50,
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
          ...(params?.productType ? { productType: params.productType } : {}),
          ...(params?.search ? { search: params.search } : {}),
        },
      }),
      providesTags: [{ type: "Product", id: "LIST" }],
    }),
    createProduct: build.mutation<Product, CreateProductBody>({
      query: (body) => ({ url: "/products", method: "POST", body }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    /** Fill an empty branch with editable placeholder cakes. */
    seedStarterCatalog: build.mutation<
      { created: number; skipped: number },
      { shopId?: string }
    >({
      query: (body) => ({
        url: "/products/starter-catalog",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    updateProduct: build.mutation<
      Product,
      { id: string; body: Partial<CreateProductBody> & { isActive?: boolean } }
    >({
      query: ({ id, body }) => ({ url: `/products/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    toggleProduct: build.mutation<Product, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        url: `/products/${id}/toggle-active`,
        method: "POST",
        body: { isActive },
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    deleteProduct: build.mutation<void, string>({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    // Add-ons
    listAddons: build.query<
      Paginated<Addon>,
      (PaginationQuery & { shopId?: string }) | void
    >({
      query: (params) => ({
        url: "/addons",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 100,
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.search ? { search: params.search } : {}),
        },
      }),
      providesTags: [{ type: "Addon", id: "LIST" }],
    }),
    createAddon: build.mutation<Addon, CreateAddonBody>({
      query: (body) => ({ url: "/addons", method: "POST", body }),
      invalidatesTags: [{ type: "Addon", id: "LIST" }],
    }),
    updateAddon: build.mutation<
      Addon,
      { id: string; body: Partial<CreateAddonBody> & { isActive?: boolean } }
    >({
      query: ({ id, body }) => ({ url: `/addons/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Addon", id: "LIST" }],
    }),
    deleteAddon: build.mutation<void, string>({
      query: (id) => ({ url: `/addons/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Addon", id: "LIST" }],
    }),

    // Clone a catalog between two branches of the same account. Plan-gated by
    // can_clone_catalog on both sides: the UI hides it, and the backend rejects
    // it with 403 (@RequiresFeature on POST /catalog/clone). Invalidates the
    // lists so the target branch shows its freshly-copied products the moment
    // it's selected.
    cloneCatalog: build.mutation<CloneResult, CloneCatalogBody>({
      query: (body) => ({ url: "/catalog/clone", method: "POST", body }),
      invalidatesTags: [
        { type: "Product", id: "LIST" },
        { type: "Category", id: "LIST" },
        { type: "Addon", id: "LIST" },
      ],
    }),

    // One workbook in, a per-row report out. Everything that did import is
    // live immediately, so all three lists refetch.
    bulkUploadCatalog: build.mutation<
      BulkUploadReport,
      { file: File; shopId: string }
    >({
      query: ({ file, shopId }) => {
        const form = new FormData();
        form.append("file", file);
        form.append("shopId", shopId);
        return { url: "/catalog/bulk-upload", method: "POST", body: form };
      },
      invalidatesTags: [
        { type: "Product", id: "LIST" },
        { type: "Category", id: "LIST" },
        { type: "Addon", id: "LIST" },
      ],
    }),

    // A mutation (not a query) so nothing is cached and each click re-downloads.
    // The blob is handed back for the caller to save; auth rides the normal way.
    downloadBulkUploadSample: build.mutation<Blob, void>({
      query: () => ({
        url: "/catalog/bulk-upload/sample",
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useListProductsQuery,
  useCreateProductMutation,
  useSeedStarterCatalogMutation,
  useUpdateProductMutation,
  useToggleProductMutation,
  useDeleteProductMutation,
  useListAddonsQuery,
  useCreateAddonMutation,
  useUpdateAddonMutation,
  useDeleteAddonMutation,
  useCloneCatalogMutation,
  useBulkUploadCatalogMutation,
  useDownloadBulkUploadSampleMutation,
} = catalogApi;
