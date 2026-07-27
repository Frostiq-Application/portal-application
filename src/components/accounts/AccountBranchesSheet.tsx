import { useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarOff, Check, Clock, MapPin, MoreHorizontal, Pencil, Phone, Plus, Store } from "@/components/ui/icons";
import { apiError } from "@/lib/apiError";
import {
  useActivateShopMutation,
  useListShopsQuery,
  useSuspendShopMutation,
} from "@/features/api/shopsApi";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { ShopStatusBadge } from "@/components/StatusBadge";
import { ShopDialog } from "@/components/shops/ShopDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

export function AccountBranchesSheet({
  open,
  onOpenChange,
  accountId,
  accountName,
}: Props) {
  const { data, isLoading } = useListShopsQuery(
    { page: 1, limit: 100, accountId },
    { skip: !open },
  );
  const [suspend] = useSuspendShopMutation();
  const [activate] = useActivateShopMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);

  const rows = data?.data ?? [];

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: Shop) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b p-5 pr-14">
            <div className="min-w-0">
              <SheetTitle className="truncate">Branches</SheetTitle>
              <SheetDescription className="truncate">
                Outlets for {accountName}
                {!isLoading && rows.length > 0 ? ` · ${rows.length}` : ""}
              </SheetDescription>
            </div>
            <Button size="sm" onClick={openNew} className="shrink-0">
              <Plus className="mr-1 h-4 w-4" />
              Add branch
            </Button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed bg-muted/20 py-14 text-center">
                <Store className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">No branches yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add the first outlet for {accountName}.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={openNew}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add branch
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((s) => (
                  <BranchRow
                    key={s.id}
                    shop={s}
                    onEdit={() => openEdit(s)}
                    onSuspend={() =>
                      run(() => suspend(s.id).unwrap(), "Branch deactivated")
                    }
                    onActivate={() =>
                      run(() => activate(s.id).unwrap(), "Branch activated")
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ShopDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shop={editing}
        defaultAccountId={accountId}
        defaultAccountName={accountName}
      />
    </>
  );
}

interface BranchRowProps {
  shop: Shop;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
}

function BranchRow({ shop: s, onEdit, onSuspend, onActivate }: BranchRowProps) {
  const hours =
    s.openingTime && s.closingTime
      ? `${s.openingTime.slice(0, 5)}–${s.closingTime.slice(0, 5)}`
      : null;
  const location = [s.displayArea, s.city].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-sm transition-shadow hover:shadow-md",
        s.status !== "active" && "opacity-80",
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-primary/5">
          {s.bannerUrl ? (
            <img
              src={s.bannerUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <Store className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* Title + location + status */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{s.branchName}</p>
            <div className="flex shrink-0 items-center gap-1">
              <ShopStatusBadge status={s.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Actions for ${s.branchName}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    View / Edit
                  </DropdownMenuItem>
                  {s.status === "active" ? (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={onSuspend}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onActivate}>
                      <Check className="mr-2 h-4 w-4" />
                      Activate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{location || "No location set"}</span>
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80">
            /{s.slug}
          </p>
        </div>
      </div>

      {/* Feature strip */}
      <div className="grid grid-cols-3 divide-x border-t bg-muted/30 text-center">
        <Feature icon={Clock} label={hours ?? "—"} caption="Hours" />
        <Feature
          icon={Phone}
          label={s.whatsappNumber ?? "—"}
          caption="WhatsApp"
        />
        <Feature
          icon={CalendarOff}
          label={s.closedDays.length ? s.closedDays.join(", ") : "None"}
          caption="Closed"
        />
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  label,
  caption,
}: {
  icon: typeof MapPin;
  label: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="w-full truncate text-xs font-medium">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {caption}
      </span>
    </div>
  );
}
