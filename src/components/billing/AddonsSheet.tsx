import { useState } from "react";
import { toast } from "sonner";
import {
  InfinityIcon,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  RotateCcw,
  Trash2,
} from "@/components/ui/icons";
import {
  useAddonOptionsQuery,
  usePurchaseAddonMutation,
  useScheduleAddonRemovalMutation,
  useVerifyPaymentMutation,
} from "@/features/api/billingApi";
import { inr, inrShort, loadRazorpay, openRazorpay } from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import type { SubscriptionAddon } from "@/types/billing";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  PaymentProcessingOverlay,
  type PaymentStage,
} from "./PaymentProcessingOverlay";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addons: SubscriptionAddon[];
  renewalDate?: string;
  isTrial?: boolean;
  onDone?: () => void;
}

/**
 * Add-ons (SH-11/12).
 *
 * Two rules the UI has to make obvious, because both surprise people:
 *  - **Buying is instant and prorated** to the current renewal date; from the
 *    next cycle the add-on bills alongside the plan.
 *  - **Removing waits for renewal.** There are no refunds, so the capacity you
 *    already paid for stays until the period ends — and the removal is
 *    undoable right up to that point.
 */
export function AddonsSheet({
  open,
  onOpenChange,
  addons,
  renewalDate,
  isTrial,
  onDone,
}: Props) {
  const { data: options, isLoading } = useAddonOptionsQuery(undefined, {
    skip: !open,
  });
  const [purchase] = usePurchaseAddonMutation();
  const [scheduleRemoval] = useScheduleAddonRemovalMutation();
  const [verify] = useVerifyPaymentMutation();

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [payStage, setPayStage] = useState<PaymentStage | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payDetail, setPayDetail] = useState<{
    label: string;
    amount: string;
  } | null>(null);

  const addonByKey = new Map(addons.map((a) => [a.featureKey, a]));

  async function buy(featureKey: string, label: string, quantity: number) {
    setBusyKey(featureKey);
    let charged = false;
    try {
      const session = await purchase({ featureKey, quantity }).unwrap();

      if (session.settledWithoutPayment) {
        toast.success(`${label} capacity added.`);
        setDraft((d) => ({ ...d, [featureKey]: 0 }));
        onDone?.();
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
        description: `${label} add-on`,
      });
      if (!result) return;

      // Charged. Hold the screen until the capacity is on the account.
      charged = true;
      setPayDetail({ label: `${label} add-on`, amount: inr(session.amount) });
      setPayStage("verifying");
      await verify(result).unwrap();
      setPayStage("done");
      await new Promise((r) => setTimeout(r, 1000));

      toast.success(`${label} capacity added — it's available right away.`);
      setPayStage(null);
      setDraft((d) => ({ ...d, [featureKey]: 0 }));
      onDone?.();
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ??
        (err as { message?: string })?.message ??
        (charged
          ? "We couldn't reach our servers to confirm the payment."
          : "Couldn't add that capacity.");

      if (charged) {
        setPayError(message);
        setPayStage("error");
      } else {
        toast.error(message);
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleRemoval(featureKey: string, remove: boolean) {
    try {
      await scheduleRemoval({ featureKey, remove }).unwrap();
      toast.success(
        remove
          ? `Removal scheduled for ${renewalDate ? formatDate(renewalDate) : "your renewal date"}. You can undo it until then.`
          : "Removal cancelled — you're keeping this add-on.",
      );
      onDone?.();
    } catch {
      toast.error("Couldn't update that add-on.");
    }
  }

  return (
    <>
      <PaymentProcessingOverlay
        open={payStage !== null}
        stage={payStage ?? "verifying"}
        detail={payDetail?.label}
        amount={payDetail?.amount}
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
              <PackagePlus className="size-4" />
              Add-on capacity
            </SheetTitle>
            <SheetDescription>
              Raise a limit without changing your plan. Add-ons work on every
              plan.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {isTrial && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                Add-ons aren't available during the trial. Activate a plan first
                — trial limits are fixed.
              </p>
            )}

            {isLoading ? (
              <>
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </>
            ) : (
              (options ?? []).map((opt) => {
                const owned = addonByKey.get(opt.featureKey);
                const pending = draft[opt.featureKey] ?? 0;
                const targetQty = (owned?.quantity ?? 0) + pending;
                const step = opt.stepSize ?? 1;
                const cycleCost =
                  opt.pricePerStepCycle != null
                    ? Number(opt.pricePerStepCycle) * pending
                    : 0;

                return (
                  <div
                    key={opt.featureKey}
                    className="space-y-3 rounded-xl border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.isUnlimited ? (
                            <span className="inline-flex items-center gap-1">
                              <InfinityIcon className="size-3" /> Unlimited on
                              your plan
                            </span>
                          ) : (
                            <>
                              Plan gives {opt.planValue}
                              {owned && owned.unitsAdded > 0 && (
                                <> · +{owned.unitsAdded} from add-ons</>
                              )}
                              {opt.effective != null && (
                                <> · {opt.effective} total</>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      {owned && (
                        <Badge variant="secondary" className="shrink-0">
                          +{owned.unitsAdded}
                        </Badge>
                      )}
                    </div>

                    {owned?.removeAtPeriodEnd && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          Ends on{" "}
                          {renewalDate ? formatDate(renewalDate) : "renewal"}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => toggleRemoval(opt.featureKey, false)}
                        >
                          <RotateCcw className="size-3.5" />
                          Undo
                        </Button>
                      </div>
                    )}

                    {!opt.sellable ? (
                      <p className="text-xs text-muted-foreground">
                        {opt.unavailableReason}
                      </p>
                    ) : isTrial ? null : (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-8"
                              disabled={pending <= 0}
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  [opt.featureKey]: Math.max(0, pending - 1),
                                }))
                              }
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="min-w-16 text-center text-sm font-medium tabular-nums">
                              +{pending * step}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-8"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  [opt.featureKey]: pending + 1,
                                }))
                              }
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                          <p className="text-right text-xs text-muted-foreground">
                            {/* Say the rule as a sentence — "₹249/10 per month"
                              reads as a fraction, not as a price for a block. */}
                            {step} more for{" "}
                            {inrShort(opt.pricePerStepMonthly ?? 0)} a month
                            {pending > 0 && (
                              <span className="block font-medium text-foreground">
                                {inr(cycleCost)} per cycle
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Stepping without seeing the cost is guesswork — show
                          the new limit and the recurring delta immediately, the
                          way a good usage-based console does. */}
                        {pending > 0 && (
                          <div className="rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-muted-foreground">
                                New {opt.label.toLowerCase()} limit
                              </span>
                              <span className="font-semibold tabular-nums">
                                {opt.effective ?? 0} →{" "}
                                {(opt.effective ?? 0) + pending * step}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                              <span className="text-muted-foreground">
                                Added to every renewal
                              </span>
                              <span className="font-semibold tabular-nums text-foreground">
                                +{inr(cycleCost)}
                              </span>
                            </div>
                          </div>
                        )}

                        {pending > 0 && (
                          <Button
                            className="w-full"
                            disabled={busyKey === opt.featureKey}
                            onClick={() =>
                              buy(opt.featureKey, opt.label, targetQty)
                            }
                          >
                            {busyKey === opt.featureKey && (
                              <Loader2 className="size-4 animate-spin" />
                            )}
                            Add {pending * step} {opt.label.toLowerCase()}
                          </Button>
                        )}
                        {pending > 0 && (
                          <p className="text-center text-xs text-muted-foreground">
                            Charged pro-rata for the days left in this period,
                            then it bills alongside your plan.
                          </p>
                        )}

                        {owned && !owned.removeAtPeriodEnd && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => toggleRemoval(opt.featureKey, true)}
                          >
                            <Trash2 className="size-3.5" />
                            Remove at renewal
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
