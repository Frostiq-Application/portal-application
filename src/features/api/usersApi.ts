import { baseApi } from "./baseApi";
import type {
  Paginated,
  PaginationQuery,
  Role,
  User,
  UserCreated,
} from "@/types";

export interface UsersQuery extends PaginationQuery {
  role?: Role;
  accountId?: string;
  isActive?: boolean;
}

export interface CreateUserBody {
  name: string;
  email: string;
  phone?: string;
  role: Role;
  accountId?: string;
  shopIds?: string[];
  /** Optional custom role layered on top of (or replacing) the base role. */
  customRoleId?: string;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<Paginated<User>, UsersQuery | void>({
      query: (params) => ({
        url: "/users",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.role ? { role: params.role } : {}),
          ...(params?.accountId ? { accountId: params.accountId } : {}),
          ...(params?.isActive !== undefined
            ? { isActive: params.isActive }
            : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((u) => ({ type: "User" as const, id: u.id })),
              { type: "User" as const, id: "LIST" },
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),

    createUser: build.mutation<UserCreated, CreateUserBody>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    updateUser: build.mutation<
      User,
      { id: string; body: Partial<Pick<User, "name" | "phone" | "isActive">> }
    >({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    resetUserPassword: build.mutation<{ resetToken: string }, string>({
      query: (id) => ({ url: `/users/${id}/reset-password`, method: "POST" }),
    }),

    assignShop: build.mutation<User, { id: string; shopId: string }>({
      query: ({ id, shopId }) => ({
        url: `/users/${id}/assignments`,
        method: "POST",
        body: { shopId },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    unassignShop: build.mutation<User, { id: string; shopId: string }>({
      query: ({ id, shopId }) => ({
        url: `/users/${id}/assignments/${shopId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResetUserPasswordMutation,
  useAssignShopMutation,
  useUnassignShopMutation,
} = usersApi;
