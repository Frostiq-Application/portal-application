import { LogOut, Mail, MessageCircle, ShieldAlert } from "@/components/ui/icons";
import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Entitlements } from "@/types";

/**
 * Full-screen block shown to brand/shop admins who are locked out and can't
 * self-serve a fix — either the account itself is deactivated (suspended,
 * rejected, pending) or their subscription has expired. In both cases only the
 * platform super admin can restore access, so the copy directs them there.
 */
export function AccountDeactivatedGate({
  support,
  reason = "account",
}: {
  support?: Entitlements["support"];
  /** Which lockout to explain: a deactivated account, or an expired subscription. */
  reason?: "account" | "expired";
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const doLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const title =
    reason === "expired"
      ? "Your subscription has expired"
      : "Your account is deactivated";
  const body =
    reason === "expired"
      ? "Your brand’s subscription has expired, so the portal is locked. Please contact the super admin to renew and restore access."
      : "This brand account has been deactivated and can’t access the portal. Please contact the super admin to have it reactivated.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>

        {(support?.email || support?.whatsapp) && (
          <div className="mt-6 flex flex-col gap-2">
            {support?.email && (
              <Button asChild variant="outline" className="justify-start">
                <a href={`mailto:${support.email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  {support.email}
                </a>
              </Button>
            )}
            {support?.whatsapp && (
              <Button asChild variant="outline" className="justify-start">
                <a
                  href={`https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {support.whatsapp}
                </a>
              </Button>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          className="mt-6 text-muted-foreground"
          onClick={doLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
