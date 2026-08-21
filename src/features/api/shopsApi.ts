import { baseApi } from "./baseApi";
import type { Paginated, PaginationQuery, Shop, ShopStatus } from "@/types";

export interface ShopsQuery extends PaginationQuery {
  accountId?: string;
  status?: ShopStatus;
  city?: string;
}

export interface CreateShopBody {
  accountId?: string;
  branchName: string;
  slug: string;
  displayArea?: string;
  /** null clears the banner; leaving the key out keeps whatever is there. */
  bannerUrl?: string | null;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  whatsappNumber?: string;
  fssaiNumber?: string;
  openingTime?: string;
  closingTime?: string;
  closedDays?: string[];
  /** null clears the link; leaving the key out keeps whatever is there. */
  googlePlaceId?: string | null;
  googleReviewUrl?: string | null;
  reviewPromptEnabled?: boolean;
  reviewPromptDelayMinutes?: number;
}

export type UpdateShopBody = Partial<Omit<CreateShopBody, "accountId" | "slug">>;

export const shopsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listShops: build.query<Paginated<Shop>, ShopsQuery | void>({
      query: (params) => ({
        url: "/shops",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.accountId ? { accountId: params.accountId } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.city ? { city: params.city } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((s) => ({ type: "Shop" as const, id: s.id })),
              { type: "Shop" as const, id: "LIST" },
            ]
          : [{ type: "Shop" as const, id: "LIST" }],
    }),

    createShop: build.mutation<Shop, CreateShopBody>({
      query: (body) => ({ url: "/shops", method: "POST", body }),
      invalidatesTags: [{ type: "Shop", id: "LIST" }],
    }),

    updateShop: build.mutation<Shop, { id: string; body: UpdateShopBody }>({
      query: ({ id, body }) => ({ url: `/shops/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Shop", id },
        { type: "Shop", id: "LIST" },
      ],
    }),

    suspendShop: build.mutation<Shop, string>({
      query: (id) => ({ url: `/shops/${id}/suspend`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Shop", id },
        { type: "Shop", id: "LIST" },
      ],
    }),

    activateShop: build.mutation<Shop, string>({
      query: (id) => ({ url: `/shops/${id}/activate`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Shop", id },
        { type: "Shop", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListShopsQuery,
  useCreateShopMutation,
  useUpdateShopMutation,
  useSuspendShopMutation,
  useActivateShopMutation,
} = shopsApi;
