import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Receipt, ShieldCheck, Timer, Trash2 } from "@/components/ui/icons";
import {
  useBillingSettingsQuery,
  useDeleteReadyAccountsQuery,
  useHardDeleteAccountDataMutation,
  useUpdateBillingSettingsMutation,
} from "@/features/api/billingAdminApi";
import { INDIAN_STATE_LIST } from "@/lib/states";
import { inr } from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import type { BillingSettings } from "@/types/billing";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Draft = Partial<BillingSettings>;

/**
 * Every field on this page changes real money or a real deadline, and several
 * are only meaningful if you already know the billing model. So each one says
 * plainly what it does and what happens if you change it — no field is left to
 * be inferred from its label.
 */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

/**
 * Billing configuration (SA-13/14/17).
 *
 * Every "magic number" in the module lives on this page — grace windows, lock
 * duration, retry schedule, GST, fee pass-through. That's the point:
 * **configuration over code**, so launch parameters can move without a deploy.
 *
 * Each field carries its own explanation. These settings change what real
 * bakeries are charged and when their storefronts go dark, and none of that is
 * inferable from a label like "Locked days".
 */
export function BillingSettingsPage() {
  const { data, isLoading } = useBillingSettingsQuery();
  const [update, { isLoading: saving }] = useUpdateBillingSettingsMutation();
  const { data: deleteReady } = useDeleteReadyAccountsQuery();
  const [hardDelete, { isLoading: deleting }] =
    useHardDeleteAccountDataMutation();

  const [draft, setDraft] = useState<Draft>({});
  const [confirmTarget, setConfirmTarget] = useState<{
    accountId: string;
    accountName: string;
  } | null>(null);
  const [typedName, setTypedName] = useState("");

  // Seeded during render rather than in an effect, so the form shows the saved
  // settings on the paint they arrive instead of one frame later.
  const [seeded, setSeeded] = useState<typeof data>(undefined);
  if (data && data !== seeded) {
    setSeeded(data);
    setDraft(data);
  }

  const set = <K extends keyof BillingSettings>(
    key: K,
    value: BillingSettings[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const num = (v: string) => v.replace(/[^\d.]/g, "");

  async function save() {
    try {
      await update({
        gstEnabled: draft.gstEnabled,
        gstin: draft.gstin?.trim() || null,
        gstRate: draft.gstRate != null ? Number(draft.gstRate) : undefined,
        legalName: draft.legalName,
        legalAddress: draft.legalAddress ?? null,
        homeState: draft.homeState,
        invoicePrefix: draft.invoicePrefix,
        graceDaysTrial: Number(draft.graceDaysTrial),
        graceDaysPayment: Number(draft.graceDaysPayment),
        lockedDays: Number(draft.lockedDays),
        archiveDays: Number(draft.archiveDays),
        retryDays: draft.retryDays,
        passGatewayFee: draft.passGatewayFee,
        gatewayFeePercent:
          draft.gatewayFeePercent != null
            ? Number(draft.gatewayFeePercent)
            : undefined,
        mandateAutoDebitLimit:
          draft.mandateAutoDebitLimit != null
            ? Number(draft.mandateAutoDebitLimit)
            : undefined,
      } as never).unwrap();
      toast.success("Billing settings saved.");
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't save those settings.",
      );
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing settings" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const gstReady = Boolean(draft.gstin?.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing settings"
        description="GST, invoicing, dunning timings and the data-retention lifecycle. Every value here is read at runtime. No deploy needed."
        actions={
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        }
      />

      <Tabs defaultValue="gst">
        <TabsList>
          <TabsTrigger value="gst">GST & invoicing</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="retention">Data retention</TabsTrigger>
        </TabsList>

        {/* ================================================== GST ========== */}
        <TabsContent value="gst" className="mt-4 space-y-4">
          {!gstReady && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 py-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong className="font-semibold">
                    GST stays off until a GSTIN is configured.
                  </strong>{" "}
                  Invoices are issued as simple receipts in the meantime, and
                  everything else works normally. Add the GSTIN and flip the
                  toggle on the day registration completes.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4" />
                GST
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="gst-on" className="font-medium">
                    Charge GST on invoices
                  </Label>
                  <Hint>
                    Off means invoices go out as plain receipts with no tax
                    lines, which is correct until registration completes.
                    Turning it on starts adding GST to every new charge; issued
                    invoices are frozen and never change. Needs a GSTIN below
                    first.
                  </Hint>
                </div>
                <Switch
                  id="gst-on"
                  checked={draft.gstEnabled ?? false}
                  disabled={!gstReady}
                  onCheckedChange={(v) => set("gstEnabled", v)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">Pronttera GSTIN</Label>
                  <Input
                    id="gstin"
                    maxLength={15}
                    value={draft.gstin ?? ""}
                    onChange={(e) =>
                      set("gstin", e.target.value.toUpperCase() as never)
                    }
                    placeholder="27AAPFU0939F1ZV"
                  />
                  <Hint>
                    Pronttera's own 15-character GST registration number. It's
                    printed on every invoice as the seller's GSTIN, and GST
                    can't be switched on without it.
                  </Hint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gst-rate">Tax rate (%)</Label>
                  <Input
                    id="gst-rate"
                    inputMode="decimal"
                    value={String(draft.gstRate ?? 18)}
                    onChange={(e) => set("gstRate", num(e.target.value) as never)}
                  />
                  <Hint>
                    Applied to plan, add-on and gateway-fee amounts on every
                    charge. Split half-and-half into CGST + SGST for buyers in
                    your home state, or charged as a single IGST line otherwise.
                    Changing it affects future invoices only. Issued ones are
                    frozen.
                  </Hint>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="legal-name">Legal name</Label>
                  <Input
                    id="legal-name"
                    value={draft.legalName ?? ""}
                    onChange={(e) => set("legalName", e.target.value)}
                  />
                  <Hint>
                    The registered entity name that appears as the seller on
                    invoices. Use the name on your GST certificate, not the
                    brand name.
                  </Hint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="home-state">Home state</Label>
                  <Select
                    value={draft.homeState ?? "Maharashtra"}
                    onValueChange={(v) => set("homeState", v)}
                  >
                    <SelectTrigger id="home-state" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {INDIAN_STATE_LIST.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Hint>
                    The state you're registered in. It decides the tax split on
                    every invoice: a bakery billing from the same state is
                    charged CGST + SGST, anyone else gets a single IGST line.
                    Get this wrong and the split on every invoice is wrong.
                  </Hint>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="legal-address">Invoice header address</Label>
                <Textarea
                  id="legal-address"
                  rows={2}
                  value={draft.legalAddress ?? ""}
                  onChange={(e) => set("legalAddress", e.target.value as never)}
                />
                <Hint>
                  Your registered place of business, printed under the seller
                  name on every invoice.
                </Hint>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                Invoice numbering
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prefix">Prefix</Label>
                <Input
                  id="prefix"
                  value={draft.invoicePrefix ?? "FRQ-"}
                  onChange={(e) => set("invoicePrefix", e.target.value)}
                />
                <Hint>
                  Prepended to every invoice number. Changing it does not
                  renumber anything already issued, so the series simply
                  continues under the new prefix from the next invoice.
                </Hint>
              </div>
              <div className="space-y-1.5">
                <Label>Next number</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
                  {draft.invoicePrefix ?? "FRQ-"}
                  {new Date().getFullYear()}-
                  {String((data.invoiceCounter ?? 0) + 1).padStart(6, "0")}
                </div>
                <Hint>
                  What the next invoice will be numbered. The counter is
                  deliberately read-only: GST requires the series to be
                  sequential with no gaps, so it is incremented under a database
                  lock at the moment an invoice is issued and can't be nudged by
                  hand.
                </Hint>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================== lifecycle ======== */}
        <TabsContent value="lifecycle" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="size-4" />
                Lifecycle timings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="graceDaysPayment">
                    Grace after a failed payment (days)
                  </Label>
                  <Input
                    id="graceDaysPayment"
                    inputMode="numeric"
                    value={String(draft.graceDaysPayment ?? "")}
                    onChange={(e) =>
                      set(
                        "graceDaysPayment",
                        Number(e.target.value.replace(/\D/g, "")) as never,
                      )
                    }
                  />
                  <Hint>
                    How long a shop keeps trading after a renewal fails. The
                    storefront stays <strong>live</strong> the whole time, on
                    purpose, so a card problem never strands an order a customer
                    already placed. Retries run during this window.
                  </Hint>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lockedDays">Lock period (days)</Label>
                  <Input
                    id="lockedDays"
                    inputMode="numeric"
                    value={String(draft.lockedDays ?? "")}
                    onChange={(e) =>
                      set(
                        "lockedDays",
                        Number(e.target.value.replace(/\D/g, "")) as never,
                      )
                    }
                  />
                  <Hint>
                    After grace runs out, how long the storefront stays offline
                    before the subscription cancels itself. The owner can still
                    log in and pay throughout, and paying restores everything
                    instantly.
                  </Hint>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="archiveDays">
                    Keep data after cancellation (days)
                  </Label>
                  <Input
                    id="archiveDays"
                    inputMode="numeric"
                    value={String(draft.archiveDays ?? "")}
                    onChange={(e) =>
                      set(
                        "archiveDays",
                        Number(e.target.value.replace(/\D/g, "")) as never,
                      )
                    }
                  />
                  <Hint>
                    How long a cancelled account's catalogue, orders and
                    customers are kept before it is <em>flagged</em> for
                    deletion. Nothing is ever deleted automatically. The flag
                    just makes it eligible for the manual Delete fully action on
                    the Data retention tab.
                  </Hint>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="graceDaysTrial">
                    Legacy trial grace (days)
                  </Label>
                  <Input
                    id="graceDaysTrial"
                    inputMode="numeric"
                    value={String(draft.graceDaysTrial ?? "")}
                    onChange={(e) =>
                      set(
                        "graceDaysTrial",
                        Number(e.target.value.replace(/\D/g, "")) as never,
                      )
                    }
                  />
                  <Hint>
                    Only affects accounts still on an old time-limited trial.
                    The Free tier replaced trials, so nothing new ever enters
                    this state. Leave it as-is unless you are winding those
                    accounts down.
                  </Hint>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="retry">Dunning retry schedule</Label>
                <Input
                  id="retry"
                  value={(draft.retryDays ?? []).join(", ")}
                  onChange={(e) =>
                    set(
                      "retryDays",
                      e.target.value
                        .split(",")
                        .map((s) => Number(s.trim()))
                        .filter((n) => Number.isFinite(n) && n > 0) as never,
                    )
                  }
                  placeholder="1, 3, 5, 7"
                />
                <Hint>
                  Days after a failed renewal on which to retry the auto-debit,
                  comma separated. Each attempt is recorded as its own row in
                  billing history with its failure reason, and the shop is
                  emailed every time. Only applies to accounts with autopay.
                  Manual payers just get the pay link.
                </Hint>
              </div>

              {/* The whole failure path in one sentence — easier to sanity-check
                  than four numbers in separate boxes. */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">In practice:</strong> a
                renewal fails → the shop keeps trading for{" "}
                {draft.graceDaysPayment ?? 7} days while{" "}
                {(draft.retryDays ?? []).length} retries run → the storefront
                goes offline for {draft.lockedDays ?? 15} days (owner can still
                pay) → the subscription cancels → data is kept a further{" "}
                {draft.archiveDays ?? 90} days, then flagged for manual
                deletion. Total from first failure to eligible-for-deletion:{" "}
                <strong className="text-foreground">
                  {(draft.graceDaysPayment ?? 7) +
                    (draft.lockedDays ?? 15) +
                    (draft.archiveDays ?? 90)}{" "}
                  days
                </strong>
                .
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =============================================== payments ======== */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" />
                Payments & mandates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="pass-fee" className="font-medium">
                    Pass the gateway fee to the account
                  </Label>
                  <Hint>
                    On: the gateway's cut is added to the bakery's bill as a
                    visible line item. Off: you absorb it and the bakery pays
                    exactly the plan price. Either is fine, but the line is
                    always shown before payment, never hidden in the total.
                  </Hint>
                </div>
                <Switch
                  id="pass-fee"
                  checked={draft.passGatewayFee ?? true}
                  onCheckedChange={(v) => set("passGatewayFee", v)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fee-pct">Gateway fee (%)</Label>
                  <Input
                    id="fee-pct"
                    inputMode="decimal"
                    value={String(draft.gatewayFeePercent ?? 2)}
                    onChange={(e) =>
                      set("gatewayFeePercent", num(e.target.value) as never)
                    }
                  />
                  <Hint>
                    What you add on top of every charge to cover Razorpay's cut.
                    Only applied when the pass-through switch above is on, and
                    it shows as its own line at checkout so nothing is hidden.
                    Set it to roughly your real blended rate. UPI is usually
                    near zero, cards are not.
                  </Hint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mandate-limit">
                    Auto-debit ceiling (₹)
                  </Label>
                  <Input
                    id="mandate-limit"
                    inputMode="decimal"
                    value={String(draft.mandateAutoDebitLimit ?? 15000)}
                    onChange={(e) =>
                      set("mandateAutoDebitLimit", num(e.target.value) as never)
                    }
                  />
                  <Hint>
                    The RBI ceiling for automatic recurring debits. At or below
                    it, an autopay mandate charges silently; above it, the
                    bakery has to approve each debit with a UPI PIN, so the
                    renewal waits for them. ₹15,000 is the operative figure for
                    SaaS. The higher ₹1,00,000 tier covers insurance, mutual
                    funds and credit-card bills, not us. Raising it past ₹15,000
                    will not make debits succeed; the bank still refuses.
                  </Hint>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">At today's prices:</strong>{" "}
                with the ceiling at {inr(draft.mandateAutoDebitLimit ?? 15000)},
                a yearly Growth (₹24,990) or Pro (₹29,995+) renewal lands above
                it and will ask the bakery to approve each debit. Everything
                monthly, and Starter yearly, auto-debits silently. Either way the
                RBI pre-debit notice goes out at least 24 hours beforehand.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================== retention ======== */}
        <TabsContent value="retention" className="mt-4 space-y-4">
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trash2 className="size-4 text-destructive" />
                Delete-ready accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Accounts that cancelled more than{" "}
                {draft.archiveDays ?? 90} days ago, set by "Keep data after
                cancellation" on the Lifecycle tab. Nothing here has been
                deleted. <strong>Nothing ever is, automatically</strong>. This
                list is just what has become <em>eligible</em>. Deleting drops
                the account's entire tenant schema; it is manual, irreversible
                and recorded against your name in the audit log.
              </p>

              {(deleteReady ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No accounts are eligible for deletion.
                </p>
              ) : (
                <div className="space-y-2">
                  {deleteReady!.map((a) => (
                    <div
                      key={a.subscriptionId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{a.accountName}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.ownerEmail} · cancelled{" "}
                          {formatDate(a.cancelledAt)} · eligible since{" "}
                          {formatDate(a.deleteReadyAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setConfirmTarget({
                            accountId: a.accountId,
                            accountName: a.accountName,
                          });
                          setTypedName("");
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete fully
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- hard-delete confirmation (SA-17) ----------------------------- */}
      <Dialog
        open={confirmTarget != null}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Permanently delete {confirmTarget?.accountName}?
            </DialogTitle>
            <DialogDescription>
              This destroys the account's entire tenant schema: catalogue,
              orders, customers, everything. It cannot be undone, and it will be
              recorded against your name in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <Badge variant="outline">{confirmTarget?.accountName}</Badge>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleting || typedName.trim() !== confirmTarget?.accountName
              }
              onClick={async () => {
                if (!confirmTarget) return;
                try {
                  await hardDelete({
                    accountId: confirmTarget.accountId,
                    confirmAccountName: typedName.trim(),
                  }).unwrap();
                  toast.success(
                    `${confirmTarget.accountName}'s data has been permanently deleted.`,
                  );
                  setConfirmTarget(null);
                } catch (err) {
                  toast.error(
                    (err as { data?: { message?: string } })?.data?.message ??
                      "Couldn't delete that account. Nothing was removed.",
                  );
                }
              }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
