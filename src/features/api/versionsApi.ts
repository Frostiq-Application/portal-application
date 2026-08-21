import { baseApi } from "./baseApi";
import type {
  AppVersion,
  LatestVersion,
  VersionHistoryItem,
  VersionInput,
  VersionViews,
} from "@/types/versions";

/**
 * Everything is multipart, because a release note may arrive as a `.md` file.
 * Sending JSON for the no-file case would mean two shapes on the server for one
 * form, so the form is always a FormData and the file is simply optional.
 */
function toForm(input: Partial<VersionInput>): FormData {
  const form = new FormData();
  if (input.file) form.append("file", input.file);
  if (input.version !== undefined) form.append("version", input.version);
  if (input.title !== undefined) form.append("title", input.title);
  // Comma-separated: a repeated field would arrive as a single string when only
  // one tag is set, which is exactly the case that silently breaks.
  if (input.tags !== undefined) form.append("tags", input.tags.join(","));
  if (input.notes !== undefined) form.append("notes", input.notes);
  if (input.releasedAt !== undefined) form.append("releasedAt", input.releasedAt);
  if (input.isPublished !== undefined) {
    form.append("isPublished", String(input.isPublished));
  }
  if (input.notify !== undefined) form.append("notify", String(input.notify));
  return form;
}

export const versionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Super admin — every release, drafts included. */
    listVersions: build.query<AppVersion[], void>({
      query: () => "/platform/versions",
      providesTags: ["Version"],
    }),

    createVersion: build.mutation<AppVersion, VersionInput>({
      query: (input) => ({
        url: "/platform/versions",
        method: "POST",
        body: toForm(input),
      }),
      invalidatesTags: ["Version"],
    }),

    updateVersion: build.mutation<
      AppVersion,
      { id: string } & Partial<VersionInput>
    >({
      query: ({ id, ...input }) => ({
        url: `/platform/versions/${id}`,
        method: "PATCH",
        body: toForm(input),
      }),
      invalidatesTags: ["Version"],
    }),

    deleteVersion: build.mutation<void, string>({
      query: (id) => ({ url: `/platform/versions/${id}`, method: "DELETE" }),
      invalidatesTags: ["Version"],
    }),

    /** The read log behind one release. */
    versionViews: build.query<VersionViews, string>({
      query: (id) => `/platform/versions/${id}/views`,
      providesTags: ["Version"],
    }),

    /**
     * What every signed-in user polls once on load. `null` until a release has
     * been published, which is why the result type allows it.
     */
    latestVersion: build.query<LatestVersion | null, void>({
      query: () => "/versions/latest",
      providesTags: ["Version"],
    }),

    /**
     * Every published release, newest first — what the What's new page reads
     * back. Drafts never appear here; that view is the super admin's alone.
     */
    versionHistory: build.query<VersionHistoryItem[], void>({
      query: () => "/versions",
      providesTags: ["Version"],
    }),

    /**
     * Marks the note read. Invalidates nothing on purpose: the dialog is closing
     * anyway, and re-fetching `latest` only to watch `seen` flip would re-render
     * the screen behind it for no visible gain.
     */
    markVersionSeen: build.mutation<void, string>({
      query: (id) => ({ url: `/versions/${id}/seen`, method: "POST" }),
    }),
  }),
});

export const {
  useListVersionsQuery,
  useCreateVersionMutation,
  useUpdateVersionMutation,
  useDeleteVersionMutation,
  useVersionViewsQuery,
  useLatestVersionQuery,
  useVersionHistoryQuery,
  useMarkVersionSeenMutation,
} = versionsApi;
