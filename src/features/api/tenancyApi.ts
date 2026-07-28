import { baseApi } from "./baseApi";
import type {
  MigrationCatalogueEntry,
  SyncResult,
  TenantDetail,
  TenantStatus,
  TenantSyncRun,
} from "@/types/tenancy";

export interface SyncBody {
  migrationIds?: string[];
  dryRun?: boolean;
  force?: boolean;
  /**
   * Verify against the live schema and re-apply anything actually missing.
   * Needed to fix structural drift, where the ledger still reads "applied".
   * The API defaults this on for a single tenant and off for the fleet.
   */
  repair?: boolean;
}

export interface SyncFleetBody extends SyncBody {
  schemas?: string[];
  concurrency?: number;
  /** Return a runId immediately and migrate in the background. */
  background?: boolean;
}

/** Super Admin → Tenancy: schema-per-account migration control. */
export const tenancyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * `structural` re-verifies each applied migration against the live catalog.
     * Off by default because it costs a query per migration per tenant; the
     * page turns it on explicitly when the admin asks for a deep check.
     */
    listTenants: builder.query<TenantStatus[], { structural?: boolean } | void>({
      query: (args) => ({
        url: "/platform/tenancy/tenants",
        params: args?.structural ? { structural: true } : undefined,
      }),
      providesTags: ["Tenancy"],
    }),

    getTenant: builder.query<TenantDetail, string>({
      query: (schema) => `/platform/tenancy/tenants/${schema}`,
      providesTags: ["Tenancy"],
    }),

    listTenantMigrations: builder.query<MigrationCatalogueEntry[], void>({
      query: () => "/platform/tenancy/migrations",
      providesTags: ["Tenancy"],
    }),

    /** Single run, polled while a background sync is in flight. */
    getSyncRun: builder.query<TenantSyncRun, string>({
      query: (id) => `/platform/tenancy/runs/${id}`,
      providesTags: ["Tenancy"],
    }),

    listSyncRuns: builder.query<TenantSyncRun[], { limit?: number } | void>({
      query: (args) => ({
        url: "/platform/tenancy/runs",
        params: args?.limit ? { limit: args.limit } : undefined,
      }),
      providesTags: ["Tenancy"],
    }),

    syncTenant: builder.mutation<SyncResult, { schema: string } & SyncBody>({
      query: ({ schema, ...body }) => ({
        url: `/platform/tenancy/tenants/${schema}/sync`,
        method: "POST",
        body,
      }),
      // A dry run changes nothing, so invalidating would refetch the whole
      // fleet for no reason and make the rehearsal feel like a real apply.
      invalidatesTags: (_r, _e, arg) => (arg.dryRun ? [] : ["Tenancy"]),
    }),

    syncFleet: builder.mutation<SyncResult, SyncFleetBody>({
      query: (body) => ({
        url: "/platform/tenancy/sync",
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => (arg.dryRun ? [] : ["Tenancy"]),
    }),
  }),
});

export const {
  useListTenantsQuery,
  useGetTenantQuery,
  useListTenantMigrationsQuery,
  useGetSyncRunQuery,
  useListSyncRunsQuery,
  useSyncTenantMutation,
  useSyncFleetMutation,
} = tenancyApi;
