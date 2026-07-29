import type {
  AccountAnalytics,
  ShopAnalytics,
  WishlistAnalytics,
} from "@/types";

/**
 * Sample analytics used **only** as the backdrop behind an upgrade overlay.
 *
 * A locked section still renders its real charts so the owner can see the shape
 * of what they'd get — but the numbers can't be theirs (the endpoints 403
 * without the feature), so they're invented and blurred. Never render this
 * unblurred, and never let it reach a screen that reads as live data.
 */
export const PREVIEW_SHOP: ShopAnalytics = {
  totalOrders: 214,
  revenue: "168400",
  averageOrderValue: "787",
  cancelledOrders: 6,
  pendingPaymentTotal: "9200",
  deliverySplit: { delivery: 96, pickup: 118 },
  statusBreakdown: {
    completed: 132,
    confirmed: 24,
    placed: 21,
    preparing: 18,
    ready: 13,
    cancelled: 6,
  },
  topProducts: [
    { name: "Velvet Truffle · 1 Kg", quantity: 64 },
    { name: "Berry Cupcakes · Box of 6", quantity: 48 },
    { name: "Belgian Chocolate Box", quantity: 36 },
    { name: "Lemon Drizzle · 500 g", quantity: 29 },
    { name: "Red Velvet · 2 Kg", quantity: 22 },
  ],
  peakHours: [
    { hour: 9, orders: 6 },
    { hour: 11, orders: 14 },
    { hour: 13, orders: 22 },
    { hour: 15, orders: 18 },
    { hour: 17, orders: 31 },
    { hour: 19, orders: 44 },
    { hour: 21, orders: 27 },
  ],
  couponReport: [
    { code: "WEEKEND15", redemptions: 38, totalDiscount: "8420" },
    { code: "FIRSTBITE", redemptions: 21, totalDiscount: "4180" },
    { code: "BIRTHDAY10", redemptions: 12, totalDiscount: "2310" },
  ],
};

export const PREVIEW_WISHLIST: WishlistAnalytics = {
  totalSaves: 386,
  uniqueProducts: 42,
  convertedSavers: 97,
  overallConversionRate: 0.25,
  trend: [
    { date: "2026-07-01", saves: 8 },
    { date: "2026-07-05", saves: 14 },
    { date: "2026-07-09", saves: 11 },
    { date: "2026-07-13", saves: 19 },
    { date: "2026-07-17", saves: 16 },
    { date: "2026-07-21", saves: 24 },
    { date: "2026-07-25", saves: 21 },
    { date: "2026-07-29", saves: 28 },
  ],
  topProducts: [
    {
      productId: "preview-1",
      name: "Velvet Truffle · 1 Kg",
      image: null,
      saves: 74,
      ordered: 23,
      conversionRate: 0.31,
    },
    {
      productId: "preview-2",
      name: "Pistachio Rose Entremet",
      image: null,
      saves: 58,
      ordered: 12,
      conversionRate: 0.21,
    },
    {
      productId: "preview-3",
      name: "Belgian Chocolate Box",
      image: null,
      saves: 41,
      ordered: 15,
      conversionRate: 0.37,
    },
    {
      productId: "preview-4",
      name: "Berry Cupcakes · Box of 6",
      image: null,
      saves: 33,
      ordered: 6,
      conversionRate: 0.18,
    },
  ],
};

export const PREVIEW_ACCOUNT: AccountAnalytics = {
  totalOrders: 612,
  revenue: "486300",
  averageOrderValue: "794",
  totalCustomers: 341,
  returningCustomers: 128,
  repeatRatePct: "37.5",
  branchComparison: [
    {
      shopId: "preview-a",
      branchName: "Koregaon Park",
      orders: 248,
      revenue: "201400",
    },
    {
      shopId: "preview-b",
      branchName: "Kondhwa",
      orders: 196,
      revenue: "154800",
    },
    {
      shopId: "preview-c",
      branchName: "Baner",
      orders: 168,
      revenue: "130100",
    },
  ],
};
