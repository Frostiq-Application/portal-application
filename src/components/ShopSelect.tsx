import { useEffect } from "react";
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
 * Branch picker for shop-scoped screens (catalog, coupons, scheduling).
 * Auto-selects the first branch once loaded if nothing is chosen yet.
 */
export function ShopSelect({
  value,
  onChange,
  label = "Branch",
}: {
  value: string;
  onChange: (shopId: string) => void;
  label?: string;
}) {
  const { data } = useListShopsQuery({ page: 1, limit: 100 });
  const shops = data?.data ?? [];

  useEffect(() => {
    if (!value && shops.length > 0) onChange(shops[0].id);
  }, [value, shops, onChange]);

  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
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
