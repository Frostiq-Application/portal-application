import { baseApi } from "./baseApi";
import type {
  Enquiry,
  EnquiryStatus,
  EnquiryType,
  Paginated,
  PaginationQuery,
} from "@/types";

/** List filters on top of the standard pagination/search params. */
export interface EnquiryListQuery extends PaginationQuery {
  status?: EnquiryStatus;
  type?: EnquiryType;
}

export const queriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Public callback request, used by the in-app support dialog. Rate-limited
     * server-side; deliberately asks for a phone number and nothing else, so
     * someone stuck mid-setup can get help in two taps.
     */
    submitEnquiry: build.mutation<
      { id: string },
      {
        phone: string;
        type?: string;
        name?: string;
        email?: string;
        shopName?: string;
        message?: string;
        /** Structured sales-intake answers; flattened into the office email. */
        details?: Record<string, unknown>;
      }
    >({
      query: (body) => ({ url: "/enquiries", method: "POST", body }),
      invalidatesTags: [{ type: "Enquiry", id: "LIST" }],
    }),

    listEnquiries: build.query<Paginated<Enquiry>, EnquiryListQuery | void>({
      query: (params) => ({
        url: "/enquiries",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.type ? { type: params.type } : {}),
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

    /**
     * Whole-inbox counts per status. Kept separate from the list so the numbers
     * on the filter strip describe the inbox, not the filtered page you're
     * already looking at.
     */
    enquiryStatusCounts: build.query<Record<EnquiryStatus, number>, void>({
      query: () => ({ url: "/enquiries/status-counts" }),
      providesTags: [{ type: "Enquiry", id: "COUNTS" }],
    }),

    updateEnquiryStatus: build.mutation<
      Enquiry,
      { id: string; status: EnquiryStatus }
    >({
      query: ({ id, status }) => ({
        url: `/enquiries/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Enquiry", id },
        { type: "Enquiry", id: "LIST" },
        { type: "Enquiry", id: "COUNTS" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListEnquiriesQuery,
  useEnquiryStatusCountsQuery,
  useSubmitEnquiryMutation,
  useUpdateEnquiryStatusMutation,
} = queriesApi;
