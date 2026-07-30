import { useMemo, useState } from "react";
import { Loader2, Plus, Search, Trash2, UserRound } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useCreateOrderMutation,
  type ManualOrderItemInput,
} from "@/features/api/ordersApi";
import { useListCustomersQuery, useGetCustomerQuery } from "@/features/api/customersApi";
import { useListProductsQuery, useListAddonsQuery } from "@/features/api/catalogApi";
import { useGetSlotsQuery } from "@/features/api/schedulingApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import type {
  Customer,
  DeliveryType,
  OrderPaymentMethod,
  Product,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAYMENT_LABEL: Record<OrderPaymentMethod, string> = {
  cod: "Cash",
  upi_manual: "UPI (manual)",
  other: "Other",
};

interface Line {
  key: number;
  productId: string;
  variantId: string;
  flavorOptionId: string;
  quantity: number;
  addonIds: string[];
}

let lineKey = 0;
const emptyLine = (): Line => ({
  key: ++lineKey,
  productId: "",
  variantId: "",
  flavorOptionId: "",
  quantity: 1,
  addonIds: [],
});

/** Price one line from the loaded catalog for the live preview. */
function linePrice(
  line: Line,
  product: Product | undefined,
  addonPrice: (id: string) => number,
): number {
  if (!product) return 0;
  const variant = product.variants.find((v) => v.id === line.variantId);
  if (!variant) return 0;
  const flavor = product.flavorOptions.find((f) => f.id === line.flavorOptionId);
  const unit = Number(variant.price) + (flavor ? Number(flavor.priceDelta) : 0);
  const addons = line.addonIds.reduce((s, id) => s + addonPrice(id), 0);
  return line.quantity * (unit + addons);
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Pre-selected branch (from the page's branch picker), if a specific one. */
  defaultShopId?: string | null;
}

/**
 * Shop-side manual order entry: pick a branch and a customer, add lines from
 * the live catalog, choose fulfilment & payment — and go. The server re-prices
 * everything; the totals here are only a preview.
 */
export function CreateOrderDialog({ open, onOpenChange, defaultShopId }: Props) {
  const [createOrder, { isLoading: saving }] = useCreateOrderMutation();

  const [shopId, setShopId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  const [addressId, setAddressId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [slot, setSlot] = useState("none");
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("cod");
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [note, setNote] = useState("");

  // Reset to a fresh form each time the dialog opens. Done during render so a
  // reopened dialog never shows the last order's lines for a frame.
  const seedKey = open ? (defaultShopId ?? "any") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    {
      setShopId(defaultShopId ?? "");
      setCustomer(null);
      setCustomerSearch("");
      setLines([emptyLine()]);
      setDeliveryType("pickup");
      setAddressId("");
      setScheduledDate(new Date().toISOString().slice(0, 10));
      setSlot("none");
      setPaymentMethod("cod");
      setMarkAsPaid(false);
      setCouponCode("");
      setNote("");
    }
  }

  const { data: shops } = useListShopsQuery({ page: 1, limit: 100 });

  const debouncedSearch = useDebouncedValue(customerSearch, 300);
  const { data: customerResults, isFetching: searching } = useListCustomersQuery(
    { page: 1, limit: 8, search: debouncedSearch || undefined },
    { skip: !open || Boolean(customer) },
  );
  const { data: customerDetail } = useGetCustomerQuery(customer?.id ?? "", {
    skip: !customer,
  });

  const { data: productPage } = useListProductsQuery(
    { page: 1, limit: 100, shopId },
    { skip: !open || !shopId },
  );
  const products = useMemo(
    () => (productPage?.data ?? []).filter((p) => p.isActive),
    [productPage],
  );
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const { data: addonPage } = useListAddonsQuery(
    { page: 1, limit: 100, shopId },
    { skip: !open || !shopId },
  );
  const addons = useMemo(
    () => (addonPage?.data ?? []).filter((a) => a.isActive),
    [addonPage],
  );
  const addonPrice = (id: string) =>
    Number(addons.find((a) => a.id === id)?.price ?? 0);

  // Slot preview for the chosen date. leadHours 0: staff can take same-day
  // orders the storefront's lead time would block. Scoped to the fulfilment
  // type since a branch can schedule pickup and delivery differently.
  const { data: slotsData } = useGetSlotsQuery(
    { shopId, date: scheduledDate, leadHours: 0, deliveryType },
    { skip: !open || !shopId || !scheduledDate },
  );

  const subtotal = lines.reduce(
    (s, l) => s + linePrice(l, productById.get(l.productId), addonPrice),
    0,
  );

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!shopId) return toast.error("Select a branch");
    if (!customer) return toast.error("Choose a customer");
    const ready = lines.filter((l) => l.productId && l.variantId);
    if (ready.length === 0) return toast.error("Add at least one item");
    if (!scheduledDate) return toast.error("Pick a date");
    if (deliveryType === "delivery" && !addressId)
      return toast.error("Choose a delivery address");

    const items: ManualOrderItemInput[] = ready.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      ...(l.flavorOptionId ? { flavorOptionId: l.flavorOptionId } : {}),
      quantity: l.quantity,
      ...(l.addonIds.length ? { addonIds: l.addonIds } : {}),
    }));
    const [slotStart, slotEnd] = slot === "none" ? [] : slot.split("|");
    try {
      const order = await createOrder({
        shopId,
        customerId: customer.id,
        items,
        deliveryType,
        ...(deliveryType === "delivery" ? { deliveryAddressId: addressId } : {}),
        scheduledDate,
        ...(slotStart ? { scheduledSlotStart: slotStart.slice(0, 5) } : {}),
        ...(slotEnd ? { scheduledSlotEnd: slotEnd.slice(0, 5) } : {}),
        paymentMethod,
        markAsPaid,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      toast.success(`Order ${order.orderNumber} created`);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to create order"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create order</DialogTitle>
          <DialogDescription>
            Enter a phone or walk-in order for a customer. Prices come from the
            live catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Branch */}
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {(shops?.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Label>Customer</Label>
            {customer ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {customer.name ?? "Unnamed customer"}
                  </span>
                  <span className="text-muted-foreground">
                    {customer.phone ?? customer.email ?? ""}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomer(null);
                    setAddressId("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name, phone or email…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {searching ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  ) : (customerResults?.data ?? []).length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      No customers found.
                    </div>
                  ) : (
                    (customerResults?.data ?? []).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => setCustomer(c)}
                      >
                        <span className="font-medium">
                          {c.name ?? "Unnamed customer"}
                        </span>
                        <span className="text-muted-foreground">
                          {c.phone ?? c.email ?? ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Items */}
          <div className="space-y-3">
            <Label>Items</Label>
            {!shopId ? (
              <p className="text-sm text-muted-foreground">
                Select a branch to load its catalog.
              </p>
            ) : (
              lines.map((line) => {
                const product = productById.get(line.productId);
                const total = linePrice(line, product, addonPrice);
                return (
                  <div key={line.key} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={line.productId}
                        onValueChange={(v) => {
                          const p = productById.get(v);
                          updateLine(line.key, {
                            productId: v,
                            variantId:
                              p?.variants.find((x) => x.isDefault)?.id ??
                              p?.variants[0]?.id ??
                              "",
                            flavorOptionId: "",
                          });
                        }}
                      >
                        <SelectTrigger className="w-56 flex-1">
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {product && (
                        <Select
                          value={line.variantId}
                          onValueChange={(v) => updateLine(line.key, { variantId: v })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Variant" />
                          </SelectTrigger>
                          <SelectContent>
                            {product.variants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.label} · ₹{Number(v.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {product && product.flavorOptions.length > 0 && (
                        <Select
                          value={line.flavorOptionId || "none"}
                          onValueChange={(v) =>
                            updateLine(line.key, {
                              flavorOptionId: v === "none" ? "" : v,
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Flavour" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No flavour</SelectItem>
                            {product.flavorOptions.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.flavorName}
                                {Number(f.priceDelta) !== 0 &&
                                  ` (+₹${Number(f.priceDelta)})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        className="w-20"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((prev) => prev.filter((l) => l.key !== line.key))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {product && addons.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {addons.map((a) => (
                          <label
                            key={a.id}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <Checkbox
                              checked={line.addonIds.includes(a.id)}
                              onCheckedChange={(checked) =>
                                updateLine(line.key, {
                                  addonIds: checked
                                    ? [...line.addonIds, a.id]
                                    : line.addonIds.filter((id) => id !== a.id),
                                })
                              }
                            />
                            {a.name} (+₹{Number(a.price)})
                          </label>
                        ))}
                      </div>
                    )}
                    {total > 0 && (
                      <p className="text-right text-xs text-muted-foreground">
                        Line total: ₹{total.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            {shopId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add item
              </Button>
            )}
          </div>

          {/* Fulfilment */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fulfilment</Label>
              <Select
                value={deliveryType}
                onValueChange={(v) => {
                  setDeliveryType(v as DeliveryType);
                  setSlot("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deliveryType === "delivery" && (
              <div className="space-y-2">
                <Label>Delivery address</Label>
                <Select value={addressId} onValueChange={setAddressId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        customer ? "Select address" : "Choose a customer first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(customerDetail?.addresses ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label ? `${a.label} — ` : ""}
                        {a.fullAddress}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customer && (customerDetail?.addresses ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    This customer has no saved addresses — choose Pickup, or ask
                    them to add one.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => {
                  setScheduledDate(e.target.value);
                  setSlot("none");
                }}
              />
              {slotsData && !slotsData.open && (
                <p className="text-xs text-amber-600">
                  {slotsData.closedReason ?? "The branch is closed on this date"}
                  {" — you can still create the order."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Time slot (optional)</Label>
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any time</SelectItem>
                  {(slotsData?.slots ?? []).map((s) => (
                    <SelectItem
                      key={s.start}
                      value={`${s.start}|${s.end}`}
                      disabled={!s.available}
                    >
                      {s.start.slice(0, 5)} – {s.end.slice(0, 5)}
                      {!s.available
                        ? " (full)"
                        : s.remaining != null
                          ? ` (${s.remaining} left)`
                          : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment & extras */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as OrderPaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_LABEL) as OrderPaymentMethod[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PAYMENT_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coupon code (optional)</Label>
              <Input
                placeholder="e.g. FLAT100"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={markAsPaid} onCheckedChange={setMarkAsPaid} />
            <Label className="font-normal">Already paid</Label>
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Phone order — write “Happy Birthday Riya” on the cake."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2 items-center gap-3 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Subtotal preview:{" "}
            <span className="font-medium text-foreground">
              ₹{subtotal.toFixed(2)}
            </span>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create order
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
