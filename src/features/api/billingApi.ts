import { baseApi } from "./baseApi";
import type {
  AddonOption,
  ApplicableCoupon,
  ArchivableItem,
  BillingProfileInput,
  ChangePreview,
  CheckoutSession,
  Invoice,
  PaymentRow,
  PricingResponse,
  Quote,
  ScheduledChange,
  SubscriptionDashboard,
  SubscriptionEvent,
} from "@/types/billing";

/** Anything that changes the subscription invalidates the whole picture. */
const SUB_TAGS = [
  { type: "Subscription" as const, id: "ME" },
  { type: "Subscription" as const, id: "ADDONS" },
  { type: "Subscription" as const, id: "PAYMENTS" },
  { type: "Entitlements" as const, id: "ME" },
];

/**
 * Self-serve billing for the bakery owner (subscription.md §9).
 *
 * Every mutation invalidates `Entitlements` as well as the subscription: an
 * upgrade unlocks feature modules across the whole app, so the nav and route
 * guards have to re-read entitlements or the user is left staring at a locked
 * screen for a feature they just paid for.
 */
export const billingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ------------------------------------------------------------ dashboard --

    mySubscription: build.query<SubscriptionDashboard, void>({
      query: () => ({ url: "/billing/me" }),
      providesTags: [{ type: "Subscription", id: "ME" }],
    }),

    myPlans: build.query<PricingResponse, void>({
      query: () => ({ url: "/billing/plans" }),
      providesTags: [{ type: "Plan", id: "LIST" }],
    }),

    billingStates: build.query<
      { states: string[]; cancelReasons: string[] },
      void
    >({
      query: () => ({ url: "/billing/states" }),
      keepUnusedDataFor: 3600,
    }),

    // ----------------------------------------------------------- free trial --

    /**
     * Start the free trial of the plan carrying the offer. `planId` is optional
     * — the server resolves and validates it either way.
     */
    startTrial: build.mutation<unknown, { planId?: string } | void>({
      query: (body) => ({
        url: "/billing/start-trial",
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: SUB_TAGS,
    }),

    // ------------------------------------------------------------ free tier --

    /** Put the account on the ₹0 plan. No card, no expiry. */
    startFree: build.mutation<unknown, void>({
      query: () => ({ url: "/billing/start-free", method: "POST" }),
      invalidatesTags: SUB_TAGS,
    }),

    /** Move between ₹0 plans; anything paid goes through checkout. */
    switchFreePlan: build.mutation<unknown, { planId: string }>({
      query: (body) => ({
        url: "/billing/free/switch-plan",
        method: "POST",
        body,
      }),
      invalidatesTags: SUB_TAGS,
    }),

    // -------------------------------------------------------- quote/coupons --

    quote: build.query<
      Quote,
      {
        planId: string;
        billingCycle: string;
        couponCode?: string;
        /** `key:qty,key:qty` — a string because it rides on a GET query. */
        addons?: string;
      }
    >({
      query: (params) => ({ url: "/billing/quote", params }),
    }),

    applicableCoupons: build.query<
      ApplicableCoupon[],
      { planId: string; billingCycle: string }
    >({
      query: (params) => ({ url: "/billing/coupons/applicable", params }),
    }),

    // ------------------------------------------------------------- checkout --

    checkout: build.mutation<
      CheckoutSession,
      {
        planId: string;
        billingCycle: string;
        couponCode?: string;
        enableAutopay?: boolean;
        addons?: { featureKey: string; quantity: number }[];
        billing: BillingProfileInput;
      }
    >({
      query: (body) => ({ url: "/billing/checkout", method: "POST", body }),
    }),

    verifyPayment: build.mutation<
      { status: string; subscriptionId: string; invoiceNumber?: string },
      {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
      }
    >({
      query: (body) => ({
        url: "/billing/checkout/verify",
        method: "POST",
        body,
      }),
      invalidatesTags: SUB_TAGS,
    }),

    // --------------------------------------------------------- plan changes --

    previewChange: build.query<
      ChangePreview,
      { planId: string; billingCycle: string }
    >({
      query: (params) => ({ url: "/billing/change/preview", params }),
    }),

    upgradePlan: build.mutation<
      CheckoutSession,
      { planId: string; billingCycle: string }
    >({
      query: (body) => ({
        url: "/billing/change/upgrade",
        method: "POST",
        body,
      }),
      invalidatesTags: SUB_TAGS,
    }),

    scheduleDowngrade: build.mutation<
      ScheduledChange,
      {
        planId: string;
        billingCycle: string;
        keepSelections?: { featureKey: string; keepIds: string[] }[];
        addons?: { featureKey: string; quantity: number }[];
      }
    >({
      query: (body) => ({
        url: "/billing/change/schedule",
        method: "POST",
        body,
      }),
      invalidatesTags: SUB_TAGS,
    }),

    undoScheduledChange: build.mutation<{ undone: boolean }, void>({
      query: () => ({ url: "/billing/change/undo", method: "POST" }),
      invalidatesTags: SUB_TAGS,
    }),

    // -------------------------------------------------------------- add-ons --

    /**
     * `planId` prices add-ons against a plan being *considered* — checkout
     * needs that, because at signup there is no subscription to read from yet.
     */
    addonOptions: build.query<AddonOption[], { planId?: string } | void>({
      query: (args) => ({
        url: "/billing/addons",
        params: args?.planId ? { planId: args.planId } : undefined,
      }),
      providesTags: [{ type: "Subscription", id: "ADDONS" }],
    }),

    purchaseAddon: build.mutation<
      CheckoutSession,
      { featureKey: string; quantity: number }
    >({
      query: (body) => ({
        url: "/billing/addons/purchase",
        method: "POST",
        body,
      }),
      invalidatesTags: SUB_TAGS,
    }),

    scheduleAddonRemoval: build.mutation<
      { removeAtPeriodEnd: boolean },
      { featureKey: string; remove: boolean }
    >({
      query: ({ featureKey, remove }) => ({
        url: `/billing/addons/${featureKey}/schedule-removal`,
        method: "POST",
        body: { remove },
      }),
      invalidatesTags: SUB_TAGS,
    }),

    // ------------------------------------------------------- archived items --

    limitItems: build.query<ArchivableItem[], string>({
      query: (featureKey) => ({ url: `/billing/items/${featureKey}` }),
      providesTags: (_r, _e, key) => [
        { type: "Subscription", id: `ITEMS-${key}` },
      ],
    }),

    restoreItem: build.mutation<
      { restored: boolean },
      { featureKey: string; itemId: string }
    >({
      query: ({ featureKey, itemId }) => ({
        url: `/billing/items/${featureKey}/${itemId}/restore`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { featureKey }) => [
        ...SUB_TAGS,
        { type: "Subscription" as const, id: `ITEMS-${featureKey}` },
        { type: "Shop" as const, id: "LIST" },
        { type: "Product" as const, id: "LIST" },
      ],
    }),

    // --------------------------------------------------------- cancellation --

    cancelSubscription: build.mutation<
      { cancelAtPeriodEnd: boolean; accessUntil: string },
      { reason: string; comment?: string }
    >({
      query: (body) => ({ url: "/billing/cancel", method: "POST", body }),
      invalidatesTags: SUB_TAGS,
    }),

    undoCancel: build.mutation<{ cancelAtPeriodEnd: boolean }, void>({
      query: () => ({ url: "/billing/cancel/undo", method: "POST" }),
      invalidatesTags: SUB_TAGS,
    }),

    // ------------------------------------------------------ billing history --

    myPayments: build.query<PaymentRow[], void>({
      query: () => ({ url: "/billing/payments" }),
      providesTags: [{ type: "Subscription", id: "PAYMENTS" }],
    }),

    myInvoices: build.query<Invoice[], void>({
      query: () => ({ url: "/billing/invoices" }),
      providesTags: [{ type: "Subscription", id: "INVOICES" }],
    }),

    myTimeline: build.query<SubscriptionEvent[], void>({
      query: () => ({ url: "/billing/timeline" }),
      providesTags: [{ type: "Subscription", id: "TIMELINE" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useMySubscriptionQuery,
  useMyPlansQuery,
  useBillingStatesQuery,
  useStartFreeMutation,
  useStartTrialMutation,
  useSwitchFreePlanMutation,
  useQuoteQuery,
  useLazyQuoteQuery,
  useApplicableCouponsQuery,
  useCheckoutMutation,
  useVerifyPaymentMutation,
  usePreviewChangeQuery,
  useUpgradePlanMutation,
  useScheduleDowngradeMutation,
  useUndoScheduledChangeMutation,
  useAddonOptionsQuery,
  usePurchaseAddonMutation,
  useScheduleAddonRemovalMutation,
  useLimitItemsQuery,
  useRestoreItemMutation,
  useCancelSubscriptionMutation,
  useUndoCancelMutation,
  useMyPaymentsQuery,
  useMyInvoicesQuery,
  useMyTimelineQuery,
} = billingApi;
