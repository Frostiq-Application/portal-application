import { useState } from "react";
import { Copy, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiError } from "@/lib/apiError";
import {
  useListUsersQuery,
  useResetUserPasswordMutation,
  useUpdateUserMutation,
} from "@/features/api/usersApi";
import { roleLabel } from "@/lib/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { InviteUserDialog } from "@/components/users/InviteUserDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const { data, isLoading } = useListUsersQuery({
    page,
    limit: 20,
    search: debounced || undefined,
  });
  const [updateUser] = useUpdateUserMutation();
  const [resetPassword] = useResetUserPasswordMutation();

  const rows = data?.data ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateUser({ id, body: { isActive } }).unwrap();
      toast.success(isActive ? "User activated" : "User deactivated");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const doReset = async (id: string) => {
    try {
      const res = await resetPassword(id).unwrap();
      await navigator.clipboard?.writeText(res.resetToken);
      toast.success("Reset token copied to clipboard", { icon: <Copy className="h-4 w-4" /> });
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Team"
        description="Admin users & branch assignments"
        actions={<InviteUserDialog />}
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search users…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-sm">{roleLabel(u.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.role === "shop_admin" ? `${u.shopIds.length} assigned` : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        u.isActive
                          ? "text-xs text-emerald-600"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => doReset(u.id)}>
                          Reset password
                        </DropdownMenuItem>
                        {u.isActive ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => toggleActive(u.id, false)}>
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => toggleActive(u.id, true)}>
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </>
  );
}
