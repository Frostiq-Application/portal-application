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
  useUpdateProductMutation,
  useToggleProductMutation,
  useDeleteProductMutation,
  useListAddonsQuery,
  useCreateAddonMutation,
  useUpdateAddonMutation,
  useDeleteAddonMutation,
} = catalogApi;
