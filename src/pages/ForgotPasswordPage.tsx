import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail } from "@/components/ui/icons";
import { AuthShell } from "@/components/common/AuthShell";
import { OtpForm } from "@/components/common/OtpForm";
import { useRequestOtpMutation } from "@/features/api/authApi";
import { apiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Self-serve password recovery.
 *
 * Until now the only way back into a locked-out account was to phone support so
 * a platform admin could mint a reset token by hand and read it out — which is
 * both a bad afternoon for the owner and a social-engineering surface for us.
 *
 * The code step exchanges for the same set-password token an admin-initiated
 * reset produces, so the last leg reuses `/set-password` unchanged.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Arriving from the sign-in form carries the address already typed there.
  const prefill = (location.state as { email?: string } | null)?.email ?? "";

  const [email, setEmail] = useState(prefill);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const [requestOtp, { isLoading }] = useRequestOtpMutation();

  const emailLooksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailLooksValid) return;
    const normalised = email.trim().toLowerCase();
    try {
      const res = await requestOtp({
        email: normalised,
        purpose: "password_reset",
      }).unwrap();
      setCooldown(res.resendAfterSeconds);
      setSentTo(normalised);
    } catch (err) {
      toast.error(apiError(err, "Couldn't send a code. Try again shortly."));
    }
  };

  if (sentTo) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <h1 className="text-xl font-bold">Check your email</h1>
            <p className="text-balance text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{sentTo}</span>{" "}
              has an account, a 6-digit code is on its way.
            </p>
          </div>

          <OtpForm
            email={sentTo}
            purpose="password_reset"
            initialCooldown={cooldown}
            onVerified={(res) => {
              if (!res.resetToken) {
                toast.error("Something went wrong. Please start again.");
                setSentTo(null);
                return;
              }
              // Hand off to the existing set-password screen — same token, same
              // endpoint an admin-issued reset uses.
              navigate(`/set-password?token=${encodeURIComponent(res.resetToken)}`, {
                replace: true,
              });
            }}
          />

          <p className="text-center text-xs text-muted-foreground">
            Wrong address?{" "}
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="font-medium underline-offset-4 hover:text-foreground hover:underline"
            >
              Use a different one
            </button>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={send} className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-bold">Forgot your password?</h1>
          <p className="text-balance text-sm text-muted-foreground">
            Enter the email you sign in with and we&rsquo;ll send you a code to
            reset it.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !emailLooksValid}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Send code
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
