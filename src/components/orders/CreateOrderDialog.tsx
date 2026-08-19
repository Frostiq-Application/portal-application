import { useCallback, useMemo, useState } from "react";
import {
  CalendarClock,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
} from "@/components/ui/icons";
import type { IconComponent } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import {
  useCreateOrderMutation,
  type ManualOrderItemInput,
} from "@/features/api/ordersApi";
import { useListCustomersQuery, useGetCustomerQuery } from "@/features/api/customersApi";
import { useListProductsQuery, useListAddonsQuery } from "@/features/api/catalogApi";
import { useGetSlotsQuery } from "@/features/api/schedulingApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import { CustomerPhoneLookup } from "@/components/customers/CustomerPhoneLookup";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import type {
  CreatedCustomer,
  Customer,
  CustomerAddress,
  DeliveryType,
  OrderCustomer,
  OrderPaymentMethod,
  Product,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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

/** Customers loaded per request in the picker — the rest page in on scroll. */
const CUSTOMER_PAGE_SIZE = 10;

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

  /**
   * Whether this brand has the customer directory.
   *
   * It decides how the buyer is picked, and nothing else on the form. With it,
   * staff search the directory as before. Without it, they identify the customer
   * by their full phone number — see {@link CustomerPhoneLookup}. The branch
   * exists because every customer route except that lookup and creation sits
   * behind this flag, so the old search 403s for those brands and left them
   * unable to create an order at all.
   */
  const { hasFeature } = useEntitlements();
  const canBrowseCustomers = hasFeature("can_use_customer_data");

  const [shopId, setShopId] = useState("");
  const [customer, setCustomer] = useState<OrderCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  /** Seeds the create form when the lookup found nobody on that number. */
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  /**
   * Addresses carried on the picked customer, kept because the server may not
   * read them back to us. Two reasons it can't: a branch-scoped user can only
   * fetch a customer who has ordered at their branch, and a customer added mid
   * order has ordered nowhere yet — that is the whole reason they are being
   * created; and on a plan without the directory, `GET /customers/:id` is gated
   * away entirely. Both the lookup and creation responses carry addresses so
   * the delivery picker has something to show either way.
   */
  const [pickedAddresses, setPickedAddresses] = useState<CustomerAddress[]>([]);
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
      setAddingCustomer(false);
      setNewCustomerPhone("");
      setPickedAddresses([]);
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

  // The directory can run to thousands of rows, so the picker never asks for
  // all of them: one debounced request per settled search term, ten rows at a
  // time, and the next ten as the results box is scrolled.
  const [customerListEl, setCustomerListEl] = useState<HTMLDivElement | null>(
    null,
  );
  const debouncedSearch = useDebouncedValue(customerSearch, 300);
  // An emptied box needs no debounce: snap back to the default list at once
  // rather than showing the cleared term's matches for another beat.
  const search = customerSearch.trim() ? debouncedSearch.trim() : "";
  // The debounce window is dead time the user can see — count it as loading so
  // the list never sits there showing matches for a term already typed past.
  const isTyping = customerSearch.trim() !== search;

  // Keyed on the dialog session too, so reopening starts back at page 1 instead
  // of re-requesting however deep the last order's search had scrolled.
  const {
    page: customerPage,
    items: customerOptions,
    hasMore: hasMoreCustomers,
    ingest: ingestCustomers,
    loadMore: loadNextCustomers,
  } = useInfiniteList<Customer>(`${seedKey ?? "closed"}|${search}`);

  // `currentData`, not `data`: RTK keeps the PREVIOUS term's response in `data`
  // while the new one is in flight, which reads to the accumulator as "nothing
  // changed" and silently drops the page.
  const { currentData: customerResults, isFetching: searching } =
    useListCustomersQuery(
      {
        page: customerPage,
        limit: CUSTOMER_PAGE_SIZE,
        search: search || undefined,
      },
      {
        // Skipped outright without the directory: the endpoint 403s there, and
        // asking anyway would put an "upgrade your plan" error on a form the
        // brand is perfectly entitled to use.
        skip:
          !open || !canBrowseCustomers || Boolean(customer) || addingCustomer,
      },
    );
  ingestCustomers(customerResults);

  // Spinner only while there is nothing to show for what was asked: the
  // debounce window and the first page. Paging deeper keeps the rows up and
  // puts the loader underneath them instead.
  const loadingCustomers =
    isTyping || (customerPage === 1 && searching && !customerResults);

  // Memoized: InfiniteScroll rebuilds its IntersectionObserver whenever this
  // identity changes, and a fresh observer re-fires on a sentinel already in
  // view — which would skip a page.
  const loadMoreCustomers = useCallback(() => {
    if (!searching) loadNextCustomers();
  }, [searching, loadNextCustomers]);
  const { data: customerDetail } = useGetCustomerQuery(customer?.id ?? "", {
    // Gated behind the directory as well, so the picked customer's addresses
    // have to come from the response that picked them.
    skip: !customer || !canBrowseCustomers,
  });
  // Whatever the customer actually has on file, falling back to what picking or
  // creating them here returned. Prefers the fetched list once it has something
  // in it, so an address added elsewhere since is not hidden by the local copy.
  const addressOptions = customerDetail?.addresses?.length
    ? customerDetail.addresses
    : pickedAddresses;

  /**
   * Attach a customer to the order, along with whatever addresses came back
   * with them, and pre-select the one to deliver to. A delivery order is the
   * case that most often sent staff looking for the customer in the first
   * place, so the address is chosen here rather than left to be found.
   */
  const attachCustomer = (
    picked: OrderCustomer,
    addresses: CustomerAddress[],
  ) => {
    setCustomer(picked);
    setPickedAddresses(addresses);
    setAddingCustomer(false);
    setNewCustomerPhone("");
    setCustomerSearch("");
    const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
    setAddressId(preferred?.id ?? "");
  };

  const useNewCustomer = (created: CreatedCustomer) =>
    attachCustomer(created, created.addresses);

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

  const removeLine = (key: number) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const readyLines = lines.filter((l) => l.productId && l.variantId);
  const itemCount = readyLines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Header and action bar are pinned; only the middle scrolls, so the
          Create button stays reachable however long the item list gets. */}
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Create order</DialogTitle>
          <DialogDescription>
            Enter a phone or walk-in order for a customer. Prices come from the
            live catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            {/* ---- what they're buying ------------------------------------ */}
            <div className="space-y-6">
              <Section icon={Store} title="Branch">
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
              </Section>

              <Section icon={UserRound} title="Customer">
                {customer ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
                        {(customer.name ?? "?").slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {customer.name ?? "Unnamed customer"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {customer.phone ?? customer.email ?? "No contact"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setCustomer(null);
                        setPickedAddresses([]);
                        setAddressId("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : addingCustomer ? (
                  <NewCustomerForm
                    shopId={shopId || undefined}
                    // Whatever they typed looking for this customer is almost
                    // always the name they are about to type again. Nothing to
                    // carry over on the lookup path — that box held a number.
                    defaultName={canBrowseCustomers ? customerSearch : ""}
                    defaultPhone={newCustomerPhone || undefined}
                    lockPhone={Boolean(newCustomerPhone)}
                    askForAddress={deliveryType === "delivery"}
                    onCreated={useNewCustomer}
                    // The email turned out to belong to someone already on
                    // file, and staff said it is the same person: put that
                    // customer on the order rather than a second record.
                    onUseExisting={(found) =>
                      attachCustomer(found, found.addresses)
                    }
                    onCancel={() => {
                      setAddingCustomer(false);
                      setNewCustomerPhone("");
                    }}
                  />
                ) : !canBrowseCustomers ? (
                  <CustomerPhoneLookup
                    shopId={shopId || undefined}
                    onSelect={(found) => attachCustomer(found, found.addresses)}
                    onAddNew={(phone) => {
                      setNewCustomerPhone(phone);
                      setAddingCustomer(true);
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          placeholder="Search by name, phone or email…"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                      </div>
                      {/* The order that prompted this feature is the one where
                          the caller isn't in the directory at all — so adding
                          them sits next to the search that just failed. */}
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setAddingCustomer(true)}
                      >
                        <UserPlus className="mr-1 size-4" />
                        New customer
                      </Button>
                    </div>
                    <div
                      ref={setCustomerListEl}
                      className="max-h-44 overflow-y-auto rounded-lg border"
                    >
                      {loadingCustomers ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Searching…
                        </div>
                      ) : customerOptions.length === 0 ? (
                        <div className="flex flex-col items-start gap-2 p-3">
                          <p className="text-sm text-muted-foreground">
                            No customers found.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAddingCustomer(true)}
                          >
                            <UserPlus className="mr-1 size-3.5" />
                            Add{customerSearch.trim() ? ` “${customerSearch.trim()}”` : " a customer"}
                          </Button>
                        </div>
                      ) : (
                        <InfiniteScroll
                          root={customerListEl}
                          rootMargin="80px"
                          hasMore={hasMoreCustomers}
                          loading={searching}
                          onLoadMore={loadMoreCustomers}
                          loader={
                            <div className="flex items-center justify-center gap-2 border-t py-2 text-xs text-muted-foreground">
                              <Loader2 className="size-3.5 animate-spin" />
                              Loading more…
                            </div>
                          }
                        >
                          <div className="divide-y">
                            {customerOptions.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                                // No addresses on a directory row; the detail
                                // query below fetches them. Passing none also
                                // clears the last pick's selected address,
                                // which would otherwise ride along onto a
                                // different customer's order.
                                onClick={() => attachCustomer(c, [])}
                              >
                                <span className="truncate font-medium">
                                  {c.name ?? "Unnamed customer"}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {c.phone ?? c.email ?? ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        </InfiniteScroll>
                      )}
                    </div>
                  </div>
                )}
              </Section>

              <Section
                icon={ShoppingBag}
                title="Items"
                action={
                  shopId && lines.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLines((prev) => [...prev, emptyLine()])}
                    >
                      <Plus className="mr-1 size-3.5" />
                      Add item
                    </Button>
                  ) : null
                }
              >
                {!shopId ? (
                  <EmptyItems message="Select a branch to load its catalog." />
                ) : lines.length === 0 ? (
                  <EmptyItems
                    message="No items on this order yet."
                    onAdd={() => setLines([emptyLine()])}
                  />
                ) : (
                  <div className="space-y-3">
                    {lines.map((line) => (
                      <LineCard
                        key={line.key}
                        line={line}
                        product={productById.get(line.productId)}
                        products={products}
                        addons={addons}
                        total={linePrice(
                          line,
                          productById.get(line.productId),
                          addonPrice,
                        )}
                        onChange={(patch) => updateLine(line.key, patch)}
                        onRemove={() => removeLine(line.key)}
                      />
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* ---- when, how and how they pay ---------------------------- */}
            <aside className="space-y-6">
              <Section icon={CalendarClock} title="Fulfilment">
                <div className="space-y-3">
                  <Field label="Type">
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
                  </Field>

                  {deliveryType === "delivery" && (
                    <Field label="Delivery address">
                      <Select value={addressId} onValueChange={setAddressId}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              customer
                                ? "Select address"
                                : "Choose a customer first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {addressOptions.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label ? `${a.label}: ` : ""}
                              {a.fullAddress}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {customer && addressOptions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          This customer has no saved addresses. Choose Pickup,
                          or ask them to add one.
                        </p>
                      )}
                    </Field>
                  )}

                  <Field label="Date">
                    <DatePicker
                      className="w-full"
                      value={scheduledDate}
                      onChange={(v) => {
                        setScheduledDate(v);
                        setSlot("none");
                      }}
                    />
                    {slotsData && !slotsData.open && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {slotsData.closedReason ??
                          "The branch is closed on this date"}
                        {". You can still create the order."}
                      </p>
                    )}
                  </Field>

                  <Field label="Time slot" hint="Optional">
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
                            {!s.available ? " (full)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Section>

              <Section icon={CreditCard} title="Payment">
                <div className="space-y-3">
                  <Field label="Method">
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) =>
                        setPaymentMethod(v as OrderPaymentMethod)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PAYMENT_LABEL) as OrderPaymentMethod[]).map(
                          (p) => (
                            <SelectItem key={p} value={p}>
                              {PAYMENT_LABEL[p]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Coupon code" hint="Optional">
                    <Input
                      placeholder="e.g. FLAT100"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                  </Field>

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                    <span className="text-sm">Already paid</span>
                    <Switch
                      checked={markAsPaid}
                      onCheckedChange={setMarkAsPaid}
                    />
                  </label>
                </div>
              </Section>

              <Section icon={StickyNote} title="Note" hint="Optional">
                <Textarea
                  rows={3}
                  placeholder="e.g. Phone order, write “Happy Birthday Riya” on the cake."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Section>
            </aside>
          </div>
        </div>

        <DialogFooter className="shrink-0 items-center gap-3 border-t px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-between sm:px-6 sm:pb-4">
          <div className="text-sm text-muted-foreground">
            {itemCount > 0 && (
              <span className="mr-2">
                {itemCount} item{itemCount === 1 ? "" : "s"} ·
              </span>
            )}
            Subtotal{" "}
            <span className="font-semibold text-foreground">
              ₹{subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
              Create order
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A titled block in the dialog body, with an optional right-aligned action. */
function Section({
  icon: Icon,
  title,
  hint,
  action,
  children,
}: {
  icon: IconComponent;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" />
          {title}
          {hint && (
            <span className="font-normal normal-case tracking-normal opacity-70">
              · {hint}
            </span>
          )}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label + control, for the narrow right-hand column. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-normal text-muted-foreground">
        {label}
        {hint && <span className="ml-1 opacity-70">· {hint}</span>}
      </Label>
      {children}
    </div>
  );
}

function EmptyItems({
  message,
  onAdd,
}: {
  message: string;
  onAdd?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
      <ShoppingBag className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onAdd && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 size-3.5" />
          Add item
        </Button>
      )}
    </div>
  );
}

/** One order line: product on top, its options beneath, add-ons as chips. */
function LineCard({
  line,
  product,
  products,
  addons,
  total,
  onChange,
  onRemove,
}: {
  line: Line;
  product: Product | undefined;
  products: Product[];
  addons: { id: string; name: string; price: string | number }[];
  total: number;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Select
          value={line.productId}
          onValueChange={(v) => {
            const p = products.find((x) => x.id === v);
            onChange({
              productId: v,
              variantId:
                p?.variants.find((x) => x.isDefault)?.id ??
                p?.variants[0]?.id ??
                "",
              flavorOptionId: "",
            });
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove item"
          title="Remove item"
          className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {product && (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select
            value={line.variantId}
            onValueChange={(v) => onChange({ variantId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {product.variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label} · ₹{Number(v.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {product.flavorOptions.length > 0 ? (
            <Select
              value={line.flavorOptionId || "none"}
              onValueChange={(v) =>
                onChange({ flavorOptionId: v === "none" ? "" : v })
              }
            >
              <SelectTrigger>
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
          ) : (
            <span className="hidden sm:block" />
          )}

          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) => onChange({ quantity })}
          />
        </div>
      )}

      {product && addons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addons.map((a) => {
            const on = line.addonIds.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    addonIds: on
                      ? line.addonIds.filter((id) => id !== a.id)
                      : [...line.addonIds, a.id],
                  })
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {a.name} +₹{Number(a.price)}
              </button>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>Line total</span>
          <span className="font-semibold text-foreground">
            ₹{total.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Quantity as -/+ around a typable field — faster than a spinner on touch. */
function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const clamp = (n: number) => Math.min(99, Math.max(1, n));
  return (
    <div className="flex h-9 items-center rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Decrease quantity"
        className="size-8 rounded-r-none"
        disabled={value <= 1}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus className="size-3.5" />
      </Button>
      <input
        aria-label="Quantity"
        inputMode="numeric"
        className="w-9 border-0 bg-transparent text-center text-sm tabular-nums outline-none"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 1))}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Increase quantity"
        className="size-8 rounded-l-none"
        disabled={value >= 99}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
