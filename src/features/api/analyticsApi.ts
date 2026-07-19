import { baseApi } from "./baseApi";
import type { AccountAnalytics, ShopAnalytics, WishlistAnalytics } from "@/types";

export interface DateRange {
  from?: string;
  to?: string;
}

export interface ShopAnalyticsQuery extends DateRange {
  shopId: string;
}

export const analyticsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    shopAnalytics: build.query<ShopAnalytics, ShopAnalyticsQuery>({
      query: ({ shopId, from, to }) => ({
        url: "/analytics/shop",
        params: {
          shopId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      providesTags: (_r, _e, { shopId }) => [
        { type: "Analytics", id: `shop:${shopId}` },
      ],
    }),

    accountAnalytics: build.query<AccountAnalytics, DateRange | void>({
      query: (params) => ({
        url: "/analytics/account",
        params: {
          ...(params?.from ? { from: params.from } : {}),
          ...(params?.to ? { to: params.to } : {}),
        },
      }),
      providesTags: [{ type: "Analytics", id: "account" }],
    }),

    wishlistAnalytics: build.query<WishlistAnalytics, ShopAnalyticsQuery>({
      query: ({ shopId, from, to }) => ({
        url: "/analytics/wishlist",
        params: {
          shopId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      providesTags: (_r, _e, { shopId }) => [
        { type: "Analytics", id: `wishlist:${shopId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useShopAnalyticsQuery,
  useAccountAnalyticsQuery,
  useWishlistAnalyticsQuery,
} = analyticsApi;
