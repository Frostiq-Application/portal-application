import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The confirmation shown after someone is invited.
 *
 * Every invite now goes out by email, so the headline is "we sent it" rather
 * than "here, copy this". The link is kept as a **fallback**, folded away
 * behind a link — an admin whose invitee reports nothing in their inbox can
 * still hand the link over directly, which is the one thing this screen used to
 * be good for and shouldn't lose. Showing it by default would just re-teach the
 * old habit of pasting links into WhatsApp.
 */
export function InviteSentPanel({
  email,
  token,
  note,
}: {
  email: string;
  /** The set-password token; the link is derived from it. */
  token: string;
  /** Overrides the default line under the address. */
  note?: string;
}) {
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/set-password?token=${token}`;

  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="py-2">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="size-4" />
        </div>
        <div className="min-w-0 text-sm">
          <p className="font-medium">Invite sent to {email}</p>
          <p className="mt-0.5 text-muted-foreground">
            {note ??
              "They'll set their own password from the link in the email. It expires in 7 days."}
          </p>
        </div>
      </div>

      {!showLink ? (
        <button
          type="button"
          onClick={() => setShowLink(true)}
          className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Didn&rsquo;t arrive? Copy the link instead
        </button>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label="Copy invite link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
