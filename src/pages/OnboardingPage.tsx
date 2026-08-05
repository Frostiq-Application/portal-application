import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { useAuth } from "@/hooks/useAuth";
import { FrostiqueMark } from "@/components/common/FrostiqueMark";
import { ArrowLeft, ArrowRight, Check, ExternalLink, LifeBuoy, Loader2, LogOut, MapPin, PartyPopper, Store } from "@/components/ui/icons";
import {
  useOnboardingStateQuery,
  useSaveBillingStepMutation,
  useSaveBranchStepMutation,
  useSaveBrandStepMutation,
  useSavePlanStepMutation,
  useGoToOnboardingStepMutation,
  type OnboardingState,
} from "@/features/api/onboardingApi";
import {
  useBillingStatesQuery,
  useMyPlansQuery,
} from "@/features/api/billingApi";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { ContactSupportDialog } from "@/components/support/ContactSupportDialog";
import {
  BranchTeamAccess,
  type BranchInvite,
} from "@/components/shops/BranchTeamAccess";
import { cn, slugify } from "@/lib/utils";
import {
  TIME_SLOTS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  formatCoordinates,
  parseCoordinates,
} from "@/lib/branch";
import type { PricingPlan } from "@/types/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploader } from "@/components/ImageUploader";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Colour, used semantically rather than decoratively:
 *
 *   primary (rose)  the brand mark, the current step, the main CTA
 *   emerald         done, confirmed, verified — something that already worked
 *   amber           outstanding: an action still owed before you can finish
 *   destructive     blocked or failed
 *   muted           inactive, skipped, not applicable
 *
 * Painting everything primary flattens all of that into "brand colour", and a
 * step that still needs paying for then looks identical to one that's done.
 *
 * Account setup — signup to first order.
 *
 * Two properties do most of the work here:
 *
 *  1. **It resumes.** The step lives on the server, and every save returns the
 *     whole state, so closing the tab mid-address costs nothing. Signup is the
 *     leakiest funnel in any product; "start again from the top" is how you
 *     lose someone who already typed their address once.
 *  2. **Nothing is mandatory-feeling.** Steps can be revisited from the rail,
 *     and a completed one is a link back rather than a locked door.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { data: state, isLoading } = useOnboardingStateQuery();
  const [contactOpen, setContactOpen] = useState(false);

  // Setup sits outside AppLayout, so it has no sidebar and therefore no way
  // out. Without this, someone who signed up on the wrong email is stuck.
  const signOut = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  // Finished accounts have no business on this screen.
  useEffect(() => {
    if (state?.completed) navigate("/", { replace: true });
  }, [state?.completed, navigate]);

  if (isLoading || !state) {
    return (
      // Same shell as the loaded state, so nothing shifts when data lands.
      <div className="min-h-svh bg-muted/40 px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto w-full max-w-[1400px] overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-6 py-4">
            <Skeleton className="h-7 w-40" />
          </div>
          <div className="grid lg:grid-cols-[1fr_340px]">
            <div className="px-6 py-8 md:px-10">
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <div className="border-t px-6 py-8 lg:border-l lg:border-t-0">
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-muted/40 px-4 py-6 md:px-6 md:py-10">
      {/*
        One fixed width for every step, not centred.

        It used to narrow to max-w-5xl on the form steps, which squeezed the
        content and made the shell visibly resize between steps — the layout
        appeared to jump every time you advanced. A single width keeps the
        header and stepper pinned where the eye left them.
      */}
      <div className="mx-auto w-full max-w-[1400px] overflow-hidden rounded-2xl border bg-background shadow-sm">
        {/* ---- header ------------------------------------------------- */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <FrostiqueMark className="size-7" />
            <span className="font-semibold tracking-tight">Frostique</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_340px]">
          {/* ---- the step itself ------------------------------------- */}
          <main className="min-w-0 px-6 py-8 md:px-10">
            <StepBody state={state} />
          </main>

          {/* ---- progress + help ------------------------------------- */}
          <aside className="border-t bg-muted/30 px-6 py-8 lg:border-l lg:border-t-0">
            <StepRail state={state} />

            <div className="mt-10 border-t pt-6">
              <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10">
                <LifeBuoy className="size-4.5 text-sky-600 dark:text-sky-400" />
              </span>
              <p className="mt-3 font-semibold">Having trouble?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Get in touch and we'll walk you through it. Setup shouldn't be
                the hard part.
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setContactOpen(true)}
              >
                Contact us
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <ContactSupportDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}

/**
 * The progress rail.
 *
 * Every step is listed with its own one-line description, so the wizard's
 * shape is legible from the first screen — you can see what you're in for
 * rather than discovering it a step at a time. A **completed** step is a real
 * button back to it; someone who typed the wrong address three steps ago
 * shouldn't have to finish signup and go hunting through settings.
 */
function StepRail({ state }: { state: OnboardingState }) {
  const [goToStep, { isLoading }] = useGoToOnboardingStepMutation();
  const visible = state.steps.filter((s) => s.step !== "done");

  return (
    <ol className="space-y-0">
      {visible.map((s, i) => {
        const canRevisit = s.complete && !s.current && !s.skipped;
        const last = i === visible.length - 1;
        return (
          <li key={s.step} className="relative flex gap-3 pb-6 last:pb-0">
            {/* Connector, drawn behind the marker and coloured by progress. */}
            {!last && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border"
              >
                <span
                  className={cn(
                    "block w-px origin-top bg-emerald-500 transition-transform duration-500 ease-out motion-reduce:transition-none",
                    s.complete ? "scale-y-100" : "scale-y-0",
                  )}
                  style={{ height: "100%" }}
                />
              </span>
            )}

            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-muted/30",
                "transition-all duration-300 ease-out motion-reduce:transition-none",
                s.complete
                  ? "scale-105 bg-emerald-500 text-white"
                  : s.current
                    ? "border-2 border-primary bg-background text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <Check
                className={cn(
                  "absolute size-3.5 transition-all duration-300 ease-out motion-reduce:transition-none",
                  s.complete ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
              />
              <span
                className={cn(
                  "transition-all duration-200 motion-reduce:transition-none",
                  s.complete ? "scale-50 opacity-0" : "scale-100 opacity-100",
                )}
              >
                {i + 1}
              </span>
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              {canRevisit ? (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void goToStep(s.step).unwrap().catch(() => {})}
                  className="text-left text-sm font-medium underline-offset-4 hover:underline"
                >
                  {s.title}
                </button>
              ) : (
                <p
                  className={cn(
                    "text-sm",
                    s.current
                      ? "font-semibold"
                      : s.skipped
                        ? "text-muted-foreground line-through"
                        : "text-muted-foreground",
                  )}
                >
                  {s.title}
                </p>
              )}
              <p
                className={cn(
                  "mt-0.5 text-xs leading-snug",
                  s.current ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {s.skipped ? "Not needed on a free plan" : s.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepBody({ state }: { state: OnboardingState }) {
  switch (state.currentStep) {
    case "brand":
      return <BrandStep state={state} />;
    case "branch":
      return <BranchStep state={state} />;
    case "billing":
      return <BillingStep state={state} />;
    case "plan":
      return <PlanStep />;
    case "payment":
      return <PaymentStep state={state} />;
    default:
      return <DoneStep />;
  }
}

/** Shared frame so every step looks and behaves the same. */
function StepCard({
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Continue",
  busy,
  disabled,
  onBack,
  backLabel = "Back",
  subSteps,
  current = 1,
  onJump,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Shown only when a step has sub-steps of its own to reverse through. */
  onBack?: () => void;
  backLabel?: string;
  /** Sub-step labels; index `current` (1-based) marks where we are. */
  subSteps?: string[];
  current?: number;
  onJump?: (n: number) => void;
}) {
  return (
    <form
      className="rounded-2xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {subSteps && subSteps.length > 1 && (
        /* A progress bar for the sub-steps, above the heading. Going back is
           always allowed; going forward isn't, since a later sub-step may
           depend on fields the current one hasn't validated yet. */
        <ol className="mb-5 flex items-center gap-2">
          {subSteps.map((label, i) => {
            const n = i + 1;
            const done = current > n;
            const active = current === n;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  disabled={n > current || !onJump}
                  onClick={() => onJump?.(n)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span
                    className={cn(
                      "block h-1 rounded-full transition-colors duration-300",
                      done
                        ? "bg-emerald-500"
                        : active
                          ? "bg-primary"
                          : "bg-muted",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-1.5 flex items-center gap-1 truncate text-xs transition-colors",
                      active
                        ? "font-medium text-foreground"
                        : done
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    {done && <Check className="size-3 text-emerald-600" />}
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 space-y-4">{children}</div>
      <div className="mt-6 flex gap-3">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onBack}
            disabled={busy}
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1"
          size="lg"
          disabled={busy || disabled}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
          {!busy && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </form>
  );
}

/**
 * A titled group of related fields.
 *
 * Long onboarding forms read as a wall of inputs; chunking them into named
 * groups turns "fill in fourteen things" into "answer three questions", which
 * is the whole reason the pattern shows up in every well-designed signup.
 */
function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ steps --

function BrandStep({ state }: { state: OnboardingState }) {
  const [save, { isLoading }] = useSaveBrandStepMutation();
  const [name, setName] = useState(state.prefill.brand.name ?? "");
  const [logoUrl, setLogoUrl] = useState(state.prefill.brand.logoUrl ?? "");
  const [themeColor, setThemeColor] = useState(
    state.prefill.brand.themeColor ?? "#be123c",
  );

  return (
    <StepCard
      title="Your brand"
      description="This is what customers see on your storefront. You can change it any time."
      busy={isLoading}
      disabled={!name.trim()}
      onSubmit={async () => {
        try {
          await save({
            name: name.trim(),
            logoUrl: logoUrl || null,
            themeColor,
          }).unwrap();
        } catch {
          toast.error("Couldn't save that. Try again.");
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="brand-name">Shop name</Label>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sweet Cake Bake"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Logo</Label>
        <ImageUploader
          value={logoUrl ? [logoUrl] : []}
          onChange={(urls) => setLogoUrl(urls[0] ?? "")}
          folder="logos"
        />
        <p className="text-xs text-muted-foreground">
          Square works best. You can add this later.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brand-color">Accent colour</Label>
        <div className="flex items-center gap-3">
          <input
            id="brand-color"
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="size-10 cursor-pointer rounded-lg border bg-transparent p-1"
          />
          <Input
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="w-32 font-mono text-sm"
          />
          <span
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: themeColor }}
          >
            Preview
          </span>
        </div>
      </div>
    </StepCard>
  );
}

function BranchStep({ state }: { state: OnboardingState }) {
  const [save, { isLoading }] = useSaveBranchStepMutation();
  // Prefill from whatever was already saved — coming back to this step and
  // finding it blank is the single most infuriating thing a wizard can do.
  const saved = state.prefill.branch;
  const editing = saved != null;

  const [branchName, setBranchName] = useState(saved?.branchName ?? "");
  // Only what the user typed is stored; the effective slug is derived below.
  const [typedSlug, setTypedSlug] = useState(saved?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [displayArea, setDisplayArea] = useState(saved?.displayArea ?? "");
  const [city, setCity] = useState(saved?.city ?? "");
  const [address, setAddress] = useState(saved?.address ?? "");
  // Shows what's already stored, so rewinding to this step doesn't look like
  // the location was lost — the box is the coordinates now, not a scratch pad.
  const [mapLink, setMapLink] = useState(
    saved?.latitude && saved?.longitude
      ? `${saved.latitude}, ${saved.longitude}`
      : "",
  );
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    saved?.latitude && saved?.longitude
      ? { lat: Number(saved.latitude), lng: Number(saved.longitude) }
      : null,
  );
  const [bannerUrl, setBannerUrl] = useState(saved?.bannerUrl ?? "");
  const [whatsappNumber, setWhatsapp] = useState(saved?.whatsappNumber ?? "");
  const [openingTime, setOpening] = useState(saved?.openingTime ?? "09:00");
  const [closingTime, setClosing] = useState(saved?.closingTime ?? "21:00");
  const [closedDays, setClosedDays] = useState<string[]>(
    saved?.closedDays ?? [],
  );
  const assignable = state.prefill.assignableUsers ?? [];
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(
    assignable.filter((u) => u.assigned).map((u) => u.id),
  );
  const [invites, setInvites] = useState<BranchInvite[]>([]);
  // Split in two because the branch form was already long, and "where it is"
  // and "who works there" are different questions asked of different parts of
  // the owner's brain. Local sub-steps, not wizard steps — the server still
  // sees one save.
  const [sub, setSub] = useState<1 | 2 | 3>(1);

  /*
   * Re-seed when the server's branch actually arrives.
   *
   * Rewinding to this step from the rail renders it against RTK Query's
   * *cached* state while the refetch is still in flight, so the `useState`
   * initialisers above can capture a branch that hadn't been saved yet — and
   * initialisers never run again. Without this, coming back showed an empty
   * form and an untouched team list even though the data was moments away.
   *
   * Keyed on the branch id, so it fires on the null → saved transition and
   * then stays out of the way while someone is typing.
   */
  const savedId = saved?.id ?? null;
  // Seeded during render, keyed on the saved branch's id, so the form shows the
  // stored values on the paint they arrive rather than one frame later.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (saved && savedId !== seededId) {
    setSeededId(savedId);
    setBranchName(saved.branchName ?? "");
    setTypedSlug(saved.slug ?? "");
    setSlugTouched(true);
    setDisplayArea(saved.displayArea ?? "");
    setCity(saved.city ?? "");
    setAddress(saved.address ?? "");
    setCoords(
      saved.latitude && saved.longitude
        ? { lat: Number(saved.latitude), lng: Number(saved.longitude) }
        : null,
    );
    setMapLink(
      saved.latitude && saved.longitude
        ? `${saved.latitude}, ${saved.longitude}`
        : "",
    );
    setBannerUrl(saved.bannerUrl ?? "");
    setWhatsapp(saved.whatsappNumber ?? "");
    setOpening(saved.openingTime ?? "09:00");
    setClosing(saved.closingTime ?? "21:00");
    setClosedDays(saved.closedDays ?? []);
    // Anyone staged as an invite has been created for real by now, so they
    // belong in the assigned list below rather than staged a second time.
    setInvites([]);
  }

  /*
   * Ticked team members, re-seeded whenever the *server's* set changes.
   *
   * Compared as a string so a refetch that returns the same people is a no-op
   * and can't wipe a selection someone is halfway through making.
   */
  const serverAssigned = assignable
    .filter((u) => u.assigned)
    .map((u) => u.id)
    .sort()
    .join(",");
  const [seenAssigned, setSeenAssigned] = useState(serverAssigned);
  if (serverAssigned !== seenAssigned) {
    setSeenAssigned(serverAssigned);
    setAssignedUserIds(serverAssigned ? serverAssigned.split(",") : []);
  }

  // Derive the slug until someone edits it themselves — then stop fighting them.
  // Computed rather than stored, so the preview can't lag the name it's built
  // from by a frame.
  const slug = slugTouched ? typedSlug : slugify(branchName);

  // A pasted value overrides whatever was stored; an empty box keeps it.
  const [seenMapLink, setSeenMapLink] = useState(mapLink);
  if (mapLink !== seenMapLink) {
    setSeenMapLink(mapLink);
    if (mapLink.trim()) setCoords(parseCoordinates(mapLink));
  }

  /** Typed something that isn't a usable pair — say so instead of staying mute. */
  const coordsError = mapLink.trim() !== "" && coords == null;

  /*
   * Where "Find on map" lands. Seeded with the address already typed above so
   * the map opens near the shop rather than on the middle of the world, and
   * falls back to plain Maps when there's nothing to search for yet.
   */
  const mapSearchUrl = useMemo(() => {
    const query = [address, displayArea, city].map((s) => s.trim()).filter(Boolean).join(", ");
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : "https://www.google.com/maps";
  }, [address, displayArea, city]);

  const toggleDay = (day: string) =>
    setClosedDays((d) =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day],
    );

  return (
    <StepCard
      subSteps={["Branch details", "Hours & contact", "Team access"]}
      current={sub}
      onJump={(n) => setSub(n as 1 | 2 | 3)}
      title={
        sub === 1
          ? "Your first branch"
          : sub === 2
            ? "Hours & contact"
            : "Who works here?"
      }
      description={
        sub === 1
          ? editing
            ? "Update anything here. The slug is fixed, since it's your branch's public URL."
            : "Where you bake. You can add more branches later from the Branches page."
          : sub === 2
            ? "When you're open and how customers reach you. All of it is editable later."
            : "Give your team access to this branch. Entirely optional, you can do all of this later from Team."
      }
      submitLabel={
        sub === 1
          ? "Next: hours & contact"
          : sub === 2
            ? "Next: who works here"
            : editing
              ? "Save and continue"
              : "Continue"
      }
      busy={isLoading}
      disabled={sub === 1 && (!branchName.trim() || !slug)}
      onBack={sub > 1 ? () => setSub((n) => (n === 3 ? 2 : 1)) : undefined}
      backLabel="Back"
      onSubmit={async () => {
        if (sub < 3) {
          setSub((n) => (n === 1 ? 2 : 3));
          return;
        }
        try {
          await save({
            branchName: branchName.trim(),
            slug,
            displayArea: displayArea.trim() || undefined,
            city: city.trim() || undefined,
            address: address.trim() || undefined,
            latitude: coords ? String(coords.lat) : undefined,
            longitude: coords ? String(coords.lng) : undefined,
            bannerUrl: bannerUrl || undefined,
            whatsappNumber: whatsappNumber.trim() || undefined,
            openingTime,
            closingTime,
            closedDays,
            assignedUserIds,
            invites,
          }).unwrap();
        } catch (err) {
          toast.error(
            (err as { data?: { message?: string } })?.data?.message ??
              "Couldn't save that branch.",
          );
        }
      }}
    >
      <div className={cn("space-y-4", sub !== 1 && "hidden")}>
        <FieldGroup
          title="What it's called"
          hint="The name customers see, and the address your storefront lives at."
        >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-name">Branch name</Label>
          <Input
            id="b-name"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="Kothrud Branch"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-slug">Slug</Label>
          <Input
            id="b-slug"
            value={slug}
            disabled={editing}
            onChange={(e) => {
              setSlugTouched(true);
              setTypedSlug(slugify(e.target.value));
            }}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {editing
              ? "This is your branch's public URL, so it's fixed now."
              : "Auto-filled from the name. Can't be changed later."}
          </p>
        </div>
      </div>
        </FieldGroup>

        <FieldGroup
          title="Where it is"
          hint="Used to show customers their nearest branch."
        >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-area">Display area</Label>
          <Input
            id="b-area"
            value={displayArea}
            onChange={(e) => setDisplayArea(e.target.value)}
            placeholder="Kothrud"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-city">City</Label>
          <Input
            id="b-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Pune"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="b-address">Address</Label>
        <Textarea
          id="b-address"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, area, landmark…"
        />
      </div>

      {/*
        One box, filled by copy-paste — no latitude/longitude fields to type.
        Nobody knows their shop's coordinates off the top of their head, and a
        mistyped one silently puts the branch in the sea. The button is a
        shortcut for *fetching* them: it opens Maps on whatever address was
        typed above, they copy the pin's coordinates there and paste them back.
      */}
      <div className="space-y-1.5">
        <Label htmlFor="b-map">Location coordinates</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="b-map"
              className="pl-9"
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              placeholder="18.50740, 73.80770"
            />
          </div>
          {/* Always live — it's the "go get them" step, so disabling it until
              coordinates exist would lock the door people came to open. */}
          <Button type="button" variant="outline" asChild>
            <a
              href={mapSearchUrl}
              target="_blank"
              rel="noreferrer"
              title="Open Google Maps to copy your shop's coordinates"
            >
              <ExternalLink className="size-4" />
              Find on map
            </a>
          </Button>
        </div>
        {coords ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-3.5" />
            Location set: {formatCoordinates(coords.lat, coords.lng)}
            <a
              className="ml-1 font-normal text-muted-foreground underline-offset-2 hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              check pin
            </a>
          </p>
        ) : coordsError ? (
          <p className="text-xs text-destructive">
            That isn't a coordinate pair. It should look like{" "}
            <span className="font-medium">18.50740, 73.80770</span>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Find on map → right-click your shop (long-press on a phone) → tap
            the coordinates that appear to copy them → paste here. It's how
            customers find your nearest branch.
          </p>
        )}
      </div>
        </FieldGroup>
      </div>

      <div className={cn("space-y-4", sub !== 2 && "hidden")}>
        <FieldGroup
          title="How it looks"
          hint="A wide photo of your shop or your best cake, shown at the top of the branch page."
        >
      <div className="space-y-1.5">
        <Label>Banner image</Label>
        <ImageUploader
          value={bannerUrl ? [bannerUrl] : []}
          onChange={(urls) => setBannerUrl(urls[0] ?? "")}
          folder="banners"
        />
      </div>
        </FieldGroup>

        <FieldGroup
          title="When you're open"
          hint="Customers can only pick delivery slots inside these hours."
        >
      <div className="space-y-1.5">
        <Label htmlFor="b-wa">WhatsApp number</Label>
        <PhoneInput
          id="b-wa"
          value={whatsappNumber}
          onChange={(v) => setWhatsapp(v ?? "")}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Opening hours</Label>
        <div className="flex items-center gap-2">
          <Select value={openingTime} onValueChange={setOpening}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Opens" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">–</span>
          <Select value={closingTime} onValueChange={setClosing}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Closes" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Closed days</Label>
          <span className="text-xs text-muted-foreground">
            {closedDays.length === 0
              ? "Open every day"
              : `Closed ${closedDays.length} day${closedDays.length > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const closed = closedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={closed}
                onClick={() => toggleDay(day)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  // Open is the normal state, so it reads calm-positive rather
                  // than shouting in the brand colour; closed is the exception
                  // and is greyed out.
                  closed
                    ? "border-transparent bg-muted text-muted-foreground line-through"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                )}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tap a day to grey it out and mark the branch closed.
        </p>
      </div>
        </FieldGroup>
      </div>

      <BranchTeamAccess
        users={assignable}
        selected={assignedUserIds}
        onChange={setAssignedUserIds}
        invites={invites}
        onInvitesChange={setInvites}
        className={cn(sub !== 3 && "hidden")}
      />
    </StepCard>
  );
}

function BillingStep({ state }: { state: OnboardingState }) {
  const [save, { isLoading }] = useSaveBillingStepMutation();
  const { data: meta } = useBillingStatesQuery();
  const p = state.prefill.billing;
  const [form, setForm] = useState({
    billingAddress: p.billingAddress ?? "",
    billingPincode: p.billingPincode ?? "",
    billingCity: p.billingCity ?? "",
    billingState: p.billingState ?? "",
    gstin: p.gstin ?? "",
  });
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const incomplete =
    !form.billingAddress.trim() ||
    !/^\d{6}$/.test(form.billingPincode) ||
    !form.billingCity.trim() ||
    !form.billingState;

  return (
    <StepCard
      title="Billing details"
      description="These appear on your invoices. Needed even on the free plan, so upgrading later is one click."
      busy={isLoading}
      disabled={incomplete}
      onSubmit={async () => {
        try {
          await save({
            ...form,
            gstin: form.gstin.trim() || undefined,
            billingCountry: "India",
          }).unwrap();
        } catch (err) {
          toast.error(
            (err as { data?: { message?: string } })?.data?.message ??
              "Couldn't save those details.",
          );
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="ba">Address</Label>
        <Input
          id="ba"
          value={form.billingAddress}
          onChange={(e) => set("billingAddress", e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bc">City</Label>
          <Input
            id="bc"
            value={form.billingCity}
            onChange={(e) => set("billingCity", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bp">Pincode</Label>
          <Input
            id="bp"
            inputMode="numeric"
            maxLength={6}
            value={form.billingPincode}
            onChange={(e) =>
              set("billingPincode", e.target.value.replace(/\D/g, ""))
            }
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bs">State</Label>
          <Select
            value={form.billingState}
            onValueChange={(v) => set("billingState", v)}
          >
            <SelectTrigger id="bs" className="w-full">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {(meta?.states ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg">
            GSTIN{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bg"
            maxLength={15}
            value={form.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
          />
        </div>
      </div>
    </StepCard>
  );
}

function PlanStep() {
  const navigate = useNavigate();
  const { data: catalogue, isLoading } = useMyPlansQuery();
  const [save] = useSavePlanStepMutation();
  // Monthly by default: signup is the moment someone is least willing to
  // commit to a year, so the smaller number is the one to open on.
  const [cycle, setCycle] = useState("monthly");
  const [busyId, setBusyId] = useState<string | null>(null);

  const plans = catalogue?.plans ?? [];
  const cycles = catalogue?.cycles ?? [];
  /** Non-null only while this account can still take the trial. */
  const trialOffer = catalogue?.trialOffer ?? null;
  const activeCycle =
    cycles.find((c) => c.code === cycle) ?? cycles[0] ?? null;

  async function choose(plan: PricingPlan) {
    setBusyId(plan.id);
    try {
      const next = await save({
        planId: plan.id,
        billingCycle: activeCycle?.code ?? "monthly",
        // Only the one plan carrying the offer, and only while this account is
        // still eligible — the server re-checks both regardless.
        startTrial: plan.id === trialOffer?.planId,
      }).unwrap();
      // A ₹0 plan or a trial finishes onboarding outright; a paid one hands off
      // to checkout, because nothing is granted before money arrives.
      if (!next.completed) {
        navigate(
          `/checkout?plan=${plan.id}&cycle=${activeCycle?.code ?? "monthly"}`,
        );
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't select that plan.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading || !activeCycle) {
    return <Skeleton className="h-[32rem] rounded-2xl" />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Choose a plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {trialOffer
            ? `Pick the plan that fits today, or try ${trialOffer.planName} free for ${trialOffer.days} days first, no card. You can move up whenever you outgrow a plan, and what you've paid for is prorated.`
            : "Pick the plan that fits today. You can move up whenever you outgrow it, and what you've paid for is prorated."}
        </p>
      </div>

      {/*
        The same pricing grid the rest of the portal uses, rather than a third
        bespoke plan list. `maxFeatures: Infinity` because here the card *is*
        the pitch — there's no comparison table to fall back to during signup.
      */}
      <PlanPicker
        plans={plans}
        cycles={cycles}
        cycle={activeCycle.code}
        onCycleChange={setCycle}
        trialOffer={trialOffer}
        maxFeatures={Infinity}
        // Signup is exactly when someone with twenty branches works out the
        // listed tiers don't fit them — so the way to say so belongs here.
        showEnterprise
        onSelect={choose}
        ctaLabel={(p) =>
          busyId === p.id
            ? "Setting up…"
            : p.id === trialOffer?.planId
              ? `Start ${trialOffer.days}-day free trial`
              : Number(p.priceMonthly) === 0
                ? "Start free"
                : `Choose ${p.name}`
        }
      />

      <p className="text-center text-xs text-muted-foreground">
        Every limit can be raised later with add-on capacity, so you don't have to
        change tier for one more branch.
      </p>
    </div>
  );
}

function PaymentStep({ state }: { state: OnboardingState }) {
  const navigate = useNavigate();
  const [goToStep, { isLoading: rewinding }] = useGoToOnboardingStepMutation();
  const planId = (state.data.chosenPlanId as string) ?? state.prefill.planId;
  const cycle = (state.data.chosenCycle as string) ?? "monthly";

  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      {/* Amber, not primary: this step is *owed*, not celebrated. */}
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10">
        <Store className="size-5 text-amber-600 dark:text-amber-500" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">One last thing</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Complete your payment and your storefront goes live immediately.
      </p>
      <Button
        className="mt-6"
        size="lg"
        disabled={!planId}
        onClick={() => navigate(`/checkout?plan=${planId}&cycle=${cycle}`)}
      >
        Go to checkout
        <ArrowRight className="size-4" />
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">
        Changed your mind?{" "}
        <button
          type="button"
          disabled={rewinding}
          className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
          onClick={async () => {
            // Rewind the wizard rather than navigating to /my-subscription —
            // that route is behind OnboardingGate, which would bounce an
            // unfinished account straight back here, so the link looked dead.
            try {
              await goToStep("plan").unwrap();
            } catch {
              toast.error("Couldn't go back. Try again.");
            }
          }}
        >
          {rewinding ? "Going back…" : "Pick a different plan"}
        </button>
      </p>
    </div>
  );
}

function DoneStep() {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
        <PartyPopper className="size-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">You're live</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Your storefront is taking orders. Add some products and you're away.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => navigate("/catalog")}>
          Add your first products
          <ArrowRight className="size-4" />
        </Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
