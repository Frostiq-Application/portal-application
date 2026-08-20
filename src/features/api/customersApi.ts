import { baseApi } from "./baseApi";
import type {
  CreatedCustomer,
  Customer,
  CustomerDetail,
  CustomerLookupResult,
  CustomerOrderSummary,
  CustomerOrderType,
  NewCustomerBody,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface CustomersQuery extends PaginationQuery {
  shopId?: string;
}

export interface CustomerLookupQuery {
  /** The customer's full number — the server matches its last 10 digits. */
  phone: string;
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
     * The buyer behind a phone number, for writing an order up.
     *
     * The only customer read that works on a plan without the customer
     * directory, which is why order entry uses it instead of `listCustomers`
     * there — everything else in this file 403s for those brands. It answers
     * with one customer or none: no browsing, and no spend or history even on a
     * hit, since that is the directory module itself.
     *
     * A miss comes back as `found: false`, not an error. It is the ordinary
     * result for the call this whole flow exists to serve — someone who has
     * never ordered before — and it leads straight into customer creation.
     *
     * Untagged: this is a point lookup for a form in progress, and letting a
     * `Customer` invalidation refetch it would swap the picked customer out from
     * under a half-written order.
     */
    lookupCustomerByPhone: build.query<CustomerLookupResult, CustomerLookupQuery>({
      query: ({ phone, shopId }) => ({
        url: "/customers/lookup",
        params: { phone, ...(shopId ? { shopId } : {}) },
      }),
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
  useLazyLookupCustomerByPhoneQuery,
  useListCustomerOrdersQuery,
  useCreateCustomerMutation,
} = customersApi;
