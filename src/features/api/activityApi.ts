import { baseApi } from "./baseApi";
import type {
  ActivityEntry,
  ActivityFilters,
  Paginated,
  PaginationQuery,
} from "@/types";

export interface ActivityQuery extends PaginationQuery {
  entityType?: string;
  action?: string;
  actorUserId?: string;
  shopId?: string;
  /** ISO instants — inclusive on both ends. */
  from?: string;
  to?: string;
}

/**
 * The brand's audit trail (Pro — `can_use_audit_log`). Read-only by design:
 * there is no write endpoint to call, because the log is written as a side
 * effect of the actions themselves and the audited team cannot edit it.
 */
export const activityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listActivity: build.query<Paginated<ActivityEntry>, ActivityQuery | void>({
      query: (params) => ({
        url: "/activity-log",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 25,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.entityType ? { entityType: params.entityType } : {}),
          ...(params?.action ? { action: params.action } : {}),
          ...(params?.actorUserId ? { actorUserId: params.actorUserId } : {}),
          ...(params?.shopId ? { shopId: params.shopId } : {}),
          ...(params?.from ? { from: params.from } : {}),
          ...(params?.to ? { to: params.to } : {}),
        },
      }),
      providesTags: [{ type: "Activity", id: "LIST" }],
    }),

    activityFilters: build.query<ActivityFilters, void>({
      query: () => ({ url: "/activity-log/filters" }),
      providesTags: [{ type: "Activity", id: "FILTERS" }],
    }),
  }),
  overrideExisting: false,
});

export const { useListActivityQuery, useActivityFiltersQuery } = activityApi;
