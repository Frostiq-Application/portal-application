import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateShopMutation,
  useUpdateShopMutation,
  type CreateShopBody,
} from "@/features/api/shopsApi";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const submit = async () => {
    if (branchName.trim().length < 2) return toast.error("Branch name required");
    if (!isEdit && !slug.trim()) return toast.error("Slug required");
    if (hoursInvalid) return toast.error("Closing time must be after opening time");
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
        await createShop({
          ...body,
          ...(platform && accountId ? { accountId } : {}),
        }).unwrap();
        toast.success("Branch created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to save branch"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit branch" : "New branch"}
            {scopedShopName && (
              <span className="text-muted-foreground"> · {scopedShopName}</span>
            )}
          </DialogTitle>
          <DialogDescription>Branch details, hours, and closed days.</DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={creating || updating || hoursInvalid}>
            {(creating || updating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
