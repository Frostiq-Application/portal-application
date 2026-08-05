/**
 * Password strength, scored against the rule the API actually enforces:
 * 8 characters or more, with at least one letter and one number.
 *
 * Anything below that is rejected on submit, so the meter never calls it
 * acceptable — the extra levels above it are about how much better than the
 * minimum a password is, not whether it will be taken.
 */
export interface PasswordStrength {
  /** 0 (empty) to 4 (strong). Drives how much of the bar is filled. */
  score: 0 | 1 | 2 | 3 | 4;
  /** Short word for the current score, or "" while the field is empty. */
  label: string;
  /** True once the API's rule is satisfied. */
  meetsMinimum: boolean;
  /** The single most useful next step, or null once there's nothing to add. */
  hint: string | null;
}

const LABELS = ["", "Too weak", "Fair", "Good", "Strong"] as const;

export function passwordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "",
      meetsMinimum: false,
      hint: "8 characters minimum, with at least one letter and one number.",
    };
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const meetsMinimum = password.length >= 8 && hasLetter && hasNumber;

  // Everything that clears the bar starts at "Fair"; length, mixed case and a
  // symbol are what lift it from there.
  let score: PasswordStrength["score"] = 1;
  if (meetsMinimum) {
    const extras = [password.length >= 12, hasMixedCase, hasSymbol].filter(
      Boolean,
    ).length;
    score = (2 + Math.min(2, extras)) as 2 | 3 | 4;
  }

  const hint = !hasLetter
    ? "Add a letter."
    : !hasNumber
      ? "Add a number."
      : password.length < 8
        ? "A little longer, 8 characters minimum."
        : score < 4
          ? "Longer, or add a capital or symbol, to make it stronger."
          : null;

  return { score, label: LABELS[score], meetsMinimum, hint };
}
