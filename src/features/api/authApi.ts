import { baseApi } from "./baseApi";
import type {
  AuthUser,
  LoginResponse,
  TwoFactorSetupResponse,
} from "@/types";

interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    verifyTwoFactor: build.mutation<
      LoginResponse,
      { code: string; token: string }
    >({
      // The pre-auth token from the login step authorises this one call.
      query: ({ code, token }) => ({
        url: "/auth/2fa/verify",
        method: "POST",
        body: { code },
        headers: { authorization: `Bearer ${token}` },
      }),
    }),
    setupTwoFactor: build.mutation<TwoFactorSetupResponse, void>({
      query: () => ({ url: "/auth/2fa/setup", method: "POST" }),
    }),
    enableTwoFactor: build.mutation<{ enabled: boolean }, { code: string }>({
      query: (body) => ({ url: "/auth/2fa/enable", method: "POST", body }),
    }),
    me: build.query<AuthUser, void>({
      query: () => ({ url: "/auth/me" }),
      providesTags: ["Me"],
    }),
    setPassword: build.mutation<
      { success: boolean },
      { token: string; password: string }
    >({
      query: (body) => ({ url: "/auth/set-password", method: "POST", body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useVerifyTwoFactorMutation,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useMeQuery,
  useSetPasswordMutation,
} = authApi;
