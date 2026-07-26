import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Crown, Loader2, Mail, Send } from "@/components/ui/icons";
import { useSubmitEnquiryMutation } from "@/features/api/queriesApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Rough scale bands. Sales cares about the order of magnitude, not the digit. */
const SCALE = [
  { id: "1-3", label: "1 – 3 branches" },
  { id: "4-10", label: "4 – 10 branches" },
  { id: "11-25", label: "11 – 25 branches" },
  { id: "25+", label: "25+ branches" },
];

const VOLUME = [
  { id: "<500", label: "Under 500" },
  { id: "500-2k", label: "500 – 2,000" },
  { id: "2k-10k", label: "2,000 – 10,000" },
  { id: "10k+", label: "10,000+" },
];

/**
 * The questions, in the order they're asked.
 *
 * Scale first, contact details last. Someone who has already told us they run
 * eleven branches is far likelier to hand over a phone number than someone
 * asked for one cold — so the cheap, interesting questions buy the expensive
 * one.
 */
const STEPS = [
  "branches",
  "volume",
  "features",
  "needs",
  "contact",
] as const;
type StepId = (typeof STEPS)[number];

const QUESTION: Record<StepId, { title: string; hint: string }> = {
  branches: {
    title: "How many branches do you run?",
    hint: "A rough band is fine — it tells us what scale we're pricing for.",
  },
  volume: {
    title: "Roughly how many orders a month?",
    hint: "Across all your branches, on a normal month.",
  },
  features: {
    title: "Which of these do you need?",
    hint: "Pick any. This is everything we already build.",
  },
  needs: {
    title: "Anything we don't build yet?",
    hint: "Be specific — this is the part that decides whether we can build it for you, and how quickly.",
  },
  contact: {
    title: "Last one — who do we call?",
    hint: "One call, usually within a working day. We won't add you to a list.",
  },
};

/**
 * The Enterprise brief, asked one question at a time.
 *
 * A single form with eight fields reads as work; the same eight asked one at
 * a time read as a conversation, and each answer is small enough that stopping
 * feels worse than continuing. Chips advance on tap — with one question on
 * screen there's nothing else the tap could have meant, so making someone
 * confirm it would just be an extra click.
 *
 * No progress indicator on purpose: a visible "1 of 8" invites the reader to
 * price the whole thing up front and decide it's too long.
 */
export function EnterpriseEnquiryDialog({
  open,
  onOpenChange,
  /** Feature labels from the plan catalogue, so the tick-list matches reality. */
  features = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  features?: { key: string; label: string }[];
}) {
  const { entitlements } = useEntitlements();
  const support = entitlements?.support;
  const [submit, { isLoading }] = useSubmitEnquiryMutation();

  const [index, setIndex] = useState(0);
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branches, setBranches] = useState<string | null>(null);
  const [volume, setVolume] = useState<string | null>(null);
  const [wanted, setWanted] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  // The features question drops out entirely when the catalogue is empty —
  // an empty question is worse than one fewer question.
  const steps = STEPS.filter((s) => s !== "features" || features.length > 0);
  const step: StepId = steps[index];
  const isLast = index === steps.length - 1;

  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  /** Whether the current answer is good enough to move on. */
  const valid: Record<StepId, boolean> = {
    branches: true,
    volume: true,
    features: true,
    needs: true,
    // Grouped, so the step is only complete once every required field in it
    // is. A blank email is fine; a half-typed one isn't, or the written
    // proposal bounces.
    contact:
      shopName.trim().length >= 2 &&
      name.trim().length >= 2 &&
      phoneValid &&
      (email.trim() === "" || emailValid),
  };
  /** Questions that are fine to leave blank. */
  const optional: Partial<Record<StepId, boolean>> = {
    branches: true,
    volume: true,
    features: true,
    needs: true,
  };

  const reset = () => {
    setIndex(0);
    setShopName("");
    setName("");
    setPhone("");
    setEmail("");
    setBranches(null);
    setVolume(null);
    setWanted([]);
    setMessage("");
    setSent(false);
  };

  async function send() {
    if (!valid.contact) return;
    try {
      await submit({
        phone: phone.trim(),
        type: "enterprise",
        name: name.trim(),
        shopName: shopName.trim(),
        email: emailValid ? email.trim() : undefined,
        message: message.trim() || undefined,
        details: {
          branches: branches ?? "not specified",
          monthlyOrders: volume ?? "not specified",
          // Labels, not keys — whoever reads this email shouldn't have to
          // decode `can_use_advanced_analytics`.
          featuresWanted: features
            .filter((f) => wanted.includes(f.key))
            .map((f) => f.label),
        },
      }).unwrap();
      setSent(true);
    } catch (err) {
      const msg = (err as { data?: { message?: string | string[] } })?.data
        ?.message;
      toast.error(
        msg
          ? Array.isArray(msg)
            ? msg.join(", ")
            : msg
          : "Couldn't send that. Try emailing us instead.",
      );
    }
  }

  const next = () => {
    if (!valid[step]) return;
    if (isLast) void send();
    else setIndex((i) => i + 1);
  };

  /** Chips answer and advance in one tap — see the component doc. */
  const pick = (set: (v: string) => void, value: string) => {
    set(value);
    if (isLast) return;
    // A beat so the selected state is visible before the question changes;
    // an instant jump makes the tap feel unacknowledged.
    setTimeout(() => setIndex((i) => i + 1), 180);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl bg-background p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Talk to us about Enterprise</DialogTitle>

        <div className="grid md:grid-cols-[280px_1fr]">
          {/* ---- what Enterprise actually means ------------------------ */}
          <aside className="flex flex-col border-b p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                <Crown className="size-4" />
              </span>
              <span className="font-semibold tracking-tight">Enterprise</span>
            </div>

            <div className="mt-6 space-y-5 text-sm">
              <div>
                <p className="font-semibold">Built around your operation</p>
                <p className="mt-1 text-muted-foreground">
                  Limits, pricing and rollout agreed with you rather than
                  picked off a card.
                </p>
              </div>
              <div className="border-t pt-5">
                <p className="font-semibold">We'll build what's missing</p>
                <p className="mt-1 text-muted-foreground">
                  If what you need fits more bakeries than yours, it usually
                  gets built.
                </p>
              </div>
              <div className="border-t pt-5">
                <p className="font-semibold">A reply from a person</p>
                <p className="mt-1 text-muted-foreground">
                  Usually within one working day, on the number you leave.
                </p>
              </div>
            </div>

            {support?.email && (
              <a
                href={`mailto:${support.email}?subject=Frostique%20Enterprise`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
              >
                <Mail className="size-3.5" />
                {support.email}
              </a>
            )}
          </aside>

          {/* ---- one question at a time -------------------------------- */}
          <div className="flex min-h-[26rem] flex-col p-6 md:p-8">
            {sent ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">Brief received</h2>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  We've got everything for {shopName}. Someone will call you on{" "}
                  {phone} — usually within a working day — with a plan and a
                  price.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  Back to plans
                </Button>
              </div>
            ) : (
              <>
                {/* Re-keyed per question so each one animates in rather than
                    swapping in place, which otherwise reads as a glitch. */}
                <div
                  key={step}
                  className="flex-1 duration-300 animate-in fade-in slide-in-from-right-4"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {QUESTION[step].title}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {QUESTION[step].hint}
                  </p>

                  <div className="mt-7">
                    {step === "branches" && (
                      <ChipGrid
                        options={SCALE}
                        value={branches}
                        onPick={(v) => pick(setBranches, v)}
                      />
                    )}

                    {step === "volume" && (
                      <ChipGrid
                        options={VOLUME}
                        value={volume}
                        onPick={(v) => pick(setVolume, v)}
                      />
                    )}

                    {step === "features" && (
                      /* Multi-select, so this one can't advance on tap —
                         picking a second feature has to stay possible. */
                      <div className="flex flex-wrap gap-2">
                        {features.map((f) => {
                          const active = wanted.includes(f.key);
                          return (
                            <button
                              key={f.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setWanted((w) =>
                                  active
                                    ? w.filter((x) => x !== f.key)
                                    : [...w, f.key],
                                )
                              }
                              className={cn(
                                "rounded-full border px-3.5 py-2 text-sm outline-none transition-all",
                                "focus-visible:ring-2 focus-visible:ring-primary/40",
                                active
                                  ? "border-primary bg-primary/5 font-medium"
                                  : "hover:border-foreground/25",
                              )}
                            >
                              {active && (
                                <Check className="mr-1.5 inline size-3.5 text-primary" />
                              )}
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {step === "needs" && (
                      <Textarea
                        autoFocus
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Franchise billing, a Tally export, an ERP we already use — whatever's on your list."
                      />
                    )}

                    {step === "contact" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Business name"
                          required
                          className="sm:col-span-2"
                        >
                          <Input
                            autoFocus
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="Sweet Cake Bake"
                          />
                        </Field>

                        <Field label="Your name" required>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                          />
                        </Field>

                        <Field label="Phone" required>
                          <PhoneInput
                            defaultCountry="IN"
                            placeholder="98765 43210"
                            value={phone}
                            onChange={(v) => setPhone(v ?? "")}
                          />
                        </Field>

                        <Field
                          label="Email"
                          hint="optional — the written quote lands here"
                          className="sm:col-span-2"
                        >
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && next()}
                            placeholder="you@bakery.in"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>

                {/* ---- footer ------------------------------------------ */}
                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() =>
                      index === 0 ? onOpenChange(false) : setIndex((i) => i - 1)
                    }
                  >
                    <ArrowLeft className="size-4" />
                    {index === 0 ? "Cancel" : "Back"}
                  </Button>

                  <div className="flex items-center gap-2">
                    {/* Skip only appears where a blank answer is genuinely
                        acceptable, so its presence carries information. */}
                    {optional[step] && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full text-muted-foreground"
                        onClick={() =>
                          isLast ? void send() : setIndex((i) => i + 1)
                        }
                      >
                        Skip
                      </Button>
                    )}
                    <Button
                      type="button"
                      className="rounded-full px-6 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                      disabled={!valid[step] || isLoading}
                      onClick={next}
                    >
                      {isLoading && <Loader2 className="size-4 animate-spin" />}
                      {isLast ? "Send brief" : "Next"}
                      {!isLoading &&
                        (isLast ? (
                          <Send className="size-4" />
                        ) : (
                          <ArrowRight className="size-4" />
                        ))}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled input inside the grouped contact step. */
function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required ? (
          <span className="ml-0.5 text-primary">*</span>
        ) : hint ? (
          <span className="ml-1 font-normal text-muted-foreground">
            — {hint}
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

/** Single-choice chips. Answering advances, so there's no confirm step. */
function ChipGrid({
  options,
  value,
  onPick,
}: {
  options: { id: string; label: string }[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(o.id)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-sm shadow-xs outline-none transition-all",
              "focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "border-primary bg-primary/5 font-medium shadow-sm"
                : "hover:border-foreground/25 hover:shadow-sm",
            )}
          >
            {o.label}
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30",
              )}
            >
              {active && <Check className="size-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
