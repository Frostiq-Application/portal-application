import { cn } from "@/lib/utils";
import { passwordStrength } from "@/lib/password";

/** Bar colour and matching text colour per score. Index 0 is the empty field. */
const TONES = [
  { bar: "bg-muted", text: "text-muted-foreground" },
  { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { bar: "bg-lime-500", text: "text-lime-700 dark:text-lime-400" },
  { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
] as const;

const SEGMENTS = [1, 2, 3, 4];

interface Props {
  password: string;
  className?: string;
}

/**
 * Four segments that fill and change colour as the password gets stronger,
 * with the verdict and the one thing worth fixing spelled out underneath.
 * Colour alone would leave the meter unreadable for anyone who can't tell
 * the two ends of it apart, so the word carries the same information.
 */
export function PasswordStrengthMeter({ password, className }: Props) {
  const { score, label, hint } = passwordStrength(password);
  const tone = TONES[score];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label || "Empty"}
        className="flex gap-1.5"
      >
        {SEGMENTS.map((segment) => (
          <div
            key={segment}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              segment <= score ? tone.bar : "bg-muted",
            )}
          />
        ))}
      </div>

      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
        {label && <span className={cn("font-medium", tone.text)}>{label}</span>}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </p>
    </div>
  );
}
