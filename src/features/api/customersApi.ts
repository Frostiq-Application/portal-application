import { baseApi } from "./baseApi";
import type {
  CreatedCustomer,
  Customer,
  CustomerDetail,
  CustomerOrderSummary,
  CustomerOrderType,
  NewCustomerBody,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface CustomersQuery extends PaginationQuery {
  shopId?: string;
}

export interface CustomerOrdersQuery {
  customerId: string;
  page?: number;
  limit?: number;
  /** Omitted returns the whole history; the drawer always asks for one half. */
  type?: CustomerOrderType;
}

export const customersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listCustomers: build.query<Paginated<Customer>, CustomersQuery | void>({
      query: (params) => ({
        url: "/customers",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.shopId ? { shopId: params.shopId } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((c) => ({
                type: "Customer" as const,
                id: c.id,
              })),
              { type: "Customer" as const, id: "LIST" },
            ]
          : [{ type: "Customer" as const, id: "LIST" }],
    }),

    getCustomer: build.query<CustomerDetail, string>({
      query: (id) => ({ url: `/customers/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "Customer", id }],
    }),

    /**
     * One page of a customer's order history, newest first.
     *
     * Separate from `getCustomer` so the drawer's history tab can scroll: the
     * profile carries only a capped slice, which is enough for the panels that
     * read it inline but not for a list the user pages through.
     *
     * `type` splits the history into catalog orders and custom cake orders.
     * The split is the server's so each list pages on its own count — filtering
     * a mixed page here would hand the drawer short pages and a total that
     * disagrees with the rows under it.
     *
     * Tagged with the orders it returned so a status change or cancellation
     * made elsewhere in the portal reaches the history the same way it reaches
     * the orders table.
     */
    listCustomerOrders: build.query<
      Paginated<CustomerOrderSummary>,
      CustomerOrdersQuery
    >({
      query: ({ customerId, page, limit, type }) => ({
        url: `/customers/${customerId}/orders`,
        params: {
          page: page ?? 1,
          limit: limit ?? 10,
          ...(type ? { type } : {}),
        },
      }),
      providesTags: (result) => [
        ...(result?.data ?? []).map((o) => ({
          type: "Order" as const,
          id: o.id,
        })),
        { type: "Order" as const, id: "LIST" },
      ],
    }),

    /**
     * Adds the customer on the other end of the phone, mid-order.
     *
     * The server de-duplicates on the number, so a call from someone already on
     * file returns their record (`matchedExisting`) rather than a second one —
     * see the flag before telling the user anything was created.
     */
    createCustomer: build.mutation<CreatedCustomer, NewCustomerBody>({
      query: (body) => ({ url: "/customers", method: "POST", body }),
      invalidatesTags: [{ type: "Customer", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCustomersQuery,
  useGetCustomerQuery,
  useListCustomerOrdersQuery,
  useCreateCustomerMutation,
} = customersApi;
