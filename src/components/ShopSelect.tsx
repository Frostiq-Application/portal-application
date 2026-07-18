import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  ALL_BRANCHES,
  selectSelectedBranchId,
  setSelectedBranch,
} from "@/features/branch/branchSlice";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Branch picker for shop-scoped screens (catalog, orders, coupons, scheduling).
 * The selection is shared across the app via the `branch` Redux slice and
 * persisted to localStorage.
 *
 * - `allowAll` adds an "All branches" option (used by Orders).
 * - `onChange` is an optional side-effect callback (e.g. reset pagination); the
 *   slice is always updated regardless.
 */
export function ShopSelect({
  label = "Branch",
  allowAll = false,
  onChange,
}: {
  label?: string;
  allowAll?: boolean;
  onChange?: (branchId: string) => void;
}) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(selectSelectedBranchId);
  const { data } = useListShopsQuery({ page: 1, limit: 100 });
  const shops = data?.data ?? [];

  // Establish a sensible default once shops load and nothing is chosen yet:
  // "All branches" when the page offers it, otherwise the first branch.
  useEffect(() => {
    if (selected) return;
    if (allowAll) dispatch(setSelectedBranch(ALL_BRANCHES));
    else if (shops.length > 0) dispatch(setSelectedBranch(shops[0].id));
  }, [selected, allowAll, shops, dispatch]);

  // A persisted concrete branch that this account can no longer see (or an
  // "all" left over on a page that doesn't allow it) shouldn't stick.
  useEffect(() => {
    if (!selected) return;
    if (selected === ALL_BRANCHES) {
      if (!allowAll && shops.length > 0) dispatch(setSelectedBranch(shops[0].id));
      return;
    }
    if (shops.length > 0 && !shops.some((s) => s.id === selected)) {
      dispatch(setSelectedBranch(allowAll ? ALL_BRANCHES : shops[0].id));
    }
  }, [selected, allowAll, shops, dispatch]);

  const handleChange = (id: string) => {
    dispatch(setSelectedBranch(id));
    onChange?.(id);
  };

  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>}
          {shops.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.branchName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
