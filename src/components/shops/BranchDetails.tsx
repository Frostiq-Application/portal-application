import { CalendarOff, Clock, Hash, MapPin, Pencil, Phone, ShieldCheck } from "@/components/ui/icons";
import type { Shop } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DAY_LABEL: Record<string, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

/**
 * Rich single-branch view for a shop admin (who owns exactly one branch). Shows
 * the branch as a detail page with a hero illustration instead of a card in a
 * grid — the grid only makes sense for multi-branch (account/platform) admins.
 */
export function BranchDetails({
  shop,
  onEdit,
}: {
  shop: Shop;
  onEdit: () => void;
}) {
  const hours =
    shop.openingTime && shop.closingTime
      ? `${shop.openingTime.slice(0, 5)} – ${shop.closingTime.slice(0, 5)}`
      : "Not set";
  const location =
    [shop.displayArea, shop.city].filter(Boolean).join(" · ") || "No area set";
  const closed =
    shop.closedDays.length > 0
      ? shop.closedDays.map((d) => DAY_LABEL[d] ?? d).join(", ")
      : "Open every day";

  return (
    <>
      <PageHeader
        title="My Branch"
        description="Your outlet at a glance"
        actions={
          <Button onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit branch
          </Button>
        }
      />

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="relative h-44 w-full sm:h-52">
          {shop.bannerUrl ? (
            <img
              src={shop.bannerUrl}
              alt={shop.branchName}
              className="h-full w-full object-cover"
            />
          ) : (
            <BranchHeroArt />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold text-white drop-shadow-sm">
                {shop.branchName}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-white/90">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </p>
            </div>
            <ShopStatusBadge status={shop.status} />
          </div>
        </div>
      </Card>

      {/* Detail tiles */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <DetailTile
          icon={Clock}
          label="Working hours"
          value={hours}
          accent="#6366f1"
        />
        <DetailTile
          icon={CalendarOff}
          label="Closed days"
          value={closed}
          accent="#f59e0b"
        />
        <DetailTile
          icon={Phone}
          label="WhatsApp"
          value={shop.whatsappNumber ?? "Not set"}
          accent="#10b981"
        />
        <DetailTile
          icon={MapPin}
          label="Address"
          value={shop.address ?? "Not set"}
          accent="#ef4444"
        />
        <DetailTile
          icon={Hash}
          label="Storefront slug"
          value={`/${shop.slug}`}
          mono
        />
        <DetailTile
          icon={ShieldCheck}
          label="FSSAI licence"
          value={shop.fssaiNumber ?? "Not set"}
        />
      </div>
    </>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
  accent,
  mono,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: accent ? `${accent}1a` : "hsl(var(--muted))",
            color: accent ?? "hsl(var(--muted-foreground))",
          }}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={
              "mt-0.5 break-words text-sm font-medium" +
              (mono ? " font-mono" : "")
            }
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Cheerful bakery-storefront illustration used when no banner is uploaded. */
function BranchHeroArt() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-50 via-amber-50 to-indigo-50">
      <svg
        viewBox="0 0 240 140"
        className="h-full w-auto"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* awning */}
        <rect x="48" y="34" width="144" height="18" rx="3" fill="#f9a8c9" />
        <path
          d="M48 52 h144 v10 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 z"
          fill="#fdf2f8"
        />
        {/* storefront */}
        <rect x="60" y="62" width="120" height="58" rx="4" fill="#ffffff" />
        <rect x="60" y="112" width="120" height="8" fill="#e5e7eb" />
        {/* door */}
        <rect x="108" y="80" width="24" height="40" rx="2" fill="#c7d2fe" />
        <circle cx="127" cy="100" r="1.6" fill="#4f46e5" />
        {/* windows */}
        <rect x="72" y="80" width="26" height="22" rx="2" fill="#bae6fd" />
        <rect x="142" y="80" width="26" height="22" rx="2" fill="#bae6fd" />
        {/* cake in window */}
        <rect x="78" y="90" width="14" height="10" rx="2" fill="#f9a8c9" />
        <circle cx="85" cy="88" r="2" fill="#f43f5e" />
        {/* sign */}
        <rect x="96" y="24" width="48" height="12" rx="6" fill="#fbbf24" />
        {/* store icon glyph on sign */}
        <circle cx="120" cy="30" r="3" fill="#fff7ed" />
      </svg>
    </div>
  );
}
