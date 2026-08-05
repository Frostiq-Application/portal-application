import { FloorBoard } from "@/components/floor/FloorBoard";
import { FloorBranchFilter } from "@/components/floor/FloorBranchFilter";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * The kitchen board — what to bake, and what to press when it's done.
 *
 * Gated on `kitchen.view`. Shows no prices, no payment state and no customer
 * contact details: a chef needs the cake, the size, the flavour and the
 * deadline, and nothing on this screen should invite a decision that isn't
 * theirs to make.
 */
export function KitchenPage() {
  return (
    <>
      <PageHeader
        title="Kitchen"
        description="Drag a card to the next lane, or use the button. Oldest deadline first"
        actions={<FloorBranchFilter />}
      />
      <FloorBoard
        lanes={[
          {
            status: "confirmed",
            label: "To start",
            hint: "Confirmed, not yet in the oven",
          },
          {
            status: "preparing",
            label: "In progress",
            hint: "Mark ready when boxed",
          },
        ]}
        actions={[
          { from: "confirmed", to: "preparing", label: "Start baking", primary: true },
          { from: "preparing", to: "ready", label: "Mark ready", primary: true },
        ]}
        emptyLabel="Nothing to bake right now."
      />
    </>
  );
}
