import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Holds a self-registered owner at the code step until their address is proven.
 *
 * Mirrors `EmailVerifiedGuard` on the server, which is where the rule is
 * actually enforced — this only saves the user from being bounced by a 403 they
 * can't act on.
 *
 * **`undefined` means verified.** The flag is absent from sessions persisted
 * before verification shipped, and from any user the API hasn't re-described
 * yet; treating "don't know" as "not verified" would push established owners
 * into a code screen for an email nobody ever sent them.
 */
export function EmailVerifiedGate() {
  const { user } = useAuth();
  if (user && user.emailVerified === false) {
    return <Navigate to="/verify-email" replace />;
  }
  return <Outlet />;
}
