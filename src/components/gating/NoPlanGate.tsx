import { Lock, LogOut, Mail, MessageCircle } from "lucide-react";
import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Entitlements } from "@/types";

/**
 * Full-screen block shown to brand/shop admins whose account has no active
 * subscription. The app is unreachable until an administrator activates a plan.
 */
export function NoPlanGate({ support }: { support?: Entitlements["support"] }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const doLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          No active subscription
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your brand doesn’t have an active plan yet. Please contact your
          administrator to get a plan activated before you can use this app.
        </p>

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
