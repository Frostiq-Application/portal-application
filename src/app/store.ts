import {
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "@/features/api/baseApi";
import authReducer, {
  logout,
  setCredentials,
} from "@/features/auth/authSlice";
import uiReducer from "@/features/ui/uiSlice";
import branchReducer, {
  setSelectedBranch,
} from "@/features/branch/branchSlice";
import notificationsReducer, {
  resetNotifications,
} from "@/features/notifications/notificationsSlice";

/**
 * Everything that belongs to one signed-in session and nothing else, torn down
 * the moment that session ends.
 *
 * The store outlives a sign-out: `logout` only clears `auth`, and the app
 * navigates to `/login` rather than reloading the page. So the RTK Query cache
 * — orders, customers, analytics, entitlements, `/auth/me` — survived intact
 * into whoever signed in next, and every screen rendered the previous account's
 * data until its refetch came back. On a different brand that is one account
 * reading another's, which is the part that matters; on the same brand it still
 * shows numbers that were never theirs.
 *
 * `resetApiState` is the only thing that empties that cache; unsubscribing
 * doesn't (entries linger for `keepUnusedDataFor`, and a screen that remounts
 * within that window serves the stale entry synchronously). The selected branch
 * and the unseen-notification dots are session-scoped for the same reason — a
 * branch id belongs to one account's shops, and the dot means "while *you* were
 * away".
 *
 * Listening for the action rather than doing this at the sign-out button covers
 * every exit: the menu, a dead refresh token in `baseApi`, an expired session
 * on the SSE stream, and the account/subscription gates all dispatch `logout`.
 */
const sessionListener = createListenerMiddleware();

/** Minimal shape read below — avoids referencing `RootState` before it exists. */
type AuthOnly = { auth: { user: { id: string } | null } };

sessionListener.startListening({
  matcher: isAnyOf(logout, setCredentials),
  effect: (action, api) => {
    const previousId = (api.getOriginalState() as AuthOnly).auth.user?.id;
    // Signing in is only a handover when the person actually changed. A
    // re-login as the same user (a 401 bounce, say) keeps its warm cache.
    if (setCredentials.match(action)) {
      if (previousId && previousId === action.payload.user.id) return;
    } else if (!previousId) {
      // Already signed out. Several parallel 401s each dispatch `logout`, and
      // a reset that re-fires the queries that produced them is a loop.
      return;
    }
    api.dispatch(baseApi.util.resetApiState());
    api.dispatch(setSelectedBranch(""));
    api.dispatch(resetNotifications());
  },
});

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    ui: uiReducer,
    branch: branchReducer,
    notifications: notificationsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(sessionListener.middleware)
      .concat(baseApi.middleware),
});

/**
 * Enables RTK Query's focus/reconnect events. Nothing changes for existing
 * screens — `refetchOnFocus` and `refetchOnReconnect` are off by default and
 * opted into per hook. The floor boards use them, because a tablet left on a
 * bench all shift has to catch up the moment someone touches it again.
 */
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
