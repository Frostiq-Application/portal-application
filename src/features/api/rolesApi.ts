import { baseApi } from "./baseApi";

export interface CustomRole {
  id: string;
  accountId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  isTemplate: boolean;
  permissions: string[];
}

export interface CreateCustomRoleBody {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateCustomRoleBody {
  name?: string;
  description?: string;
  isActive?: boolean;
  permissions?: string[];
}

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listPermissionCatalog: build.query<{ permissions: string[] }, void>({
      query: () => ({ url: "/roles/permissions" }),
    }),

    listCustomRoles: build.query<CustomRole[], void>({
      query: () => ({ url: "/roles" }),
      providesTags: [{ type: "CustomRole", id: "LIST" }],
    }),

    createCustomRole: build.mutation<CustomRole, CreateCustomRoleBody>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      invalidatesTags: [{ type: "CustomRole", id: "LIST" }],
    }),

    updateCustomRole: build.mutation<
      CustomRole,
      { id: string; body: UpdateCustomRoleBody }
    >({
      query: ({ id, body }) => ({ url: `/roles/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "CustomRole", id: "LIST" }],
    }),

    deleteCustomRole: build.mutation<void, string>({
      query: (id) => ({ url: `/roles/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "CustomRole", id: "LIST" }],
    }),

    assignRoleToUser: build.mutation<
      void,
      { userId: string; customRoleId: string | null }
    >({
      query: ({ userId, customRoleId }) => ({
        url: `/roles/users/${userId}`,
        method: "PUT",
        body: { customRoleId },
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPermissionCatalogQuery,
  useListCustomRolesQuery,
  useCreateCustomRoleMutation,
  useUpdateCustomRoleMutation,
  useDeleteCustomRoleMutation,
  useAssignRoleToUserMutation,
} = rolesApi;
