import {
  Ban,
  Check,
  CreditCard,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Store,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useListShopsQuery } from "@/features/api/shopsApi";
import type { Account } from "@/types";
import { AccountStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  account: Account;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onViewSubscription: () => void;
}

export function AccountCard({
  account: a,
  onEdit,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onViewSubscription,
}: Props) {
  // limit: 1 keeps the request cheap — only meta.total is used here.
  const { data: shops } = useListShopsQuery({ accountId: a.id, page: 1, limit: 1 });
  const branchCount = shops?.meta.total ?? 0;

  return (
    <div className="group relative flex overflow-hidden rounded-lg border bg-background transition-colors hover:bg-muted/30">
      {/* Left: banner image, fading rightward into the card, with logo + name pinned bottom-left. */}
      <div className="relative h-auto w-40 shrink-0 overflow-hidden bg-muted sm:w-56">
        {a.bannerUrl ? (
          <img
            src={a.bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            <Store className="h-8 w-8 text-primary/40" />
          </div>
        )}
        {/* Fades the image into the card background toward the right. */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
          <div className="flex items-center gap-2">
            {a.logoUrl ? (
              <img
                src={a.logoUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-white/40 object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold uppercase text-white">
                {a.name.slice(0, 2)}
              </span>
            )}
            <span className="truncate text-sm font-medium text-white">
              {a.name}
            </span>
          </div>
        </div>
      </div>

      {/* Right: everything else. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4 pr-12 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 sm:w-1/4">
          <div className="truncate text-sm font-medium">{a.ownerName}</div>
          <div className="truncate text-xs text-muted-foreground">{a.ownerEmail}</div>
        </div>
        <div className="min-w-0 sm:w-1/6">
          <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            /{a.appSlug}
          </code>
        </div>
        <div className="sm:w-24">
          <AccountStatusBadge status={a.status} />
        </div>
        <div className="text-xs text-muted-foreground sm:w-28">
          <span className="font-medium text-foreground">{branchCount}</span>{" "}
          {branchCount === 1 ? "branch" : "branches"}
        </div>
        <div className="text-xs text-muted-foreground sm:w-24">
          {formatDate(a.createdAt)}
        </div>
      </div>

      {/* Sits above the row so opening the menu doesn't trigger any parent click handler. */}
      <div className="absolute right-3 top-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${a.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewSubscription}>
              <CreditCard className="mr-2 h-4 w-4" />
              View subscription
            </DropdownMenuItem>
            {a.status === "pending" && (
              <>
                <DropdownMenuItem onClick={onApprove}>
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onReject}>
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            {a.status === "active" && (
              <DropdownMenuItem className="text-destructive" onClick={onSuspend}>
                <Ban className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
            )}
            {a.status === "suspended" && (
              <DropdownMenuItem onClick={onReactivate}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reactivate
              </DropdownMenuItem>
            )}
            {a.status === "rejected" && (
              <DropdownMenuItem disabled>No actions</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
