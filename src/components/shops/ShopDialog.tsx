import { useEffect, useMemo, useState } from "react";
import { Clock, Copy, Loader2, Mail, Store, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateShopMutation,
  useUpdateShopMutation,
  type CreateShopBody,
} from "@/features/api/shopsApi";
import {
  useCreateUserMutation,
  useResetUserPasswordMutation,
} from "@/features/api/usersApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdmin } from "@/lib/roles";
import { apiError } from "@/lib/apiError";
import { cn, slugify } from "@/lib/utils";
import type { Shop } from "@/types";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** "09:30" -> "9:30 AM", for the time selects. */
function formatTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** Half-hour slots across the day: 00:00, 00:30, … 23:30. */
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
  return { value, label: formatTimeLabel(value) };
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shop?: Shop | null;
  /** Scopes the branch to this shop, replacing the picker with a title. */
  defaultAccountId?: string;
  /** Shown in the title; saves a lookup when the caller already knows it. */
  defaultAccountName?: string;
}

export function ShopDialog({
  open,
  onOpenChange,
  shop,
  defaultAccountId,
  defaultAccountName,
}: Props) {
  const isEdit = Boolean(shop);
  const { role } = useAuth();
  const platform = isPlatformAdmin(role);
  // The picker is the only reason to fetch the list; skip it when scoped.
  const needsAccountPicker = platform && !isEdit && !defaultAccountId;
  const { data: accounts } = useListAccountsQuery(
    needsAccountPicker ? { page: 1, limit: 100, status: "active" } : undefined,
    { skip: !needsAccountPicker },
  );
  const [createShop, { isLoading: creating }] = useCreateShopMutation();
  const [updateShop, { isLoading: updating }] = useUpdateShopMutation();
  const [createUser, { isLoading: invitingOwner }] = useCreateUserMutation();
  const [resetPassword, { isLoading: resetting }] = useResetUserPasswordMutation();

  // Shop Owners can hand a brand-new branch straight to a Branch Owner. Platform
  // admins keep the lean flow (they invite staff from the Team page instead).
  const canAddOwner = !isEdit && !platform;
  const [tab, setTab] = useState<"branch" | "owner">("branch");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  /** Reset-password token minted after the owner is created — shows the link screen. */
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [slug, setSlug] = useState("");
  const [displayArea, setDisplayArea] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [closedDays, setClosedDays] = useState<string[]>([]);
  /** Once the user edits the slug by hand, stop syncing it from the name. */
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setAccountId(shop?.accountId ?? defaultAccountId ?? "");
      setBranchName(shop?.branchName ?? "");
      setSlug(shop?.slug ?? "");
      setDisplayArea(shop?.displayArea ?? "");
      setBannerUrl(shop?.bannerUrl ?? "");
      setAddress(shop?.address ?? "");
      setCity(shop?.city ?? "");
      setWhatsapp(shop?.whatsappNumber ?? "");
      setOpeningTime(shop?.openingTime?.slice(0, 5) ?? "");
      setClosingTime(shop?.closingTime?.slice(0, 5) ?? "");
      setClosedDays(shop?.closedDays ?? []);
      setSlugTouched(false);
      setTab("branch");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPhone("");
      setResetToken(null);
    }
  }, [open, shop, defaultAccountId]);

  const onBranchNameChange = (value: string) => {
    setBranchName(value);
    // The slug is immutable after creation, so only auto-fill it for new branches.
    if (!isEdit && !slugTouched) setSlug(slugify(value));
  };

  const toggleDay = (d: string) =>
    setClosedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  /** Names the shop in the title when the branch is scoped to one. */
  const scopedShopName =
    defaultAccountName ??
    (defaultAccountId
      ? (accounts?.data ?? []).find((a) => a.id === defaultAccountId)?.name
      : undefined);

  /** Closing before opening is only valid if the branch trades past midnight. */
  const hoursInvalid = useMemo(
    () =>
      Boolean(openingTime && closingTime && closingTime <= openingTime),
    [openingTime, closingTime],
  );

  // The associated user is optional: a branch owner is invited only when their
  // details are supplied. Any filled field opts in and makes name + email required.
  const ownerRequested =
    canAddOwner &&
    Boolean(ownerName.trim() || ownerEmail.trim() || ownerPhone.trim());

  const submit = async () => {
    if (branchName.trim().length < 2) {
      setTab("branch");
      return toast.error("Branch name required");
    }
    if (!isEdit && !slug.trim()) {
      setTab("branch");
      return toast.error("Slug required");
    }
    if (hoursInvalid) {
      setTab("branch");
      return toast.error("Closing time must be after opening time");
    }
    if (ownerRequested && (ownerName.trim().length < 2 || !ownerEmail.trim())) {
      setTab("owner");
      return toast.error("Branch owner needs a name and email");
    }
    const body: CreateShopBody = {
      branchName: branchName.trim(),
      slug: slug.trim(),
      displayArea: displayArea.trim() || undefined,
      bannerUrl: bannerUrl || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      whatsappNumber: whatsapp.trim() || undefined,
      openingTime: openingTime || undefined,
      closingTime: closingTime || undefined,
      closedDays,
    };
    try {
      if (isEdit && shop) {
        const { slug: _s, ...rest } = body;
        void _s;
        await updateShop({ id: shop.id, body: rest }).unwrap();
        toast.success("Branch updated");
      } else {
        const created = await createShop({
          ...body,
          ...(platform && accountId ? { accountId } : {}),
        }).unwrap();
        toast.success("Branch created");

        // Optionally hand the fresh branch to a Branch Owner. The branch is
        // already saved, so if the invite fails we keep the drawer's owner
        // fields and surface the error rather than losing the branch.
        if (ownerRequested) {
          try {
            const owner = await createUser({
              name: ownerName.trim(),
              email: ownerEmail.trim(),
              phone: ownerPhone.trim() || undefined,
              role: "shop_admin",
              shopIds: [created.id],
            }).unwrap();
            // Mint a reset-password link the owner uses to set their password.
            const res = await resetPassword(owner.id).unwrap();
            setResetToken(res.resetToken);
            toast.success("Branch owner created");
            return; // Stay open to show the reset-password link.
          } catch (err) {
            toast.error(apiError(err, "Branch saved, but the owner invite failed"));
            return;
          }
        }
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to save branch"));
    }
  };

  if (resetToken) {
    const link = `${window.location.origin}/set-password?token=${resetToken}`;
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Branch created · owner added</SheetTitle>
            <SheetDescription>
              Share this reset-password link (valid 7 days). {ownerName || "The owner"} will
              choose their own password before signing in.
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center gap-2 py-4">
            <Input readOnly value={link} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                toast.success("Copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <SheetFooter className="mt-auto">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  const branchFields = (
    <div className="grid gap-4 py-2 sm:grid-cols-2">
      {/* Only offer the picker when the shop isn't already implied by context. */}
          {needsAccountPicker && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Shop</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                <SelectContent>
                  {(accounts?.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branchName">Branch name</Label>
            <Input
              id="branchName"
              value={branchName}
              onChange={(e) => onBranchNameChange(e.target.value)}
              placeholder="Kothrud Branch"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">
              Slug {isEdit && <span className="text-muted-foreground">(fixed)</span>}
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                // Normalise on blur, not per keystroke, so a trailing dash can be typed.
                setSlug(e.target.value);
              }}
              onBlur={(e) => setSlug(slugify(e.target.value))}
              placeholder="kothrud"
              disabled={isEdit}
            />
            {!isEdit && (
              <p className="text-xs text-muted-foreground">
                Auto-filled from the name. Cannot be changed later.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayArea">Display area</Label>
            <Input
              id="displayArea"
              value={displayArea}
              onChange={(e) => setDisplayArea(e.target.value)}
              placeholder="Kothrud"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Pune"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, area, landmark…"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Banner image</Label>
            <ImageUploader
              value={bannerUrl ? [bannerUrl] : []}
              onChange={(urls) => setBannerUrl(urls[0] ?? "")}
              folder="shops"
              max={1}
              aspect="banner"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>WhatsApp number</Label>
            <PhoneInput
              defaultCountry="IN"
              placeholder="Enter phone number"
              value={whatsapp}
              onChange={(v) => setWhatsapp(v ?? "")}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Opening hours</Label>
            <div
              className={cn(
                "flex items-stretch rounded-md border transition-colors",
                "focus-within:ring-1 focus-within:ring-ring",
                hoursInvalid && "border-destructive",
              )}
            >
              <Clock className="ml-3 h-4 w-4 shrink-0 self-center text-muted-foreground" />
              <TimeSelect
                value={openingTime}
                onChange={setOpeningTime}
                placeholder="Opening time"
              />
              <span className="flex select-none items-center px-1 text-sm text-muted-foreground">
                –
              </span>
              <TimeSelect
                value={closingTime}
                onChange={setClosingTime}
                placeholder="Closing time"
              />
            </div>
            {hoursInvalid ? (
              <p className="text-xs text-destructive">
                Closing time must be after opening time.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave blank if the branch has no fixed hours.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <Label>Closed days</Label>
              <span className="text-xs text-muted-foreground">
                {closedDays.length === 0
                  ? "Open every day"
                  : `Closed ${closedDays.length} ${closedDays.length === 1 ? "day" : "days"}`}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => {
                const closed = closedDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={closed}
                    aria-label={`${d} — ${closed ? "closed" : "open"}`}
                    className={cn(
                      "rounded-md border py-2 text-xs font-medium capitalize transition-colors",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      closed
                        ? "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
                        : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap a day to grey it out and mark the branch closed.
            </p>
          </div>
        </div>
  );

  const ownerFields = (
    <div className="grid gap-3 py-2 sm:grid-cols-2">
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Invite someone to manage this branch. They&rsquo;ll receive a link to set
        their password after the branch is created. Leave blank to add an owner
        later from the Team page.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label>Owner name <span className="text-destructive">*</span></Label>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Full name"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Owner email <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            className="pl-9"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@example.com"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Owner phone</Label>
        <PhoneInput
          defaultCountry="IN"
          placeholder="Enter phone number"
          value={ownerPhone}
          onChange={(v) => setOwnerPhone(v ?? "")}
        />
      </div>
    </div>
  );

  const saving = creating || updating || invitingOwner || resetting;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b p-6 pr-14">
          <SheetTitle>
            {isEdit ? "Edit branch" : "New branch"}
            {scopedShopName && (
              <span className="text-muted-foreground"> · {scopedShopName}</span>
            )}
          </SheetTitle>
          <SheetDescription>
            {canAddOwner
              ? "Branch details, hours, and an optional owner to invite."
              : "Branch details, hours, and closed days."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Shop Owners split the form into Branch Details + Associated User; the
              lean platform/edit flow shows the branch fields on their own. */}
          {canAddOwner ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "branch" | "owner")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="branch">
                  <Store className="mr-2 h-4 w-4" />
                  Branch Details
                </TabsTrigger>
                <TabsTrigger value="owner">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Associated User details
                </TabsTrigger>
              </TabsList>
              <TabsContent value="branch">{branchFields}</TabsContent>
              <TabsContent value="owner">{ownerFields}</TabsContent>
            </Tabs>
          ) : (
            branchFields
          )}
        </div>

        <SheetFooter className="border-t p-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || hoursInvalid}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save" : ownerRequested ? "Create & invite" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Borderless on purpose — the parent group draws the single shared frame. */
function TimeSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  // Existing branches may hold a time that isn't on the half-hour grid; keep it
  // selectable so opening the dialog can't silently drop it.
  const slots = useMemo(() => {
    if (!value || TIME_SLOTS.some((t) => t.value === value)) return TIME_SLOTS;
    return [...TIME_SLOTS, { value, label: formatTimeLabel(value) }].sort((a, b) =>
      a.value.localeCompare(b.value),
    );
  }, [value]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={placeholder}
        className="flex-1 border-0 bg-transparent px-2 shadow-none focus:ring-0"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {slots.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
