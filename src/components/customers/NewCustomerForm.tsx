import { useState } from "react";
import { ArrowLeft, Loader2, MapPin } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { useCreateCustomerMutation } from "@/features/api/customersApi";
import type { CreatedCustomer, NewCustomerBody } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

interface Props {
  /** Branch the order is being taken for, when one has been chosen. */
  shopId?: string;
  /** Seeds the name box — usually whatever was typed into the customer search. */
  defaultName?: string;
  /**
   * Ask for an address up front. Set for a delivery order, where a customer
   * with no address on file cannot be ordered for at all.
   */
  askForAddress?: boolean;
  onCreated: (customer: CreatedCustomer) => void;
  onCancel: () => void;
}

/**
 * Adding the caller who isn't on file yet, without leaving the order.
 *
 * Deliberately the shortest form that still produces a usable customer: a name
 * to put on the order, a number to ring back on, and — only when the order is
 * going out for delivery — somewhere to take it. Everything else about a
 * customer is theirs to fill in from the storefront.
 *
 * Renders inline rather than as a second dialog: this is one step of writing an
 * order up, and a modal stacked on the order modal would bury the form it
 * belongs to.
 */
export function NewCustomerForm({
  shopId,
  defaultName,
  askForAddress,
  onCreated,
  onCancel,
}: Props) {
  const [createCustomer, { isLoading: saving }] = useCreateCustomerMutation();

  const [name, setName] = useState(defaultName?.trim() ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Enter the customer's name");
    // The number is what the branch calls back on, and what stops the same
    // caller becoming a new customer record on every order.
    if (phone.replace(/\D/g, "").length < 7) {
      return toast.error("Enter a valid phone number");
    }

    const address = fullAddress.trim();
    const body: NewCustomerBody = {
      name: name.trim(),
      phone: phone.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(shopId ? { shopId } : {}),
      ...(address
        ? {
            address: {
              fullAddress: address,
              ...(city.trim() ? { city: city.trim() } : {}),
              ...(pincode.trim() ? { pincode: pincode.trim() } : {}),
            },
          }
        : {}),
    };

    try {
      const customer = await createCustomer(body).unwrap();
      // A matched number is not a failure — it is the regular caller the shop
      // already knows — but saying "customer added" would be a lie, and the
      // name on the order is theirs, not what was just typed.
      toast.success(
        customer.matchedExisting
          ? `${customer.name ?? "This customer"} is already on file — using their record`
          : `${customer.name ?? "Customer"} added`,
      );
      onCreated(customer);
    } catch (err) {
      toast.error(apiError(err, "Failed to add customer"));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name" required>
          <Input
            autoFocus
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Phone" required>
          <PhoneInput
            defaultCountry="IN"
            placeholder="Phone number"
            value={phone}
            onChange={(v) => setPhone(v ?? "")}
          />
        </FormField>
      </div>

      <FormField label="Email" hint="Optional">
        <Input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FormField>

      {askForAddress && (
        <div className="space-y-3 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            Delivery address — saved to this customer.
          </p>
          <FormField label="Address">
            <Input
              placeholder="Flat / house, street, area"
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="City" hint="Optional">
              <Input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </FormField>
            <FormField label="Pincode" hint="Optional">
              <Input
                inputMode="numeric"
                placeholder="411038"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </FormField>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {/* "Back", not "Cancel": this sits inside the order dialog, which has a
            Cancel of its own that throws the whole order away. */}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="mr-1 size-3.5" />
          Back
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
          Add customer
        </Button>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-normal text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {hint && <span className="ml-1 opacity-70">· {hint}</span>}
      </Label>
      {children}
    </div>
  );
}
