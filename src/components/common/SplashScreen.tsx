import { useState } from "react";
import { cn } from "@/lib/utils";

/** The animated cake, dropped into /public. See the fallback note below. */
const LOADING_GIF = "/loading.gif";
/** Same artwork, still — already in /public as the favicon. */
const LOADING_FALLBACK = "/favicon-512.png";

interface Props {
  /** Headline under the mark. */
  title?: string;
  /** One quieter line under that. */
  message?: string;
  /** Fill the parent instead of the viewport — for panels, not boot. */
  inline?: boolean;
  className?: string;
}

/**
 * The screen someone stares at before the app can show them anything.
 *
 * It was the word "Loading…" in muted grey, which reads as a page that failed
 * to render rather than one that is working. This is the brand mark in a round
 * medallion, breathing, with rings leaving it — so a slow first load still
 * looks alive.
 *
 * The mark falls back to the static favicon if `/public/loading.gif` isn't
 * there, so the screen is never a broken image, and picks the animation up the
 * moment the file lands.
 */
export function SplashScreen({
  title = "Getting things ready",
  message = "One moment while we load your bakery.",
  inline = false,
  className,
}: Props) {
  const [src, setSrc] = useState(LOADING_GIF);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-6 bg-background px-6 text-center",
        inline ? "h-full w-full py-16" : "min-h-screen",
        className,
      )}
    >
      <div className="relative flex size-32 items-center justify-center">
        {/* Two rings, offset in time, so there is always one on its way out. */}
        <span
          aria-hidden
          className="absolute size-24 rounded-full bg-primary/15 motion-reduce:hidden animate-splash-ring"
        />
        <span
          aria-hidden
          className="absolute size-24 rounded-full bg-primary/15 motion-reduce:hidden animate-splash-ring [animation-delay:1.3s]"
        />

        <div className="relative size-24 overflow-hidden rounded-full border border-border/60 bg-card shadow-lg shadow-primary/10 animate-splash-bob motion-reduce:animate-none">
          <img
            src={src}
            alt=""
            aria-hidden
            onError={() => setSrc(LOADING_FALLBACK)}
            className="size-full rounded-full object-contain p-2.5"
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{message}</p>
      </div>

      {/* An indeterminate track: no fake percentage, just visible movement. */}
      <div aria-hidden className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <span className="block h-full w-1/3 rounded-full bg-primary/70 animate-splash-track motion-reduce:hidden" />
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
