import { baseApi } from "./baseApi";
import type { DeliveryType, OrderPaymentStatus, OrderStatus } from "@/types";

/**
 * A request's own lifecycle — the negotiation, and nothing else.
 *
 * Accepting converts it into an order, and from there the ORDER's status is the
 * only fulfilment state there is. `rejected`/`preparing`/`ready`/`delivered` are
 * retired: they duplicated `OrderStatus`, which is exactly how a request and the
 * order it became came to show different things. They stay in the union only
 * because historical timeline events still carry them.
 */
export type CustomCakeStatus =
  | "submitted"
  | "under_review"
  | "quotation_sent"
  | "accepted"
  | "cancelled"
  | LegacyCustomCakeStatus;

/** @deprecated Read-only, for old timeline rows. Never sent to the API. */
export type LegacyCustomCakeStatus =
  | "rejected"
  | "preparing"
  | "ready"
  | "delivered";

/** The stages a request can actually be moved to, in pipeline order. */
export const CUSTOM_CAKE_PIPELINE: CustomCakeStatus[] = [
  "submitted",
  "under_review",
  "quotation_sent",
  "accepted",
  "cancelled",
];

export interface CustomCakeRequest {
  id: string;
  requestNumber: string;
  shopId: string;
  customerId: string | null;
  guestId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  cakeType: string | null;
  weight: string | null;
  shape: string | null;
  theme: string | null;
  occasion: string | null;
  sponge: string | null;
  cream: string | null;
  filling: string | null;
  flavour: string | null;
  colour: string | null;
  decorations: string[];
  topper: string | null;
  cakeMessage: string | null;
  referenceImageUrls: string[];
  deliveryType: DeliveryType;
  neededDate: string | null;
  neededTime: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  specialInstructions: string | null;
  allergyInfo: string | null;
  status: CustomCakeStatus;
  quotedPrice: string | null;
  adminNotes: string | null;
  resolutionReason: string | null;
  convertedOrderId: string | null;
  /**
   * The order this request became. Null until it is accepted.
   *
   * `convertedOrderStatus` is the live status of that order — where the cake
   * actually is. The request's own `status` deliberately stops at `accepted`,
   * so this is what the desk reads for anything past the quote, rather than a
   * second copy that drifts.
   */
  convertedOrderNumber: string | null;
  convertedOrderStatus: OrderStatus | null;
  convertedOrderPaymentStatus: OrderPaymentStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomCakeEvent {
  id: string;
  requestId: string;
  status: CustomCakeStatus;
  changedBy: string | null;
  note: string | null;
  changedAt: string;
}

export interface CustomCakeOption {
  id: string;
  shopId: string;
  fieldKey: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomCakeListResponse {
  items: CustomCakeRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomCakeQuery {
  shopId?: string;
  status?: CustomCakeStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * A request typed up by the shop for someone who phoned in or walked up. The
 * brief is the storefront form's, plus the branch it belongs to and (optionally)
 * the customer record to attach — the link conversion to an order later needs.
 */
export interface CreateCustomCakeInput {
  shopId: string;
  customerId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  cakeType?: string;
  weight?: string;
  shape?: string;
  theme?: string;
  occasion?: string;
  sponge?: string;
  cream?: string;
  filling?: string;
  flavour?: string;
  colour?: string;
  decorations?: string[];
  topper?: string;
  cakeMessage?: string;
  referenceImageUrls?: string[];
  deliveryType: DeliveryType;
  neededDate?: string;
  neededTime?: string;
  deliveryAddress?: string;
  notes?: string;
  specialInstructions?: string;
  allergyInfo?: string;
}

export const customCakeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createCustomCake: build.mutation<CustomCakeRequest, CreateCustomCakeInput>({
      query: (body) => ({
        url: "/custom-cake/requests",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "CustomCake", id: "LIST" }],
    }),

    listCustomCakes: build.query<CustomCakeListResponse, CustomCakeQuery | void>({
      query: (params) => ({
        url: "/custom-cake/requests",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.search ? { search: params.search } : {}),
        },
      }),
      providesTags: [{ type: "CustomCake", id: "LIST" }],
    }),

    getCustomCake: build.query<CustomCakeRequest, string>({
      query: (id) => ({ url: `/custom-cake/requests/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "CustomCake", id }],
    }),

    getCustomCakeEvents: build.query<CustomCakeEvent[], string>({
      query: (id) => ({ url: `/custom-cake/requests/${id}/events` }),
      providesTags: (_r, _e, id) => [{ type: "CustomCake", id: `events:${id}` }],
    }),

    updateCustomCakeStatus: build.mutation<
      CustomCakeRequest,
      { id: string; status: CustomCakeStatus; reason?: string; note?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/custom-cake/requests/${id}/status`,
        method: "PATCH",
        body,
      }),
      // Order tags too: moving a request to `accepted` creates the order, so
      // the queue must not keep showing a list that predates it.
      invalidatesTags: (_r, _e, { id }) => [
        { type: "CustomCake", id },
        { type: "CustomCake", id: "LIST" },
        { type: "CustomCake", id: `events:${id}` },
        { type: "Order", id: "LIST" },
      ],
    }),

    quoteCustomCake: build.mutation<
      CustomCakeRequest,
      { id: string; quotedPrice: number; note?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/custom-cake/requests/${id}/quote`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "CustomCake", id },
        { type: "CustomCake", id: "LIST" },
        { type: "CustomCake", id: `events:${id}` },
      ],
    }),

    setCustomCakeNotes: build.mutation<
      CustomCakeRequest,
      { id: string; adminNotes: string }
    >({
      query: ({ id, adminNotes }) => ({
        url: `/custom-cake/requests/${id}/notes`,
        method: "PATCH",
        body: { adminNotes },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "CustomCake", id }],
    }),

    convertCustomCake: build.mutation<
      { orderId: string; orderNumber: string },
      { id: string; totalAmount?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/custom-cake/requests/${id}/convert`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "CustomCake", id },
        { type: "CustomCake", id: "LIST" },
        { type: "CustomCake", id: `events:${id}` },
        { type: "Order", id: "LIST" },
      ],
    }),

    // ---- Options ----
    listCustomCakeOptions: build.query<CustomCakeOption[], string>({
      query: (shopId) => ({ url: "/custom-cake/options", params: { shopId } }),
      providesTags: [{ type: "CustomCakeOption", id: "LIST" }],
    }),

    createCustomCakeOption: build.mutation<
      CustomCakeOption,
      { shopId: string; fieldKey: string; label: string; sortOrder?: number }
    >({
      query: ({ shopId, ...body }) => ({
        url: "/custom-cake/options",
        method: "POST",
        params: { shopId },
        body,
      }),
      invalidatesTags: [{ type: "CustomCakeOption", id: "LIST" }],
    }),

    updateCustomCakeOption: build.mutation<
      CustomCakeOption,
      { id: string; label?: string; sortOrder?: number; isActive?: boolean }
    >({
      query: ({ id, ...body }) => ({
        url: `/custom-cake/options/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "CustomCakeOption", id: "LIST" }],
    }),

    deleteCustomCakeOption: build.mutation<void, string>({
      query: (id) => ({ url: `/custom-cake/options/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "CustomCakeOption", id: "LIST" }],
    }),
  }),
});

export const {
  useCreateCustomCakeMutation,
  useListCustomCakesQuery,
  useGetCustomCakeQuery,
  useGetCustomCakeEventsQuery,
  useUpdateCustomCakeStatusMutation,
  useQuoteCustomCakeMutation,
  useSetCustomCakeNotesMutation,
  useConvertCustomCakeMutation,
  useListCustomCakeOptionsQuery,
  useCreateCustomCakeOptionMutation,
  useUpdateCustomCakeOptionMutation,
  useDeleteCustomCakeOptionMutation,
} = customCakeApi;

/** Field keys whose option lists are admin-configurable (mirrors backend). */
export const CUSTOM_CAKE_OPTION_FIELDS = [
  "cake_type",
  "weight",
  "shape",
  "theme",
  "occasion",
  "sponge",
  "cream",
  "filling",
  "flavour",
  "colour",
  "decoration",
  "topper",
] as const;

export const CUSTOM_CAKE_FIELD_LABELS: Record<string, string> = {
  cake_type: "Cake type",
  weight: "Weight",
  shape: "Shape",
  theme: "Theme",
  occasion: "Occasion",
  sponge: "Sponge",
  cream: "Cream",
  filling: "Filling",
  flavour: "Flavour",
  colour: "Colour",
  decoration: "Decoration",
  topper: "Topper",
};

/**
 * Every label, live and retired — old timeline events still reference the
 * retired ones, and a history that renders "undefined" is worse than one that
 * names a stage nobody can reach any more.
 */
export const CUSTOM_CAKE_STATUS_LABELS: Record<CustomCakeStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  quotation_sent: "Quotation sent",
  accepted: "Accepted",
  cancelled: "Cancelled",
  rejected: "Cancelled",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
};

/** Hex accents per status (aligned with the Orders status palette). */
export const CUSTOM_CAKE_STATUS_ACCENT: Record<CustomCakeStatus, string> = {
  submitted: "#3b82f6",
  under_review: "#8b5cf6",
  quotation_sent: "#f59e0b",
  accepted: "#10b981",
  rejected: "#ef4444",
  preparing: "#f59e0b",
  ready: "#10b981",
  delivered: "#10b981",
  cancelled: "#ef4444",
};
