import { baseApi } from "./baseApi";

export type OnboardingStepId =
  | "brand"
  | "branch"
  | "billing"
  | "plan"
  | "payment"
  | "done";

export interface OnboardingStepState {
  step: OnboardingStepId;
  title: string;
  description: string;
  complete: boolean;
  /** Skipped steps are shown struck through rather than hidden. */
  skipped: boolean;
  current: boolean;
}

export interface OnboardingState {
  currentStep: OnboardingStepId;
  completed: boolean;
  completedAt: string | null;
  steps: OnboardingStepState[];
  percentComplete: number;
  data: Record<string, unknown>;
  prefill: {
    brand: { name: string; logoUrl: string | null; themeColor: string | null };
    billing: {
      billingAddress: string | null;
      billingPincode: string | null;
      billingCity: string | null;
      billingState: string | null;
      gstin: string | null;
    };
    branchCount: number;
    planId: string | null;
    /** True once this account has had its one free run. */
    freePlanUsed: boolean;
    /** How long the free plan lasts, from billing settings. */
    freeTrialDays: number;
    /** The plan this account can trial and for how long; null when it can't. */
    trialOffer: { planId: string; planName: string; days: number } | null;
    /** The saved branch, so going back to that step isn't an empty form. */
    branch: {
      id: string;
      branchName: string;
      slug: string;
      displayArea: string | null;
      address: string | null;
      city: string | null;
      latitude: string | null;
      longitude: string | null;
      bannerUrl: string | null;
      whatsappNumber: string | null;
      openingTime: string | null;
      closingTime: string | null;
      closedDays: string[];
    } | null;
    /** Account users who can be given access to a branch. */
    assignableUsers: {
      id: string;
      name: string;
      email: string;
      role: string;
      /** Owners reach every branch by role, so assigning them is a no-op. */
      isOwner: boolean;
      assigned: boolean;
      /** Invited but hasn't set a password yet — can't sign in. */
      pending: boolean;
    }[];
  };
}

/**
 * Account setup.
 *
 * Every mutation returns the **whole** state rather than an ack, so the wizard
 * re-renders from the server's idea of progress instead of its own — two tabs
 * open on the same signup can't then disagree about which step is next.
 *
 * Entitlements are invalidated alongside, because finishing onboarding flips
 * the account active and grants a plan.
 */
const TAGS = [
  { type: "Onboarding" as const, id: "ME" },
  { type: "Entitlements" as const, id: "ME" },
  { type: "Subscription" as const, id: "ME" },
];

export const onboardingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    onboardingState: build.query<OnboardingState, void>({
      query: () => ({ url: "/onboarding/me" }),
      providesTags: [{ type: "Onboarding", id: "ME" }],
    }),

    saveBrandStep: build.mutation<
      OnboardingState,
      { name: string; logoUrl?: string | null; themeColor?: string | null }
    >({
      query: (body) => ({ url: "/onboarding/brand", method: "POST", body }),
      invalidatesTags: TAGS,
    }),

    saveBranchStep: build.mutation<OnboardingState, Record<string, unknown>>({
      query: (body) => ({ url: "/onboarding/branch", method: "POST", body }),
      invalidatesTags: [...TAGS, { type: "Shop" as const, id: "LIST" }],
    }),

    saveBillingStep: build.mutation<OnboardingState, Record<string, unknown>>({
      query: (body) => ({ url: "/onboarding/billing", method: "POST", body }),
      invalidatesTags: TAGS,
    }),

    savePlanStep: build.mutation<
      OnboardingState,
      { planId: string; billingCycle?: string; startTrial?: boolean }
    >({
      query: (body) => ({ url: "/onboarding/plan", method: "POST", body }),
      invalidatesTags: TAGS,
    }),

    completeOnboarding: build.mutation<OnboardingState, void>({
      query: () => ({ url: "/onboarding/complete", method: "POST" }),
      invalidatesTags: TAGS,
    }),

    goToOnboardingStep: build.mutation<OnboardingState, OnboardingStepId>({
      query: (step) => ({
        url: "/onboarding/go-to",
        method: "POST",
        body: { step },
      }),
      invalidatesTags: [{ type: "Onboarding", id: "ME" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useOnboardingStateQuery,
  useSaveBrandStepMutation,
  useSaveBranchStepMutation,
  useSaveBillingStepMutation,
  useSavePlanStepMutation,
  useCompleteOnboardingMutation,
  useGoToOnboardingStepMutation,
} = onboardingApi;
