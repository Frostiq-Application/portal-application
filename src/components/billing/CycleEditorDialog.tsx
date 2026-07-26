import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/ui/icons";
import { useUpsertCycleMutation } from "@/features/api/billingAdminApi";
import { inrShort } from "@/lib/billing";
import { slugify } from "@/lib/utils";
import type { BillingCycle } from "@/types/billing";
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
import { Label } from "@/components/ui/label";

/**
 * Billing-cycle editor (SA-10).
 *
 * A cycle is genuinely just two numbers, and the live preview makes the whole
 * pricing model legible: months, months free, and therefore the multiplier
 * every plan's price gets. No percentages anywhere — the structural discount is
 * always months free, so it can never stack with itself.
 */
export function CycleEditorDialog({
  open,
  onOpenChange,
  cycle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a new cycle; pass a row to edit it. */
  cycle?: BillingCycle | null;
}) {
  const editing = cycle != null;
  const [upsert, { isLoading }] = useUpsertCycleMutation();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [months, setMonths] = useState("3");
  const [freeMonths, setFreeMonths] = useState("0");
  const [displayOrder, setDisplayOrder] = useState("0");

  useEffect(() => {
    if (!open) return;
    setCode(cycle?.code ?? "");
    setName(cycle?.name ?? "");
    setMonths(String(cycle?.months ?? 3));
    setFreeMonths(String(cycle?.freeMonths ?? 0));
    setDisplayOrder(String(cycle?.displayOrder ?? 0));
  }, [open, cycle]);

  const m = Number(months) || 0;
  const f = Number(freeMonths) || 0;
  const payable = Math.max(0, m - f);
  const invalid = m < 1 || f >= m;

  async function handleSave() {
    if (invalid) {
      toast.error("Free months must be fewer than the total months.");
      return;
    }
    try {
      await upsert({
        // The code is the primary key, so an edit keeps it verbatim; only a
        // new cycle derives one from the name.
        code: editing ? cycle!.code : slugify(code || name).replace(/-/g, "_"),
        name: name.trim() || `${m} months`,
        months: m,
        freeMonths: f,
        displayOrder: Number(displayOrder) || 0,
        isActive: cycle?.isActive ?? true,
      }).unwrap();
      toast.success(
        editing
          ? `${name} saved. New prices apply to future checkouts; live subscriptions keep the length they bought.`
          : `${name || code} added. It's available at checkout now.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't save that cycle.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${cycle!.name}` : "New billing cycle"}
          </DialogTitle>
          <DialogDescription>
            Total months plus free months. Every plan picks this up
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Display name</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="3 months"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-code">Code</Label>
              <Input
                id="c-code"
                value={code}
                disabled={editing}
                onChange={(e) => setCode(e.target.value)}
                placeholder="quarterly"
                className="font-mono text-sm"
              />
              {editing && (
                <p className="text-xs text-muted-foreground">
                  Live subscriptions reference this, so it can't change.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-months">Total months</Label>
              <Input
                id="c-months"
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-free">Free months</Label>
              <Input
                id="c-free"
                inputMode="numeric"
                value={freeMonths}
                onChange={(e) => setFreeMonths(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-order">Order</Label>
              <Input
                id="c-order"
                inputMode="numeric"
                value={displayOrder}
                onChange={(e) =>
                  setDisplayOrder(e.target.value.replace(/\D/g, ""))
                }
              />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            {invalid ? (
              <p className="mt-2 text-sm text-destructive">
                Free months must be fewer than the total months.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm">
                  Customers get <strong>{m} months</strong> and pay for{" "}
                  <strong>{payable}</strong> —{" "}
                  <strong className="tabular-nums">{payable}×</strong> the
                  monthly price.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <span className="text-muted-foreground">
                    ₹1,499/mo → {inrShort(1499 * payable)}
                  </span>
                  <span className="text-muted-foreground">
                    ₹2,499/mo → {inrShort(2499 * payable)}
                  </span>
                  <span className="text-muted-foreground">
                    ₹5,999/mo → {inrShort(5999 * payable)}
                  </span>
                </div>
              </>
            )}
          </div>

          {editing && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Changing the length or free months affects{" "}
              <strong>future</strong> checkouts and renewals only. Anyone
              mid-period keeps the term and price they bought — the engine
              re-reads this at each renewal, never inside a paid period.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || invalid}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save cycle" : "Add cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
