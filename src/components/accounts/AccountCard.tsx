import { Ban, Check, CreditCard, Loader2, MoreHorizontal, Pencil, RotateCcw, Store, X } from "@/components/ui/icons";
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
  onViewBranches: () => void;
  /** What this shop is currently doing — "Suspending shop…" — or null. */
  busy?: string | null;
}

export function AccountCard({
  account: a,
  onEdit,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onViewSubscription,
  onViewBranches,
  busy = null,
}: Props) {
  // limit: 1 keeps the request cheap — only meta.total is used here.
  const { data: shops } = useListShopsQuery({ accountId: a.id, page: 1, limit: 1 });
  const branchCount = shops?.meta.total ?? 0;

  return (
    <div
      aria-busy={!!busy}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-background text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {/* The status change is a round-trip to the API. Say so on the card the
          action was taken on, not only in a toast that lands once it's over. */}
      {busy && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/75 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="px-3 text-center text-xs font-medium text-muted-foreground">
            {busy}
          </span>
        </div>
      )}

      {/* Banner image on top, with logo + name pinned bottom-left and status top-left. */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
        {a.bannerUrl ? (
          <img
            src={a.bannerUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            <Store className="h-8 w-8 text-primary/40" />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <AccountStatusBadge status={a.status} />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-10">
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

      {/* Body: owner, slug, branch count, created date. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0 pr-8">
          <div className="truncate text-sm font-medium">{a.ownerName}</div>
          <div className="truncate text-xs text-muted-foreground">{a.ownerEmail}</div>
        </div>
        <code className="w-fit max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          /{a.appSlug}
        </code>
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{branchCount}</span>{" "}
            {branchCount === 1 ? "branch" : "branches"}
          </span>
          <span>{formatDate(a.createdAt)}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-auto w-full"
          onClick={onViewBranches}
        >
          <Store className="mr-1.5 h-4 w-4" />
          View branches
        </Button>
      </div>

      <div className="absolute right-2 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-background/80 backdrop-blur"
              aria-label={`Actions for ${a.name}`}
              disabled={!!busy}
            >
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
