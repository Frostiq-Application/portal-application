import { baseApi } from "./baseApi";
import type { OrderDateBucket, OrderSortBy, SortDir } from "@/lib/orders";
import type {
  DeliveryType,
  Order,
  OrderPaymentMethod,
  OrderStatus,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface OrdersQuery extends PaginationQuery {
  shopId?: string;
  status?: OrderStatus;
  deliveryType?: DeliveryType;
  scheduledDate?: string;
  /** Delivery-day tab. Resolved server-side against `refDate`. */
  dateBucket?: Exclude<OrderDateBucket, "all">;
  /** The browser's own "today", so day buckets follow the shop's clock. */
  refDate?: string;
  sortBy?: OrderSortBy;
  sortDir?: SortDir;
}

/** Totals behind the delivery-day tabs. */
export interface OrderScheduleCounts {
  today: number;
  tomorrow: number;
  overmorrow: number;
  other: number;
  all: number;
}

/** Query params shared by the list and both count endpoints. */
function queueParams(params?: Partial<OrdersQuery> | void) {
  const p: Partial<OrdersQuery> = params ?? {};
  return {
    ...(p.shopId ? { shopId: p.shopId } : {}),
    ...(p.deliveryType ? { deliveryType: p.deliveryType } : {}),
    ...(p.scheduledDate ? { scheduledDate: p.scheduledDate } : {}),
    ...(p.dateBucket ? { dateBucket: p.dateBucket } : {}),
    ...(p.refDate ? { refDate: p.refDate } : {}),
    ...(p.search ? { search: p.search } : {}),
  };
}

export interface ManualOrderItemInput {
  productId: string;
  variantId: string;
  flavorOptionId?: string;
  quantity: number;
  addonIds?: string[];
}

export interface CreateManualOrderBody {
  shopId: string;
  customerId: string;
  items: ManualOrderItemInput[];
  deliveryType: DeliveryType;
  deliveryAddressId?: string;
  scheduledDate: string;
  scheduledSlotStart?: string;
  scheduledSlotEnd?: string;
  paymentMethod: OrderPaymentMethod;
  markAsPaid?: boolean;
  couponCode?: string;
  note?: string;
}

/**
 * Optimistically drop an order from EVERY cached `listOrders` page, returning
 * an undo fn that restores all patches. Used so an action button removes the
 * row from the current tab instantly; the undo runs if the request fails.
 */
function optimisticallyRemove(id: string, dispatch: any, getState: any) {
  const patches: { undo: () => void }[] = [];
  const entries = ordersApi.util.selectInvalidatedBy(getState(), [
    { type: "Order", id: "LIST" },
  ]);
  for (const { originalArgs } of entries) {
    const patch = dispatch(
      ordersApi.util.updateQueryData(
        "listOrders",
        originalArgs as OrdersQuery | void,
        (draft) => {
          const idx = draft.data.findIndex((o) => o.id === id);
          if (idx !== -1) {
            draft.data.splice(idx, 1);
            if (draft.meta.total > 0) draft.meta.total -= 1;
          }
        },
      ),
    );
    patches.push(patch);
  }
  return () => patches.forEach((p) => p.undo());
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listOrders: build.query<Paginated<Order>, OrdersQuery | void>({
      query: (params) => ({
        url: "/orders",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...queueParams(params),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.sortBy ? { sortBy: params.sortBy } : {}),
          ...(params?.sortDir ? { sortDir: params.sortDir } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((o) => ({ type: "Order" as const, id: o.id })),
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order" as const, id: "LIST" }],
    }),

    getOrder: build.query<Order, string>({
      query: (id) => ({ url: `/orders/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),

    // Per-status totals for the queue tabs. Tagged LIST so realtime events
    // (which invalidate the list) refresh the counts too.
    getOrderStatusCounts: build.query<
      Partial<Record<OrderStatus, number>>,
      Omit<OrdersQuery, "status" | "page" | "limit"> | void
    >({
      query: (params) => ({
        url: "/orders/counts",
        params: queueParams(params),
      }),
      providesTags: [{ type: "Order", id: "LIST" }],
    }),

    // Per-delivery-day totals for the day tabs. Unlike the status counts these
    // *do* honor the selected status, so each day shows what that tab opens.
    getOrderScheduleCounts: build.query<
      OrderScheduleCounts,
      Omit<OrdersQuery, "dateBucket" | "page" | "limit"> | void
    >({
      query: (params) => ({
        url: "/orders/schedule-counts",
        params: {
          ...queueParams(params),
          ...(params?.status ? { status: params.status } : {}),
        },
      }),
      providesTags: [{ type: "Order", id: "LIST" }],
    }),

    createOrder: build.mutation<Order, CreateManualOrderBody>({
      query: (body) => ({ url: "/orders", method: "POST", body }),
      invalidatesTags: [{ type: "Order", id: "LIST" }],
    }),

    updateOrderStatus: build.mutation<
      Order,
      { id: string; status: OrderStatus; note?: string }
    >({
      query: ({ id, status, note }) => ({
        url: `/orders/${id}/status`,
        method: "POST",
        body: { status, ...(note ? { note } : {}) },
      }),
      // Optimistic: the order leaves its current-status list at once. On
      // failure the row snaps back into place.
      async onQueryStarted({ id }, { dispatch, getState, queryFulfilled }) {
        const undo = optimisticallyRemove(id, dispatch, getState);
        try {
          await queryFulfilled;
        } catch {
          undo();
        }
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    cancelOrder: build.mutation<Order, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/orders/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      async onQueryStarted({ id }, { dispatch, getState, queryFulfilled }) {
        const undo = optimisticallyRemove(id, dispatch, getState);
        try {
          await queryFulfilled;
        } catch {
          undo();
        }
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    // Mark-paid does NOT change status, so the row stays in its tab. We patch
    // the payment badge in place optimistically and revert on failure.
    markOrderPaid: build.mutation<Order, string>({
      query: (id) => ({ url: `/orders/${id}/mark-paid`, method: "POST" }),
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        const patches: { undo: () => void }[] = [];
        const entries = ordersApi.util.selectInvalidatedBy(getState(), [
          { type: "Order", id: "LIST" },
        ]);
        for (const { originalArgs } of entries) {
          patches.push(
            dispatch(
              ordersApi.util.updateQueryData(
                "listOrders",
                originalArgs as OrdersQuery | void,
                (draft) => {
                  const o = draft.data.find((x) => x.id === id);
                  if (o) o.paymentStatus = "paid";
                },
              ),
            ),
          );
        }
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCreateOrderMutation,
  useListOrdersQuery,
  useGetOrderQuery,
  useGetOrderStatusCountsQuery,
  useGetOrderScheduleCountsQuery,
  useUpdateOrderStatusMutation,
  useCancelOrderMutation,
  useMarkOrderPaidMutation,
} = ordersApi;
