import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "@/components/ui/icons";
import { FrostiqueMark } from "@/components/common/FrostiqueMark";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { useAuth } from "@/hooks/useAuth";
import {
  useLoginMutation,
  useVerifyTwoFactorMutation,
} from "@/features/api/authApi";
import type { LoginResponse } from "@/types";
import { apiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const extractError = (err: unknown) =>
  apiError(err, "Something went wrong. Please try again.");

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Prefill from the set-password screen ("Go to sign in" passes the email).
  const prefillEmail =
    (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);

  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [verify, { isLoading: verifying }] = useVerifyTwoFactorMutation();

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  // Redirecting from the render body makes React warn that the router is being
  // updated while a different component renders; do it as an effect instead.
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const finish = (res: LoginResponse) => {
    if (res.user && res.refreshToken) {
      dispatch(
        setCredentials({
          user: res.user,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        }),
      );
      navigate(from, { replace: true });
    }
  };

  const onSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await login({ email, password }).unwrap();
      if (res.requiresTwoFactor) {
        setPreAuthToken(res.accessToken);
        toast.info("Enter the 6-digit code from your authenticator app.");
      } else {
        finish(res);
      }
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const onSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preAuthToken) return;
    try {
      const res = await verify({ code, token: preAuthToken }).unwrap();
      finish(res);
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  return (
    <div className="flex min-h-svh flex-col-reverse lg:flex-row-reverse">
      <div className="relative flex flex-col gap-4 overflow-hidden bg-gradient-to-br from-secondary/50 via-background to-accent/50 p-6 md:p-10 lg:w-1/2">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-accent/40 blur-3xl"
        />
        <div className="relative flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <FrostiqueMark className="size-6" />
            Frostique Portal
          </a>
        </div>
        <div className="relative flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {!preAuthToken ? (
              <form
                onSubmit={onSubmitCredentials}
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-xl font-bold">
                    Sign in to the admin portal
                  </h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    Enter your email below to sign in to your account
                  </p>
                </div>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      placeholder="admin@pronttera.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {/* Carries whatever's already typed above, so the reset
                          screen doesn't ask for the email a second time. */}
                      <Link
                        to="/forgot-password"
                        state={email ? { email } : undefined}
                        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <PasswordInput
                      id="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loggingIn} className="w-full">
                    {loggingIn && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Sign in
                  </Button>

                  {/* Without this, a new bakery has no route into the product
                      at all — the register endpoint existed but nothing linked
                      to it. */}
                  <p className="text-center text-sm text-muted-foreground">
                    New here?{" "}
                    <Link
                      to="/register"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Create your shop
                    </Link>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={onSubmitCode} className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-xl font-bold">Two-factor verification</h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="code">Authentication code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={verifying || code.length !== 6}
                    className="w-full"
                  >
                    {verifying && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Verify
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPreAuthToken(null);
                      setCode("");
                    }}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block lg:w-1/2">
        <img
          src="/placeholder.avif"
          alt="A tiered cake on a stand, decorated with berries and icing"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.85]"
        />
      </div>
    </div>
  );
}
