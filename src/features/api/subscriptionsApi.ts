import { baseApi } from "./baseApi";
import type {
  BillingCycle,
  BillingSummary,
  Paginated,
  PaginationQuery,
  PaymentMethodType,
  Subscription,
  SubscriptionPayment,
  SubscriptionStatus,
} from "@/types";

export interface SubscriptionsQuery extends PaginationQuery {
  status?: SubscriptionStatus;
  dueBefore?: string;
}

export interface CreateSubscriptionBody {
  accountId: string;
  planId: string;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  startDate?: string;
  trialEndsAt?: string;
  notes?: string;
}

export interface MarkPaidBody {
  amount: number;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: PaymentMethodType;
  referenceNote?: string;
}

export const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listSubscriptions: build.query<
      Paginated<Subscription>,
      SubscriptionsQuery | void
    >({
      query: (params) => ({
        url: "/subscriptions",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.dueBefore ? { dueBefore: params.dueBefore } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((s) => ({
                type: "Subscription" as const,
                id: s.id,
              })),
              { type: "Subscription" as const, id: "LIST" },
            ]
          : [{ type: "Subscription" as const, id: "LIST" }],
    }),

    billingSummary: build.query<BillingSummary, void>({
      query: () => ({ url: "/subscriptions/summary" }),
      providesTags: [{ type: "Subscription", id: "SUMMARY" }],
    }),

    subscriptionPayments: build.query<SubscriptionPayment[], string>({
      query: (id) => ({ url: `/subscriptions/${id}/payments` }),
      providesTags: (_r, _e, id) => [{ type: "Subscription", id: `PAY-${id}` }],
    }),

    createSubscription: build.mutation<Subscription, CreateSubscriptionBody>({
      query: (body) => ({ url: "/subscriptions", method: "POST", body }),
      invalidatesTags: [
        { type: "Subscription", id: "LIST" },
        { type: "Subscription", id: "SUMMARY" },
      ],
    }),

    markPaid: build.mutation<
      SubscriptionPayment,
      { id: string; body: MarkPaidBody }
    >({
      query: ({ id, body }) => ({
        url: `/subscriptions/${id}/mark-paid`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Subscription", id },
        { type: "Subscription", id: "LIST" },
        { type: "Subscription", id: "SUMMARY" },
        { type: "Subscription", id: `PAY-${id}` },
      ],
    }),

    cancelSubscription: build.mutation<Subscription, string>({
      query: (id) => ({ url: `/subscriptions/${id}/cancel`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Subscription", id },
        { type: "Subscription", id: "LIST" },
        { type: "Subscription", id: "SUMMARY" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListSubscriptionsQuery,
  useBillingSummaryQuery,
  useSubscriptionPaymentsQuery,
  useCreateSubscriptionMutation,
  useMarkPaidMutation,
  useCancelSubscriptionMutation,
} = subscriptionsApi;
