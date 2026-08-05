import { useMemo, useState } from "react";
import {
  CakeSlice,
  CalendarClock,
  ImagePlus,
  Loader2,
  Palette,
  Phone,
  Search,
  Store,
  UserRound,
  X,
} from "@/components/ui/icons";
import type { IconComponent } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ImageUploader } from "@/components/ImageUploader";
import {
  useCreateCustomCakeMutation,
  useListCustomCakeOptionsQuery,
  type CreateCustomCakeInput,
} from "@/features/api/customCakeApi";
import { useListCustomersQuery } from "@/features/api/customersApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import type { Customer, DeliveryType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
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

/** Reference photos a caller can describe over the phone before it's noise. */
const MAX_REFERENCE_IMAGES = 5;

/** Customers offered at a time in the (optional) attach-a-customer picker. */
const CUSTOMER_RESULTS = 8;

/** The brief's single-choice fields, grouped exactly as the storefront form. */
const DETAIL_GROUPS: {
  key: string;
  title: string;
  fields: { fieldKey: string; label: string; prop: SelectProp }[];
}[] = [
  {
    key: "size",
    title: "Size & shape",
    fields: [
      { fieldKey: "cake_type", label: "Cake type", prop: "cakeType" },
      { fieldKey: "weight", label: "Weight", prop: "weight" },
      { fieldKey: "shape", label: "Shape", prop: "shape" },
    ],
  },
  {
    key: "flavour",
    title: "Flavour",
    fields: [
      { fieldKey: "sponge", label: "Sponge", prop: "sponge" },
      { fieldKey: "cream", label: "Cream", prop: "cream" },
      { fieldKey: "filling", label: "Filling", prop: "filling" },
      { fieldKey: "flavour", label: "Flavour", prop: "flavour" },
    ],
  },
  {
    key: "look",
    title: "Look & feel",
    fields: [
      { fieldKey: "occasion", label: "Occasion", prop: "occasion" },
      { fieldKey: "theme", label: "Theme", prop: "theme" },
      { fieldKey: "colour", label: "Colour", prop: "colour" },
      { fieldKey: "topper", label: "Topper", prop: "topper" },
    ],
  },
];

type SelectProp =
  | "cakeType"
  | "weight"
  | "shape"
  | "theme"
  | "occasion"
  | "sponge"
  | "cream"
  | "filling"
  | "flavour"
  | "colour"
  | "topper";

interface Draft {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  cakeType: string;
  weight: string;
  shape: string;
  theme: string;
  occasion: string;
  sponge: string;
  cream: string;
  filling: string;
  flavour: string;
  colour: string;
  topper: string;
  decorations: string[];
  cakeMessage: string;
  referenceImageUrls: string[];
  deliveryType: DeliveryType;
  neededDate: string;
  neededTime: string;
  deliveryAddress: string;
  notes: string;
  specialInstructions: string;
  allergyInfo: string;
}

const emptyDraft = (): Draft => ({
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  cakeType: "",
  weight: "",
  shape: "",
  theme: "",
  occasion: "",
  sponge: "",
  cream: "",
  filling: "",
  flavour: "",
  colour: "",
  topper: "",
  decorations: [],
  cakeMessage: "",
  referenceImageUrls: [],
  deliveryType: "delivery",
  neededDate: "",
  neededTime: "",
  deliveryAddress: "",
  notes: "",
  specialInstructions: "",
  allergyInfo: "",
});

/** Trimmed value, or undefined so the field is left off the request entirely. */
const opt = (value: string): string | undefined =>
  value.trim() ? value.trim() : undefined;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected branch (from the page's branch picker), if a specific one. */
  defaultShopId?: string | null;
}

/**
 * Shop-side custom cake entry: the same brief the customer fills in on the
 * storefront, typed up by staff for a request that arrived by phone or at the
 * counter. It lands in the custom cake queue as a normal `submitted` request,
 * so quoting, accepting and converting to an order all work unchanged.
 *
 * Attaching a customer is optional but worth doing — a request with no customer
 * record cannot be converted into an order later.
 */
export function CreateCustomCakeDialog({
  open,
  onOpenChange,
  defaultShopId,
}: Props) {
  const [createRequest, { isLoading: saving }] = useCreateCustomCakeMutation();

  const [shopId, setShopId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  // Reset to a fresh form each time the dialog opens. Done during render so a
  // reopened dialog never shows the last request's answers for a frame.
  const seedKey = open ? (defaultShopId ?? "any") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setShopId(defaultShopId ?? "");
    setCustomer(null);
    setCustomerSearch("");
    setDraft(emptyDraft());
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const { data: shops } = useListShopsQuery({ page: 1, limit: 100 });

  const debouncedSearch = useDebouncedValue(customerSearch, 300);
  const search = customerSearch.trim() ? debouncedSearch.trim() : "";
  const { data: customerResults, isFetching: searching } = useListCustomersQuery(
    { page: 1, limit: CUSTOMER_RESULTS, search: search || undefined },
    { skip: !open || Boolean(customer) },
  );

  // The branch's own option lists — the same ones that power the storefront
  // form, so staff pick from exactly what a customer would see.
  const { data: options, isLoading: optionsLoading } =
    useListCustomCakeOptionsQuery(shopId, { skip: !open || !shopId });

  const optionsFor = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const o of options ?? []) {
      if (!o.isActive) continue;
      const list = grouped.get(o.fieldKey) ?? [];
      list.push(o.label);
      grouped.set(o.fieldKey, list);
    }
    return grouped;
  }, [options]);

  /** Fill the contact block from the attached customer, keeping what's typed. */
  const attachCustomer = (picked: Customer) => {
    setCustomer(picked);
    set({
      contactName: draft.contactName || (picked.name ?? ""),
      contactPhone: draft.contactPhone || (picked.phone ?? ""),
      contactEmail: draft.contactEmail || (picked.email ?? ""),
    });
  };

  const submit = async () => {
    if (!shopId) return toast.error("Select a branch");
    if (draft.contactName.trim().length < 2)
      return toast.error("Enter the customer's name");
    if (draft.contactPhone.replace(/\D/g, "").length < 7)
      return toast.error("Enter a valid phone number");

    const payload: CreateCustomCakeInput = {
      shopId,
      ...(customer ? { customerId: customer.id } : {}),
      contactName: draft.contactName.trim(),
      contactPhone: draft.contactPhone.trim(),
      contactEmail: opt(draft.contactEmail),
      cakeType: opt(draft.cakeType),
      weight: opt(draft.weight),
      shape: opt(draft.shape),
      theme: opt(draft.theme),
      occasion: opt(draft.occasion),
      sponge: opt(draft.sponge),
      cream: opt(draft.cream),
      filling: opt(draft.filling),
      flavour: opt(draft.flavour),
      colour: opt(draft.colour),
      topper: opt(draft.topper),
      ...(draft.decorations.length ? { decorations: draft.decorations } : {}),
      cakeMessage: opt(draft.cakeMessage),
      ...(draft.referenceImageUrls.length
        ? { referenceImageUrls: draft.referenceImageUrls }
        : {}),
      deliveryType: draft.deliveryType,
      neededDate: opt(draft.neededDate),
      neededTime: opt(draft.neededTime),
      deliveryAddress: opt(draft.deliveryAddress),
      notes: opt(draft.notes),
      specialInstructions: opt(draft.specialInstructions),
      allergyInfo: opt(draft.allergyInfo),
    };

    try {
      const created = await createRequest(payload).unwrap();
      // The mutation invalidates the list, so the new row is already behind
      // this toast — no "go and look at it" action needed.
      toast.success(`Request ${created.requestNumber} created`, {
        description: "It's in the queue, ready to quote.",
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to create the request"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Header and action bar are pinned; only the middle scrolls, so the
          Create button stays reachable however long the brief gets. */}
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Create custom cake request</DialogTitle>
          <DialogDescription>
            Take a made-to-order cake brief over the phone or at the counter. It
            joins the custom cake queue, where you can quote it and turn it into
            an order.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            {/* ---- who's asking and what they want ----------------------- */}
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

              <Section
                icon={UserRound}
                title="Customer account"
                hint="Optional"
              >
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
                      onClick={() => setCustomer(null)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search by name, phone or email…"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg border">
                      {searching && !customerResults ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Searching…
                        </div>
                      ) : (customerResults?.data ?? []).length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">
                          No customers found.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {(customerResults?.data ?? []).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                              onClick={() => attachCustomer(c)}
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
                      )}
                    </div>
                    {/* Conversion needs a customer row, so it is cheaper to say
                        so now than to find out at the quote-accepted step. */}
                    <p className="text-xs text-muted-foreground">
                      Attach an account to convert this request into an order
                      later. Skip it for a walk-in with no account.
                    </p>
                  </div>
                )}
              </Section>

              <Section icon={Phone} title="Contact details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      placeholder="Who the cake is for"
                      value={draft.contactName}
                      onChange={(e) => set({ contactName: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      type="tel"
                      placeholder="Phone number"
                      value={draft.contactPhone}
                      onChange={(e) => set({ contactPhone: e.target.value })}
                    />
                  </Field>
                  <Field label="Email" hint="Optional">
                    <Input
                      type="email"
                      placeholder="customer@example.com"
                      value={draft.contactEmail}
                      onChange={(e) => set({ contactEmail: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>

              <Section icon={ImagePlus} title="Inspiration" hint="Optional">
                <div className="space-y-3">
                  <ImageUploader
                    value={draft.referenceImageUrls}
                    onChange={(referenceImageUrls) =>
                      set({ referenceImageUrls })
                    }
                    folder="custom-cake"
                    max={MAX_REFERENCE_IMAGES}
                  />
                  <Textarea
                    rows={3}
                    placeholder="What did they describe? e.g. two tiers, pastel florals, gold drip."
                    value={draft.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                  />
                </div>
              </Section>

              <Section icon={Palette} title="The cake" hint="All optional">
                {!shopId ? (
                  <EmptyHint message="Select a branch to load its cake options." />
                ) : optionsLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading options…
                  </div>
                ) : (
                  <div className="space-y-6">
                    {DETAIL_GROUPS.map((group) => {
                      const hasPills = group.fields.some(
                        (f) => (optionsFor.get(f.fieldKey) ?? []).length > 0,
                      );
                      const isLook = group.key === "look";
                      if (!hasPills && !isLook) return null;
                      return (
                        <div key={group.key} className="space-y-3">
                          <h4 className="text-sm font-medium">{group.title}</h4>
                          {group.fields.map((f) => (
                            <PillGroup
                              key={f.fieldKey}
                              label={f.label}
                              options={optionsFor.get(f.fieldKey) ?? []}
                              selected={draft[f.prop] ? [draft[f.prop]] : []}
                              onToggle={(label) =>
                                set({
                                  [f.prop]:
                                    draft[f.prop] === label ? "" : label,
                                } as Partial<Draft>)
                              }
                            />
                          ))}
                          {isLook && (
                            <>
                              <PillGroup
                                label="Decorations"
                                options={optionsFor.get("decoration") ?? []}
                                selected={draft.decorations}
                                onToggle={(label) =>
                                  set({
                                    decorations: draft.decorations.includes(
                                      label,
                                    )
                                      ? draft.decorations.filter(
                                          (d) => d !== label,
                                        )
                                      : [...draft.decorations, label],
                                  })
                                }
                              />
                              <Field label="Message on the cake" hint="Optional">
                                <Input
                                  placeholder="e.g. Happy Birthday Aisha"
                                  value={draft.cakeMessage}
                                  onChange={(e) =>
                                    set({ cakeMessage: e.target.value })
                                  }
                                />
                              </Field>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* ---- when and where it's needed ---------------------------- */}
            <aside className="space-y-6">
              <Section icon={CalendarClock} title="When & where">
                <div className="space-y-3">
                  <Field label="Type">
                    <Select
                      value={draft.deliveryType}
                      onValueChange={(v) =>
                        set({ deliveryType: v as DeliveryType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivery">Delivery</SelectItem>
                        <SelectItem value="pickup">Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Needed on" hint="Optional">
                    <DatePicker
                      className="w-full"
                      value={draft.neededDate}
                      onChange={(neededDate) => set({ neededDate })}
                    />
                  </Field>

                  <Field label="Needed by" hint="Optional">
                    <Input
                      type="time"
                      value={draft.neededTime}
                      onChange={(e) => set({ neededTime: e.target.value })}
                    />
                  </Field>

                  {draft.deliveryType === "delivery" && (
                    <Field label="Delivery address" hint="Optional">
                      <Textarea
                        rows={2}
                        placeholder="Where should we deliver?"
                        value={draft.deliveryAddress}
                        onChange={(e) =>
                          set({ deliveryAddress: e.target.value })
                        }
                      />
                    </Field>
                  )}
                </div>
              </Section>

              <Section icon={CakeSlice} title="Anything else" hint="Optional">
                <div className="space-y-3">
                  <Field label="Allergy info">
                    <Input
                      placeholder="e.g. nut allergy"
                      value={draft.allergyInfo}
                      onChange={(e) => set({ allergyInfo: e.target.value })}
                    />
                  </Field>
                  <Field label="Special instructions">
                    <Textarea
                      rows={3}
                      placeholder="Anything else the kitchen should know?"
                      value={draft.specialInstructions}
                      onChange={(e) =>
                        set({ specialInstructions: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </Section>
            </aside>
          </div>
        </div>

        <DialogFooter className="shrink-0 items-center gap-3 border-t px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-between sm:px-6 sm:pb-4">
          <p className="text-xs text-muted-foreground">
            The request is created as <span className="font-medium">Submitted</span>{" "}
            — quote it from the Custom Cakes queue.
          </p>
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
              Create request
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A titled block in the dialog body. */
function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: IconComponent;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex min-h-8 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
        {hint && (
          <span className="font-normal normal-case tracking-normal opacity-70">
            · {hint}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

/** Label + control. */
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

/**
 * One option row as tappable pills — the storefront's control, so a request read
 * off the phone is captured in the same vocabulary the customer would have used.
 * Renders nothing when the branch has configured no options for the field.
 */
function PillGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (label: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                on
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {o}
              {on && <X className="size-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
