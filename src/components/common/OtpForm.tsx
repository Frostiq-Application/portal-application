import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiError } from "@/lib/apiError";
import {
  useRequestOtpMutation,
  useVerifyOtpMutation,
  type OtpPurpose,
  type OtpVerified,
} from "@/features/api/authApi";

/**
 * Enter-the-code step, shared by signup verification and password reset.
 *
 * One input rather than six boxes. Six-box widgets look tidier and behave worse
 * — paste, backspace across boundaries and mobile autofill all need special
 * handling, and each is a place to get it wrong. A single field with
 * `autocomplete="one-time-code"` lets the OS do the filling.
 *
 * The resend button is on a visible countdown because the server enforces a
 * 60-second cooldown; a button that just errors is worse than one that tells
 * you when it'll work.
 */
export function OtpForm({
  email,
  purpose,
  onVerified,
  initialCooldown = 60,
}: {
  email: string;
  purpose: OtpPurpose;
  onVerified: (result: OtpVerified) => void | Promise<void>;
  /** Seconds to block resend for on mount, matching the code already sent. */
  initialCooldown?: number;
}) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();
  const [requestOtp, { isLoading: resending }] = useRequestOtpMutation();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const complete = code.length === 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || verifying) return;
    try {
      const res = await verifyOtp({ email, purpose, code }).unwrap();
      await onVerified(res);
    } catch (err) {
      // The server says only "invalid or expired" on purpose — it won't reveal
      // which. Clearing the field saves a manual select-all before retrying.
      setCode("");
      toast.error(apiError(err, "That code didn't work. Try again."));
    }
  };

  const resend = async () => {
    try {
      const res = await requestOtp({ email, purpose }).unwrap();
      setCooldown(res.resendAfterSeconds);
      setCode("");
      toast.success(`New code sent to ${email}`);
    } catch (err) {
      toast.error(apiError(err, "Couldn't send another code just yet."));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        aria-label="6-digit code"
        className="h-14 text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em] placeholder:text-muted-foreground/40"
      />

      <Button type="submit" className="w-full" disabled={!complete || verifying}>
        {verifying && <Loader2 className="mr-2 size-4 animate-spin" />}
        Verify
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&rsquo;t get it?{" "}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
          >
            {resending ? "Sending…" : "Send another code"}
          </button>
        )}
      </p>
    </form>
  );
}
