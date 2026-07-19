import { baseApi } from "./baseApi";
import type {
  BlackoutDate,
  SchedulingScope,
  SchedulingSettings,
  SlotsResponse,
  WeeklyHours,
} from "@/types";

export interface UpsertSchedulingSettingsBody {
  shopId: string;
  fulfilmentType?: SchedulingScope;
  slotDurationMinutes?: number;
  dailyCutoffTime?: string;
  maxAdvanceDays?: number;
  slotCapacity?: number | null;
}

export interface WeeklyHoursRow {
  fulfilmentType?: SchedulingScope;
  weekday: number;
  closed?: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

export interface UpsertWeeklyHoursBody {
  shopId: string;
  /** Full replacement — send every row (all scopes) the branch should keep. */
  rows: WeeklyHoursRow[];
}

export interface CreateBlackoutDateBody {
  shopId: string;
  date: string;
  reason?: string;
}

export interface SlotsQuery {
  shopId: string;
  date: string;
  leadHours?: number;
  deliveryType?: "delivery" | "pickup";
}

export const schedulingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSchedulingSettings: build.query<
      SchedulingSettings,
      { shopId: string; fulfilmentType?: SchedulingScope }
    >({
      query: ({ shopId, fulfilmentType }) => ({
        url: `/scheduling/settings/${shopId}`,
        params: fulfilmentType ? { fulfilmentType } : undefined,
      }),
      providesTags: (_r, _e, { shopId }) => [{ type: "Scheduling", id: shopId }],
    }),

    upsertSchedulingSettings: build.mutation<
      SchedulingSettings,
      UpsertSchedulingSettingsBody
    >({
      query: (body) => ({ url: "/scheduling/settings", method: "PUT", body }),
      invalidatesTags: (_r, _e, { shopId }) => [
        { type: "Scheduling", id: shopId },
      ],
    }),

    listWeeklyHours: build.query<WeeklyHours[], string>({
      query: (shopId) => ({ url: `/scheduling/weekly-hours/${shopId}` }),
      providesTags: (_r, _e, shopId) => [
        { type: "Scheduling", id: `hours-${shopId}` },
      ],
    }),

    upsertWeeklyHours: build.mutation<WeeklyHours[], UpsertWeeklyHoursBody>({
      query: (body) => ({ url: "/scheduling/weekly-hours", method: "PUT", body }),
      invalidatesTags: (_r, _e, { shopId }) => [
        { type: "Scheduling", id: `hours-${shopId}` },
      ],
    }),

    listBlackoutDates: build.query<BlackoutDate[], string>({
      query: (shopId) => ({ url: `/scheduling/blackout-dates/${shopId}` }),
      providesTags: (_r, _e, shopId) => [{ type: "Blackout", id: shopId }],
    }),

    addBlackoutDate: build.mutation<BlackoutDate, CreateBlackoutDateBody>({
      query: (body) => ({
        url: "/scheduling/blackout-dates",
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { shopId }) => [
        { type: "Blackout", id: shopId },
      ],
    }),

    removeBlackoutDate: build.mutation<void, { id: string; shopId: string }>({
      query: ({ id }) => ({
        url: `/scheduling/blackout-dates/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { shopId }) => [
        { type: "Blackout", id: shopId },
      ],
    }),

    // Live preview of computed slots for a date (public endpoint).
    getSlots: build.query<SlotsResponse, SlotsQuery>({
      query: ({ shopId, date, leadHours, deliveryType }) => ({
        url: "/scheduling/slots",
        params: {
          shopId,
          date,
          ...(leadHours != null ? { leadHours } : {}),
          ...(deliveryType ? { deliveryType } : {}),
        },
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSchedulingSettingsQuery,
  useUpsertSchedulingSettingsMutation,
  useListWeeklyHoursQuery,
  useUpsertWeeklyHoursMutation,
  useListBlackoutDatesQuery,
  useAddBlackoutDateMutation,
  useRemoveBlackoutDateMutation,
  useGetSlotsQuery,
} = schedulingApi;
