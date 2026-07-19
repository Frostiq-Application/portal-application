import { baseApi } from "./baseApi";
import type { Paginated, PaginationQuery, Plan } from "@/types";

export interface PlansQuery extends PaginationQuery {
  activeOnly?: boolean;
}

export interface PlanFeatures {
  can_use_coupons?: boolean;
  can_use_cms?: boolean;
  can_clone_catalog?: boolean;
  can_use_realtime?: boolean;
  can_use_analytics?: boolean;
  can_use_wishlist_analytics?: boolean;
  can_use_advanced_analytics?: boolean;
  can_use_audit_log?: boolean;
  priority_support?: boolean;
  /** Numeric limit carried inside the features blob. Null = unlimited. */
  max_team_seats?: number | null;
}

export interface CreatePlanBody {
  name: string;
  description?: string;
  priceMonthly: number;
  maxShops?: number | null;
  maxProductsPerShop?: number | null;
  features?: PlanFeatures;
  isPublic?: boolean;
}

export const plansApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listPlans: build.query<Paginated<Plan>, PlansQuery | void>({
      query: (params) => ({
        url: "/plans",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.activeOnly ? { activeOnly: true } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((p) => ({ type: "Plan" as const, id: p.id })),
              { type: "Plan" as const, id: "LIST" },
            ]
          : [{ type: "Plan" as const, id: "LIST" }],
    }),

    // Active, public plans only — no auth needed. Used by the choose-a-plan
    // screen shown to brand admins with no active subscription.
    publicPlans: build.query<Plan[], void>({
      query: () => ({ url: "/plans/public" }),
      providesTags: [{ type: "Plan" as const, id: "PUBLIC" }],
    }),

    createPlan: build.mutation<Plan, CreatePlanBody>({
      query: (body) => ({ url: "/plans", method: "POST", body }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),

    updatePlan: build.mutation<
      Plan,
      { id: string; body: Partial<CreatePlanBody> }
    >({
      query: ({ id, body }) => ({ url: `/plans/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Plan", id },
        { type: "Plan", id: "LIST" },
      ],
    }),

    archivePlan: build.mutation<Plan, string>({
      query: (id) => ({ url: `/plans/${id}/archive`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Plan", id },
        { type: "Plan", id: "LIST" },
      ],
    }),

    unarchivePlan: build.mutation<Plan, string>({
      query: (id) => ({ url: `/plans/${id}/unarchive`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Plan", id },
        { type: "Plan", id: "LIST" },
      ],
    }),

    deletePlan: build.mutation<void, string>({
      query: (id) => ({ url: `/plans/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPlansQuery,
  usePublicPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useArchivePlanMutation,
  useUnarchivePlanMutation,
  useDeletePlanMutation,
} = plansApi;
