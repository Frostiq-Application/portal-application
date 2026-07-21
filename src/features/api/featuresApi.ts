import { baseApi } from "./baseApi";

export type FeatureKind = "boolean" | "limit";

export interface Feature {
  key: string;
  label: string;
  description: string | null;
  category: string;
  kind: FeatureKind;
  sortOrder: number;
  /** System feature (core / column-backed limit): cannot be deleted; kind fixed. */
  isProtected: boolean;
}

export interface CreateFeatureBody {
  key: string;
  label: string;
  description?: string;
  category: string;
  kind?: FeatureKind;
  sortOrder?: number;
}

export type UpdateFeatureBody = Partial<Omit<CreateFeatureBody, "key">>;

export const featuresApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listFeatures: build.query<Feature[], void>({
      query: () => ({ url: "/features" }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((f) => ({ type: "Feature" as const, id: f.key })),
              { type: "Feature" as const, id: "LIST" },
            ]
          : [{ type: "Feature" as const, id: "LIST" }],
    }),

    createFeature: build.mutation<Feature, CreateFeatureBody>({
      query: (body) => ({ url: "/features", method: "POST", body }),
      invalidatesTags: [{ type: "Feature", id: "LIST" }],
    }),

    updateFeature: build.mutation<
      Feature,
      { key: string; body: UpdateFeatureBody }
    >({
      query: ({ key, body }) => ({
        url: `/features/${key}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { key }) => [
        { type: "Feature", id: key },
        { type: "Feature", id: "LIST" },
      ],
    }),

    deleteFeature: build.mutation<void, string>({
      query: (key) => ({ url: `/features/${key}`, method: "DELETE" }),
      // Removing a feature also strips it from plans → refresh plans too.
      invalidatesTags: [
        { type: "Feature", id: "LIST" },
        { type: "Plan", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListFeaturesQuery,
  useCreateFeatureMutation,
  useUpdateFeatureMutation,
  useDeleteFeatureMutation,
} = featuresApi;
