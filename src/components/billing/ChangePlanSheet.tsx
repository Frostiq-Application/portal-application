import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowRight, ArrowUp, CalendarClock, Check, Loader2, PackagePlus, TriangleAlert, Zap } from "@/components/ui/icons";
import {
  useLimitItemsQuery,
  usePreviewChangeQuery,
  useScheduleDowngradeMutation,
  useUpgradePlanMutation,
} from "@/features/api/billingApi";
import { inr, inrShort, loadRazorpay, openRazorpay } from "@/lib/billing";
import { formatDate, cn } from "@/lib/utils";
import { useVerifyPaymentMutation } from "@/features/api/billingApi";
import type {
  ChangePreview,
  CycleOption,
  OverLimitRow,
  PricingPlan,
} from "@/types/billing";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteSummary } from "./QuoteSummary";
import {
  PaymentProcessingOverlay,
  type PaymentStage,
} from "./PaymentProcessingOverlay";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
  cycle: CycleOption | null;
  currentPlanName?: string;
  onDone?: () => void;
}

/**
 * The keep-selection picker for one over-limit Count feature (SH-15).
 *
 * The account chooses which branches / products / team members stay active;
 * everything else is **archived, not deleted**, and comes straight back if they
 * upgrade or buy capacity later. That distinction is the whole reason this
 * screen exists rather than a bare "are you sure?" dialog.
 */
function KeepPicker({
  row,
  selected,
  onChange,
}: {
  row: OverLimitRow;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: items, isLoading } = useLimitItemsQuery(row.featureKey);
  const active = useMemo(
    () => (items ?? []).filter((i) => !i.isArchived),
    [items],
  );

  // Default to the oldest N — the same rule the server applies if nobody
  // chooses, so what's shown is what would actually happen.
  useEffect(() => {
    if (selected.length === 0 && active.length > 0) {
      onChange(active.slice(0, row.allowed).map((i) => i.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  const atLimit = selected.length >= row.allowed;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{row.label}</p>
        <Badge variant={atLimit ? "secondary" : "outline"}>
          {selected.length} of {row.allowed} kept
        </Badge>
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1.5">
        {active.map((item) => {
          const checked = selected.includes(item.id);
          const disabled = !checked && atLimit;
          return (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                checked ? "bg-primary/5" : "hover:bg-muted",
                disabled && "cursor-not-allowed opacity-45",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) =>
                  onChange(
                    v
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.name}</span>
                {item.meta && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.meta}
                  </span>
                )}
              </span>
              {!checked && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  will archive
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Unselected items are archived, never deleted — they come back the moment
        you have capacity again.
      </p>
    </div>
  );
}

/**
 * How the prorated figure was arrived at.
 *
 * A single line reading "Upgrade to Growth Plus — 31 of 31 days remaining
 * ₹1,500.00" is a number the customer has no way to check. It leaves out both
 * halves of the sum: what they are already paying, and that the difference is
 * being scaled by the days they have left. Showing the working is what makes a
 * mid-cycle charge feel like arithmetic rather than a figure we picked.
 *
 * Every number here comes from the server's own proration, never recomputed —
 * a second implementation of the formula is one that can disagree with the
 * amount on the button.
 */
function ProrationWorking({
  basis,
  newPlanName,
  newCycleName,
  daysRemaining,
  daysInCycle,
  prorationAmount,
  renewsOn,
  freeMonthsNote,
}: {
  basis: NonNullable<ChangePreview["basis"]>;
  newPlanName: string;
  newCycleName: string;
  daysRemaining: number;
  daysInCycle: number;
  prorationAmount: string;
  renewsOn?: string;
  /** "6 months, 1 free" — why the cycle price isn't months × monthly. */
  freeMonthsNote?: string;
}) {
  const current = `${basis.currentPlanName} · ${basis.currentCycleName} — you already pay`;
  const full = daysRemaining >= daysInCycle;

  // A longer cycle isn't a top-up — the account is buying a new term today and
  // handing back the days it has left. The only figure that needs explaining is
  // the credit; the itemised quote below already shows what the term costs.
  if (basis.kind === "restart") {
    return (
      <section className="space-y-2 rounded-xl border border-dashed p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How this is worked out
        </h3>
        <Row
          label={`${newPlanName} · ${newCycleName}`}
          sub={freeMonthsNote}
          value={inr(basis.newCyclePrice)}
        />
        <Row
          label={current}
          value={`${inr(basis.currentCyclePrice)} · ${inr(basis.currentPerDay)}/day`}
        />
        <Row
          label={`× ${basis.creditedDays} day${basis.creditedDays === 1 ? "" : "s"} you've paid for and haven't used`}
          value={`− ${inr(basis.creditAmount)}`}
          muted
        />
        <Separator className="my-1" />
        <Row label="Due today, before fees" value={inr(prorationAmount)} strong />
        <p className="pt-1 text-xs text-muted-foreground">
          None of what you've paid is lost — it comes off today's charge. Your{" "}
          {newCycleName.toLowerCase()} term starts today
          {renewsOn ? ` and renews ${formatDate(renewsOn)}` : ""}, then{" "}
          {inr(basis.newCyclePrice)} every {newCycleName.toLowerCase()} cycle.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-xl border border-dashed p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        How this is worked out
      </h3>

      {basis.perDay ? (
        // A longer cycle buys a different amount of time, so the two totals
        // can't simply be subtracted — one is a year and the other a month.
        // Per day is the only comparison that means anything here, and it's the
        // one the charge is actually computed from.
        <>
          <Row
            label={`${newPlanName} · ${newCycleName}`}
            sub={freeMonthsNote}
            value={`${inr(basis.newCyclePrice)} · ${inr(basis.newPerDay)}/day`}
          />
          <Row
            label={current}
            value={`${inr(basis.currentCyclePrice)} · ${inr(basis.currentPerDay)}/day`}
          />
          <Separator className="my-1" />
          <Row
            label="Difference per day"
            value={`${inr(basis.newPerDay)} − ${inr(basis.currentPerDay)}`}
            muted
          />
          <Row
            label={`× ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in this period`}
            value={inr(prorationAmount)}
            strong
          />
        </>
      ) : (
        <>
          <Row
            label={`${newPlanName} · ${newCycleName}`}
            sub={freeMonthsNote}
            value={inr(basis.newCyclePrice)}
          />
          <Row label={current} value={`− ${inr(basis.currentCyclePrice)}`} />
          <Separator className="my-1" />
          <Row
            label="Difference for a full period"
            value={inr(
              Number(basis.newCyclePrice) - Number(basis.currentCyclePrice),
            )}
            muted
          />
          <Row
            label={
              full
                ? `For all ${daysInCycle} days left in this period`
                : `For ${daysRemaining} of ${daysInCycle} days left in this period`
            }
            value={inr(prorationAmount)}
            strong
          />
        </>
      )}

      <p className="pt-1 text-xs text-muted-foreground">
        Your renewal date doesn't move — this covers only the days left in the
        period you've already paid for. After that you're billed{" "}
        {inr(basis.newCyclePrice)} each {newCycleName.toLowerCase()} cycle.
      </p>
    </section>
  );
}

function Row({
  label,
  sub,
  value,
  muted,
  strong,
}: {
  label: string;
  /** A quieter second line, for the make-up of the figure beside it. */
  sub?: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span
        className={cn(
          "min-w-0",
          muted || !strong ? "text-muted-foreground" : "font-medium",
        )}
      >
        {label}
        {sub && (
          <span className="block text-xs text-muted-foreground/80">{sub}</span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Plan changes (SH-13/14/15).
 *
 * The sheet renders one of three shapes depending on what the server says:
 *  - **Immediate** — an upgrade from a paid plan. The prorated difference for
 *    the days remaining is charged now, and features unlock as soon as it
 *    settles.
 *  - **Scheduled** — a downgrade. Nothing is charged and nothing is refunded;
 *    the account keeps its current plan until the period ends, and picks what
 *    to keep if the new plan can't hold everything.
 *  - **Checkout** — a first purchase, from a trial or the ₹0 tier. There is no
 *    paid period to prorate against, so this is the full cycle at full price
 *    and it goes through checkout, where the billing address and GSTIN the
 *    invoice needs are collected.
 *
 * Which shape it is, and the money in it, come from the server on every open —
 * see the query below.
 */
export function ChangePlanSheet({
  open,
  onOpenChange,
  plan,
  cycle,
  currentPlanName,
  onDone,
}: Props) {
  const [keep, setKeep] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [payStage, setPayStage] = useState<PaymentStage | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [upgrade] = useUpgradePlanMutation();
  const [schedule] = useScheduleDowngradeMutation();
  const [verify] = useVerifyPaymentMutation();

  const args =
    plan && cycle ? { planId: plan.id, billingCycle: cycle.code } : undefined;
  // `currentData`, not `data`: `data` keeps the last result this hook saw *for
  // any argument*, so opening the sheet on a second plan would render the first
  // plan's amounts until the new request landed — the wrong price, under the
  // right plan's name, on a button that takes money.
  //
  // `refetchOnMountOrArgChange` then makes every open a real request rather
  // than a replay of whatever was quoted last time, since usage, days remaining
  // and the account's own plan can all have moved since.
  const { currentData: preview, isFetching } = usePreviewChangeQuery(
    args ?? { planId: "", billingCycle: "" },
    { skip: !args || !open, refetchOnMountOrArgChange: true },
  );

  // The query unsubscribes the instant the sheet starts closing, which would
  // blank the panel mid-animation. This holds the last quote for the ~200ms
  // slide-out only — while the sheet is open the live result is the only thing
  // rendered, so nothing stale can ever be read or acted on.
  const [lastShown, setLastShown] = useState<ChangePreview | undefined>();
  if (preview && preview !== lastShown) setLastShown(preview);
  const view = open ? preview : lastShown;

  /** Anything but a settled, current quote is a loading state. */
  const loading = open && (isFetching || !preview);

  // Cleared during render rather than in an effect so the add-on keeps never
  // survive into the first paint for a different plan or cycle.
  const seedKey = open ? `${plan?.id ?? ""}:${cycle?.code ?? ""}` : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    if (open) setKeep({});
  }

  async function handleConfirm() {
    if (!plan || !cycle || !preview) return;

    // A first purchase collects a billing address, a GSTIN and an autopay
    // choice — none of which fit in this sheet, and all of which checkout
    // already does.
    if (preview.mode === "checkout") {
      onOpenChange(false);
      navigate(`/checkout?plan=${plan.id}&cycle=${cycle.code}`);
      return;
    }

    setBusy(true);
    let charged = false;
    try {
      if (preview.mode === "immediate") {
        const session = await upgrade({
          planId: plan.id,
          billingCycle: cycle.code,
        }).unwrap();

        if (session.settledWithoutPayment) {
          toast.success(`You're on ${plan.name} now.`);
          onDone?.();
          onOpenChange(false);
          return;
        }

        const ready = await loadRazorpay();
        if (!ready) {
          toast.error("Couldn't reach the payment gateway.");
          return;
        }
        const result = await openRazorpay({
          razorpayKeyId: session.razorpayKeyId,
          razorpayOrderId: session.razorpayOrderId,
          amount: session.amount,
          accountName: session.accountName,
          ownerEmail: session.ownerEmail,
          ownerPhone: session.ownerPhone,
          description: `Upgrade to ${plan.name}`,
        });
        if (!result) return;

        // Charged. Hold the screen until the upgrade is on the account.
        charged = true;
        setPayStage("verifying");
        await verify(result).unwrap();
        setPayStage("done");
        await new Promise((r) => setTimeout(r, 1000));
        toast.success(
          preview.basis?.currentPlanName === plan.name
            ? `You're on ${cycle.name.toLowerCase()} billing now.`
            : `Upgraded to ${plan.name}. New features are live.`,
        );
      } else {
        await schedule({
          planId: plan.id,
          billingCycle: cycle.code,
          keepSelections: Object.entries(keep).map(([featureKey, keepIds]) => ({
            featureKey,
            keepIds,
          })),
        }).unwrap();
        toast.success(
          `Change scheduled for ${formatDate(preview.effectiveAt)}. You can undo it any time before then.`,
        );
      }
      setPayStage(null);
      onDone?.();
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ??
        (err as { message?: string })?.message ??
        (charged
          ? "We couldn't reach our servers to confirm the payment."
          : "Couldn't apply that change.");

      if (charged) {
        setPayError(message);
        setPayStage("error");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const immediate = view?.mode === "immediate";
  /** Moving onto a longer cycle: a new term starting today, not a top-up. */
  const restartTerm = immediate && view?.restartTerm === true;
  /** Only the billing cycle is changing — the plan itself stays put. */
  const cycleOnly = restartTerm && view?.basis?.currentPlanName === plan?.name;
  /** A trial or ₹0 account buying a plan for the first time. */
  const firstPurchase = view?.mode === "checkout";
  const fromTrial = firstPurchase && view?.trial === true;
  const trialDaysLeft = view?.daysRemaining ?? 0;
  const price = plan?.cyclePrices.find((p) => p.code === cycle?.code);
  /**
   * Why a longer cycle doesn't cost months × monthly. The discount *is* the
   * free months, and a price that looks arbitrary next to a monthly figure the
   * account already knows is the one people ask about.
   */
  const freeMonthsNote =
    cycle && cycle.freeMonths > 0
      ? `${cycle.months} months billed as ${cycle.payableMonths} — ${cycle.freeMonths} month${
          cycle.freeMonths === 1 ? "" : "s"
        } free`
      : undefined;

  return (
    <>
    <PaymentProcessingOverlay
      open={payStage !== null}
      stage={payStage ?? "verifying"}
      detail={plan ? `Upgrade to ${plan.name}` : undefined}
      amount={view ? inr(view.quote.totalAmount) : undefined}
      errorMessage={payError ?? undefined}
      errorActionLabel="Close"
      onErrorAction={() => {
        setPayStage(null);
        onDone?.();
        onOpenChange(false);
      }}
    />
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          {/* The title names the shape of the change, so it stays neutral until
              the server has said which shape it is. */}
          <SheetTitle className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : immediate || firstPurchase ? (
              <ArrowUp className="size-4 text-emerald-600" />
            ) : (
              <ArrowDown className="size-4 text-amber-600" />
            )}
            {loading
              ? "Review your change"
              : firstPurchase
                ? fromTrial
                  ? "Activate your plan"
                  : "Start your subscription"
                : cycleOnly
                  ? `Switch to ${cycle?.name.toLowerCase() ?? "a longer cycle"} billing`
                  : immediate
                    ? "Upgrade"
                    : "Change plan"}
          </SheetTitle>
          <SheetDescription>
            {/* "Growth Plus → Growth Plus · Semi-annually" reads as a change
                that isn't one. When only the cycle moves, say so. */}
            {cycleOnly && view?.basis
              ? `${plan?.name} · ${view.basis.currentCycleName} → ${cycle?.name}`
              : currentPlanName && plan
                ? `${currentPlanName} → ${plan.name}${cycle ? ` · ${cycle.name}` : ""}`
                : "Review your change"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </>
          ) : view ? (
            <>
              {/* ---- what happens and when -------------------------------- */}
              <div
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4",
                  immediate || firstPurchase
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5",
                )}
              >
                {immediate || firstPurchase ? (
                  <Zap className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {firstPurchase
                      ? fromTrial
                        ? "This ends your trial and starts your subscription"
                        : "This starts your subscription"
                      : restartTerm
                        ? `Your ${cycle?.name.toLowerCase() ?? "new"} term starts today`
                        : immediate
                          ? "This applies right away"
                          : `This takes effect on ${formatDate(view.effectiveAt)}`}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {firstPurchase
                      ? fromTrial
                        ? `${
                            trialDaysLeft === 0
                              ? "Your trial ends today"
                              : `You have ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} of trial left`
                          } — there's nothing paid to prorate against, so this is the full ${cycle?.name.toLowerCase() ?? "cycle"} price and a fresh period starts the moment it's paid. Everything you've set up stays exactly as it is.`
                        : `You're on a free plan, so there's nothing to prorate — this is the full ${cycle?.name.toLowerCase() ?? "cycle"} price, and a new period starts the moment it's paid.`
                      : restartTerm
                        ? `You're charged for the new term now, less the ${view.daysRemaining} day${view.daysRemaining === 1 ? "" : "s"} you've already paid for${
                            view.renewsOn
                              ? `. Your renewal date moves to ${formatDate(view.renewsOn)}`
                              : ""
                          }.`
                        : immediate
                          ? `You'll be charged the difference for the ${view.daysRemaining} day${view.daysRemaining === 1 ? "" : "s"} left in your current period, and the new features unlock immediately.`
                          : "Nothing is charged or refunded now — you keep your current plan and everything in it until then. You can undo this any time before it lands."}
                  </p>
                </div>
              </div>

              {/* ---- new price ------------------------------------------- */}
              {price && plan && cycle && (
                <div className="flex items-center justify-between rounded-xl border bg-card p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {immediate
                        ? "New recurring amount"
                        : firstPurchase
                          ? "Plan price"
                          : "From the change date"}
                    </p>
                    <p className="font-semibold">
                      {plan.name} · {cycle.name}
                    </p>
                    {freeMonthsNote && (
                      <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                        {freeMonthsNote}
                      </p>
                    )}
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {inrShort(price.price)}
                  </p>
                </div>
              )}

              {/* ---- over-limit resolution (SH-15) ------------------------ */}
              {/* A first purchase archives nothing, so it gets the warning
                  without the keep-picker: there is no choice to make. */}
              {view.overLimit.length > 0 && firstPurchase && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 p-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p>
                      You're using more than {plan?.name} includes —{" "}
                      {view.overLimit
                        .map((r) => `${r.used} ${r.label.toLowerCase()} of ${r.allowed}`)
                        .join(", ")}
                      .
                    </p>
                    <p className="mt-1">
                      Nothing is removed. You just won't be able to add more
                      until you're back within the limit, or add capacity from
                      the Add-ons panel.
                    </p>
                  </div>
                </div>
              )}

              {view.overLimit.length > 0 && !firstPurchase && (
                <section className="space-y-4">
                  <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 p-3">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      You're using more than {plan?.name} allows. Choose what
                      stays active — or add capacity to keep everything.
                    </p>
                  </div>

                  {view.overLimit.map((row) => (
                    <div key={row.featureKey} className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {row.used} in use · {row.allowed} allowed
                        </span>
                        <Badge variant="destructive" className="shrink-0">
                          {row.excess} over
                        </Badge>
                      </div>
                      <KeepPicker
                        row={row}
                        selected={keep[row.featureKey] ?? []}
                        onChange={(ids) =>
                          setKeep((k) => ({ ...k, [row.featureKey]: ids }))
                        }
                      />
                    </div>
                  ))}

                  {(view.addonOptions ?? []).some((a) => a.sellable) && (
                    <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                      <PackagePlus className="mt-0.5 size-3.5 shrink-0" />
                      Want to keep everything? Buy add-on capacity from the
                      Add-ons panel instead — it raises your limit on any plan.
                    </p>
                  )}
                </section>
              )}

              {view.overLimit.length === 0 && !immediate && !firstPurchase && (
                <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <Check className="size-4 shrink-0" />
                  Everything you're using fits in the new plan — nothing will be
                  archived.
                </p>
              )}

              <Separator />

              {immediate && view.basis && plan && (
                <ProrationWorking
                  basis={view.basis}
                  newPlanName={plan.name}
                  newCycleName={cycle?.name ?? view.basis.currentCycleName}
                  daysRemaining={view.daysRemaining ?? 0}
                  daysInCycle={view.daysInCycle ?? 0}
                  prorationAmount={view.prorationAmount}
                  renewsOn={view.renewsOn}
                  freeMonthsNote={freeMonthsNote}
                />
              )}

              {immediate ? (
                <QuoteSummary
                  quote={view.quote}
                  title={restartTerm ? "Due today" : "Prorated charge now"}
                />
              ) : firstPurchase ? (
                <QuoteSummary quote={view.quote} title="Due at checkout" />
              ) : (
                <QuoteSummary
                  quote={view.quote}
                  title={`From ${formatDate(view.effectiveAt)}`}
                  showApprovalNote={false}
                />
              )}
            </>
          ) : null}
        </div>

        <div className="border-t bg-background px-6 py-4">
          {/* Nothing is committable until the current quote is in — the amount
              on this button is the amount that gets charged. */}
          <Button
            className="w-full"
            size="lg"
            disabled={loading || !view || busy}
            onClick={handleConfirm}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {loading
              ? "Checking your account…"
              : firstPurchase
                ? "Continue to checkout"
                : immediate
                  ? `Pay ${view ? inr(view.quote.totalAmount) : ""} and ${
                      cycleOnly ? "switch" : "upgrade"
                    }`
                  : "Schedule this change"}
            {firstPurchase && !loading && <ArrowRight className="size-4" />}
          </Button>
          {!loading && firstPurchase && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              You'll confirm your billing details and pay on the next step.
            </p>
          )}
          {!loading && !immediate && !firstPurchase && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              No charge today. Undo any time before it takes effect.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
