import { baseApi } from "./baseApi";
import type {
  DeliveryType,
  Order,
  OrderStatus,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface OrdersQuery extends PaginationQuery {
  shopId?: string;
  status?: OrderStatus;
  deliveryType?: DeliveryType;
  scheduledDate?: string;
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listOrders: build.query<Paginated<Order>, OrdersQuery | void>({
      query: (params) => ({
        url: "/orders",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.deliveryType ? { deliveryType: params.deliveryType } : {}),
          ...(params?.scheduledDate ? { scheduledDate: params.scheduledDate } : {}),
          ...(params?.search ? { search: params.search } : {}),
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

    updateOrderStatus: build.mutation<
      Order,
      { id: string; status: OrderStatus; note?: string }
    >({
      query: ({ id, status, note }) => ({
        url: `/orders/${id}/status`,
        method: "POST",
        body: { status, ...(note ? { note } : {}) },
      }),
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
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    markOrderPaid: build.mutation<Order, string>({
      query: (id) => ({ url: `/orders/${id}/mark-paid`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListOrdersQuery,
  useGetOrderQuery,
  useUpdateOrderStatusMutation,
  useCancelOrderMutation,
  useMarkOrderPaidMutation,
} = ordersApi;
