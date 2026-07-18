import { baseApi } from "./baseApi";

export interface UploadResult {
  url: string;
  key: string;
}

export const uploadApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    uploadAsset: build.mutation<UploadResult, { file: File; folder?: string }>({
      query: ({ file, folder }) => {
        const form = new FormData();
        form.append("file", file);
        if (folder) form.append("folder", folder);
        return { url: "/assets/upload", method: "POST", body: form };
      },
    }),
  }),
  overrideExisting: false,
});

export const { useUploadAssetMutation } = uploadApi;
