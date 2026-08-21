import { AlertTriangle, LogOut, Mail, MessageCircle, RefreshCw, WifiOff } from "@/components/ui/icons";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { apiError } from "@/lib/apiError";
import type { Entitlements } from "@/types";
import { Button } from "@/components/ui/button";

/**
 * The screen for "we couldn't ask the server", as opposed to "the server said
 * no".
 *
 * Every other gate in this folder explains a *decision*: the account is
 * suspended, the plan lapsed, nobody has bought one yet. Each of those is read
 * from `/accounts/me/entitlements`, so when that call fails there is no
 * decision to explain — and the gates all defaulted to their most alarming
 * reading of an empty answer. With the API down, an owner on a perfectly
 * healthy Pro plan was told to choose a plan and handed a checkout button,
 * which is both false and the kind of false that costs money.
 *
 * So an unreachable server gets its own screen, and it says the one true
 * thing: this is us, not you, and nothing about your account has changed.
 */
export function ServerErrorGate({
  error,
  onRetry,
  isRetrying,
  support,
}: {
  /** The failed RTK Query error, used to name the failure honestly. */
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  support?: Entitlements["support"];
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // A request that never reached the API reads as a connection problem — which
  // may well be the viewer's wifi, so the copy doesn't blame either end.
  const status = (error as { status?: number | string } | undefined)?.status;
  const offline = status === "FETCH_ERROR" || status === "TIMEOUT_ERROR";

  const doLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          {offline ? (
            <WifiOff className="h-6 w-6 text-destructive" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-destructive" />
          )}
        </div>

        <h1 className="text-xl font-semibold tracking-tight">
          {offline ? "We can't reach the server" : "Something went wrong"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {offline
            ? "The portal couldn't load your account. Check your connection and try again — nothing about your account or subscription has changed."
            : "The portal couldn't load your account. This is on our side, not yours, and nothing about your subscription has changed."}
        </p>

        {/* The underlying message, quieter — it's what support will ask for. */}
        <p className="mt-3 text-xs text-muted-foreground/80">
          {apiError(error, "The server didn't respond as expected.")}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} disabled={isRetrying}>
              <RefreshCw className={isRetrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {isRetrying ? "Retrying…" : "Try again"}
            </Button>
          )}

          {support?.email && (
            <Button asChild variant="outline">
              <a href={`mailto:${support.email}`}>
                <Mail className="h-4 w-4" />
                {support.email}
              </a>
            </Button>
          )}
          {support?.whatsapp && (
            <Button asChild variant="outline">
              <a
                href={`https://wa.me/${support.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
                {support.whatsapp}
              </a>
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-6 text-muted-foreground"
          onClick={doLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
