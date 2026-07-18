import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Search, Store } from "lucide-react";
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
import { AccountBranchesPanel } from "@/components/accounts/AccountBranchesPanel";
import { AccountCard } from "@/components/accounts/AccountCard";
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

export function AccountsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isLoading, isFetching } = useListAccountsQuery({
    page,
    limit: 20,
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
  const [expanded, setExpanded] = useState<string | null>(null);

  const meta = data?.meta;
  const rows = data?.data ?? [];
  const totalPages = meta?.totalPages ?? 1;

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

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

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
        <div className="flex flex-col gap-3">
          {skeletonRows.map((i) => (
            <div key={i} className="flex overflow-hidden rounded-lg border bg-background">
              <Skeleton className="h-24 w-40 shrink-0 rounded-none sm:w-56" />
              <div className="flex flex-1 items-center gap-4 p-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
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
        <div className="flex flex-col gap-3">
          {rows.map((a) => {
            const isOpen = expanded === a.id;
            return (
              <div key={a.id}>
                <div className="relative">
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    aria-expanded={isOpen}
                  >
                    <AccountCard
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
                    />
                  </button>
                  <ChevronDown
                    className={`pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
                {isOpen && (
                  <div className="mt-2 px-1">
                    <AccountBranchesPanel accountId={a.id} accountName={a.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {meta ? `${meta.total} ${meta.total === 1 ? "shop" : "shops"}` : ""}
          {isFetching && !isLoading ? " · updating…" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

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
    </>
  );
}
