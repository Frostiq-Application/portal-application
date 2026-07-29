import { FloorBoard } from "@/components/floor/FloorBoard";
import { FloorBranchFilter } from "@/components/floor/FloorBranchFilter";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapPin, Phone, User } from "@/components/ui/icons";

/**
 * The dispatch board — what's boxed and where it's going.
 *
 * Gated on `delivery.view`. Unlike the kitchen this one *does* show the address
 * and a phone number, because you cannot complete a drop without them; that
 * difference is exactly why `customers.view` is in the delivery manager's
 * defaults and not the chef's.
 */
export function DeliveryPage() {
  return (
    <>
      <PageHeader
        title="Delivery"
        description="Drag a card to the next lane, or use the button — what's ready and what's on the road"
        actions={<FloorBranchFilter />}
      />
      <FloorBoard
        lanes={[
          {
            status: "ready",
            label: "Ready to dispatch",
            hint: "Boxed and waiting",
          },
          {
            status: "out_for_delivery",
            label: "On the road",
            hint: "Mark delivered on handover",
          },
        ]}
        actions={[
          {
            from: "ready",
            to: "out_for_delivery",
            label: "Out for delivery",
            primary: true,
          },
          { from: "out_for_delivery", to: "delivered", label: "Delivered", primary: true },
        ]}
        emptyLabel="Nothing waiting to go out."
        showContact
        renderDetail={(order) => {
          // Pickup orders have no address — showing an empty block for them
          // would read as missing data rather than "they're coming to you".
          if (order.deliveryType === "pickup") {
            return (
              <p className="rounded-xl bg-muted px-4 py-3 text-base font-semibold">
                Pickup — customer collects from the branch
              </p>
            );
          }
          const addr = order.deliveryAddress;
          const phone = order.customer?.phone;
          const name = order.customer?.name;
          if (!addr && !phone && !name) return null;
          return (
            <div className="grid gap-3 rounded-xl bg-muted px-4 py-3">
              {/* Who to hand it to, before where to take it — it's the first
                  thing said at the door. */}
              {name && (
                <p className="flex items-center gap-2.5 text-base font-bold">
                  <User className="size-5 shrink-0 text-muted-foreground" />
                  {name}
                </p>
              )}
              {addr && (
                <p className="flex gap-2.5 text-base leading-snug">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <span>
                    {addr.fullAddress}
                    {addr.landmark && (
                      <span className="block text-sm text-muted-foreground">
                        Near {addr.landmark}
                      </span>
                    )}
                    {(addr.city || addr.pincode) && (
                      <span className="block text-sm text-muted-foreground">
                        {[addr.city, addr.pincode].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </span>
                </p>
              )}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-2.5 text-base font-bold text-primary"
                >
                  <Phone className="size-5 shrink-0" />
                  {phone}
                </a>
              )}
            </div>
          );
        }}
      />
    </>
  );
}
