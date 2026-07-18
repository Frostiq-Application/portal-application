import { baseApi } from "./baseApi";
import type { Entitlements } from "@/types";

export const entitlementsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    myEntitlements: build.query<Entitlements, void>({
      query: () => ({ url: "/accounts/me/entitlements" }),
      providesTags: [{ type: "Entitlements", id: "ME" }],
      // Re-check on every app entry so a newly-activated plan is picked up
      // without needing a hard reload.
      keepUnusedDataFor: 30,
    }),
  }),
  overrideExisting: false,
});

export const { useMyEntitlementsQuery } = entitlementsApi;
