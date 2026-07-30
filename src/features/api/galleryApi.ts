import { baseApi } from "./baseApi";

/** One image in a branch's design gallery. */
export interface GalleryImage {
  id: string;
  shopId: string;
  imageUrl: string;
  name: string | null;
  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

/** What the uploader hands over once a file is in the bucket. */
export interface GalleryImageInput {
  imageUrl: string;
  storageKey?: string;
  name?: string;
  isFeatured?: boolean;
}

export const galleryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listGalleryImages: build.query<GalleryImage[], string>({
      query: (shopId) => ({ url: "/gallery", params: { shopId } }),
      providesTags: [{ type: "Gallery", id: "LIST" }],
    }),

    /** One call per upload batch — N files land as a single write. */
    addGalleryImages: build.mutation<
      GalleryImage[],
      { shopId: string; images: GalleryImageInput[] }
    >({
      query: (body) => ({ url: "/gallery", method: "POST", body }),
      invalidatesTags: [{ type: "Gallery", id: "LIST" }],
    }),

    updateGalleryImage: build.mutation<
      GalleryImage,
      {
        id: string;
        shopId: string;
        name?: string;
        isFeatured?: boolean;
        isActive?: boolean;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/gallery/${id}`,
        method: "PATCH",
        body,
      }),
      // Optimistic: a star or a hide toggle should feel instant, and the row is
      // already on screen — waiting for a round trip makes it feel broken.
      async onQueryStarted({ id, shopId, ...patch }, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          galleryApi.util.updateQueryData("listGalleryImages", shopId, (draft) => {
            const row = draft.find((i) => i.id === id);
            if (row) Object.assign(row, patch);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
      invalidatesTags: [{ type: "Gallery", id: "LIST" }],
    }),

    reorderGalleryImages: build.mutation<void, { shopId: string; ids: string[] }>({
      query: (body) => ({ url: "/gallery/reorder", method: "PATCH", body }),
      invalidatesTags: [{ type: "Gallery", id: "LIST" }],
    }),

    deleteGalleryImage: build.mutation<void, { id: string; shopId: string }>({
      query: ({ id, shopId }) => ({
        url: `/gallery/${id}`,
        method: "DELETE",
        body: { shopId },
      }),
      async onQueryStarted({ id, shopId }, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          galleryApi.util.updateQueryData("listGalleryImages", shopId, (draft) =>
            draft.filter((i) => i.id !== id),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
      invalidatesTags: [{ type: "Gallery", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListGalleryImagesQuery,
  useAddGalleryImagesMutation,
  useUpdateGalleryImageMutation,
  useReorderGalleryImagesMutation,
  useDeleteGalleryImageMutation,
} = galleryApi;
