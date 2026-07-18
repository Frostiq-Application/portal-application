import { baseApi } from "./baseApi";
import type {
  Account,
  AccountCreated,
  AccountStatus,
  OnboardingSource,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface AccountsQuery extends PaginationQuery {
  status?: AccountStatus;
  onboardingSource?: OnboardingSource;
}

export interface CreateAccountBody {
  name: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  appSlug: string;
  planId?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeColor?: string;
  activate?: boolean;
}

export interface UpdateAccountBody {
  name?: string;
  ownerName?: string;
  ownerPhone?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeColor?: string;
  currentPlanId?: string;
}

export const accountsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listAccounts: build.query<Paginated<Account>, AccountsQuery | void>({
      query: (params) => ({
        url: "/accounts",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.onboardingSource
            ? { onboardingSource: params.onboardingSource }
            : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((a) => ({ type: "Account" as const, id: a.id })),
              { type: "Account" as const, id: "LIST" },
            ]
          : [{ type: "Account" as const, id: "LIST" }],
    }),

    getAccount: build.query<Account, string>({
      query: (id) => ({ url: `/accounts/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "Account", id }],
    }),

    myAccount: build.query<Account, void>({
      query: () => ({ url: "/accounts/me" }),
      providesTags: [{ type: "Account", id: "ME" }],
    }),

    createAccount: build.mutation<AccountCreated, CreateAccountBody>({
      query: (body) => ({ url: "/accounts", method: "POST", body }),
      invalidatesTags: [{ type: "Account", id: "LIST" }],
    }),

    updateAccount: build.mutation<
      Account,
      { id: string; body: UpdateAccountBody }
    >({
      query: ({ id, body }) => ({ url: `/accounts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),

    approveAccount: build.mutation<Account, string>({
      query: (id) => ({ url: `/accounts/${id}/approve`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),

    rejectAccount: build.mutation<Account, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/accounts/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),

    suspendAccount: build.mutation<Account, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/accounts/${id}/suspend`,
        method: "POST",
        body: reason ? { reason } : {},
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),

    reactivateAccount: build.mutation<Account, string>({
      query: (id) => ({ url: `/accounts/${id}/reactivate`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Account", id },
        { type: "Account", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListAccountsQuery,
  useGetAccountQuery,
  useMyAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useApproveAccountMutation,
  useRejectAccountMutation,
  useSuspendAccountMutation,
  useReactivateAccountMutation,
} = accountsApi;
