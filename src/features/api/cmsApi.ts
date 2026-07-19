import { baseApi } from "./baseApi";
import type { Occasion } from "@/types";

export type BannerTapAction =
  | "none"
  | "open_product"
  | "open_category"
  | "open_url";

export interface Banner {
  id: string;
  accountId: string | null;
  shopId: string | null;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  tapAction: BannerTapAction;
  tapTarget: string | null;
  displayOrder: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface Announcement {
  id: string;
  accountId: string | null;
  shopId: string | null;
  message: string;
  bgColor: string | null;
  textColor: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface AccountContent {
  accountId: string;
  tagline: string | null;
  aboutText: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  whatsappUrl: string | null;
}

export interface CreateBannerBody {
  accountId?: string;
  shopId?: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  displayOrder?: number;
}

export interface CreateAnnouncementBody {
  accountId?: string;
  shopId?: string;
  message: string;
  bgColor?: string;
  textColor?: string;
}

export const cmsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Banners
    listBanners: build.query<Banner[], void>({
      query: () => ({ url: "/cms/banners" }),
      providesTags: [{ type: "Cms", id: "BANNERS" }],
    }),
    createBanner: build.mutation<Banner, CreateBannerBody>({
      query: (body) => ({ url: "/cms/banners", method: "POST", body }),
      invalidatesTags: [{ type: "Cms", id: "BANNERS" }],
    }),
    updateBanner: build.mutation<
      Banner,
      { id: string; body: Partial<CreateBannerBody> & { isActive?: boolean } }
    >({
      query: ({ id, body }) => ({ url: `/cms/banners/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Cms", id: "BANNERS" }],
    }),
    deleteBanner: build.mutation<void, string>({
      query: (id) => ({ url: `/cms/banners/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Cms", id: "BANNERS" }],
    }),

    // Announcements
    listAnnouncements: build.query<Announcement[], void>({
      query: () => ({ url: "/cms/announcements" }),
      providesTags: [{ type: "Cms", id: "ANN" }],
    }),
    createAnnouncement: build.mutation<Announcement, CreateAnnouncementBody>({
      query: (body) => ({ url: "/cms/announcements", method: "POST", body }),
      invalidatesTags: [{ type: "Cms", id: "ANN" }],
    }),
    updateAnnouncement: build.mutation<
      Announcement,
      { id: string; body: Partial<CreateAnnouncementBody> & { isActive?: boolean } }
    >({
      query: ({ id, body }) => ({
        url: `/cms/announcements/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "Cms", id: "ANN" }],
    }),
    deleteAnnouncement: build.mutation<void, string>({
      query: (id) => ({ url: `/cms/announcements/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Cms", id: "ANN" }],
    }),

    // Brand content (account admin)
    getAccountContent: build.query<AccountContent, void>({
      query: () => ({ url: "/cms/account-content" }),
      providesTags: [{ type: "Cms", id: "CONTENT" }],
    }),
    upsertAccountContent: build.mutation<
      AccountContent,
      Partial<Omit<AccountContent, "accountId">>
    >({
      query: (body) => ({ url: "/cms/account-content", method: "PUT", body }),
      invalidatesTags: [{ type: "Cms", id: "CONTENT" }],
    }),

    // Occasions & featured products
    listOccasions: build.query<Occasion[], void>({
      query: () => ({ url: "/cms/occasions" }),
      providesTags: [{ type: "Occasion", id: "LIST" }],
    }),
    createOccasion: build.mutation<
      Occasion,
      { name: string; iconUrl?: string; displayOrder?: number }
    >({
      query: (body) => ({ url: "/cms/occasions", method: "POST", body }),
      invalidatesTags: [{ type: "Occasion", id: "LIST" }],
    }),
    updateOccasion: build.mutation<
      Occasion,
      {
        id: string;
        body: {
          name?: string;
          iconUrl?: string;
          displayOrder?: number;
          isActive?: boolean;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `/cms/occasions/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "Occasion", id: "LIST" }],
    }),
    deleteOccasion: build.mutation<void, string>({
      query: (id) => ({ url: `/cms/occasions/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Occasion", id: "LIST" }],
    }),

    // Featured products assigned to an occasion for a branch
    getOccasionProducts: build.query<
      { productIds: string[] },
      { occasionId: string; shopId: string }
    >({
      query: ({ occasionId, shopId }) => ({
        url: `/cms/occasions/${occasionId}/products`,
        params: { shopId },
      }),
      providesTags: (_r, _e, { occasionId, shopId }) => [
        { type: "OccasionProducts", id: `${occasionId}:${shopId}` },
      ],
    }),
    assignOccasionProducts: build.mutation<
      { assigned: number },
      { occasionId: string; shopId: string; productIds: string[] }
    >({
      query: ({ occasionId, shopId, productIds }) => ({
        url: `/cms/occasions/${occasionId}/products`,
        method: "POST",
        body: { shopId, productIds },
      }),
      invalidatesTags: (_r, _e, { occasionId, shopId }) => [
        { type: "OccasionProducts", id: `${occasionId}:${shopId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
  useListAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useGetAccountContentQuery,
  useUpsertAccountContentMutation,
  useListOccasionsQuery,
  useCreateOccasionMutation,
  useUpdateOccasionMutation,
  useDeleteOccasionMutation,
  useGetOccasionProductsQuery,
  useAssignOccasionProductsMutation,
} = cmsApi;
