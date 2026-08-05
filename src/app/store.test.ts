import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/app/store";
import { authApi } from "@/features/api/authApi";
import {
  logout,
  setCredentials,
  type Credentials,
} from "@/features/auth/authSlice";
import { setSelectedBranch } from "@/features/branch/branchSlice";
import { newOrderArrived } from "@/features/notifications/notificationsSlice";
import type { AuthUser } from "@/types";

const user = (id: string): AuthUser => ({
  id,
  name: `User ${id}`,
  email: `${id}@example.com`,
  role: "account_super_admin",
  accountId: `acct-${id}`,
  shopIds: [],
});

const credentials = (id: string): Credentials => ({
  user: user(id),
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
});

/** Seeds a cache entry without going near the network. */
async function seedCache(id: string) {
  await store.dispatch(
    authApi.util.upsertQueryData("me", undefined, user(id)),
  );
}

const cachedNames = () =>
  Object.values(store.getState().api.queries).map(
    (q) => (q?.data as AuthUser | undefined)?.name,
  );

describe("session teardown", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(logout());
  });

  it("empties the API cache when the session ends", async () => {
    store.dispatch(setCredentials(credentials("a")));
    await seedCache("a");
    expect(cachedNames()).toContain("User a");

    store.dispatch(logout());

    // Not merely unsubscribed — gone. An entry that outlives the sign-out is
    // served synchronously to the next person who mounts that screen.
    expect(store.getState().api.queries).toEqual({});
  });

  it("does not carry one account's cache into the next sign-in", async () => {
    store.dispatch(setCredentials(credentials("a")));
    await seedCache("a");
    store.dispatch(logout());

    store.dispatch(setCredentials(credentials("b")));

    expect(cachedNames()).not.toContain("User a");
  });

  it("clears the cache when a different user signs in without signing out", async () => {
    store.dispatch(setCredentials(credentials("a")));
    await seedCache("a");

    store.dispatch(setCredentials(credentials("b")));

    expect(cachedNames()).not.toContain("User a");
  });

  it("keeps the cache when the same user re-authenticates", async () => {
    store.dispatch(setCredentials(credentials("a")));
    await seedCache("a");

    // A silent token refresh that ends in a fresh `setCredentials` shouldn't
    // cost the user every screen they already had loaded.
    store.dispatch(setCredentials(credentials("a")));

    expect(cachedNames()).toContain("User a");
  });

  it("drops the selected branch and unseen dots on sign-out", () => {
    store.dispatch(setCredentials(credentials("a")));
    store.dispatch(setSelectedBranch("shop-1"));
    store.dispatch(newOrderArrived());

    store.dispatch(logout());

    // A branch id belongs to one account's shops; the dot means "while *you*
    // were away". Neither survives the handover — in the store or on disk.
    expect(store.getState().branch.selectedBranchId).toBe("");
    expect(localStorage.getItem("frostique-portal-branch")).toBe("");
    expect(store.getState().notifications.hasUnseenOrders).toBe(false);
  });
});
