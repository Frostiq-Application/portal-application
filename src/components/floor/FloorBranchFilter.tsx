import { useCan } from "@/hooks/useCan";
import { ShopSelect } from "@/components/ShopSelect";

/**
 * The branch picker for the floor boards — the same one the Orders queue uses,
 * writing to the same shared slice, so a branch chosen on one screen is the
 * branch every other screen opens on.
 *
 * Hidden for chefs, riders and branch staff. Not as a courtesy: listing shops
 * needs `branches.view`, which those roles don't hold, so the dropdown would be
 * an empty box over a 403 — and they are scoped to their own branch server-side
 * anyway, which is the answer the picker would have given them.
 */
export function FloorBranchFilter() {
  const { can } = useCan();
  if (!can("branches.view")) return null;
  return <ShopSelect />;
}
