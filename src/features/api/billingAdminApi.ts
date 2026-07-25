import { baseApi } from "./baseApi";
import type {
  AdminPlan,
  AdminSubscriptionDetail,
  AdminSubscriptionRow,
  BillingCycle,
  BillingFeature,
  BillingReports,
  BillingSettings,
  CouponRedemption,
  DeleteReadyAccount,
  PaymentRow,
  PlanFeatureValue,
  SubscriptionCoupon,
  SweepResult,
} from "@/types/billing";
import type { Paginated, SubscriptionStatus } from "@/types";

export interface AdminSubscriptionsQuery {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  accountId?: string;
  planId?: string;
  search?: string;
  dueBefore?: string;
}

export interface UpsertPlanBody {
  code?: string | null;
  name: string;
  tagline?: string;
  description?: string;
  priceMonthly: number;
  visibility?: "public" | "hidden";
  exclusiveAccountId?: string | null;
  badge?: string | null;
  sortOrder?: number;
  features?: PlanFeatureValue[];
}

export interface UpsertCouponBody {
  code: string;
  internalNote?: string;
  discountType: "percent" | "flat";
  discountValue: number;
  maxDiscountAmount?: number | null;
  durationCycles?: number;
  visibility?: "public" | "private";
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  perAccountLimit?: number;
  isActive?: boolean;
  planIds?: string[];
  cycleCodes?: string[];
}

/** The Super Admin surface — subscription.md §8. */
export const billingAdminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ------------------------------------------------------------- features --

    adminFeatures: build.query<BillingFeature[], void>({
      query: () => ({ url: "/billing-admin/features" }),
      providesTags: [{ type: "Feature", id: "LIST" }],
    }),

    upsertFeature: build.mutation<BillingFeature, Partial<BillingFeature>>({
      query: (body) => ({ url: "/billing-admin/features", method: "PUT", body }),
      invalidatesTags: [
        { type: "Feature", id: "LIST" },
        { type: "Plan", id: "LIST" },
      ],
    }),

    setFeatureActive: build.mutation<
      BillingFeature,
      { key: string; isActive: boolean }
    >({
      query: ({ key, isActive }) => ({
        url: `/billing-admin/features/${key}/active`,
        method: "PATCH",
        body: { isActive },
      }),
      invalidatesTags: [{ type: "Feature", id: "LIST" }],
    }),

    // ---------------------------------------------------------------- plans --

    adminPlans: build.query<AdminPlan[], void>({
      query: () => ({ url: "/billing-admin/plans" }),
      providesTags: [{ type: "Plan", id: "LIST" }],
    }),

    createPlan: build.mutation<AdminPlan, UpsertPlanBody>({
      query: (body) => ({ url: "/billing-admin/plans", method: "POST", body }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),

    updatePlan: build.mutation<AdminPlan, { id: string; body: UpsertPlanBody }>({
      query: ({ id, body }) => ({
        url: `/billing-admin/plans/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),

    archivePlan: build.mutation<AdminPlan, { id: string; archived: boolean }>({
      query: ({ id, archived }) => ({
        url: `/billing-admin/plans/${id}/archive`,
        method: "PATCH",
        body: { archived },
      }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),

    // --------------------------------------------------------------- cycles --

    adminCycles: build.query<BillingCycle[], void>({
      query: () => ({ url: "/billing-admin/cycles" }),
      providesTags: [{ type: "Plan", id: "CYCLES" }],
    }),

    upsertCycle: build.mutation<BillingCycle, Partial<BillingCycle>>({
      query: (body) => ({ url: "/billing-admin/cycles", method: "PUT", body }),
      invalidatesTags: [
        { type: "Plan", id: "CYCLES" },
        { type: "Plan", id: "LIST" },
      ],
    }),

    setCycleActive: build.mutation<
      BillingCycle,
      { code: string; isActive: boolean }
    >({
      query: ({ code, isActive }) => ({
        url: `/billing-admin/cycles/${code}/active`,
        method: "PATCH",
        body: { isActive },
      }),
      invalidatesTags: [{ type: "Plan", id: "CYCLES" }],
    }),

    // -------------------------------------------------------------- coupons --

    adminCoupons: build.query<SubscriptionCoupon[], string | void>({
      query: (search) => ({
        url: "/billing-admin/coupons",
        params: search ? { search } : undefined,
      }),
      providesTags: [{ type: "Coupon", id: "SUB-LIST" }],
    }),

    createSubCoupon: build.mutation<SubscriptionCoupon, UpsertCouponBody>({
      query: (body) => ({ url: "/billing-admin/coupons", method: "POST", body }),
      invalidatesTags: [{ type: "Coupon", id: "SUB-LIST" }],
    }),

    updateSubCoupon: build.mutation<
      SubscriptionCoupon,
      { id: string; body: UpsertCouponBody }
    >({
      query: ({ id, body }) => ({
        url: `/billing-admin/coupons/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "Coupon", id: "SUB-LIST" }],
    }),

    setSubCouponActive: build.mutation<
      SubscriptionCoupon,
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        url: `/billing-admin/coupons/${id}/active`,
        method: "PATCH",
        body: { isActive },
      }),
      invalidatesTags: [{ type: "Coupon", id: "SUB-LIST" }],
    }),

    couponRedemptions: build.query<CouponRedemption[], string>({
      query: (id) => ({ url: `/billing-admin/coupons/${id}/redemptions` }),
    }),

    // ------------------------------------------------------------- settings --

    billingSettings: build.query<BillingSettings, void>({
      query: () => ({ url: "/billing-admin/settings" }),
      providesTags: [{ type: "Plan", id: "SETTINGS" }],
    }),

    updateBillingSettings: build.mutation<
      BillingSettings,
      Partial<BillingSettings>
    >({
      query: (body) => ({
        url: "/billing-admin/settings",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "Plan", id: "SETTINGS" }],
    }),

    // ------------------------------------------------------------ oversight --

    adminSubscriptions: build.query<
      Paginated<AdminSubscriptionRow>,
      AdminSubscriptionsQuery | void
    >({
      query: (params) => ({
        url: "/billing-admin/subscriptions",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.accountId ? { accountId: params.accountId } : {}),
          ...(params?.planId ? { planId: params.planId } : {}),
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.dueBefore ? { dueBefore: params.dueBefore } : {}),
        },
      }),
      providesTags: [{ type: "Subscription", id: "ADMIN-LIST" }],
    }),

    adminSubscriptionDetail: build.query<AdminSubscriptionDetail, string>({
      query: (id) => ({ url: `/billing-admin/subscriptions/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "Subscription", id }],
    }),

    adminPayments: build.query<
      PaymentRow[],
      { subscriptionId?: string; accountId?: string }
    >({
      query: (params) => ({ url: "/billing-admin/payments", params }),
    }),

    billingReports: build.query<BillingReports, void>({
      query: () => ({ url: "/billing-admin/reports" }),
      providesTags: [{ type: "Analytics", id: "BILLING" }],
    }),

    // ------------------------------------------------------- data lifecycle --

    deleteReadyAccounts: build.query<DeleteReadyAccount[], void>({
      query: () => ({ url: "/billing-admin/delete-ready" }),
      providesTags: [{ type: "Account", id: "DELETE-READY" }],
    }),

    hardDeleteAccountData: build.mutation<
      { deleted: true },
      { accountId: string; confirmAccountName: string }
    >({
      query: ({ accountId, confirmAccountName }) => ({
        url: `/billing-admin/accounts/${accountId}/data`,
        method: "DELETE",
        body: { confirmAccountName },
      }),
      invalidatesTags: [
        { type: "Account", id: "DELETE-READY" },
        { type: "Account", id: "LIST" },
      ],
    }),

    // ---------------------------------------------------------------- engine --

    runBillingCycle: build.mutation<SweepResult, void>({
      query: () => ({ url: "/billing-admin/run-billing-cycle", method: "POST" }),
      invalidatesTags: [
        { type: "Subscription", id: "ADMIN-LIST" },
        { type: "Analytics", id: "BILLING" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useAdminFeaturesQuery,
  useUpsertFeatureMutation,
  useSetFeatureActiveMutation,
  useAdminPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useArchivePlanMutation,
  useAdminCyclesQuery,
  useUpsertCycleMutation,
  useSetCycleActiveMutation,
  useAdminCouponsQuery,
  useCreateSubCouponMutation,
  useUpdateSubCouponMutation,
  useSetSubCouponActiveMutation,
  useCouponRedemptionsQuery,
  useBillingSettingsQuery,
  useUpdateBillingSettingsMutation,
  useAdminSubscriptionsQuery,
  useAdminSubscriptionDetailQuery,
  useAdminPaymentsQuery,
  useBillingReportsQuery,
  useDeleteReadyAccountsQuery,
  useHardDeleteAccountDataMutation,
  useRunBillingCycleMutation,
} = billingAdminApi;
