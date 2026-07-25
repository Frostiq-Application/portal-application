import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { RootState } from "@/app/store";
import { logout, setTokens } from "@/features/auth/authSlice";
import type { LoginResponse } from "@/types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set("authorization", `Bearer ${token}`);
    return headers;
  },
});

// Guard so multiple parallel 401s trigger only one refresh call.
let refreshing: Promise<LoginResponse | null> | null = null;

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const state = api.getState() as RootState;
    const refreshToken = state.auth.refreshToken;

    if (!refreshToken) {
      api.dispatch(logout());
      return result;
    }

    if (!refreshing) {
      refreshing = Promise.resolve(
        rawBaseQuery(
          { url: "/auth/refresh", method: "POST", body: { refreshToken } },
          api,
          extraOptions,
        ),
      ).then((res) => (res.data ? (res.data as LoginResponse) : null));
    }

    const refreshed = await refreshing;
    refreshing = null;

    if (refreshed?.accessToken && refreshed.refreshToken) {
      api.dispatch(
        setTokens({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        }),
      );
      // Retry the original request with the new token.
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Account",
    "Shop",
    "User",
    "Plan",
    "Subscription",
    "Coupon",
    "Cms",
    "Category",
    "Product",
    "Addon",
    "Order",
    "Customer",
    "Scheduling",
    "Blackout",
    "Occasion",
    "OccasionProducts",
    "CustomRole",
    "Me",
    "Analytics",
    "Entitlements",
    "CustomCake",
    "CustomCakeOption",
    "Feature",
    "Enquiry",
    "Onboarding",
  ],
  endpoints: () => ({}),
});
