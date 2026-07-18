// ==================== Auth & shared ====================

/** Admin roles, matching the service-application `user_role` enum. */
export type Role =
  | "platform_super_admin"
  | "account_super_admin"
  | "shop_admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountId: string | null;
  shopIds: string[];
}

/** Response of POST /auth/login, /auth/2fa/verify, /auth/refresh. */
export interface LoginResponse {
  requiresTwoFactor: boolean;
  accessToken: string;
  refreshToken?: string | null;
  user?: AuthUser | null;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

/** Paginated envelope returned by the service-application. */
export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

// ==================== Domain enums ====================

export type AccountStatus = "pending" | "active" | "suspended" | "rejected";
export type OnboardingSource = "self_registration" | "admin_created";
export type ShopStatus = "active" | "suspended";

// ==================== Entities ====================

export interface Account {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  appSlug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  themeColor: string | null;
  currentPlanId: string | null;
  status: AccountStatus;
  onboardingSource: OnboardingSource;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountCreated extends Account {
  ownerInviteToken: string;
}

export interface Shop {
  id: string;
  accountId: string;
  branchName: string;
  slug: string;
  displayArea: string | null;
  bannerUrl: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  city: string | null;
  whatsappNumber: string | null;
  fssaiNumber: string | null;
  openingTime: string | null;
  closingTime: string | null;
  closedDays: string[];
  status: ShopStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  accountId: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  isActive: boolean;
  shopIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserCreated extends User {
  inviteToken: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  maxShops: number | null;
  maxProductsPerShop: number | null;
  features: Record<string, boolean>;
  isActive: boolean;
  isPublic: boolean;
}

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "expired"
  | "cancelled"
  | "suspended";

/** Plan feature flags gating admin-app modules (BRD §5.15). */
export interface PlanFeatureFlags {
  can_use_coupons?: boolean;
  can_use_analytics?: boolean;
  can_use_cms?: boolean;
  can_clone_catalog?: boolean;
  priority_support?: boolean;
}

export type PlanFeatureKey = keyof PlanFeatureFlags;

/** GET /accounts/me/entitlements — drives the contact-admin gate + feature gating. */
export interface Entitlements {
  hasActiveSubscription: boolean;
  /** Brand account display name — shown in the admin app's brand header (both brand & shop admins). */
  accountName: string;
  /** Brand account logo URL, if uploaded — shown in the brand header. */
  logoUrl: string | null;
  /** Brand account theme (accent) color as a hex string — recolours primary accents. */
  themeColor: string | null;
  /** Brand account lifecycle status. When not "active" the app shows the account-deactivated screen. */
  accountStatus: AccountStatus;
  /** Whether any subscription record exists (any status). */
  hasSubscription: boolean;
  planId: string | null;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  features: PlanFeatureFlags;
  maxShops: number | null;
  shopsUsed: number;
  maxProductsPerShop: number | null;
  support: {
    email: string | null;
    whatsapp: string | null;
  };
}
export type BillingCycle = "monthly" | "quarterly" | "annual";
export type PaymentMethodType = "upi" | "bank_transfer" | "cash" | "other";

export interface Subscription {
  id: string;
  accountId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  priceAtSubscription: string;
  startDate: string;
  endDate: string;
  nextBillingDate: string;
  trialEndsAt: string | null;
  autoRenew: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  accountId: string;
  amount: string;
  currency: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: PaymentMethodType;
  referenceNote: string | null;
  receiptNumber: string;
  createdAt: string;
}

export interface BillingSummary {
  mrr: string;
  totalCollected: string;
  activeSubscriptions: number;
  trialSubscriptions: number;
  dueSoon: number;
  overdue: number;
}

// ==================== Catalog ====================

export type ProductType = "cake" | "cupcake" | "chocolate";
export type UnitType = "piece" | "kg" | "gram" | "box";

export interface Category {
  id: string;
  shopId: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  price: string;
  unitType: UnitType;
  isDefault: boolean;
  sku: string | null;
  sortOrder: number;
  trackInventory: boolean;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
}

export interface ProductFlavor {
  id: string;
  flavorName: string;
  priceDelta: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  shopId: string;
  categoryId: string | null;
  productType: ProductType;
  name: string;
  description: string | null;
  images: string[];
  isEggless: boolean;
  isActive: boolean;
  minOrderHours: number;
  isFeatured: boolean;
  sortOrder: number;
  variants: ProductVariant[];
  flavorOptions: ProductFlavor[];
  createdAt: string;
  updatedAt: string;
}

export interface Addon {
  id: string;
  shopId: string;
  name: string;
  imageUrl: string | null;
  price: string;
  unitType: UnitType;
  isActive: boolean;
  trackInventory: boolean;
  stockQuantity: number | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Orders ====================

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type DeliveryType = "delivery" | "pickup";
export type OrderPaymentMethod = "cod" | "upi_manual" | "other";
export type OrderPaymentStatus = "pending" | "paid";

export interface OrderItemAddon {
  name: string;
  price: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  variantLabel: string;
  flavorName: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  addons: OrderItemAddon[];
}

export interface OrderStatusHistory {
  status: OrderStatus;
  note: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  shopId: string;
  accountId: string;
  customerId: string;
  status: OrderStatus;
  deliveryType: DeliveryType;
  deliveryAddressId: string | null;
  scheduledDate: string;
  scheduledSlotStart: string | null;
  scheduledSlotEnd: string | null;
  subtotal: string;
  couponId: string | null;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  customerNote: string | null;
  cancellationReason: string | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

/** A realtime order change pushed over SSE (`GET /orders/stream`). */
export interface OrderEvent {
  accountId: string;
  shopId: string;
  orderId: string;
  orderNumber: string;
  type: "created" | "status" | "payment" | "cancelled";
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  at: string;
}

export type CouponType = "percentage" | "flat";

export interface Coupon {
  id: string;
  shopId: string;
  code: string;
  discountType: CouponType;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderAmount: string | null;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  isPublic: boolean;
  displayLabel: string | null;
}

// ==================== Analytics ====================

export interface TopProduct {
  name: string;
  quantity: number;
}

/** GET /analytics/shop — branch analytics (ShopAnalyticsDto). */
export interface ShopAnalytics {
  totalOrders: number;
  revenue: string;
  averageOrderValue: string;
  cancelledOrders: number;
  pendingPaymentTotal: string;
  deliverySplit: { delivery: number; pickup: number };
  statusBreakdown: Record<string, number>;
  topProducts: TopProduct[];
}

export interface BranchComparison {
  shopId: string;
  branchName: string;
  orders: number;
  revenue: string;
}

/** GET /analytics/account — brand analytics (AccountAnalyticsDto). */
export interface AccountAnalytics {
  totalOrders: number;
  revenue: string;
  averageOrderValue: string;
  totalCustomers: number;
  returningCustomers: number;
  repeatRatePct: string;
  branchComparison: BranchComparison[];
}
