import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Loader2, Store } from "@/components/ui/icons";
import { isValidPhoneNumber } from "react-phone-number-input";
import { FrostiqueMark } from "@/components/common/FrostiqueMark";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import {
  useRegisterAccountMutation,
  useRegistrationAvailabilityQuery,
} from "@/features/api/accountsApi";
import { useLoginMutation } from "@/features/api/authApi";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { slugify } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { passwordStrength } from "@/lib/password";
import { PasswordStrengthMeter } from "@/components/common/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";

const extractError = (err: unknown) =>
  apiError(err, "Something went wrong. Please try again.");

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The one thing only the owner can fix — spot it to mark the field, not just toast. */
const isEmailTakenError = (err: unknown) =>
  /email already exists|email already in use/i.test(apiError(err, ""));

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
 *
 * Both uniqueness questions are asked while the form is being filled in rather
 * than left to the submit: a taken email is a dead end the owner has to know
 * about *before* typing a password, and a taken shop name isn't a dead end at
 * all — the server allocates `golden-cake-4f9c2a` — but the address is theirs
 * from here on, so it is shown to them rather than sprung on them later.
 */
export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [register, { isLoading: registering }] = useRegisterAccountMutation();
  const [login, { isLoading: loggingIn }] = useLoginMutation();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  // Set when the server rejects the email at submit — the pre-check below can't
  // have landed if someone types fast and submits faster.
  const [rejectedEmail, setRejectedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  // The storefront address is no longer asked for — it comes from the shop
  // name. A name that slugifies to nothing (symbols only) still can't be sent,
  // which is what `incomplete` checks below.
  const appSlug = slugify(name);

  // The API wants 8+ characters with a letter and a number; checking length
  // alone here let a password through the button and straight into a server
  // rejection. The meter below scores against the same rule.
  const { meetsMinimum: passwordStrongEnough } = passwordStrength(password);
  const emailLooksValid = EMAIL_PATTERN.test(ownerEmail);

  // ---- is this email free? ------------------------------------------------
  // Only asked once the address is well-formed, and only after typing settles:
  // the route is throttled per IP, and half an address is never taken anyway.
  const normalizedEmail = ownerEmail.trim().toLowerCase();
  const debouncedEmail = useDebouncedValue(normalizedEmail, 450);
  const emailToCheck = EMAIL_PATTERN.test(debouncedEmail) ? debouncedEmail : "";
  // `currentData`, not `data`: it must never answer for an address the owner has
  // already typed past, which is exactly what `data`'s fallback would do.
  const { currentData: emailCheck, isFetching: checkingEmail } =
    useRegistrationAvailabilityQuery(
      { email: emailToCheck },
      { skip: !emailToCheck },
    );
  const emailTaken =
    emailCheck?.emailAvailable === false || rejectedEmail === normalizedEmail;

  // ---- and what address will the shop get? -------------------------------
  const debouncedSlug = useDebouncedValue(appSlug, 450);
  const { currentData: slugCheck } = useRegistrationAvailabilityQuery(
    { appSlug: debouncedSlug },
    { skip: !debouncedSlug },
  );
  // Only trust the answer once it's about the name currently on screen —
  // otherwise the line under the field lags a keystroke behind the preview.
  const slugAnswered = !!debouncedSlug && debouncedSlug === appSlug;
  const slugTaken = slugAnswered && slugCheck?.slugAvailable === false;
  // What the server said it would hand out. Shown, not sent: registration
  // re-resolves it, so a name taken in the meantime still gets a free address.
  const assignedSlug = (slugTaken && slugCheck?.suggestedSlug) || appSlug;
  // The picker hands back E.164, so validate the number against its own country
  // rather than counting digits — a ten-digit rule quietly rejects every country
  // whose numbers aren't ten digits long. Same check the admin-side account form
  // uses, so a self-serve signup can't store a shape the portal would reject.
  const phoneLooksValid = !!ownerPhone && isValidPhoneNumber(ownerPhone);
  const incomplete =
    !name.trim() ||
    !appSlug ||
    !ownerName.trim() ||
    !emailLooksValid ||
    emailTaken ||
    !phoneLooksValid ||
    !passwordStrongEnough;

  const busy = registering || loggingIn;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (incomplete) return;

    try {
      // The address is sent as a preference. Two bakeries can share a name and
      // `app_slug` is unique, so the server allocates the free one — from one
      // request, inside the transaction that inserts the row, which is the only
      // place a check-then-write can't be raced. (This page used to guess "-2",
      // "-3" from out here, which cost a round trip per guess and still raced.)
      const created = await register({
        name: name.trim(),
        appSlug,
        ownerName: ownerName.trim(),
        ownerEmail: normalizedEmail,
        ownerPhone: ownerPhone.trim(),
        password,
      }).unwrap();

      // Tell them what they actually got, when it isn't what they asked for.
      if (created.appSlug !== appSlug) {
        toast.info(`Your storefront address is /${created.appSlug}`, {
          description: `"${name.trim()}" was already taken, so we made yours unique.`,
        });
      }

      // Sign them straight in regardless of verification. The account is real
      // and the password works, so there is no reason to make them log in
      // again — verification gates onboarding, not the session.
      const session = await login({
        email: normalizedEmail,
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
          toast.success(
            `Welcome, ${ownerName.trim().split(" ")[0]}. Check your email for a code.`,
          );
          navigate("/verify-email", { replace: true });
          return;
        }
        toast.success(
          `Welcome, ${ownerName.trim().split(" ")[0]}. Let's set up your shop.`,
        );
        navigate("/onboarding", { replace: true });
        return;
      }

      // Registered but the auto-login didn't return a session — send them to
      // sign in rather than leaving them on a dead form.
      toast.success("Account created. Sign in to continue.");
      navigate("/login", { state: { email: normalizedEmail } });
    } catch (err) {
      // Mark the field, not just the toast: a duplicate email is the one failure
      // the owner has to act on, and a toast is gone before they've read it.
      if (isEmailTakenError(err)) setRejectedEmail(normalizedEmail);
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
                  placeholder="Enter shop name"
                  autoComplete="organization"
                  aria-describedby="shop-address"
                  autoFocus
                  required
                />
                {/* The name is the storefront address, so show the address. A
                    taken name is not an error here — it just comes back with a
                    suffix, and seeing that now beats discovering it later. */}
                {appSlug && (
                  <p id="shop-address" className="text-xs text-muted-foreground">
                    {slugTaken ? (
                      <>
                        <span className="text-amber-600 dark:text-amber-400">
                          “{name.trim()}” is already taken
                        </span>
                        , so your storefront will be{" "}
                        <span className="font-medium text-foreground">
                          /{assignedSlug}
                        </span>
                      </>
                    ) : (
                      <>
                        Your storefront:{" "}
                        <span className="font-medium text-foreground">
                          /{appSlug}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner-name">Your name</Label>
                <Input
                  id="owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner-email">Email</Label>
                <div className="relative">
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="Enter email address"
                    autoComplete="email"
                    aria-invalid={emailTaken || undefined}
                    aria-describedby={emailTaken ? "email-taken" : undefined}
                    className={
                      emailTaken
                        ? "border-destructive pr-9 focus-visible:ring-destructive"
                        : "pr-9"
                    }
                    required
                  />
                  {checkingEmail && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                {/* A taken email is the one dead end on this form, so it says so
                    where the answer is — and offers the way out, carrying the
                    address so signing in doesn't ask for it again. */}
                {emailTaken && (
                  <p
                    id="email-taken"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    This email already has an account.{" "}
                    <Link
                      to="/login"
                      state={{ email: normalizedEmail }}
                      className="font-medium underline underline-offset-4"
                    >
                      Sign in instead
                    </Link>
                    {" or "}
                    <Link
                      to="/forgot-password"
                      state={{ email: normalizedEmail }}
                      className="font-medium underline underline-offset-4"
                    >
                      reset the password
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner-phone">Phone</Label>
                {/* Country picker + national formatting, so the number leaves
                    here in E.164 — the shape the API stores and every notice
                    (OTP, order alerts) is later sent from. */}
                <PhoneInput
                  id="owner-phone"
                  defaultCountry="IN"
                  value={ownerPhone}
                  onChange={(v) => setOwnerPhone(v ?? "")}
                  placeholder="Enter phone number"
                  autoComplete="tel"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="new-password"
                  required
                />
                <PasswordStrengthMeter password={password} className="mt-0.5" />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={busy || incomplete}
              >
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
              "Free forever to start: 1 branch, 4 products, no card",
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
