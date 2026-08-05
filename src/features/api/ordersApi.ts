import { defaultSerializeQueryArgs } from "@reduxjs/toolkit/query";
import { baseApi } from "./baseApi";
import type { AppDispatch } from "@/app/store";
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
 * Optimistically apply a status change to EVERY cached `listOrders` page,
 * returning an undo fn that restores all patches.
 *
 * Three behaviours, decided per cached query:
 *  - **the list it's leaving** (a status-filtered tab or board lane it no
 *    longer belongs to) drops the row;
 *  - **the list it's arriving in** — the board lane for the new status — gains
 *    it, so a dragged card appears in its new column on release rather than a
 *    refetch later;
 *  - **an unfiltered list** keeps it and just rewrites the status.
 *
 * Together these make a drag look like one continuous movement instead of a
 * card blinking out of one column and into another.
 */
/** The two endpoints that return order pages: the admin queue and the boards. */
const LIST_ENDPOINTS = ["listOrders", "listBoardOrders"] as const;
type ListEndpoint = (typeof LIST_ENDPOINTS)[number];

/**
 * What RTK Query's lifecycle callbacks actually hand back — the api reducer's
 * own state, not the app's full `RootState`. Derived from `baseApi` rather than
 * `ordersApi` so it doesn't feed the inference cycle noted below.
 */
type ApiRootState = Parameters<typeof baseApi.util.selectInvalidatedBy>[0];

function optimisticallyAdvance(
  id: string,
  status: OrderStatus,
  dispatch: AppDispatch,
  getState: () => ApiRootState,
) {
  const patches: { undo: () => void }[] = [];
  const state = getState();
  // Only the list endpoints — the two count endpoints provide the same LIST tag
  // and their args would otherwise be replayed against a list cache key.
  const entries = ordersApi.util
    .selectInvalidatedBy(state, [{ type: "Order", id: "LIST" }])
    .filter((e) => LIST_ENDPOINTS.includes(e.endpointName as ListEndpoint)) as {
    endpointName: ListEndpoint;
    originalArgs: OrdersQuery | void;
  }[];

  // `ordersApi` is still being inferred where this function sits in the module,
  // so indexing its `endpoints` map by a *union* of names resolves against a
  // half-built type and loses `listBoardOrders`. Both list endpoints share one
  // arg and result shape, so a narrow local view of the two selectors costs
  // nothing and breaks the cycle.
  const listEndpoints = ordersApi.endpoints as unknown as Record<
    ListEndpoint,
    {
      select: (
        arg: OrdersQuery | void,
      ) => (state: unknown) => { data?: Paginated<Order> };
    }
  >;

  // Grab the row before any patch removes it: the lane it's moving into needs
  // a whole order to render, not just an id.
  let moving: Order | undefined;
  for (const { endpointName, originalArgs } of entries) {
    const cached = listEndpoints[endpointName].select(originalArgs)(state).data;
    const found = cached?.data.find((o) => o.id === id);
    if (found) {
      moving = found;
      break;
    }
  }

  const apply = (args: OrdersQuery | void) => (draft: Paginated<Order>) => {
    const idx = draft.data.findIndex((o) => o.id === id);
    const wanted = args?.status;

    if (idx !== -1) {
      if (!wanted || wanted === status) {
        draft.data[idx].status = status;
      } else {
        draft.data.splice(idx, 1);
        if (draft.meta.total > 0) draft.meta.total -= 1;
      }
      return;
    }

    // Not in this list yet, and this is exactly the lane it's moving into.
    // Position doesn't matter — the board re-sorts by delivery date.
    if (wanted === status && moving) {
      draft.data.unshift({ ...moving, status });
      draft.meta.total += 1;
    }
  };

  for (const { endpointName, originalArgs } of entries) {
    patches.push(
      dispatch(
        ordersApi.util.updateQueryData(
          endpointName as never,
          originalArgs as never,
          apply(originalArgs) as never,
        ),
      ),
    );
  }
  return () => patches.forEach((p) => p.undo());
}

/**
 * Optimistically drop an order from EVERY cached `listOrders` page, returning
 * an undo fn that restores all patches. Used by cancellation, which takes the
 * order out of every board and tab it could be sitting in.
 */
function optimisticallyRemove(
  id: string,
  dispatch: AppDispatch,
  getState: () => ApiRootState,
) {
  const patches: { undo: () => void }[] = [];
  const entries = ordersApi.util
    .selectInvalidatedBy(getState(), [{ type: "Order", id: "LIST" }])
    .filter((e) => LIST_ENDPOINTS.includes(e.endpointName as ListEndpoint));

  const drop = (draft: Paginated<Order>) => {
    const idx = draft.data.findIndex((o) => o.id === id);
    if (idx !== -1) {
      draft.data.splice(idx, 1);
      if (draft.meta.total > 0) draft.meta.total -= 1;
    }
  };

  for (const { endpointName, originalArgs } of entries) {
    patches.push(
      dispatch(
        ordersApi.util.updateQueryData(
          endpointName as never,
          originalArgs as never,
          drop as never,
        ),
      ),
    );
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
      // The queue scrolls rather than pages, so every loaded page lives in ONE
      // cache entry keyed by the filters alone. That keeps the optimistic
      // patches above honest: advancing an order the user scrolled to on page 3
      // still rewrites the row they are looking at, which a per-page cache
      // (each page a separate entry, only the newest one subscribed) could not do.
      serializeQueryArgs: ({ queryArgs, endpointDefinition, endpointName }) => {
        const filters: Partial<OrdersQuery> = { ...queryArgs };
        delete filters.page;
        return defaultSerializeQueryArgs({
          queryArgs: filters,
          endpointDefinition,
          endpointName,
        });
      },
      merge: (cache, incoming, { arg }) => {
        // Page 1 only comes back around as a refresh (a filter change makes a
        // new cache entry), and the user is by definition still at the top —
        // so take the server's list wholesale and pick up anything just placed.
        if ((arg?.page ?? 1) <= 1) {
          cache.data = incoming.data;
          cache.meta = incoming.meta;
          return;
        }
        // Upsert, don't append: a realtime invalidation refetches the page the
        // user is on, and rows shift across the page boundary as orders leave
        // the queue — appending blindly would duplicate both.
        const at = new Map(cache.data.map((o, i) => [o.id, i]));
        for (const order of incoming.data) {
          const i = at.get(order.id);
          if (i === undefined) cache.data.push(order);
          else cache.data[i] = order;
        }
        cache.meta = incoming.meta;
      },
      // Same cache entry, so only a page turn is a new request.
      forceRefetch: ({ currentArg, previousArg }) =>
        (currentArg?.page ?? 1) !== (previousArg?.page ?? 1),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((o) => ({ type: "Order" as const, id: o.id })),
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order" as const, id: "LIST" }],
    }),

    /**
     * The same page of orders as `listOrders`, from the plan-gated `/orders/board`
     * route. The Kitchen and Delivery lanes use this and nothing else, so a brand
     * that drops the module gets boards that stop at the server rather than
     * boards that keep working off whatever bundle the tablet still has.
     */
    listBoardOrders: build.query<Paginated<Order>, OrdersQuery | void>({
      query: (params) => ({
        url: "/orders/board",
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
      // Optimistic: the order leaves its current-status tab (or changes lane on
      // a board) at once. On failure it snaps back into place.
      async onQueryStarted(
        { id, status },
        { dispatch, getState, queryFulfilled },
      ) {
        const undo = optimisticallyAdvance(id, status, dispatch, getState);
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
  useListBoardOrdersQuery,
  useGetOrderQuery,
  useGetOrderStatusCountsQuery,
  useGetOrderScheduleCountsQuery,
  useUpdateOrderStatusMutation,
  useCancelOrderMutation,
  useMarkOrderPaidMutation,
} = ordersApi;
