import { useMemo, useState } from "react";
import { Clock, Loader2, Mail, MapPin, Store, User as UserIcon, Check } from "@/components/ui/icons";
import { toast } from "sonner";
import { InviteSentPanel } from "@/components/common/InviteSentPanel";
import {
  useCreateShopMutation,
  useUpdateShopMutation,
  type CreateShopBody,
} from "@/features/api/shopsApi";
import {
  useAssignShopMutation,
  useCreateUserMutation,
  useListUsersQuery,
} from "@/features/api/usersApi";
import { BranchTeamAccess } from "@/components/shops/BranchTeamAccess";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdmin } from "@/lib/roles";
import { apiError } from "@/lib/apiError";
import { cn, slugify } from "@/lib/utils";
import {
  TIME_SLOTS,
  WEEKDAYS,
  formatCoordinates,
  formatTimeLabel,
  parseCoordinates,
  parseGoogleReviewTarget,
} from "@/lib/branch";
import {
  useGetReviewCouponQuery,
  useRemoveReviewCouponMutation,
  useUpsertReviewCouponMutation,
} from "@/features/api/reviewCouponApi";
import type { CouponType, Shop } from "@/types";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
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
  const [assignShop, { isLoading: assigning }] = useAssignShopMutation();
  const [upsertReviewCoupon] = useUpsertReviewCouponMutation();
  const [removeReviewCoupon] = useRemoveReviewCouponMutation();
  // Only the account's own staff can be assigned, so platform admins editing
  // someone else's branch see the list for that account.
  const { data: teamPage } = useListUsersQuery(
    { page: 1, limit: 100 },
    { skip: !open },
  );

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
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [reviewPromptEnabled, setReviewPromptEnabled] = useState(false);
  const [reviewDelayHours, setReviewDelayHours] = useState("3");
  /** Set when a paste didn't contain anything we can open a review form with. */
  const [reviewLinkInvalid, setReviewLinkInvalid] = useState(false);

  // Thank-you coupon. Given for the in-app rating, never for the Google review
  // — paying for a Google review breaches Google's policy and the penalty lands
  // on the shop's listing.
  const [rewardOn, setRewardOn] = useState(false);
  const [rewardCode, setRewardCode] = useState("THANKYOU");
  const [rewardType, setRewardType] = useState<CouponType>("percentage");
  const [rewardValue, setRewardValue] = useState("10");
  const [rewardMaxDiscount, setRewardMaxDiscount] = useState("");
  const [rewardMinOrder, setRewardMinOrder] = useState("");
  /** Which branch's coupon the fields above currently hold. */
  const [rewardSeeded, setRewardSeeded] = useState<string | null>(null);
  /** Once the user edits the slug by hand, stop syncing it from the name. */
  const [slugTouched, setSlugTouched] = useState(false);

  // Seeded during render rather than in an effect so the fields are correct on
  // first paint instead of flashing the previous branch's values for a frame.
  const seedKey = open ? (shop?.id ?? `new:${defaultAccountId ?? ""}`) : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    {
      setAccountId(shop?.accountId ?? defaultAccountId ?? "");
      setBranchName(shop?.branchName ?? "");
      setSlug(shop?.slug ?? "");
      setDisplayArea(shop?.displayArea ?? "");
      setBannerUrl(shop?.bannerUrl ?? "");
      setAddress(shop?.address ?? "");
      setLatitude(shop?.latitude ?? "");
      setLongitude(shop?.longitude ?? "");
      setCity(shop?.city ?? "");
      setWhatsapp(shop?.whatsappNumber ?? "");
      setOpeningTime(shop?.openingTime?.slice(0, 5) ?? "");
      setClosingTime(shop?.closingTime?.slice(0, 5) ?? "");
      setClosedDays(shop?.closedDays ?? []);
      setGooglePlaceId(shop?.googlePlaceId ?? "");
      setGoogleReviewUrl(shop?.googleReviewUrl ?? "");
      setReviewPromptEnabled(shop?.reviewPromptEnabled ?? false);
      // Stored in minutes, shown in hours — nobody thinks about this in minutes.
      setReviewDelayHours(String((shop?.reviewPromptDelayMinutes ?? 180) / 60));
      setReviewLinkInvalid(false);
      // Reward fields start from the defaults; for an existing branch the block
      // below overwrites them once its coupon arrives. Resetting the seed key
      // is what lets that happen again for the next branch opened.
      setRewardSeeded(null);
      setRewardOn(false);
      setRewardCode("THANKYOU");
      setRewardType("percentage");
      setRewardValue("10");
      setRewardMaxDiscount("");
      setRewardMinOrder("");
      setSlugTouched(false);
      setTab("branch");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPhone("");
      setResetToken(null);
    }
  }

  /*
   * The coupon lives in `coupons`, not on the branch row, so it arrives in its
   * own request rather than with the shop. Seeded during render like everything
   * else here — once, after the request settles, so a slow reply can't land on
   * top of something the user has already typed.
   */
  const { data: existingReward, isLoading: rewardLoading } =
    useGetReviewCouponQuery(shop?.id ?? "", { skip: !open || !shop?.id });
  const rewardKey = open && shop?.id && !rewardLoading ? shop.id : null;
  if (rewardKey && rewardKey !== rewardSeeded) {
    setRewardSeeded(rewardKey);
    setRewardOn(Boolean(existingReward));
    if (existingReward) {
      setRewardCode(existingReward.code);
      setRewardType(existingReward.discountType);
      setRewardValue(String(Number(existingReward.discountValue)));
      setRewardMaxDiscount(
        existingReward.maxDiscountAmount
          ? String(Number(existingReward.maxDiscountAmount))
          : "",
      );
      setRewardMinOrder(
        existingReward.minOrderAmount
          ? String(Number(existingReward.minOrderAmount))
          : "",
      );
    }
  }

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

  /** Coordinates must be a valid, complete pair (both or neither) to save. */
  const coordsInvalid = useMemo(() => {
    const hasLat = latitude.trim() !== "";
    const hasLng = longitude.trim() !== "";
    if (!hasLat && !hasLng) return false;
    if (hasLat !== hasLng) return true;
    const lat = Number(latitude);
    const lng = Number(longitude);
    return (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    );
  }, [latitude, longitude]);

  /** Applies a pasted Google Maps link (or "lat, lng") to the two fields. */
  const applyMapLink = (value: string) => {
    const parsed = parseCoordinates(value);
    if (!parsed) return;
    setLatitude(String(parsed.lat));
    setLongitude(String(parsed.lng));
  };

  /**
   * Route a pasted value to whichever field it actually is. Clearing the box
   * clears both, so an emptied field saves as "no review link" rather than
   * leaving the old one behind.
   */
  const applyReviewLink = (value: string) => {
    if (!value.trim()) {
      setGooglePlaceId("");
      setGoogleReviewUrl("");
      setReviewLinkInvalid(false);
      return;
    }
    const parsed = parseGoogleReviewTarget(value);
    setReviewLinkInvalid(!parsed);
    if (!parsed) return;
    setGooglePlaceId(parsed.placeId ?? "");
    setGoogleReviewUrl(parsed.reviewUrl ?? "");
  };

  /** Closing before opening is only valid if the branch trades past midnight. */
  const hoursInvalid = useMemo(
    () =>
      Boolean(openingTime && closingTime && closingTime <= openingTime),
    [openingTime, closingTime],
  );

  // The associated user is optional: a branch owner is invited only when their
  // details are supplied. Any filled field opts in and makes name + email required.
  /** Account staff who could be given access to this branch. */
  const assignable = (teamPage?.data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isOwner: u.role === "account_super_admin",
    pending: u.isActive === false,
  }));
  /** Who can already see this branch — the baseline the form diffs against. */
  const currentlyAssigned = shop
    ? (teamPage?.data ?? [])
        .filter((u) => (u.shopIds ?? []).includes(shop.id))
        .map((u) => u.id)
    : [];
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  // Seed from current access whenever the drawer opens on an existing branch.
  // Done during render so the checkboxes are right on the paint the team list
  // arrives, rather than showing an empty selection for a frame first.
  const accessKey = open ? `${shop?.id ?? "new"}:${teamPage?.data?.length ?? -1}` : null;
  const [accessSeeded, setAccessSeeded] = useState<string | null>(null);
  if (accessKey !== accessSeeded) {
    setAccessSeeded(accessKey);
    if (open) {
      setAssignedUserIds(
        shop
          ? (teamPage?.data ?? [])
              .filter((u) => (u.shopIds ?? []).includes(shop.id))
              .map((u) => u.id)
          : [],
      );
    }
  }

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
    if (coordsInvalid) {
      setTab("branch");
      return toast.error("Enter a valid latitude and longitude pair");
    }
    if (ownerRequested && (ownerName.trim().length < 2 || !ownerEmail.trim())) {
      setTab("owner");
      return toast.error("Branch owner needs a name and email");
    }
    /**
     * Grant access to everyone ticked. Runs after the branch is saved, since
     * an assignment needs a branch id — and it's deliberately non-fatal: the
     * branch is the thing being created, and losing it because one permission
     * grant failed would be a far worse outcome than a warning toast.
     */
    const syncAssignments = async (shopId: string) => {
      const toAdd = assignedUserIds.filter(
        (id) => !currentlyAssigned.includes(id),
      );
      if (toAdd.length === 0) return;
      try {
        for (const id of toAdd) await assignShop({ id, shopId }).unwrap();
      } catch (err) {
        toast.error(apiError(err, "Branch saved, but team access didn't apply"));
      }
    };

    /**
     * Save the thank-you coupon, which is a coupon row rather than a branch
     * column and so needs its own call. Non-fatal like the assignments above:
     * the branch is the thing being saved, and losing it over a reward that
     * didn't stick would be the wrong trade.
     */
    const syncReward = async (shopId: string) => {
      try {
        if (!reviewPromptEnabled || !rewardOn) {
          if (existingReward) await removeReviewCoupon(shopId).unwrap();
          return;
        }
        await upsertReviewCoupon({
          shopId,
          body: {
            code: rewardCode.trim().toUpperCase(),
            discountType: rewardType,
            discountValue: Number(rewardValue || "0"),
            ...(rewardType === "percentage" && rewardMaxDiscount.trim()
              ? { maxDiscountAmount: Number(rewardMaxDiscount) }
              : {}),
            ...(rewardMinOrder.trim()
              ? { minOrderAmount: Number(rewardMinOrder) }
              : {}),
          },
        }).unwrap();
      } catch (err) {
        toast.error(apiError(err, "Branch saved, but the coupon didn't"));
      }
    };

    const body: CreateShopBody = {
      branchName: branchName.trim(),
      slug: slug.trim(),
      displayArea: displayArea.trim() || undefined,
      // null, not undefined: undefined drops the key from the JSON body, so
      // clearing the banner read as "don't touch it" on an edit.
      bannerUrl: bannerUrl || null,
      address: address.trim() || undefined,
      latitude: latitude.trim() ? Number(latitude) : undefined,
      longitude: longitude.trim() ? Number(longitude) : undefined,
      city: city.trim() || undefined,
      whatsappNumber: whatsapp.trim() || undefined,
      openingTime: openingTime || undefined,
      closingTime: closingTime || undefined,
      closedDays,
      // null, not undefined — same reason as the banner: clearing the link has
      // to reach the server as an instruction, not as an omitted key.
      googlePlaceId: googlePlaceId.trim() || null,
      googleReviewUrl: googleReviewUrl.trim() || null,
      reviewPromptEnabled,
      reviewPromptDelayMinutes: Math.round(Number(reviewDelayHours || "3") * 60),
    };
    try {
      if (isEdit && shop) {
        const { slug: _s, ...rest } = body;
        void _s;
        await updateShop({ id: shop.id, body: rest }).unwrap();
        await syncAssignments(shop.id);
        await syncReward(shop.id);
        toast.success("Branch updated");
      } else {
        const created = await createShop({
          ...body,
          ...(platform && accountId ? { accountId } : {}),
        }).unwrap();
        await syncAssignments(created.id);
        await syncReward(created.id);
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
            // `createUser` already mints the set-password token and emails it.
            // This used to follow up with a reset-password call for a second
            // token — harmless when both were only ever copied out of a dialog,
            // but now that each one sends mail it would land the new owner two
            // different invites for the same account.
            setResetToken(owner.inviteToken);
            toast.success(`Branch owner invited. Email sent to ${ownerEmail.trim()}`);
            return; // Stay open to show the invite confirmation.
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
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Branch created · owner added</SheetTitle>
            <SheetDescription>
              {ownerName || "The owner"} will choose their own password before
              signing in.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <InviteSentPanel email={ownerEmail.trim()} token={resetToken} />
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
            <Label htmlFor="mapLink">Location coordinates</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mapLink"
                className="pl-9"
                placeholder="Paste a Google Maps link to auto-fill"
                onChange={(e) => applyMapLink(e.target.value)}
                onPaste={(e) =>
                  applyMapLink(e.clipboardData.getData("text"))
                }
              />
            </div>
            {latitude && longitude && !coordsInvalid ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Location set: {formatCoordinates(latitude, longitude)}
                <button
                  type="button"
                  className="ml-1 font-normal text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setLatitude("");
                    setLongitude("");
                  }}
                >
                  clear
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Open the branch in Google Maps, tap Share, and paste the link.
                Used to show customers their nearest branch.
              </p>
            )}
            {coordsInvalid && (
              <p className="text-xs text-destructive">
                That link didn't contain a usable location. Try the Share link
                from Google Maps.
              </p>
            )}
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
                    aria-label={`${d}: ${closed ? "closed" : "open"}`}
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

          <div className="sm:col-span-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="reviewPromptEnabled">Ask for reviews</Label>
                  <p className="text-xs text-muted-foreground">
                    A few hours after an order is delivered, ask the customer to
                    rate it — then offer to share it on Google.
                  </p>
                </div>
                <Switch
                  id="reviewPromptEnabled"
                  checked={reviewPromptEnabled}
                  onCheckedChange={setReviewPromptEnabled}
                />
              </div>

              {reviewPromptEnabled && (
                <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="googleReview">Google review link</Label>
                    <Input
                      id="googleReview"
                      placeholder="Paste your Place ID or review link"
                      defaultValue={googleReviewUrl || googlePlaceId}
                      onChange={(e) => applyReviewLink(e.target.value)}
                      onPaste={(e) =>
                        applyReviewLink(e.clipboardData.getData("text"))
                      }
                    />
                    {googlePlaceId || googleReviewUrl ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        {googleReviewUrl ? "Review link set" : "Place ID set"}
                        <button
                          type="button"
                          className="ml-1 font-normal text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => {
                            setGooglePlaceId("");
                            setGoogleReviewUrl("");
                            setReviewLinkInvalid(false);
                          }}
                        >
                          clear
                        </button>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Find the branch on Google's Place ID finder and paste the
                        ID. Without it, customers still rate the order in the
                        app — they just aren't offered the Google step.
                      </p>
                    )}
                    {reviewLinkInvalid && (
                      <p className="text-xs text-destructive">
                        That's an ordinary Maps link, which doesn't contain a
                        Place ID. Use the Place ID finder, or paste a link that
                        opens the review form directly.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reviewDelay">Wait after delivery</Label>
                    <div className="relative">
                      <Input
                        id="reviewDelay"
                        type="number"
                        min={1}
                        max={168}
                        step={1}
                        className="pr-16"
                        value={reviewDelayHours}
                        onChange={(e) => setReviewDelayHours(e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        hours
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Asking the moment it arrives rates the delivery, not the
                      cake.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="rewardOn">Thank-you coupon</Label>
                          <p className="text-xs text-muted-foreground">
                            Given for rating in the app — never for the Google
                            review, which Google's rules forbid paying for. It
                            never expires and can be used once per customer.
                          </p>
                        </div>
                        <Switch
                          id="rewardOn"
                          checked={rewardOn}
                          onCheckedChange={setRewardOn}
                        />
                      </div>

                      {rewardOn && (
                        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="rewardCode">Coupon code</Label>
                            <Input
                              id="rewardCode"
                              value={rewardCode}
                              onChange={(e) =>
                                setRewardCode(e.target.value.toUpperCase())
                              }
                              placeholder="THANKYOU"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="rewardType">Discount</Label>
                            <div className="flex gap-2">
                              <Select
                                value={rewardType}
                                onValueChange={(v) =>
                                  setRewardType(v as CouponType)
                                }
                              >
                                <SelectTrigger id="rewardType" className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">%</SelectItem>
                                  <SelectItem value="flat">₹</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={rewardValue}
                                onChange={(e) => setRewardValue(e.target.value)}
                                placeholder={rewardType === "flat" ? "100" : "10"}
                              />
                            </div>
                          </div>

                          {rewardType === "percentage" && (
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor="rewardMax">
                                Cap the discount (₹)
                              </Label>
                              <Input
                                id="rewardMax"
                                type="number"
                                min={0}
                                step="0.01"
                                value={rewardMaxDiscount}
                                onChange={(e) =>
                                  setRewardMaxDiscount(e.target.value)
                                }
                                placeholder="No cap"
                              />
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="rewardMin">
                              Minimum order (₹)
                            </Label>
                            <Input
                              id="rewardMin"
                              type="number"
                              min={0}
                              step="0.01"
                              value={rewardMinOrder}
                              onChange={(e) => setRewardMinOrder(e.target.value)}
                              placeholder="No minimum"
                            />
                          </div>

                          <p className="text-xs text-muted-foreground sm:col-span-2">
                            {isEdit
                              ? "Editing this changes the coupon everyone holds, so nobody is left with a code that stopped working."
                              : "The coupon is created when you save the branch."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
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

      <BranchTeamAccess
        users={assignable}
        selected={assignedUserIds}
        onChange={setAssignedUserIds}
        className="border-t pt-5 sm:col-span-2"
      />
    </div>
  );

  const saving =
    creating || updating || invitingOwner || assigning;

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
          <Button onClick={submit} disabled={saving || hoursInvalid || coordsInvalid}>
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
