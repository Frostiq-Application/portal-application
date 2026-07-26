import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Building2, Check, Clock, CreditCard, Handshake, Loader2, Mail, MessageCircle, Phone, Rocket, Sparkles, Store } from "@/components/ui/icons";
import { useSubmitEnquiryMutation } from "@/features/api/queriesApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * What someone is stuck on, mapped to the enquiry types the backend already
 * understands. Picking a topic isn't decoration — it routes the callback to
 * whoever can actually answer it.
 */
const TOPICS = [
  {
    id: "setup",
    type: "general" as const,
    Icon: Store,
    title: "Setting up my shop",
    description: "Branches, catalogue or branding.",
  },
  {
    id: "plan",
    type: "custom_quote" as const,
    Icon: CreditCard,
    title: "Choosing a plan",
    description: "Which one fits my shop?",
  },
  {
    id: "demo",
    type: "demo" as const,
    Icon: Rocket,
    title: "Book a demo",
    description: "Walk me through it.",
  },
  {
    id: "billing",
    type: "general" as const,
    Icon: Building2,
    title: "Billing & invoices",
    description: "GST, payments or receipts.",
  },
  {
    id: "partnership",
    type: "partnership" as const,
    Icon: Handshake,
    title: "Partnership",
    description: "Let's work together.",
  },
  {
    id: "other",
    type: "other" as const,
    Icon: Sparkles,
    title: "Something else",
    description: "We're here to help!",
  },
];

/** A hairline-separated block in the contact rail. */
function ContactBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b py-5 first:pt-0 last:border-b-0 last:pb-0">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

/**
 * The help panel behind "Contact us".
 *
 * Two columns on purpose: the left is every way to reach a human *right now*,
 * the right is a callback request for when nobody wants to start a
 * conversation. A support dialog that only offers a form is useless to someone
 * stuck and impatient — and one that only lists an inbox is useless to someone
 * mid-setup at 11pm.
 *
 * The form posts a real enquiry, so a submitted request actually reaches the
 * office rather than pretending to.
 */
export function ContactSupportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { entitlements } = useEntitlements();
  const support = entitlements?.support;
  const [submit, { isLoading }] = useSubmitEnquiryMutation();

  const [topic, setTopic] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const chosen = TOPICS.find((t) => t.id === topic);
  const phoneValid = phone.replace(/\D/g, "").length >= 10;

  const reset = () => {
    setTopic(null);
    setPhone("");
    setSent(false);
  };

  async function send() {
    if (!chosen || !phoneValid) return;
    try {
      await submit({ phone: phone.trim(), type: chosen.type }).unwrap();
      setSent(true);
    } catch (err) {
      const message = (err as { data?: { message?: string | string[] } })?.data
        ?.message;
      toast.error(
        message
          ? Array.isArray(message)
            ? message.join(", ")
            : message
          : "Couldn't send that. Try emailing us instead.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      {/* The shell is padded and tinted so the contact rail can sit inside it
          as its own raised card, rather than as a flat coloured gutter. */}
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl bg-background p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">Contact support</DialogTitle>

        <div className="grid md:grid-cols-[300px_1fr]">
          {/* ---- reach a human now ------------------------------------- */}
          <aside className="flex flex-col border-b p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-4" />
              </span>
              <span className="font-semibold tracking-tight">Frostique</span>
            </div>

            <div className="mt-6">
              {support?.email && (
                <ContactBlock
                  title="Email support"
                  description="We'll get back to you within one working day."
                >
                  <a
                    href={`mailto:${support.email}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
                  >
                    <Mail className="size-3.5" />
                    {support.email}
                  </a>
                </ContactBlock>
              )}

              {support?.whatsapp && (
                <ContactBlock
                  title="WhatsApp"
                  description="Fastest for a quick question."
                >
                  <a
                    href={`https://wa.me/${support.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
                  >
                    <MessageCircle className="size-3.5" />
                    {support.whatsapp}
                    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 no-underline dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  </a>
                </ContactBlock>
              )}

              <ContactBlock
                title="Call us"
                description={
                  support?.whatsapp
                    ? "Mon – Sat, 10:00 AM – 7:00 PM (IST)."
                    : "Leave your number and we'll ring you back, Mon – Sat, 10:00 AM – 7:00 PM (IST)."
                }
              >
                {support?.whatsapp && (
                  <a
                    href={`tel:${support.whatsapp.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
                  >
                    <Phone className="size-3.5" />
                    {support.whatsapp}
                  </a>
                )}
              </ContactBlock>
            </div>

            <p className="mt-6 flex items-start gap-2 rounded-lg border bg-muted p-3 text-xs text-muted-foreground">
              <Clock className="mt-px size-3.5 shrink-0" />
              Setting up out of hours? Leave a request anyway — it's first in
              the queue the next morning.
            </p>
          </aside>

          {/* ---- request a callback ------------------------------------ */}
          <div className="p-6 md:p-8">
            {sent ? (
              <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">
                  We'll be in touch
                </h2>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                  Someone will call you on {phone} about{" "}
                  {chosen?.title.toLowerCase()} — usually within a few hours on
                  a working day.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  Back to setup
                </Button>
              </div>
            ) : (
              <>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Store className="size-4.5" />
                </span>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  What do you need help with?
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Tell us roughly what's up and we'll put the right person on it.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {TOPICS.map((t) => {
                    const active = topic === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTopic(active ? null : t.id)}
                        className={cn(
                          "relative rounded-xl border bg-card p-3.5 text-left shadow-xs outline-none transition-all",
                          "focus-visible:ring-2 focus-visible:ring-primary/40",
                          active
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:border-foreground/25 hover:shadow-sm",
                        )}
                      >
                        {active && (
                          <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-md bg-primary">
                            <Check className="size-3.5 text-primary-foreground" />
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg border transition-colors",
                            active &&
                              "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          <t.Icon className="size-4" />
                        </span>
                        <span className="mt-2.5 block text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-1.5">
                  <Label htmlFor="support-phone">
                    Your number
                    <span className="ml-1 font-normal text-muted-foreground">
                      — so we can call you back
                    </span>
                  </Label>
                  <PhoneInput
                    id="support-phone"
                    defaultCountry="IN"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(v) => setPhone(v ?? "")}
                  />
                </div>

                <div className="mt-7 flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => onOpenChange(false)}
                  >
                    <ArrowLeft className="size-4" />
                    Go back
                  </Button>
                  <Button
                    className="rounded-full px-6 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                    disabled={!chosen || !phoneValid || isLoading}
                    onClick={send}
                  >
                    {isLoading && <Loader2 className="size-4 animate-spin" />}
                    Continue
                  </Button>
                </div>

                {(!chosen || !phoneValid) && (
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    {!chosen
                      ? "Pick a topic above to continue."
                      : "Add a phone number we can reach you on."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
