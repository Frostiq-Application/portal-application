import { useState } from "react";
import { CakeSlice } from "@/components/ui/icons";
import { cn, formatDate } from "@/lib/utils";
import type { OrderCustomCake } from "@/types";
import { ImagePreviewDialog } from "@/components/custom-cake/ImagePreviewDialog";

/**
 * The custom cake brief, shown wherever a converted order is worked.
 *
 * A converted custom cake collapses into a single order line reading
 * "Custom Cake CC-…" with the weight and shape after it. That is the whole of
 * what the order carries, and it is nowhere near enough to bake from: the
 * sponge, the cream, the decorations, the message piped on top, the photo the
 * customer sent and — the one that matters most — the allergy note all live on
 * the request. A chef cannot go and read it there; the custom cake desk is a
 * different permission and, on some plans, a different add-on. So the brief
 * travels with the order, and this renders it.
 *
 * Two sizes for two rooms. `compact` is the admin drawer, read at a desk;
 * `floor` is the kitchen and delivery sheet, read across a bench with flour on
 * your hands, where the same facts are set at twice the size.
 */
export function CustomCakeBrief({
  cake,
  variant = "compact",
}: {
  cake: OrderCustomCake;
  variant?: "compact" | "floor";
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const floor = variant === "floor";

  const rows: [string, string | null][] = [
    ["Cake type", cake.cakeType],
    ["Weight", cake.weight],
    ["Shape", cake.shape],
    ["Occasion", cake.occasion],
    ["Theme", cake.theme],
    ["Sponge", cake.sponge],
    ["Cream", cake.cream],
    ["Filling", cake.filling],
    ["Flavour", cake.flavour],
    ["Colour", cake.colour],
    ["Decorations", cake.decorations.length ? cake.decorations.join(", ") : null],
    ["Topper", cake.topper],
    [
      "Needed",
      cake.neededDate
        ? `${formatDate(cake.neededDate)}${cake.neededTime ? ` · ${cake.neededTime}` : ""}`
        : null,
    ],
  ];
  const filled = rows.filter(([, v]) => v);

  return (
    <div
      className={cn(
        "rounded-2xl border border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30",
        floor ? "space-y-4 p-5" : "space-y-3 p-3",
      )}
    >
      <div className="flex items-center gap-2">
        <CakeSlice
          className={cn("shrink-0 text-rose-600", floor ? "size-6" : "size-4")}
        />
        <span
          className={cn(
            "font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300",
            floor ? "text-sm" : "text-xs",
          )}
        >
          Custom cake
        </span>
        <span
          className={cn(
            "ml-auto font-mono text-muted-foreground",
            floor ? "text-sm" : "text-xs",
          )}
        >
          {cake.requestNumber}
        </span>
      </div>

      {/* Reference photos — for a made-to-order cake this is the spec, not a
          decoration, so it sits above the text on both variants. */}
      {cake.referenceImageUrls.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {cake.referenceImageUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setPreviewIndex(i)}
                className="shrink-0 overflow-hidden rounded-xl border transition-opacity hover:opacity-80"
              >
                <img
                  src={url}
                  alt={`Reference ${i + 1}`}
                  className={cn("object-cover", floor ? "size-28" : "size-20")}
                />
              </button>
            ))}
          </div>
          <ImagePreviewDialog
            urls={cake.referenceImageUrls}
            index={previewIndex}
            onIndexChange={setPreviewIndex}
            onOpenChange={(o) => !o && setPreviewIndex(null)}
          />
        </>
      )}

      {filled.length > 0 && (
        <dl className={cn("grid gap-x-4", floor ? "gap-y-2 sm:grid-cols-2" : "gap-y-1.5")}>
          {filled.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt
                className={cn(
                  "text-muted-foreground",
                  floor ? "text-base" : "text-xs",
                )}
              >
                {label}
              </dt>
              <dd
                className={cn(
                  "text-right font-semibold",
                  floor ? "text-base" : "text-xs",
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {cake.cakeMessage && (
        <div className="rounded-xl bg-background/70 px-3 py-2">
          <p className={cn("text-muted-foreground", floor ? "text-sm" : "text-[11px]")}>
            Message on cake
          </p>
          <p className={cn("font-semibold", floor ? "text-lg" : "text-sm")}>
            “{cake.cakeMessage}”
          </p>
        </div>
      )}

      {cake.specialInstructions && (
        <p className={cn(floor ? "text-base" : "text-xs")}>
          <span className="font-semibold">Instructions:</span>{" "}
          {cake.specialInstructions}
        </p>
      )}

      {/* Allergies are never folded into the general note block: this is the
          one line on the screen where being missed hurts someone. */}
      {cake.allergyInfo && (
        <p
          className={cn(
            "rounded-xl bg-red-600 px-3 py-2 font-bold text-white",
            floor ? "text-lg" : "text-xs",
          )}
        >
          Allergy: {cake.allergyInfo}
        </p>
      )}
    </div>
  );
}

/** One-line "this is a custom cake" marker for list rows and board cards. */
export function CustomCakeTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300",
        className,
      )}
    >
      <CakeSlice className="size-3" />
      Custom
    </span>
  );
}
