import { baseApi } from "./baseApi";
import type { DeliveryType } from "@/types";

export type CustomCakeStatus =
  | "submitted"
  | "under_review"
  | "quotation_sent"
  | "accepted"
  | "rejected"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

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
  page?: number;
  limit?: number;
}

export const customCakeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listCustomCakes: build.query<CustomCakeListResponse, CustomCakeQuery | void>({
      query: (params) => ({
        url: "/custom-cake/requests",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.status ? { status: params.status } : {}),
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
      invalidatesTags: (_r, _e, { id }) => [
        { type: "CustomCake", id },
        { type: "CustomCake", id: "LIST" },
        { type: "CustomCake", id: `events:${id}` },
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

export const CUSTOM_CAKE_STATUS_LABELS: Record<CustomCakeStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  quotation_sent: "Quotation sent",
  accepted: "Accepted",
  rejected: "Rejected",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
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
