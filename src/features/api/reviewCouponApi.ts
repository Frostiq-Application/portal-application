import { baseApi } from "./baseApi";
import type { CouponType } from "@/types";

/**
 * The thank-you coupon a branch gives for rating an order.
 *
 * Narrower than the ordinary coupon body on purpose: no dates and no total
 * usage cap, because the server fixes those. The reward is earned, so it starts
 * working immediately, never expires, and is one per customer.
 */
export interface ReviewCouponBody {
  code: string;
  discountType: CouponType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
}

export interface ReviewCoupon {
  id: string;
  code: string;
  discountType: CouponType;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderAmount: string | null;
  /** "10% off your next order" — what the customer is shown. */
  label: string;
  /** Always false. Present so the UI never has to assume. */
  expires: boolean;
}

export const reviewCouponApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReviewCoupon: build.query<ReviewCoupon | null, string>({
      query: (shopId) => ({ url: `/shops/${shopId}/review-coupon` }),
      providesTags: (_r, _e, shopId) => [{ type: "Shop" as const, id: shopId }],
    }),

    upsertReviewCoupon: build.mutation<
      ReviewCoupon,
      { shopId: string; body: ReviewCouponBody }
    >({
      query: ({ shopId, body }) => ({
        url: `/shops/${shopId}/review-coupon`,
        method: "PUT",
        body,
      }),
      // Also a coupon, so the Coupons page has to re-read after this.
      invalidatesTags: (_r, _e, { shopId }) => [
        { type: "Shop" as const, id: shopId },
        { type: "Coupon" as const, id: "LIST" },
      ],
    }),

    removeReviewCoupon: build.mutation<void, string>({
      query: (shopId) => ({
        url: `/shops/${shopId}/review-coupon`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, shopId) => [
        { type: "Shop" as const, id: shopId },
        { type: "Coupon" as const, id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetReviewCouponQuery,
  useUpsertReviewCouponMutation,
  useRemoveReviewCouponMutation,
} = reviewCouponApi;
