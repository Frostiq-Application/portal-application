import { baseApi } from "./baseApi";
import type { Enquiry, Paginated, PaginationQuery } from "@/types";

export const queriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listEnquiries: build.query<Paginated<Enquiry>, PaginationQuery | void>({
      query: (params) => ({
        url: "/enquiries",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((e) => ({ type: "Enquiry" as const, id: e.id })),
              { type: "Enquiry" as const, id: "LIST" },
            ]
          : [{ type: "Enquiry" as const, id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const { useListEnquiriesQuery } = queriesApi;
