import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Cake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useInviteEmailQuery,
  useSetPasswordMutation,
} from "@/features/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function extractError(err: unknown): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return msg ?? "Something went wrong. Please try again.";
}

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);

  const [setPasswordMutation, { isLoading }] = useSetPasswordMutation();
  // Resolve the email this invite is for, to show the user which account they
  // are activating (read-only) and to prefill the sign-in screen afterwards.
  const { data: invite } = useInviteEmailQuery(token, { skip: !token });
  const email = invite?.email;

  const goToSignIn = () =>
    navigate("/login", email ? { state: { email } } : undefined);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Missing or invalid invite link.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      await setPasswordMutation({ token, password }).unwrap();
      setDone(true);
      toast.success("Password set. You can now sign in.");
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Cake className="size-4" />
            </div>
            Frostique Portal
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {!token ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-xl font-bold">Invalid link</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  This set-password link is missing its token. Ask your admin
                  to resend the invite.
                </p>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <h1 className="text-xl font-bold">Password set</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  You can now sign in
                  {email ? (
                    <>
                      {" "}
                      as <span className="font-medium">{email}</span>
                    </>
                  ) : (
                    " with your email"
                  )}{" "}
                  and your new password.
                </p>
                <Button className="w-full" onClick={goToSignIn}>
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-xl font-bold">Set your password</h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    Choose a password to activate your account.
                  </p>
                </div>
                <div className="grid gap-6">
                  {email && (
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        readOnly
                        disabled
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Set password
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src="/placeholder.svg"
          alt="A tiered cake on a stand, decorated with berries and icing"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.85]"
        />
      </div>
    </div>
  );
}
