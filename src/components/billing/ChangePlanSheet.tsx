import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CalendarClock, Check, Loader2, PackagePlus, TriangleAlert, Zap } from "@/components/ui/icons";
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
 * Plan changes (SH-13/14/15).
 *
 * The sheet renders one of two shapes depending on what the server says:
 *  - **Immediate** — an upgrade. The prorated difference for the days remaining
 *    is charged now, and features unlock as soon as it settles.
 *  - **Scheduled** — a downgrade. Nothing is charged and nothing is refunded;
 *    the account keeps its current plan until the period ends, and picks what
 *    to keep if the new plan can't hold everything.
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

  const [upgrade] = useUpgradePlanMutation();
  const [schedule] = useScheduleDowngradeMutation();
  const [verify] = useVerifyPaymentMutation();

  const args =
    plan && cycle ? { planId: plan.id, billingCycle: cycle.code } : undefined;
  const { data: preview, isFetching } = usePreviewChangeQuery(
    args ?? { planId: "", billingCycle: "" },
    { skip: !args || !open },
  );

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
        toast.success(`Upgraded to ${plan.name}. New features are live.`);
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

  const immediate = preview?.mode === "immediate";
  const price = plan?.cyclePrices.find((p) => p.code === cycle?.code);

  return (
    <>
    <PaymentProcessingOverlay
      open={payStage !== null}
      stage={payStage ?? "verifying"}
      detail={plan ? `Upgrade to ${plan.name}` : undefined}
      amount={preview ? inr(preview.quote.totalAmount) : undefined}
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
          <SheetTitle className="flex items-center gap-2">
            {immediate ? (
              <ArrowUp className="size-4 text-emerald-600" />
            ) : (
              <ArrowDown className="size-4 text-amber-600" />
            )}
            {immediate ? "Upgrade" : "Change plan"}
          </SheetTitle>
          <SheetDescription>
            {currentPlanName && plan
              ? `${currentPlanName} → ${plan.name}${cycle ? ` · ${cycle.name}` : ""}`
              : "Review your change"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isFetching && !preview ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </>
          ) : preview ? (
            <>
              {/* ---- what happens and when -------------------------------- */}
              <div
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4",
                  immediate
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5",
                )}
              >
                {immediate ? (
                  <Zap className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {immediate
                      ? "This applies right away"
                      : `This takes effect on ${formatDate(preview.effectiveAt)}`}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {immediate
                      ? `You'll be charged the difference for the ${preview.daysRemaining} day${preview.daysRemaining === 1 ? "" : "s"} left in your current period, and the new features unlock immediately.`
                      : "Nothing is charged or refunded now — you keep your current plan and everything in it until then. You can undo this any time before it lands."}
                  </p>
                </div>
              </div>

              {/* ---- new price ------------------------------------------- */}
              {price && plan && cycle && (
                <div className="flex items-center justify-between rounded-xl border bg-card p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {immediate ? "New recurring amount" : "From the change date"}
                    </p>
                    <p className="font-semibold">
                      {plan.name} · {cycle.name}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {inrShort(price.price)}
                  </p>
                </div>
              )}

              {/* ---- over-limit resolution (SH-15) ------------------------ */}
              {preview.overLimit.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 p-3">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      You're using more than {plan?.name} allows. Choose what
                      stays active — or add capacity to keep everything.
                    </p>
                  </div>

                  {preview.overLimit.map((row) => (
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

                  {(preview.addonOptions ?? []).some((a) => a.sellable) && (
                    <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                      <PackagePlus className="mt-0.5 size-3.5 shrink-0" />
                      Want to keep everything? Buy add-on capacity from the
                      Add-ons panel instead — it raises your limit on any plan.
                    </p>
                  )}
                </section>
              )}

              {preview.overLimit.length === 0 && !immediate && (
                <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <Check className="size-4 shrink-0" />
                  Everything you're using fits in the new plan — nothing will be
                  archived.
                </p>
              )}

              <Separator />

              {immediate ? (
                <QuoteSummary quote={preview.quote} title="Prorated charge now" />
              ) : (
                <QuoteSummary
                  quote={preview.quote}
                  title={`From ${formatDate(preview.effectiveAt)}`}
                  showApprovalNote={false}
                />
              )}
            </>
          ) : null}
        </div>

        <div className="border-t bg-background px-6 py-4">
          <Button
            className="w-full"
            size="lg"
            disabled={!preview || busy}
            onClick={handleConfirm}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {immediate
              ? `Pay ${preview ? inr(preview.quote.totalAmount) : ""} and upgrade`
              : "Schedule this change"}
          </Button>
          {!immediate && (
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
