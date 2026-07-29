import { Navigate, Outlet } from "react-router-dom";
import { useCan } from "@/hooks/useCan";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/roles";
import type { PermissionKey } from "@/types";

/**
 * Blocks a route the signed-in user has no permission for.
 *
 * Hiding the nav item is not enough on its own — a chef who types `/catalog`
 * would otherwise get the page shell, then a wall of 403s from every request it
 * fires, which reads as a broken app rather than a closed door. Redirecting
 * lands them somewhere they can actually work.
 *
 * Mirrors `PermissionGuard` on the server, which remains the enforcement; this
 * is purely so the UI doesn't offer what the API will refuse.
 */
export function PermissionRoute({ permission }: { permission: PermissionKey }) {
  const { can } = useCan();
  const { role } = useAuth();
  if (!can(permission)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }
  return <Outlet />;
}
