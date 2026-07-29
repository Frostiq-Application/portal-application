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

export type OtpPurpose = "email_verification" | "password_reset";

export interface OtpRequest {
  email: string;
  purpose: OtpPurpose;
}

export interface OtpRequested {
  sent: boolean;
  expiresInMinutes: number;
  resendAfterSeconds: number;
}

export interface OtpVerified {
  verified: boolean;
  /** Only for `password_reset` — feed it to `/set-password`. */
  resetToken?: string | null;
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
    inviteEmail: build.query<{ email: string }, string>({
      query: (token) => ({
        url: "/auth/invite/email",
        params: { token },
      }),
    }),

    /**
     * Sends a one-time code. Always resolves — the server won't say whether the
     * address has an account, so a rejection here means rate limiting, never
     * "no such user".
     */
    requestOtp: build.mutation<OtpRequested, OtpRequest>({
      query: (body) => ({ url: "/auth/otp/request", method: "POST", body }),
    }),
    /**
     * `password_reset` comes back with a `resetToken` for `/set-password`;
     * `email_verification` comes back with nothing but `verified`.
     */
    verifyOtp: build.mutation<OtpVerified, OtpRequest & { code: string }>({
      query: (body) => ({ url: "/auth/otp/verify", method: "POST", body }),
      invalidatesTags: ["Me"],
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
  useInviteEmailQuery,
  useRequestOtpMutation,
  useVerifyOtpMutation,
} = authApi;
