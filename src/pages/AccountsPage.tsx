import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Store } from "@/components/ui/icons";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_OPTIONS: { label: string; value: AccountStatus | "all" }[] = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

function extractError(err: unknown): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return msg ?? "Action failed.";
}

const PAGE_SIZE = 24;

export function AccountsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [items, setItems] = useState<Account[]>([]);

  const { data, isLoading, isFetching } = useListAccountsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  });

  const [approve] = useApproveAccountMutation();
  const [suspend] = useSuspendAccountMutation();
  const [reactivate] = useReactivateAccountMutation();
  const [reject] = useRejectAccountMutation();

  const [rejectTarget, setRejectTarget] = useState<Account | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [branchesTarget, setBranchesTarget] = useState<Account | null>(null);

  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const hasMore = page < totalPages;

  // Reset the accumulator whenever the search term or status filter changes.
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [debouncedSearch, status]);

  // Accumulate pages for infinite scroll. Page 1 (initial load, filter change,
  // or a mutation refetch that invalidates LIST) replaces the accumulator.
  useEffect(() => {
    if (!data) return;
    setItems((prev) =>
      data.meta.page === 1
        ? data.data
        : [
            ...prev.filter((p) => !data.data.some((n) => n.id === p.id)),
            ...data.data,
          ],
    );
  }, [data]);

  const loadMore = useCallback(() => {
    if (!isFetching) setPage((p) => p + 1);
  }, [isFetching]);

  const run = async (
    fn: () => Promise<unknown>,
    okMsg: string,
  ): Promise<void> => {
    try {
      await fn();
      toast.success(okMsg);
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error("Please provide a reason.");
      return;
    }
    await run(
      () => reject({ id: rejectTarget.id, reason: rejectReason }).unwrap(),
      "Shop rejected.",
    );
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
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as AccountStatus | "all");
            setPage(1);
          }}
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
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
          loader={
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          }
          endMessage={
            <p className="pt-6 text-center text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "shop" : "shops"}
            </p>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                onEdit={() => setEditTarget(a)}
                onApprove={() =>
                  run(() => approve(a.id).unwrap(), "Shop approved.")
                }
                onReject={() => setRejectTarget(a)}
                onSuspend={() =>
                  run(() => suspend({ id: a.id }).unwrap(), "Shop suspended.")
                }
                onReactivate={() =>
                  run(() => reactivate(a.id).unwrap(), "Shop reactivated.")
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
          if (!o) {
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
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitReject}>
              Reject shop
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
