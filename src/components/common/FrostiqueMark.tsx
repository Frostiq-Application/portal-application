import { cn } from "@/lib/utils";

/**
 * The Frostique product mark — the same cake-slice icon the tab favicon and the
 * landing site use, so the brand reads the same on every surface.
 *
 * It is served from `/public`, not bundled, because it is also the favicon: one
 * file, one cache entry, no second copy to keep in step.
 *
 * The art is full-colour on transparency, so unlike the generic glyph it used
 * to replace it gets no tinted background plate — that would fight the artwork.
 * Sizing is the caller's job, via `className`.
 */
export function FrostiqueMark({ className }: { className?: string }) {
  return (
    <img
      src="/favicon-512.png"
      alt=""
      aria-hidden
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
