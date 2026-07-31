import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Building2, CreditCard, ArrowRight, BadgeCheck, BadgePercent, Check, CheckCircle2, Info, Loader2, Lock, Minus, Package, PackagePlus, Pencil, Plus, ShieldCheck, Tag, TriangleAlert, X, Zap } from "@/components/ui/icons";
import {
  useApplicableCouponsQuery,
  useBillingStatesQuery,
  useCheckoutMutation,
  useMyPlansQuery,
  useMySubscriptionQuery,
  useQuoteQuery,
  useVerifyPaymentMutation,
} from "@/features/api/billingApi";
import {
  useAddonOptionsQuery,
} from "@/features/api/billingApi";
import {
  useCompleteOnboardingMutation,
  useOnboardingStateQuery,
} from "@/features/api/onboardingApi";
import { inr, inrShort, loadRazorpay, openRazorpay } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Odometer } from "@/components/ui/odometer";
import { featureLabel } from "@/lib/billing";
import {
  PaymentProcessingOverlay,
  type PaymentStage,
} from "@/components/billing/PaymentProcessingOverlay";
import { usePaymentExitGuard } from "@/hooks/usePaymentExitGuard";
import { playDecrement, playIncrement } from "@/lib/sound";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FormState {
  billingAddress: string;
  billingPincode: string;
  billingCity: string;
  billingState: string;
  gstin: string;
}

/**
 * Checkout (SH-07/08/09/10).
 *
 * This was a side sheet. Paying is the highest-stakes thing a bakery owner does
 * in the product, and a 512px drawer put the total and the Pay button below a
 * long scroll, with the rest of the app still visible and clickable behind it.
 *
 * The layout every serious checkout converges on instead: a focused page, form
 * on the left, and an **order summary pinned in view on the right** so the
 * amount never leaves the screen while you fill in an address. On mobile the
 * summary moves to the top, where it plays the same role.
 *
 * The cycle switcher lives *inside* checkout deliberately — "actually, yearly"
 * is the most common last-second change, and bouncing back to the plans page to
 * make it loses the form.
 */
/** One labelled fact on the review step. */
function ReviewRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  /** Dims values that stand in for "nothing chosen". */
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right font-medium",
          muted && "font-normal text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** A group of review rows with a jump back to the step that set them. */
function ReviewCard({
  title,
  icon,
  onEdit,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </span>
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onEdit}
        >
          <Pencil className="size-3" />
          Edit
        </Button>
      </div>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planId = params.get("plan");
  const initialCycle = params.get("cycle") ?? "yearly";

  const { data: catalogue, isLoading: loadingPlans } = useMyPlansQuery();
  const { data: dashboard } = useMySubscriptionQuery();
  // Checkout is the last step of signup for anyone on a paid plan, so it has
  // to close that loop itself — otherwise a paid-up account stays stuck on the
  // payment step forever.
  const { data: onboarding } = useOnboardingStateQuery();
  const [completeOnboarding] = useCompleteOnboardingMutation();
  const { data: meta } = useBillingStatesQuery();
  const [checkout] = useCheckoutMutation();
  const [verify] = useVerifyPaymentMutation();

  const [cycleCode, setCycleCode] = useState(initialCycle);
  const [form, setForm] = useState<FormState>({
    billingAddress: "",
    billingPincode: "",
    billingCity: "",
    billingState: "",
    gstin: "",
  });
  // Two steps: pick what you're buying, then say who you are. Splitting them
  // stops the page being one long scroll where the total sits below a form.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [autopay, setAutopay] = useState(true);
  const [paying, setPaying] = useState(false);
  // Non-null from the moment Razorpay hands back a signed result until this
  // page unmounts on navigation — the window the lock screen owns.
  const [payStage, setPayStage] = useState<PaymentStage | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  /**
   * The gap the lock screen can't cover: from pressing Pay until Razorpay hands
   * a result back, the customer is inside the gateway's modal — possibly already
   * approving in a UPI app or on their bank's 3-D Secure page. A refresh here
   * loses the tab that is waiting for that result, which is the same bad outcome
   * as refreshing during verification, just earlier. Once `payStage` is set the
   * overlay takes over and runs its own, stricter guard.
   */
  const warnWhilePaying = useCallback(() => {
    toast.warning("Payment in progress", {
      description:
        "Please don't refresh or close this tab until it finishes — you may be charged without us recording it.",
    });
  }, []);
  usePaymentExitGuard(paying && payStage === null, {
    onAttempt: warnWhilePaying,
  });

  const { data: addonOptions } = useAddonOptionsQuery(
    planId ? { planId } : {},
    { skip: !planId },
  );

  /** Add-ons actually bought, resolved for the review step. */
  const chosenAddons = (addonOptions ?? [])
    .filter((a) => (addonQty[a.featureKey] ?? 0) > 0)
    .map((a) => {
      const qty = addonQty[a.featureKey] ?? 0;
      const stepSize = a.stepSize ?? 1;
      return {
        featureKey: a.featureKey,
        label: a.label,
        planValue: a.planValue,
        total: a.planValue + qty * stepSize,
      };
    });

  /** Extra capacity per feature, so limits can be shown post-uplift. */
  const addonUplift = (addonOptions ?? []).reduce<Record<string, number>>(
    (acc, a) => {
      const qty = addonQty[a.featureKey] ?? 0;
      if (qty > 0) acc[a.featureKey] = qty * (a.stepSize ?? 1);
      return acc;
    },
    {},
  );

  /** The `key:qty` form the quote endpoint takes. */
  const addonList = Object.entries(addonQty)
    .filter(([, q]) => q > 0)
    .map(([featureKey, quantity]) => ({ featureKey, quantity }));
  const addonQuery = addonList.length
    ? addonList.map((a) => `${a.featureKey}:${a.quantity}`).join(",")
    : undefined;

  const plan = catalogue?.plans.find((p) => p.id === planId) ?? null;
  const cycles = catalogue?.cycles ?? [];
  const cycle = cycles.find((c) => c.code === cycleCode) ?? cycles[0] ?? null;
  const profile = dashboard?.billingProfile;

  /** Feature flags this plan switches on, for the summary's tick-list. */
  const planFeatures = plan
    ? Object.entries(plan.flags)
        .filter(([, on]) => on)
        .map(([key]) => key)
    : [];

  // Prefill from the saved billing profile once it lands. Done during render so
  // the fields are populated on the paint the profile arrives — a checkout form
  // that fills itself in a frame later reads as a glitch.
  const [seenProfile, setSeenProfile] = useState<typeof profile>(undefined);
  if (profile && profile !== seenProfile) {
    setSeenProfile(profile);
    setForm((f) =>
      f.billingAddress || f.billingCity
        ? f
        : {
            billingAddress: profile.billingAddress ?? "",
            billingPincode: profile.billingPincode ?? "",
            billingCity: profile.billingCity ?? "",
            billingState: profile.billingState ?? "",
            gstin: profile.gstin ?? "",
          },
    );
  }

  // Not memoized: RTK Query serialises query args into the cache key, so a
  // fresh object with the same contents is the same request. The manual memo
  // this replaces depended on values the compiler couldn't prove stable, which
  // cost the whole component its optimisation to save one object literal.
  const quoteArgs =
    plan && cycle
      ? {
          planId: plan.id,
          billingCycle: cycle.code,
          couponCode: appliedCoupon,
          addons: addonQuery,
        }
      : undefined;
  const { data: quote, isFetching: quoting } = useQuoteQuery(
    quoteArgs ?? { planId: "", billingCycle: "" },
    { skip: !quoteArgs },
  );
  const { data: publicCoupons } = useApplicableCouponsQuery(
    plan && cycle ? { planId: plan.id, billingCycle: cycle.code } : { planId: "", billingCycle: "" },
    { skip: !plan || !cycle },
  );

  // A bad code is reported on the quote rather than failing it, so the preview
  // keeps working while the message explains what's wrong.
  //
  // The rejection is *copied into state* rather than announced straight off
  // `quote.couponError`, and that's load-bearing. Dropping the code during
  // render makes React throw the render away and start again before it ever
  // commits — so an effect keyed on `couponError` never sees the error at all:
  // by the time a render survives, the code is gone, the quote request no
  // longer carries it, and the value is back to undefined. That's how "This
  // coupon has expired." went missing. A rejection held in state outlives the
  // discarded render, and a fresh object each time re-fires the toast even when
  // the same code is entered twice.
  const couponError = quote?.couponError;
  const [rejected, setRejected] = useState<
    { code: string; message: string } | undefined
  >(undefined);
  if (couponError && appliedCoupon && appliedCoupon !== rejected?.code) {
    setRejected({ code: appliedCoupon, message: couponError });
    setAppliedCoupon(undefined);
  }
  useEffect(() => {
    if (rejected) toast.error(rejected.message);
  }, [rejected]);

  /**
   * Every apply is a fresh attempt, so the "already rejected this one" guard
   * resets with it.
   *
   * Without the reset a code rejected once stayed rejected for the life of the
   * page: entering it again — the first thing anyone does after a coupon
   * bounces — left `appliedCoupon === rejected.code`, which skipped the clear
   * above and parked the page in a contradiction. A green "DIWALI applied"
   * chip, an error toast saying it doesn't apply, and a total with no discount
   * in it. Same trap on the way back to a cycle the code doesn't cover.
   */
  const applyCoupon = (code: string) => {
    setRejected(undefined);
    setAppliedCoupon(code);
  };

  /**
   * Whether the server has actually honoured the applied code — it echoes the
   * coupon back on the quote, and `null` once it has rejected one.
   *
   * The chip reads this rather than `appliedCoupon`, because entering a code is
   * a request, not a result. Rendering the green "applied" state off local
   * intent flashed a success for the length of the quote round-trip and then
   * yanked it back on a bad code, which reads as a bug even though the end
   * state is right.
   */
  const couponConfirmed =
    !!appliedCoupon &&
    quote?.couponCode?.toUpperCase() === appliedCoupon.toUpperCase();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const incomplete =
    !form.billingAddress.trim() ||
    !/^\d{6}$/.test(form.billingPincode) ||
    !form.billingCity.trim() ||
    !form.billingState;

  async function handlePay() {
    if (!plan || !cycle || incomplete) return;
    setPaying(true);
    // Everything after Razorpay's handler fires is a different kind of failure:
    // the customer has been charged, so it can't be reported as a toast on a
    // page that still shows a Pay button.
    let charged = false;
    try {
      const session = await checkout({
        planId: plan.id,
        billingCycle: cycle.code,
        couponCode: appliedCoupon,
        enableAutopay: autopay,
        addons: addonList,
        billing: {
          billingAddress: form.billingAddress.trim(),
          billingPincode: form.billingPincode.trim(),
          billingCity: form.billingCity.trim(),
          billingState: form.billingState,
          billingCountry: "India",
          ...(form.gstin.trim() ? { gstin: form.gstin.trim().toUpperCase() } : {}),
        },
      }).unwrap();

      if (session.settledWithoutPayment) {
        toast.success("You're all set — your plan is active.");
        navigate("/my-subscription", { replace: true });
        return;
      }

      const ready = await loadRazorpay();
      if (!ready) {
        toast.error("Couldn't reach the payment gateway. Check your connection.");
        return;
      }

      const result = await openRazorpay({
        razorpayKeyId: session.razorpayKeyId,
        razorpayOrderId: session.razorpayOrderId,
        amount: session.amount,
        accountName: session.accountName,
        ownerEmail: session.ownerEmail,
        ownerPhone: session.ownerPhone,
        description: `${plan.name} — ${cycle.name}`,
      });
      if (!result) return; // dismissed — not an error

      // From here the money is gone and the account record is catching up.
      // The lock screen goes up and stays up until this page unmounts.
      charged = true;
      setPayStage("verifying");
      const verified = await verify(result).unwrap();

      setPayStage("activating");
      // Mid-signup? Finish onboarding and land on the celebration screen
      // rather than dropping someone into billing history they didn't ask for.
      const midSignup = Boolean(onboarding && !onboarding.completed);
      let onboardingClosed = false;
      if (midSignup) {
        try {
          await completeOnboarding().unwrap();
          onboardingClosed = true;
        } catch {
          // The payment landed; that is what matters. The wizard will pick the
          // account up on its next load.
        }
      }

      // Let the confirmed state actually register before the screen changes
      // under them — a tick that flashes for 30ms may as well not exist.
      setPayStage("done");
      await new Promise((r) => setTimeout(r, 1100));

      toast.success(
        verified.invoiceNumber
          ? `Payment received — invoice ${verified.invoiceNumber}`
          : "Payment received. Your plan is active.",
      );
      // Replace, never push: it consumes the sentinel history entry the lock
      // screen pushed to trap Back, and a paid-for checkout has no business
      // being a Back target once it has been paid for.
      if (onboardingClosed) navigate("/onboarding", { replace: true });
      else navigate("/my-subscription?tab=billing", { replace: true });
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ??
        (err as { message?: string })?.message ??
        (charged
          ? "We couldn't reach our servers to confirm the payment."
          : "Something went wrong. No money has been taken.");

      if (charged) {
        // Stay on the lock screen and switch it to its error face: the webhook
        // settles this payment server-side regardless, so the honest advice is
        // "wait and check billing", never "try paying again".
        setPayError(message);
        setPayStage("error");
      } else {
        toast.error(message);
      }
    } finally {
      setPaying(false);
    }
  }

  if (loadingPlans) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!plan || !cycle) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="font-medium">That plan isn't available.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been archived. Pick another to continue.
        </p>
        <Button className="mt-5" onClick={() => navigate("/my-subscription")}>
          Back to plans
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* The one in-app way off this page. `beforeunload` can't see a client-side
          route change, so mid-payment it has to be closed here. */}
      <button
        type="button"
        disabled={paying}
        onClick={() => {
          if (paying) return warnWhilePaying();
          if (onboarding && !onboarding.completed) navigate("/onboarding");
          else navigate(-1);
        }}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <ArrowLeft className="size-4" />
        {onboarding && !onboarding.completed ? "Back to setup" : "Back"}
      </button>

      {/* ---- stepper --------------------------------------------------- */}
      <ol className="mb-6 flex items-center gap-3">
        {[
          { n: 1 as const, label: "Plan & add-ons" },
          { n: 2 as const, label: "Your details" },
          { n: 3 as const, label: "Review & pay" },
        ].map((s_, i, all) => {
          const done = step > s_.n;
          const active = step === s_.n;
          return (
            <li key={s_.n} className="flex items-center gap-3">
              <button
                type="button"
                // Going back is always allowed; going forward isn't, because
                // step 2 needs a plan chosen first.
                disabled={s_.n > step}
                onClick={() => setStep(s_.n)}
                className={cn(
                  "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-foreground"
                    : done
                      ? "text-muted-foreground hover:text-foreground"
                      : "cursor-default text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    done
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : s_.n}
                </span>
                {s_.label}
              </button>
              {i < all.length - 1 && (
                <span className="h-px w-8 bg-border sm:w-16" />
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        {/* ================================================== form ======== */}
        <div className="order-2 space-y-6 lg:order-1">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {step === 1
                ? "What you're buying"
                : step === 2
                  ? "Your details"
                  : "Check this over"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 1
                ? "Pick a billing cycle and any extra capacity you already know you need."
                : step === 2
                  ? "Where to send the invoice. You'll be charged once."
                  : "Everything you've chosen, in one place. Nothing is charged until you press pay."}
            </p>
          </div>

          {/* ---- billing cycle (SH-01) --------------------------------- */}
          <section className={cn("space-y-3", step !== 1 && "hidden")}>
            <h2 className="text-sm font-semibold">Billing cycle</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {cycles.map((c) => {
                const p = plan.cyclePrices.find((x) => x.code === c.code);
                const active = c.code === cycle.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCycleCode(c.code)}
                    aria-pressed={active}
                    className={cn(
                      "relative rounded-xl border bg-card p-3 text-left shadow-xs transition-all hover:shadow-sm",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-foreground/25",
                    )}
                  >
                    {c.savingsLabel && (
                      /* Contrast is set explicitly rather than by variant: the
                         selected card is already tinted primary, so a primary
                         badge on top of it disappears into its own background. */
                      <Badge
                        className={cn(
                          "absolute -top-2 right-2 border-transparent px-2 py-0 text-[10px] font-semibold shadow-sm",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary dark:bg-primary/20",
                        )}
                      >
                        {c.savingsLabel}
                      </Badge>
                    )}
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums">
                      {inrShort(p?.price ?? 0)}
                    </p>
                    {c.months > 1 && p && (
                      <p className="text-xs text-muted-foreground">
                        {inrShort(p.perMonth)}/mo
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---- add-ons, bought with the plan (SH-11) ----------------- */}
          {step === 1 && (addonOptions ?? []).some((a) => a.sellable) && (
            <section className="space-y-3 rounded-xl border p-5">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  {/* Optional extra, not a warning and not the main action —
                      sky reads as "informational" without competing with the
                      primary CTA. */}
                  <span className="flex size-6 items-center justify-center rounded-md bg-sky-500/10">
                    <PackagePlus className="size-3.5 text-sky-600 dark:text-sky-400" />
                  </span>
                  Need more room?
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add capacity now and it's on the same invoice. You can always
                  add it later instead — it's just prorated then.
                </p>
              </div>

              {(addonOptions ?? [])
                .filter((a) => a.sellable)
                .map((opt) => {
                  const qty = addonQty[opt.featureKey] ?? 0;
                  const step_ = opt.stepSize ?? 1;
                  // Quote per *month*, not per cycle. `pricePerStepCycle` is
                  // computed from an existing subscription's cycle, and there
                  // isn't one yet at checkout — it would understate a yearly
                  // add-on. The order summary carries the true cycle amount,
                  // server-computed, so that's the number that must be trusted.
                  const perMonth = Number(opt.pricePerStepMonthly ?? 0) * qty;
                  return (
                    <div
                      key={opt.featureKey}
                      className={cn(
                        // Never wraps: the stepper is the one thing the eye
                        // returns to on every row, so it holds the right edge
                        // and the copy wraps inside its own column instead.
                        "flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs transition-all hover:shadow-sm",
                        qty > 0 && "border-primary/40 shadow-sm",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{opt.label}</p>
                        {/* "₹249.00/10/month" read as a riddle. Spell the rule
                            out as a sentence instead, and show the outcome of
                            the stepper on its own line once something is picked. */}
                        <p className="text-xs text-muted-foreground">
                          Your plan includes {opt.planValue} · add{" "}
                          {step_} more for {inrShort(opt.pricePerStepMonthly ?? 0)} a
                          month
                        </p>
                        {qty > 0 && (
                          <p className="mt-0.5 text-xs font-medium">
                            You'll have {opt.planValue + qty * step_} in total
                            {/* On a phone there's no room for the amount beside
                                the stepper, so it rides along with the outcome
                                rather than disappearing. */}
                            <span className="sm:hidden">
                              {" "}
                              · +{inrShort(perMonth)}/month
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        {qty > 0 && (
                          <span className="hidden text-sm font-medium tabular-nums sm:inline">
                            +{inrShort(perMonth)}
                            <span className="text-xs font-normal text-muted-foreground">
                              /month
                            </span>
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="size-8"
                            disabled={qty <= 0}
                            onClick={() => {
                              playDecrement();
                              setAddonQty((d) => ({
                                ...d,
                                [opt.featureKey]: Math.max(0, qty - 1),
                              }));
                            }}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="min-w-12 text-center text-sm font-medium tabular-nums">
                            {qty > 0 && "+"}
                            <AnimatedNumber value={qty * step_} />
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="size-8"
                            onClick={() => {
                              playIncrement();
                              setAddonQty((d) => ({
                                ...d,
                                [opt.featureKey]: qty + 1,
                              }));
                            }}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </section>
          )}

          {/* ---- billing details (SH-09) ------------------------------- */}
          <section className={cn("space-y-3 rounded-xl border p-5", step !== 2 && "hidden")}>
            <div>
              <h2 className="text-sm font-semibold">Billing details</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                These appear on your invoice. We freeze a copy at issue time, so
                later edits never change an invoice already issued.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr">Address</Label>
              <Input
                id="addr"
                value={form.billingAddress}
                onChange={(e) => set("billingAddress", e.target.value)}
                placeholder="Shop 4, Ganga Trueno, Kharadi"
                autoComplete="street-address"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.billingCity}
                  onChange={(e) => set("billingCity", e.target.value)}
                  placeholder="Pune"
                  autoComplete="address-level2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin">Pincode</Label>
                <Input
                  id="pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.billingPincode}
                  onChange={(e) =>
                    set("billingPincode", e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="411014"
                  autoComplete="postal-code"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Select
                  value={form.billingState}
                  onValueChange={(v) => set("billingState", v)}
                >
                  <SelectTrigger id="state" className="w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(meta?.states ?? []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gstin">
                  GSTIN{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="gstin"
                  maxLength={15}
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  placeholder="27AAPFU0939F1ZV"
                />
              </div>
            </div>
          </section>

          {/* ---- coupon (SH-10) ---------------------------------------- */}
          <section className={cn("space-y-3 rounded-xl border p-5", step !== 2 && "hidden")}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Tag className="size-4" />
              Coupon
            </h2>

            {appliedCoupon ? (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                  couponConfirmed
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-2 text-sm font-medium",
                    couponConfirmed
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {couponConfirmed ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  )}
                  <span className="truncate">
                    {couponConfirmed ? (
                      <>
                        {appliedCoupon} applied
                        {Number(quote?.discountAmount ?? 0) > 0 && (
                          <span className="font-normal">
                            {" "}
                            — saving {inr(quote!.discountAmount)}
                          </span>
                        )}
                      </>
                    ) : (
                      <>Checking {appliedCoupon}…</>
                    )}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2"
                  onClick={() => {
                    setAppliedCoupon(undefined);
                    setCouponInput("");
                  }}
                  aria-label="Remove coupon"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="uppercase"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && couponInput.trim()) {
                        e.preventDefault();
                        applyCoupon(couponInput.trim());
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    disabled={!couponInput.trim()}
                    onClick={() => applyCoupon(couponInput.trim())}
                  >
                    Apply
                  </Button>
                </div>

                {(publicCoupons?.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Available for this plan
                    </p>
                    {publicCoupons!.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => applyCoupon(c.code)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            <BadgePercent className="size-3.5 text-primary" />
                            {c.code}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          − {inr(c.discountAmount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Applies to the plan price only — never to add-ons.
            </p>
          </section>

          {/* ---- autopay (SH-07 — nudged, optional) -------------------- */}
          <section
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-5",
              step !== 2 && "hidden",
            )}
          >
            <div className="min-w-0">
              <Label htmlFor="autopay" className="flex items-center gap-1.5 font-medium">
                <Zap className="size-4 text-amber-500" />
                Turn on autopay
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                We'll set up a UPI or card mandate so renewals happen on their
                own. You always get a notice at least 24 hours before any debit,
                and you can switch it off whenever you like. Paying manually each
                cycle works just as well.
              </p>
            </div>
            <Switch id="autopay" checked={autopay} onCheckedChange={setAutopay} />
          </section>

          {/* ---- review & confirm ------------------------------------- */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Each block links back to the step that owns it. A review
                  screen that can only be corrected by pressing Back three
                  times isn't a review screen, it's a wall. */}
              <ReviewCard
                title="Plan"
                icon={<Package className="size-4" />}
                onEdit={() => setStep(1)}
              >
                <ReviewRow label="Plan" value={plan.name} />
                <ReviewRow
                  label="Billing cycle"
                  value={
                    cycle.freeMonths > 0
                      ? `${cycle.name} · ${cycle.freeMonths} month${cycle.freeMonths > 1 ? "s" : ""} free`
                      : cycle.name
                  }
                />
                <ReviewRow
                  label="Renews"
                  value={`Every ${cycle.months} month${cycle.months > 1 ? "s" : ""}`}
                />
              </ReviewCard>

              <ReviewCard
                title="Extra capacity"
                icon={<PackagePlus className="size-4" />}
                onEdit={() => setStep(1)}
              >
                {chosenAddons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    None — you're on the plan's included limits. You can add
                    capacity later whenever you outgrow them.
                  </p>
                ) : (
                  chosenAddons.map((a) => (
                    <ReviewRow
                      key={a.featureKey}
                      label={a.label}
                      value={`${a.planValue} included → ${a.total}`}
                    />
                  ))
                )}
              </ReviewCard>

              <ReviewCard
                title="Billing details"
                icon={<Building2 className="size-4" />}
                onEdit={() => setStep(2)}
              >
                <ReviewRow label="Address" value={form.billingAddress} />
                <ReviewRow
                  label="City"
                  value={`${form.billingCity} ${form.billingPincode}`}
                />
                <ReviewRow label="State" value={form.billingState} />
                <ReviewRow
                  label="GSTIN"
                  value={form.gstin || "Not provided"}
                  muted={!form.gstin}
                />
              </ReviewCard>

              <ReviewCard
                title="Payment"
                icon={<CreditCard className="size-4" />}
                onEdit={() => setStep(2)}
              >
                {/* Confirmed, not requested — the review step states what is
                    actually being charged. */}
                <ReviewRow
                  label="Coupon"
                  value={couponConfirmed ? appliedCoupon! : "None applied"}
                  muted={!couponConfirmed}
                />
                <ReviewRow
                  label="Autopay"
                  value={
                    autopay
                      ? "On — renewals charge automatically"
                      : "Off — you'll pay each cycle yourself"
                  }
                />
              </ReviewCard>

              <p className="flex items-start gap-2 rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-xs">
                <ShieldCheck className="mt-px size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                Pressing pay opens Razorpay's secure window. Your card or UPI
                details never touch our servers, and the GST invoice reaches
                your inbox the moment the payment clears.
              </p>
            </div>
          )}
        </div>

        {/* ============================================ order summary ==== */}
        {/* Sticky on desktop so the amount never scrolls out of view while
            the form is being filled in; first on mobile, same purpose. */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-10">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted/40 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Order summary
              </p>
              <p className="mt-1 font-semibold">{plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {cycle.name}
                {cycle.freeMonths > 0 && (
                  <>
                    {" "}
                    · {cycle.freeMonths} month{cycle.freeMonths > 1 ? "s" : ""}{" "}
                    free
                  </>
                )}
                {addonList.length > 0 && (
                  <>
                    {" "}
                    · {addonList.length} add-on
                    {addonList.length > 1 ? "s" : ""}
                  </>
                )}
              </p>
            </div>

            {/* What the money actually buys. The summary listed prices but
                never the capacity or features behind them, so the limits you
                were paying to raise were invisible at the moment of paying. */}
            <div className="border-b p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What's included
              </p>

              <ul className="mt-3 space-y-1.5 text-sm">
                {plan.limits.map((limit) => {
                  const extra = addonUplift[limit.featureKey] ?? 0;
                  return (
                    <li
                      key={limit.featureKey}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        {limit.label}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {limit.isUnlimited ? (
                          "Unlimited"
                        ) : (
                          <>
                            {limit.value + extra}
                            {extra > 0 && (
                              /* The uplift is called out rather than folded
                                 silently into the total — it's the thing being
                                 paid extra for. */
                              <span className="ml-1 font-normal text-emerald-700 dark:text-emerald-400">
                                (+{extra})
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {planFeatures.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                  {planFeatures.map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-muted-foreground">
                        {featureLabel(key)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5">
              {quoting && !quote ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : quote ? (
                <>
                  <dl className="space-y-2 text-sm">
                    {quote.lines
                      .filter((l) => Number(l.amount) !== 0)
                      .map((line) => {
                        const amt = Number(line.amount);
                        const discount = amt < 0;
                        return (
                          <div
                            key={line.key}
                            className="flex items-start justify-between gap-3"
                          >
                            <dt
                              className={cn(
                                "flex min-w-0 items-center gap-1",
                                discount
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {line.label}
                              {/*
                                A rupee figure nobody can sanity-check invites
                                "what is this?" — so the rate is in the label
                                and the reasoning is one hover away.
                              */}
                              {line.key === "gateway_fee" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="What is the payment gateway fee?"
                                      className="rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
                                    >
                                      <Info className="size-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-64">
                                    What our payment provider charges to process
                                    the transaction, passed on at cost —{" "}
                                    {quote.gatewayFeePercent}% of{" "}
                                    {inr(quote.subtotal)}. It applies to every
                                    charge, including renewals.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </dt>
                            <dd
                              className={cn(
                                "shrink-0 tabular-nums",
                                discount &&
                                  "font-medium text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              <Odometer
                                text={
                                  discount
                                    ? `− ${inr(Math.abs(amt))}`
                                    : inr(amt)
                                }
                                stagger={28}
                              />
                            </dd>
                          </div>
                        );
                      })}
                  </dl>

                  <Separator className="my-4" />

                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">Total due today</span>
                    <Odometer
                      text={inr(quote.totalAmount)}
                      className="text-2xl font-bold"
                    />
                  </div>

                  {Number(quote.discountAmount) > 0 && (
                    <p className="mt-1 text-right text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      You save {inr(quote.discountAmount)}
                    </p>
                  )}

                  {step < 3 ? (
                    <>
                      <Button
                        className="mt-5 w-full"
                        size="lg"
                        disabled={step === 2 && incomplete}
                        onClick={() => setStep(step === 1 ? 2 : 3)}
                      >
                        {step === 1 ? "Continue" : "Review order"}
                        <ArrowRight className="size-4" />
                      </Button>
                      {step === 2 && incomplete && (
                        <p className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <Info className="size-3.5 shrink-0" />
                          Complete your billing details to continue
                        </p>
                      )}
                      {step === 2 && (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                          Back to plan &amp; add-ons
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        className="mt-5 w-full"
                        size="lg"
                        disabled={incomplete || paying}
                        onClick={handlePay}
                      >
                        {paying ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Processing…
                          </>
                        ) : (
                          <>
                            <Lock className="size-4" />
                            Pay {inr(quote.totalAmount)}
                          </>
                        )}
                      </Button>

                      {incomplete && !paying && (
                        <p className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <Info className="size-3.5 shrink-0" />
                          Complete your billing details to continue
                        </p>
                      )}

                      {/* Standing warning for the whole gateway window. The
                          Razorpay modal covers most of the page, so this is
                          mainly what they come back to after switching to a UPI
                          app — and what makes the blocked-refresh toast make
                          sense rather than feel arbitrary. */}
                      {paying && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-left text-xs font-medium text-amber-700 dark:text-amber-400">
                          <TriangleAlert className="mt-px size-3.5 shrink-0" />
                          Payment in progress — don't refresh or close this tab.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Back to your details
                      </button>
                    </>
                  )}

                  {quote.requiresApproval && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                      Above ₹15,000, RBI requires your approval for each
                      recurring debit — we'll email you before every renewal.
                    </p>
                  )}
                </>
              ) : null}
            </div>

            {/* Trust row — the reassurance every checkout earns its conversion
                with. All three statements are literally true here. */}
            <div className="space-y-2 border-t bg-muted/30 px-5 py-4">
              {[
                { Icon: ShieldCheck, text: "Secured by Razorpay — we never see your card or UPI details" },
                { Icon: BadgeCheck, text: "GST-ready invoice emailed immediately" },
                { Icon: Check, text: "Cancel any time; access runs to the end of your period" },
              ].map(({ Icon, text }) => (
                <p
                  key={text}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {text}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <PaymentProcessingOverlay
        open={payStage !== null}
        stage={payStage ?? "verifying"}
        detail={`${plan.name} · ${cycle.name}`}
        amount={quote ? inr(quote.totalAmount) : undefined}
        errorMessage={payError ?? undefined}
        onErrorAction={() => navigate("/my-subscription?tab=billing")}
      />
    </div>
    </TooltipProvider>
  );
}
