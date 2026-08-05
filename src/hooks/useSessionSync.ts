import { useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { setUser } from "@/features/auth/authSlice";
import { useMeQuery } from "@/features/api/authApi";
import { useAuth } from "@/hooks/useAuth";

/**
 * Refreshes the signed-in user — role, branch assignments and above all
 * `permissions` — from `/auth/me` on every app load.
 *
 * The whole user object is persisted to localStorage at sign-in, and nothing
 * used to replace it. So a session kept its permission set forever: the day a
 * permission was split in two (`orders.create` out of `orders.manage`), every
 * existing session was missing the new key and the buttons it gates simply
 * stopped rendering — for people whose role had granted them all along. The
 * only cure was signing out and back in, which is not something a user knows
 * to do about a button that isn't there.
 *
 * The same staleness applied to any change an owner made: a custom role edited
 * or reassigned reached its holder whenever they next happened to re-login.
 *
 * `useCan` treats the server's set as the source of truth, so this is what
 * makes that true rather than aspirational.
 */
export function useSessionSync(): void {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAuth();

  const { data } = useMeQuery(undefined, {
    skip: !isAuthenticated,
    // The point is to catch what changed while they were away, so ask on each
    // mount rather than serving whatever the cache still holds.
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    // Cached responses keep their identity, so this runs once per fetch, and
    // the write is a no-op re-render at worst.
    if (data) dispatch(setUser(data));
  }, [data, dispatch]);
}
