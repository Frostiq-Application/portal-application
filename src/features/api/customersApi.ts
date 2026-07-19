import { baseApi } from "./baseApi";
import type {
  Customer,
  CustomerDetail,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface CustomersQuery extends PaginationQuery {
  shopId?: string;
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
  }),
  overrideExisting: false,
});

export const { useListCustomersQuery, useGetCustomerQuery } = customersApi;
