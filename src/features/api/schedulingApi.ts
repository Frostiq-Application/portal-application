import { baseApi } from "./baseApi";
import type {
  BlackoutDate,
  SchedulingSettings,
  SlotsResponse,
} from "@/types";

export interface UpsertSchedulingSettingsBody {
  shopId: string;
  slotDurationMinutes?: number;
  dailyCutoffTime?: string;
  maxAdvanceDays?: number;
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
}

export const schedulingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSchedulingSettings: build.query<SchedulingSettings, string>({
      query: (shopId) => ({ url: `/scheduling/settings/${shopId}` }),
      providesTags: (_r, _e, shopId) => [{ type: "Scheduling", id: shopId }],
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
      query: ({ shopId, date, leadHours }) => ({
        url: "/scheduling/slots",
        params: { shopId, date, ...(leadHours != null ? { leadHours } : {}) },
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSchedulingSettingsQuery,
  useUpsertSchedulingSettingsMutation,
  useListBlackoutDatesQuery,
  useAddBlackoutDateMutation,
  useRemoveBlackoutDateMutation,
  useGetSlotsQuery,
} = schedulingApi;
