import { useState } from "react";
import { toast } from "sonner";
import { Cake, Loader2, Sparkles } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useSeedStarterCatalogMutation } from "@/features/api/catalogApi";

/**
 * The one-click way out of an empty catalogue.
 *
 * A new shop's first screen is a table with nothing in it and a button that
 * opens a nine-field form — which is where most trials quietly stop. Seeding a
 * handful of editable placeholders turns the first task from "build a
 * catalogue" into "change a price", and the shop can take an order before the
 * owner has taken a single photograph.
 *
 * Only rendered on a genuinely empty branch: the server refuses to seed over
 * existing products, so offering it later would be a button that always fails.
 */
export function StarterCatalogCard({ shopId }: { shopId: string }) {
  const [seed, { isLoading }] = useSeedStarterCatalogMutation();
  // Hidden on success rather than left as a dead control — the list behind it
  // is about to repopulate, and the offer no longer applies.
  const [done, setDone] = useState(false);

  if (done) return null;

  async function handleSeed() {
    try {
      const res = await seed({ shopId }).unwrap();
      setDone(true);
      toast.success(
        `Added ${res.created} starter cake${res.created === 1 ? "" : "s"}. Edit them to match what you bake.`,
      );
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't add the starter cakes.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed bg-muted/30 p-5">
      <span className="rounded-lg bg-primary/10 p-2.5 text-primary">
        <Cake className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Start with five cakes</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          We'll add five common cakes with sizes and prices already filled in.
          Rename them, change the prices, add your own photos, or delete the
          ones you don't make.
        </p>
      </div>
      <Button onClick={handleSeed} disabled={isLoading} className="shrink-0">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        Add starter cakes
      </Button>
    </div>
  );
}
