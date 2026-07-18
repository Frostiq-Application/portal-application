import { baseApi } from "./baseApi";
import type { Coupon, CouponType, Paginated, PaginationQuery } from "@/types";

export interface CouponsQuery extends PaginationQuery {
  shopId?: string;
}

export interface CreateCouponBody {
  shopId?: string;
  code: string;
  discountType: CouponType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  validFrom: string;
  validUntil: string;
  isPublic?: boolean;
  displayLabel?: string;
}

export type UpdateCouponBody = Partial<
  Omit<CreateCouponBody, "shopId" | "code">
> & { isActive?: boolean };

export const couponsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listCoupons: build.query<Paginated<Coupon>, CouponsQuery | void>({
      query: (params) => ({
        url: "/coupons",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.shopId ? { shopId: params.shopId } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((c) => ({ type: "Coupon" as const, id: c.id })),
              { type: "Coupon" as const, id: "LIST" },
            ]
          : [{ type: "Coupon" as const, id: "LIST" }],
    }),

    createCoupon: build.mutation<Coupon, CreateCouponBody>({
      query: (body) => ({ url: "/coupons", method: "POST", body }),
      invalidatesTags: [{ type: "Coupon", id: "LIST" }],
    }),

    updateCoupon: build.mutation<Coupon, { id: string; body: UpdateCouponBody }>({
      query: ({ id, body }) => ({ url: `/coupons/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Coupon", id },
        { type: "Coupon", id: "LIST" },
      ],
    }),

    deleteCoupon: build.mutation<void, string>({
      query: (id) => ({ url: `/coupons/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Coupon", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCouponsQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
} = couponsApi;
