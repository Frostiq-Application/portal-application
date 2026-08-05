import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/ui/icons";
import { useUpsertAccountOverrideMutation } from "@/features/api/billingAdminApi";
import type { AccountEntitlementRow } from "@/types/billing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * Capture the *why* before an exception is written.
 *
 * The reason is mandatory on purpose. These grants are permanent by default and
 * outlive whoever made them — six months on, at a renewal or an upgrade
 * conversation, "why does this account have Pro analytics on a Growth plan?"
 * needs an answer that isn't a guess.
 */
export function GrantOverrideDialog({
  accountId,
  row,
  targetEnabled,
  onOpenChange,
}: {
  accountId: string;
  row: AccountEntitlementRow | null;
  /** Boolean features: the state the admin just switched to. */
  targetEnabled: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [upsert, { isLoading }] = useUpsertAccountOverrideMutation();

  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [bonus, setBonus] = useState("");
  const [unlimited, setUnlimited] = useState(false);

  // Seed during render, not in an effect, so the fields are right on first
  // paint instead of flashing the previous feature's values.
  const seedKey = row ? `${row.key}:${targetEnabled}` : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setReason(row?.override?.reason ?? "");
    setExpiresAt(row?.override?.expiresAt?.slice(0, 10) ?? "");
    setBonus(
      row?.override?.bonusValue != null ? String(row.override.bonusValue) : "",
    );
    setUnlimited(row?.override?.isUnlimited ?? false);
  }

  const isCount = row?.dataType === "count";

  async function handleSave() {
    if (!row) return;
    if (!reason.trim()) {
      toast.error("Say why this exception exists.");
      return;
    }
    if (isCount && !unlimited && (!bonus || Number(bonus) <= 0)) {
      toast.error("Give the extra units, or switch on unlimited.");
      return;
    }

    try {
      await upsert({
        accountId,
        featureKey: row.key,
        body: {
          ...(isCount
            ? {
                bonusValue: unlimited ? null : Number(bonus),
                isUnlimited: unlimited,
              }
            : { enabled: targetEnabled }),
          reason: reason.trim(),
          // A date input means "through the end of that day" to the person
          // typing it, so the grant is held open until the day is actually over.
          expiresAt: expiresAt
            ? new Date(`${expiresAt}T23:59:59`).toISOString()
            : null,
        },
      }).unwrap();
      toast.success(`${row.label} updated for this account.`);
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Couldn't save that override.";
      toast.error(message);
    }
  }

  const revoking = !isCount && !targetEnabled;

  return (
    <Dialog open={row != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCount
              ? `Extra ${row?.label.toLowerCase()}`
              : revoking
                ? `Revoke ${row?.label}`
                : `Grant ${row?.label}`}
          </DialogTitle>
          <DialogDescription>
            {isCount
              ? "Extra capacity on top of the plan and anything already bought. It rides along through plan changes, so an upgrade adds to it rather than replacing it."
              : revoking
                ? "This account keeps its plan, but loses this capability. It won't be told why. To them it reads like anything else their plan doesn't include."
                : "This account gets the capability without moving to the plan that sells it. Its price and limits don't change."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCount && (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Unlimited</Label>
                  <p className="text-xs text-muted-foreground">
                    No ceiling for this account.
                  </p>
                </div>
                <Switch checked={unlimited} onCheckedChange={setUnlimited} />
              </div>
              {!unlimited && (
                <div className="space-y-1.5">
                  <Label htmlFor="grant-bonus">Extra units</Label>
                  <Input
                    id="grant-bonus"
                    type="number"
                    min={1}
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    placeholder="e.g. 2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Added to the plan's {row?.planUnlimited ? "unlimited" : (row?.planValue ?? 0)}
                    {(row?.addonValue ?? 0) > 0 && ` and the ${row?.addonValue} bought`}.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="grant-reason">Reason</Label>
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Closed the Growth deal on condition of keeping Pro analytics."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-expiry">Expires</Label>
            <DatePicker
              id="grant-expiry"
              className="w-full"
              placeholder="No expiry"
              value={expiresAt}
              onChange={setExpiresAt}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to make it permanent.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={isLoading}
            variant={revoking ? "destructive" : "default"}
            onClick={() => void handleSave()}
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {revoking ? "Revoke" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
