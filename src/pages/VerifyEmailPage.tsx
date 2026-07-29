import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "@/components/ui/icons";
import { AuthShell } from "@/components/common/AuthShell";
import { OtpForm } from "@/components/common/OtpForm";
import { useAppDispatch } from "@/app/hooks";
import { logout, setUser } from "@/features/auth/authSlice";
import { authApi } from "@/features/api/authApi";
import { useAuth } from "@/hooks/useAuth";

/**
 * The code step of self-serve signup.
 *
 * Placed *after* the account exists and the owner is signed in, not before the
 * form is submitted. Verifying first would mean holding a whole registration
 * form in memory across a round trip, and losing it to any refresh. This way
 * the account is real, the session is live, and the only thing verification
 * unlocks is onboarding — so an owner who abandons here can come back to a
 * working login rather than nothing at all.
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAuth();

  // Nothing to verify without a session, and nothing to do if it's already done.
  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true });
    else if (user?.emailVerified) navigate("/", { replace: true });
  }, [isAuthenticated, user?.emailVerified, navigate]);

  if (!user) return null;

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-5" />
          </div>
          <h1 className="text-xl font-bold">Check your email</h1>
          <p className="text-balance text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{user.email}</span>.
            Enter it below to finish setting up your shop.
          </p>
        </div>

        <OtpForm
          email={user.email}
          purpose="email_verification"
          onVerified={async () => {
            // Re-read the profile rather than patching the flag locally: the
            // server is what the onboarding guard trusts, so the session should
            // reflect what the server now says.
            const fresh = await dispatch(
              authApi.endpoints.me.initiate(undefined, {
                forceRefetch: true,
              }),
            ).unwrap();
            dispatch(setUser(fresh));
            toast.success("Email verified — let's set up your shop.");
            navigate("/onboarding", { replace: true });
          }}
        />

        <p className="text-center text-xs text-muted-foreground">
          Wrong address?{" "}
          <button
            type="button"
            onClick={() => {
              dispatch(logout());
              navigate("/register", { replace: true });
            }}
            className="font-medium underline-offset-4 hover:text-foreground hover:underline"
          >
            Start over
          </button>
        </p>
      </div>
    </AuthShell>
  );
}
