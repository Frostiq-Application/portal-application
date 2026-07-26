import { Navigate, Outlet } from "react-router-dom";
import { useOnboardingStateQuery } from "@/features/api/onboardingApi";
import { useAuth } from "@/hooks/useAuth";

/**
 * Keeps a half-configured account in setup until it's finished.
 *
 * Only the owner is redirected. Staff and branch admins can't complete
 * onboarding — it commits the billing profile and picks the plan — so bouncing
 * them into a wizard they're forbidden to submit would strand them completely.
 *
 * Fails **open**: if the state can't be read, the app renders normally. A bug
 * in this guard should never be able to lock every owner out of their own
 * portal.
 */
export function OnboardingGate() {
  const { role } = useAuth();
  const isOwner = role === "account_super_admin";
  const { data, isLoading, isError } = useOnboardingStateQuery(undefined, {
    skip: !isOwner,
  });

  if (!isOwner || isLoading || isError || !data) return <Outlet />;
  if (data.completed) return <Outlet />;

  // `/checkout` needs no exemption here: it lives outside this gate entirely,
  // alongside `/onboarding`.
  return <Navigate to="/onboarding" replace />;
}
