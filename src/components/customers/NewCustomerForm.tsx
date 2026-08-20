import { useState } from "react";
import { ArrowLeft, Loader2, MapPin, ShieldAlert } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { useCreateCustomerMutation } from "@/features/api/customersApi";
import type {
  CreatedCustomer,
  CustomerLookup,
  EmailInUseError,
  NewCustomerBody,
} from "@/types";
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
   * Seeds the phone box. Set when the form was reached from a phone lookup that
   * found nobody: that number is the reason we are here, and retyping it is
   * both busywork and a chance to mistype it into a different customer.
   */
  defaultPhone?: string;
  /**
   * Show the seeded number as read-only. Paired with `defaultPhone` on the
   * lookup path, where editing it would produce a customer on a number nobody
   * checked — and quietly reintroduce the duplicate that lookup just avoided.
   */
  lockPhone?: boolean;
  /**
   * Ask for an address up front. Set for a delivery order, where a customer
   * with no address on file cannot be ordered for at all.
   */
  askForAddress?: boolean;
  onCreated: (customer: CreatedCustomer) => void;
  /**
   * Attach the customer who already holds the typed email.
   *
   * Required, not optional: an address already on file is refused outright, so
   * this is the only way forward from that state other than typing a different
   * one. A form that could not offer it would be a dead end.
   */
  onUseExisting: (customer: CustomerLookup) => void;
  onCancel: () => void;
}

/** Reads the 409 body from POST /customers, or null for any other failure. */
function emailInUse(err: unknown): EmailInUseError | null {
  const body = (err as { data?: Partial<EmailInUseError> } | undefined)?.data;
  return body?.error === "EMAIL_IN_USE" && body.emailInUseBy
    ? (body as EmailInUseError)
    : null;
}

/**
 * Adding the caller who isn't on file yet, without leaving the order.
 *
 * Deliberately the shortest form that still produces a usable customer: a name
 * to put on the order, a number to ring back on, an email, and — only when the
 * order is going out for delivery — somewhere to take it. Everything else about
 * a customer is theirs to fill in from the storefront.
 *
 * The email is not optional contact detail, which is why it is asked for on
 * every plan. A storefront sign-in carries an email and no phone number, so it
 * is the only thing that can connect the person signing in to the record being
 * created here. Skip it and this customer can never reach the order that is
 * about to be written for them: they sign in, get a second empty account, and
 * their history sits on a row nothing points at.
 *
 * Renders inline rather than as a second dialog: this is one step of writing an
 * order up, and a modal stacked on the order modal would bury the form it
 * belongs to.
 */
export function NewCustomerForm({
  shopId,
  defaultName,
  defaultPhone,
  lockPhone,
  askForAddress,
  onCreated,
  onUseExisting,
  onCancel,
}: Props) {
  const [createCustomer, { isLoading: saving }] = useCreateCustomerMutation();

  const [name, setName] = useState(defaultName?.trim() ?? "");
  const [phone, setPhone] = useState(defaultPhone?.trim() ?? "");
  const [email, setEmail] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  /** The customer already on this email, once the server has told us. */
  const [clash, setClash] = useState<EmailInUseError | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Enter the customer's name");
    // The number is what the branch calls back on, and what stops the same
    // caller becoming a new customer record on every order.
    if (phone.replace(/\D/g, "").length < 7) {
      return toast.error("Enter a valid phone number");
    }
    // Checked here as well as by the server so the message names what is wrong
    // while the field is still on screen. Loose on purpose — an address the
    // customer can receive mail at is the goal, and a stricter pattern rejects
    // valid ones for the sake of catching typos it cannot catch anyway.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return toast.error("Enter the customer's email address");
    }

    const address = fullAddress.trim();
    const body: NewCustomerBody = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
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
      setClash(null);
      onCreated(customer);
    } catch (err) {
      // An email already on file is refused, but not with a toast: it names a
      // customer who is almost certainly the one this order is for, and that
      // has to stay on screen with a button attached rather than vanish.
      const inUse = emailInUse(err);
      if (inUse) return setClash(inUse);
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
          {lockPhone ? (
            <Input readOnly value={phone} className="bg-muted text-muted-foreground" />
          ) : (
            <PhoneInput
              defaultCountry="IN"
              placeholder="Phone number"
              value={phone}
              onChange={(v) => setPhone(v ?? "")}
            />
          )}
        </FormField>
      </div>

      {/* Not decoration: this is what lets the customer find this order once
          they sign in on the storefront. Worth the extra question at the
          counter, so the hint says why rather than just marking it required. */}
      <FormField label="Email" required hint="So they can track this order online">
        <Input
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // The warning described the old address; keep it and the buttons
            // beneath it would act on a customer this form no longer names.
            setClash(null);
          }}
        />
      </FormField>

      {clash && (
        <EmailInUseNotice
          owner={clash.emailInUseBy}
          onUseExisting={() => onUseExisting(clash.emailInUseBy)}
        />
      )}

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
        {/* Hidden while the clash is up: its own buttons are the two answers,
            and a third that just re-asks the question would be noise. */}
        {!clash && (
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            Add customer
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The email is already on file — who holds it, and the one way forward.
 *
 * There is no "add anyway". An email is the only thing a storefront sign-in can
 * match a customer on, so two records sharing one guarantees that whoever signs
 * in sees the orders on just one of them — a split that nothing later can
 * detect or repair. The address identifies a customer; a second record for it
 * is a contradiction, not a choice.
 *
 * That is why this names them and offers the button rather than just refusing.
 * A clash nearly always means the caller is already on file under another
 * number, so attaching them is both correct and the fastest way on. Staff who
 * genuinely have a second person in front of them retype the email, and editing
 * that field clears this notice and restores Add customer.
 */
function EmailInUseNotice({
  owner,
  onUseExisting,
}: {
  owner: CustomerLookup;
  onUseExisting: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex gap-2.5">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">This email is already on file</p>
          <p className="text-xs text-muted-foreground">
            It belongs to{" "}
            <span className="font-medium text-foreground">
              {owner.name ?? "an unnamed customer"}
            </span>
            {owner.phone ? ` · ${owner.phone}` : ""}.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" onClick={onUseExisting}>
        Use {owner.name?.split(" ")[0] ?? "this customer"}
      </Button>
      {/* Names the other way out, since the Add customer button is gone until
          the field changes and nothing else on screen says so. */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        If this is a different person, enter their own email address — two
        customers cannot share one.
      </p>
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
