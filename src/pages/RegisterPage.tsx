import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, Loader2, Store } from "@/components/ui/icons";
import { FrostiqueMark } from "@/components/common/FrostiqueMark";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { useRegisterAccountMutation } from "@/features/api/accountsApi";
import { useLoginMutation } from "@/features/api/authApi";
import { useAuth } from "@/hooks/useAuth";
import { cn, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function extractError(err: unknown): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return msg ?? "Something went wrong. Please try again.";
}

/** The storefront domain a slug will produce, for the live preview. */
const STOREFRONT_HOST =
  (import.meta.env.VITE_STOREFRONT_HOST as string | undefined) ??
  "frostique.in";

/**
 * Self-serve signup for a bakery.
 *
 * The backend has always exposed `POST /accounts/register`, but nothing in the
 * portal called it — so a new shop had no way in at all. This is that door.
 *
 * It asks for the bare minimum to create a login, then **signs the owner in**
 * and sends them to verify their email. Making someone register, then hunt for
 * a confirmation, then log in separately is three chances to lose them before
 * they have seen the product — so the session is live from the first submit and
 * the emailed code is the only thing standing between them and setup.
 */
export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [register, { isLoading: registering }] = useRegisterAccountMutation();
  const [login, { isLoading: loggingIn }] = useLoginMutation();

  const [name, setName] = useState("");
  const [appSlug, setAppSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  // Derive the URL from the shop name until someone edits it themselves —
  // then stop overwriting their choice.
  useEffect(() => {
    if (!slugTouched) setAppSlug(slugify(name));
  }, [name, slugTouched]);

  const passwordStrongEnough = password.length >= 8;
  const emailLooksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail);
  const phoneLooksValid = ownerPhone.replace(/\D/g, "").length >= 10;
  const incomplete =
    !name.trim() ||
    !appSlug ||
    !ownerName.trim() ||
    !emailLooksValid ||
    !phoneLooksValid ||
    !passwordStrongEnough;

  const busy = registering || loggingIn;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (incomplete) return;

    try {
      await register({
        name: name.trim(),
        appSlug,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPhone: ownerPhone.trim(),
        password,
      }).unwrap();

      // Sign them straight in regardless of verification. The account is real
      // and the password works, so there is no reason to make them log in
      // again — verification gates onboarding, not the session.
      const session = await login({
        email: ownerEmail.trim().toLowerCase(),
        password,
      }).unwrap();

      if (session.user && session.refreshToken) {
        dispatch(
          setCredentials({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          }),
        );
        // Registration already sent a code; the verify screen picks it up from
        // there. Anyone somehow already verified skips straight to setup.
        if (session.user.emailVerified === false) {
          toast.success(`Welcome, ${ownerName.trim().split(" ")[0]} — check your email for a code.`);
          navigate("/verify-email", { replace: true });
          return;
        }
        toast.success(`Welcome, ${ownerName.trim().split(" ")[0]} — let's set up your shop.`);
        navigate("/onboarding", { replace: true });
        return;
      }

      // Registered but the auto-login didn't return a session — send them to
      // sign in rather than leaving them on a dead form.
      toast.success("Account created. Sign in to continue.");
      navigate("/login", { state: { email: ownerEmail.trim().toLowerCase() } });
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  return (
    <div className="flex min-h-svh flex-col-reverse lg:flex-row-reverse">
      {/* ---- form ---------------------------------------------------------- */}
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
          <Link to="/login" className="flex items-center gap-2 font-medium">
            <FrostiqueMark className="size-6" />
            Frostique Portal
          </Link>
        </div>

        <div className="relative flex flex-1 items-center justify-center py-6">
          <form onSubmit={onSubmit} className="w-full max-w-sm">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-xl font-bold">Create your shop</h1>
              <p className="text-balance text-sm text-muted-foreground">
                Free to start, no card needed. Takes about a minute.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="shop-name">Shop name</Label>
                <Input
                  id="shop-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sweet Cake Bake"
                  autoComplete="organization"
                  autoFocus
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="slug">Your storefront address</Label>
                <div className="flex items-center rounded-md border focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    id="slug"
                    value={appSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setAppSlug(slugify(e.target.value));
                    }}
                    placeholder="sweet-cake-bake"
                    className="border-0 font-mono text-sm shadow-none focus-visible:ring-0"
                    required
                  />
                  <span className="shrink-0 pr-3 text-sm text-muted-foreground">
                    .{STOREFRONT_HOST}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is where your customers will order. It can't be changed
                  later, so pick something you'll be happy with.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner-name">Your name</Label>
                <Input
                  id="owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Arbaj Ansari"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner-email">Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner-phone">Phone</Label>
                <Input
                  id="owner-phone"
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <p
                  className={cn(
                    "text-xs",
                    password && !passwordStrongEnough
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {password && !passwordStrongEnough
                    ? "A little longer — 8 characters minimum."
                    : "8 characters minimum."}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={busy || incomplete}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create shop
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* ---- reassurance panel --------------------------------------------- */}
      <div className="relative hidden flex-col justify-center bg-muted p-10 lg:flex lg:w-1/2">
        <div className="mx-auto max-w-sm">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Your own branded cake shop, online today
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Stop paying commission to aggregators. Frostique gives you your own
            storefront, your own customers and your own margins.
          </p>

          <ul className="mt-7 space-y-3">
            {[
              "Free forever to start — 1 branch, 4 products, no card",
              "Your own storefront address customers can bookmark",
              "Take real orders from day one",
              "Upgrade only when you outgrow it",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-muted-foreground">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
