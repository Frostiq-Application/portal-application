import { useState } from "react";
import { Search, Users, X } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListCustomersQuery } from "@/features/api/customersApi";
import { useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
} from "@/features/branch/branchSlice";
import type { Customer } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShopSelect } from "@/components/ShopSelect";
import { CustomerDetailSheet } from "@/components/customers/CustomerDetailSheet";
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

function inr(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

export function CustomersPage() {
  const branchId = useAppSelector(selectSelectedBranchId);
  // "All branches" → no shopId filter (account super admin sees everyone).
  const shopId = branchId === ALL_BRANCHES ? undefined : branchId;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useListCustomersQuery({
    limit: 100,
    search: debouncedSearch || undefined,
    shopId,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Your customers, their spend, and order history"
        actions={<ShopSelect allowAll />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead>Last order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? "No customers match your search."
                      : "No customers yet."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <CustomerRow key={c.id} customer={c} onOpen={() => setOpenId(c.id)} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerDetailSheet
        customerId={openId}
        onOpenChange={(open) => !open && setOpenId(null)}
      />
    </>
  );
}

function CustomerRow({
  customer,
  onOpen,
}: {
  customer: Customer;
  onOpen: () => void;
}) {
  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell>
        <div className="font-medium">{customer.name ?? "Guest"}</div>
        {!customer.isActive && (
          <span className="text-[10px] uppercase text-muted-foreground">
            Inactive
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div>{customer.phone ?? "—"}</div>
        {customer.email && <div className="truncate">{customer.email}</div>}
      </TableCell>
      <TableCell className="text-right text-sm">{customer.orderCount}</TableCell>
      <TableCell className="text-right text-sm font-medium">
        {inr(customer.totalSpent)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
      </TableCell>
    </TableRow>
  );
}
