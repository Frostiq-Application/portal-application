import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, Store } from "@/components/ui/icons";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useRowAction } from "@/hooks/useRowAction";
import {
  useApproveAccountMutation,
  useListAccountsQuery,
  useReactivateAccountMutation,
  useRejectAccountMutation,
  useSuspendAccountMutation,
} from "@/features/api/accountsApi";
import type { Account, AccountStatus } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateAccountDialog } from "@/components/accounts/CreateAccountDialog";
import { EditAccountDialog } from "@/components/accounts/EditAccountDialog";
import { AccountBranchesSheet } from "@/components/accounts/AccountBranchesSheet";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountCardSkeletonGrid } from "@/components/accounts/AccountCardSkeleton";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

const STATUS_OPTIONS: { label: string; value: AccountStatus | "all" }[] = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

const PAGE_SIZE = 24;

export function AccountsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const debouncedSearch = useDebouncedValue(search, 350);

  // The debounce window is dead time the user can see: they have typed, the
  // request hasn't left yet. Count it as loading, so the grid never sits there
  // showing results for a term that is already gone.
  const isTyping = search !== debouncedSearch;

  const { page, items, hasMore, total, ingest, loadMore: loadNextPage } =
    useInfiniteList<Account>([debouncedSearch, status].join("|"));

  // `currentData`, not `data`: RTK keeps the PREVIOUS filter's response in
  // `data` (same object identity) while the new one is in flight, which both
  // hides the fact that we're loading and, when the new filter is already
  // cached, looks like "nothing changed" to the accumulator.
  const { currentData, isFetching } = useListAccountsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  });
  ingest(currentData);

  // Skeletons whenever we have nothing to show for what the user is asking for
  // — the debounce window, the first load, and every filter change. Paging past
  // page 1 keeps the grid up and shows the loader underneath instead.
  const showSkeletons = isTyping || (page === 1 && isFetching && !currentData);

  const [approve] = useApproveAccountMutation();
  const [suspend] = useSuspendAccountMutation();
  const [reactivate] = useReactivateAccountMutation();
  const [reject] = useRejectAccountMutation();
  const { busyLabel, run } = useRowAction();

  const [rejectTarget, setRejectTarget] = useState<Account | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [branchesTarget, setBranchesTarget] = useState<Account | null>(null);
  const rejecting = !!rejectTarget && !!busyLabel(rejectTarget.id);

  // Memoized: InfiniteScroll rebuilds its IntersectionObserver whenever this
  // identity changes, and a fresh observer re-fires on a sentinel that is
  // already in view — which would skip a page.
  const loadMore = useCallback(() => {
    if (!isFetching) loadNextPage();
  }, [isFetching, loadNextPage]);

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error("Please provide a reason.");
      return;
    }
    // The dialog stays up, with the button spinning, until the API answers —
    // closing it first would leave nothing on screen to say the work is out,
    // and on a failure it would throw away the reason they just typed.
    const ok = await run(
      {
        id: rejectTarget.id,
        pending: "Rejecting shop…",
        success: "Shop rejected.",
      },
      () => reject({ id: rejectTarget.id, reason: rejectReason }).unwrap(),
    );
    if (!ok) return;
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <>
      <PageHeader
        title="Shops"
        description="Shop brands on the platform"
        actions={<CreateAccountDialog />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or slug…"
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-busy={showSkeletons}
          />
          {/* Reassurance inside the field itself: the keystroke registered and
              a result is coming, even before the debounce lets the request go. */}
          {showSkeletons && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as AccountStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeletons ? (
        <AccountCardSkeletonGrid />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-background py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Store className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No shops found</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {search || status !== "all"
                ? "Try adjusting your search or status filter."
                : "Onboard your first shop to get started."}
            </p>
          </div>
        </div>
      ) : (
        <InfiniteScroll
          hasMore={hasMore}
          loading={isFetching}
          onLoadMore={loadMore}
          loader={<AccountCardSkeletonGrid count={3} className="pt-4" />}
          endMessage={
            <p className="pt-6 text-center text-xs text-muted-foreground">
              {total} {total === 1 ? "shop" : "shops"}
            </p>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                busy={busyLabel(a.id)}
                onEdit={() => setEditTarget(a)}
                onApprove={() =>
                  run(
                    {
                      id: a.id,
                      pending: "Approving shop…",
                      success: "Shop approved.",
                    },
                    () => approve(a.id).unwrap(),
                  )
                }
                onReject={() => setRejectTarget(a)}
                onSuspend={() =>
                  run(
                    {
                      id: a.id,
                      pending: "Suspending shop…",
                      success: "Shop suspended.",
                    },
                    () => suspend({ id: a.id }).unwrap(),
                  )
                }
                onReactivate={() =>
                  run(
                    {
                      id: a.id,
                      pending: "Reactivating shop…",
                      success: "Shop reactivated.",
                    },
                    () => reactivate(a.id).unwrap(),
                  )
                }
                onViewSubscription={() =>
                  navigate(`/subscriptions?accountId=${a.id}`)
                }
                onViewBranches={() => setBranchesTarget(a)}
              />
            ))}
          </div>
        </InfiniteScroll>
      )}

      {/* Reject reason dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          // Escape / click-away is off while the request is out: the dialog is
          // the only place the reason is held.
          if (!o && !rejecting) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject shop</DialogTitle>
            <DialogDescription>
              This reason is shown to <strong>{rejectTarget?.name}</strong>&rsquo;s
              owner.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. FSSAI documents could not be verified."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            disabled={rejecting}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectTarget(null)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={rejecting}
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rejecting ? "Rejecting…" : "Reject shop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditAccountDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        account={editTarget}
      />

      <AccountBranchesSheet
        open={!!branchesTarget}
        onOpenChange={(o) => !o && setBranchesTarget(null)}
        accountId={branchesTarget?.id ?? ""}
        accountName={branchesTarget?.name ?? ""}
      />
    </>
  );
}
