import type { AccountStatus, Plan, SubscriptionStatus } from "./index";

/**
 * Subscription & Billing types — mirrors the service-application payloads.
 * See `subscription.md` for the requirements each shape serves.
 */

// ---------------------------------------------------------------- catalogue --

export type FeatureDataType = "boolean" | "count";

export interface BillingFeature {
  key: string;
  label: string;
  description: string | null;
  category: string;
  dataType: FeatureDataType;
  /** Count only — units per add-on step (branches 1, products 10). */
  addonStep: number | null;
  /** Count only — ₹/step/month. **Null = add-on not sold.** */
  addonPriceMonthly: string | null;
  /** Count only — the fixed cap during trial. */
  trialLimit: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface BillingCycle {
  code: string;
  name: string;
  months: number;
  /** The structural discount, always expressed as months free. */
  freeMonths: number;
  displayOrder: number;
  isActive: boolean;
}

/** A cycle as offered at checkout, with its derived price. */
export interface CycleOption {
  code: string;
  name: string;
  months: number;
  freeMonths: number;
  payableMonths: number;
  savingsLabel: string | null;
}

export interface CyclePrice {
  code: string;
  price: string;
  perMonth: string;
}

export interface PlanLimit {
  featureKey: string;
  label: string;
  value: number;
  isUnlimited: boolean;
}

/** A plan as shown on the pricing page. */
export interface PricingPlan {
  id: string;
  code: string | null;
  name: string;
  tagline: string | null;
  description: string | null;
  badge: string | null;
  priceMonthly: string;
  sortOrder?: number;
  /** Free-trial window in days; 0 on every plan that isn't the offer. */
  trialDays?: number;
  cyclePrices: CyclePrice[];
  limits: PlanLimit[];
  flags: Record<string, boolean>;
}

export interface PricingResponse {
  cycles: CycleOption[];
  plans: PricingPlan[];
  /** Non-null only while this account can still take the trial. */
  trialOffer?: TrialOffer | null;
}

/** The single plan carrying the free-trial offer, and its window. */
export interface TrialOffer {
  planId: string;
  planCode: string | null;
  planName: string;
  days: number;
}

/** A plan in the Super Admin catalogue editor. */
export interface AdminPlan extends Plan {
  subscriberCount: number;
  cyclePrices: {
    code: string;
    name: string;
    months: number;
    freeMonths: number;
    payableMonths: number;
    price: string;
  }[];
  features: never;
  planFeatures?: PlanFeatureValue[];
}

export interface PlanFeatureValue {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  isUnlimited: boolean;
}

// -------------------------------------------------------------------- quote --

export interface QuoteLine {
  key: string;
  label: string;
  qty: number;
  unitPrice: string;
  amount: string;
}

/** The itemised amount preview shown before every charge (SH-08). */
export interface Quote {
  planAmount: string;
  addonAmount: string;
  discountAmount: string;
  subtotal: string;
  gatewayFee: string;
  taxAmount: string;
  totalAmount: string;
  gstApplicable: boolean;
  gstRate: string;
  /** The pass-through rate applied, so the UI can show "(2%)". */
  gatewayFeePercent: string;
  currency: "INR";
  lines: QuoteLine[];
  payableMonths: number;
  cycleMonths: number;
  couponCode: string | null;
  /** True when the total exceeds the ₹15,000 RBI auto-debit ceiling. */
  requiresApproval: boolean;
  couponError?: string;
}

// ------------------------------------------------------------------ coupons --

export type DiscountType = "percent" | "flat";
export type CouponVisibility = "public" | "private";

export interface ApplicableCoupon {
  code: string;
  discountAmount: string;
  durationCycles: number;
  label: string;
}

export interface SubscriptionCoupon {
  id: string;
  code: string;
  internalNote: string | null;
  discountType: DiscountType;
  discountValue: string;
  maxDiscountAmount: string | null;
  durationCycles: number;
  visibility: CouponVisibility;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  perAccountLimit: number;
  redemptionCount: number;
  isActive: boolean;
  planIds: string[];
  cycleCodes: string[];
  remaining: number | null;
  createdAt: string;
}

export interface CouponRedemption {
  id: string;
  couponId: string;
  accountId: string;
  subscriptionId: string;
  discountAmount: string;
  redeemedAt: string;
}

// ------------------------------------------------------------- subscription --

export interface UsageRow {
  featureKey: string;
  label: string;
  used: number;
  planValue: number;
  addonValue: number;
  /** plan + add-ons. Null = unlimited. **This** is what gating compares. */
  effective: number | null;
  isUnlimited: boolean;
  /** True during trial: the fixed trial cap replaces the plan value. */
  trialCapped: boolean;
}

export interface SubscriptionAddon {
  id: string;
  featureKey: string;
  label: string;
  quantity: number;
  stepSize: number;
  unitsAdded: number;
  pricePerStep: string;
  removeAtPeriodEnd: boolean;
  addedAt: string;
}

export interface AddonOption {
  featureKey: string;
  label: string;
  description: string | null;
  stepSize: number | null;
  pricePerStepMonthly: string | null;
  pricePerStepCycle: string | null;
  sellable: boolean;
  unavailableReason: string | null;
  isUnlimited: boolean;
  currentQuantity: number;
  planValue: number;
  effective: number | null;
}

export type ScheduledChangeType = "plan_downgrade" | "cycle_change";

export interface ScheduledChange {
  id: string;
  changeType: ScheduledChangeType;
  targetPlanId: string | null;
  targetPlanName: string | null;
  targetCycle: string | null;
  targetCycleName: string | null;
  keepSelections: Record<string, string[]>;
  newAddons: { featureKey: string; quantity: number }[];
  effectiveAt: string;
}

export interface BillingProfile {
  billingAddress: string | null;
  billingPincode: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string;
  gstin: string | null;
  complete: boolean;
}

export interface SubscriptionSummary {
  id: string;
  status: SubscriptionStatus;
  planId: string;
  planName: string;
  planTagline: string | null;
  billingCycle: string;
  cycleName: string;
  lockedMonthlyPrice: string;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceUntil: string | null;
  lockedUntil: string | null;
  autopayEnabled: boolean;
  hasMandate: boolean;
  cancelAtPeriodEnd: boolean;
  cancelReason: string | null;
  deleteReadyAt: string | null;
  dunningAttempt: number;
  nextRetryAt: string | null;
  daysRemaining: number;
}

/** GET /billing/me — everything the subscription dashboard renders (SH-17). */
export interface SubscriptionDashboard {
  subscription: SubscriptionSummary | null;
  /** Eligible to be put on the ₹0 plan (no live subscription yet). */
  freePlanAvailable?: boolean;
  /** Which plan this account can trial, or null when the offer is off. */
  trialOffer?: TrialOffer | null;
  coupon: {
    code: string;
    description: string;
    cyclesLeft: number;
  } | null;
  usage?: UsageRow[];
  flags?: Record<string, boolean>;
  addons?: SubscriptionAddon[];
  scheduledChange?: ScheduledChange | null;
  nextRenewal?: { date: string; quote: Quote };
  billingProfile: BillingProfile;
  storefrontLive?: boolean;
  showPoweredBy?: boolean;
  settings: {
    graceDaysTrial?: number;
    graceDaysPayment?: number;
    lockedDays?: number;
    archiveDays?: number;
    mandateAutoDebitLimit?: string;
    gstEnabled?: boolean;
  };
}

// ----------------------------------------------------------------- checkout --

/** What the browser needs to open Razorpay. */
export interface CheckoutSession {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: string;
  currency: string;
  quote: Quote;
  accountName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  /** True for a ₹0 total — already settled, no gateway round-trip. */
  settledWithoutPayment: boolean;
}

export interface BillingProfileInput {
  billingAddress: string;
  billingPincode: string;
  billingCity: string;
  billingState: string;
  billingCountry?: string;
  gstin?: string;
}

// ------------------------------------------------------------ plan changes --

export interface OverLimitRow {
  featureKey: string;
  label: string;
  used: number;
  allowed: number;
  excess: number;
}

/** Preview of a plan change — immediate + prorated, or scheduled to renewal. */
export interface ChangePreview {
  mode: "immediate" | "scheduled";
  upgrade: boolean;
  quote: Quote;
  prorationAmount: string;
  daysRemaining?: number;
  daysInCycle?: number;
  overLimit: OverLimitRow[];
  effectiveAt: string;
  addonOptions?: AddonOption[];
}

export interface ArchivableItem {
  id: string;
  name: string;
  meta?: string;
  isArchived: boolean;
}

// ------------------------------------------------------------------ history --

export type PaymentType =
  | "first_payment"
  | "renewal"
  | "upgrade_proration"
  | "addon_proration";
export type PaymentStatus = "pending" | "success" | "failed";

export interface PaymentRow {
  id: string;
  type: PaymentType;
  status: PaymentStatus;
  planAmount: string;
  addonAmount: string;
  discountAmount: string;
  gatewayFee: string;
  taxAmount: string;
  totalAmount: string;
  periodStart: string | null;
  periodEnd: string | null;
  paymentMethod: string | null;
  attemptNumber: number;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  invoice: { id: string; invoiceNumber: string; total: string } | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  subscriptionId: string;
  accountId: string;
  sellerLegalName: string;
  sellerGstin: string | null;
  billToName: string;
  billToGstin: string | null;
  billToAddress: string | null;
  billToState: string | null;
  subtotal: string;
  discount: string;
  gatewayFee: string;
  gstApplicable: boolean;
  gstRate: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  pdfUrl: string | null;
  issuedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  accountId: string;
  eventType: string;
  summary: string | null;
  detail: Record<string, unknown> | null;
  actorUserId: string | null;
  createdAt: string;
}

// ----------------------------------------------------------------- settings --

export interface BillingSettings {
  id: number;
  gstEnabled: boolean;
  gstin: string | null;
  gstRate: string;
  legalName: string;
  legalAddress: string | null;
  homeState: string;
  invoicePrefix: string;
  invoiceCounter: number;
  trialDays: number;
  graceDaysTrial: number;
  graceDaysPayment: number;
  lockedDays: number;
  archiveDays: number;
  retryDays: number[];
  passGatewayFee: boolean;
  gatewayFeePercent: string;
  mandateAutoDebitLimit: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- oversight --

export interface AdminSubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  accountId: string;
  accountName: string;
  ownerEmail: string;
  planId: string;
  planName: string;
  billingCycle: string;
  lockedMonthlyPrice: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  graceUntil: string | null;
  lockedUntil: string | null;
  cancelAtPeriodEnd: boolean;
  cancelReason: string | null;
  autopayEnabled: boolean;
  dunningAttempt: number;
  nextRetryAt: string | null;
  deleteReadyAt: string | null;
  createdAt: string;
  hasScheduledChange: boolean;
}

export interface AdminSubscriptionDetail {
  subscription: SubscriptionSummary & Record<string, unknown>;
  account: {
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    appSlug: string;
    status: AccountStatus;
    gstin: string | null;
    billingState: string | null;
  } | null;
  plan: { id: string; name: string; priceMonthly: string } | null;
  payments: PaymentRow[];
  timeline: SubscriptionEvent[];
  quote: Quote;
}

export interface BillingReports {
  revenueByPlan: {
    plan: string;
    cycle: string;
    subscribers: number;
    mrr: string;
  }[];
  collectedByMonth: {
    month: string;
    gross: string;
    discounts: string;
    payments: number;
  }[];
  couponPerformance: {
    code: string;
    redemptions: number;
    discountGiven: string;
  }[];
  cancellations: { reason: string; count: number }[];
  statusCounts: Record<string, number>;
  failedPayments30d: number;
}

export interface DeleteReadyAccount {
  subscriptionId: string;
  accountId: string;
  accountName: string;
  ownerEmail: string;
  cancelledAt: string;
  deleteReadyAt: string;
}

export interface SweepResult {
  renewalsProcessed: number;
  charged: number;
  failed: number;
  movedToGrace: number;
  locked: number;
  cancelled: number;
  remindersSent: number;
}
