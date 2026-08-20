import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Phone, Search, ShieldAlert, UserPlus } from "@/components/ui/icons";
import { apiError } from "@/lib/apiError";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLazyLookupCustomerByPhoneQuery } from "@/features/api/customersApi";
import type { CustomerLookup } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Digits a number must have before it identifies anyone. Matches the server. */
const REQUIRED_DIGITS = 10;

/** "9812345678" → "98123 45678", the grouping the number is read aloud in. */
function group(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

interface Props {
  /** Branch the order is being taken for, when one has been chosen. */
  shopId?: string;
  onSelect: (customer: CustomerLookup) => void;
  /** Hand the typed number to customer creation — it is already on the form. */
  onAddNew: (phone: string) => void;
}

/**
 * Find the customer on the other end of the phone, by their number alone.
 *
 * The order form's customer picker for brands whose plan has no customer
 * directory. Those brands used to be unable to create an order at all: every
 * customer route sat behind `can_use_customer_data`, so the search returned 403
 * and the form's required customer field could never be filled.
 *
 * Not a search box with the list hidden — a different question. Staff type a
 * number they already have, off a caller ID or read back over the line, and get
 * that one person or nobody. There is no partial matching and nothing to page
 * through, so this never becomes the directory by another route. Brands that DO
 * have the module keep the full search; see CreateOrderDialog.
 */
export function CustomerPhoneLookup({ shopId, onSelect, onAddNew }: Props) {
  const [lookup, { isFetching }] = useLazyLookupCustomerByPhoneQuery();

  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<CustomerLookup | null>(null);
  /** The number `result` describes — cleared the moment the box is edited. */
  const [searched, setSearched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Last number sent, so a settled value is never looked up twice. */
  const requested = useRef<string | null>(null);

  const ready = digits.length === REQUIRED_DIGITS;

  const search = useCallback(
    async (phone: string) => {
      requested.current = phone;
      setError(null);
      try {
        const res = await lookup({ phone, shopId }).unwrap();
        setResult(res.customer);
        setSearched(phone);
      } catch (err) {
        setResult(null);
        setSearched(null);
        setError(apiError(err, "Couldn't look that number up"));
      }
    },
    [lookup, shopId],
  );

  /**
   * Put a number in the box, keeping only digits.
   *
   * `keep` is the difference between typing and pasting, and it matters because
   * the two overflow in opposite directions. Typing an eleventh digit is a
   * slip — the tenth was the last one wanted — so the extra is dropped and the
   * number already entered stands. A pasted string overflows because it carries
   * a country code in front of the number, so there the *leading* digits are
   * the ones to drop.
   *
   * Keeping the last ten on every input was the bug this replaces: a typed
   * eleventh digit slid the window along, quietly turning 0123456789 into
   * 1234567899 — a different, real-looking number.
   */
  const put = (raw: string, keep: "first" | "last") => {
    const all = raw.replace(/\D/g, "");
    setDigits(
      keep === "last"
        ? all.slice(-REQUIRED_DIGITS)
        : all.slice(0, REQUIRED_DIGITS),
    );
    setResult(null);
    setSearched(null);
    setError(null);
    // Editing the box makes whatever was last sent stale, so retyping the same
    // number searches again rather than sitting on a result that was cleared.
    requested.current = null;
  };

  /**
   * Look the number up once staff stop typing, rather than the moment a tenth
   * digit appears.
   *
   * Firing on the count alone looks right and is not: someone typing their
   * country code hits ten digits at "9198123456" — a real-looking number that
   * is not the one they are entering — and every keystroke after it shifts the
   * window along to another. That spends three lookups against the rate limit
   * and flashes "no customer found" at staff mid-number. Waiting for the value
   * to settle asks once, about the number they actually typed.
   */
  const settled = useDebouncedValue(digits);
  // Deliberately keyed on the number alone. Depending on `search` would re-run
  // this whenever the query trigger changes identity, and the run after an edit
  // still sees the PREVIOUS settled number with the guard just cleared — which
  // re-fetches the number staff have already typed past and puts its customer
  // back on screen under the new one.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });
  useEffect(() => {
    if (settled.length === REQUIRED_DIGITS && requested.current !== settled) {
      void searchRef.current(settled);
    }
  }, [settled]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            // Ten digits plus the separator `group` puts in. The browser then
            // refuses the eleventh outright, so a full box stops accepting
            // keystrokes rather than silently discarding them.
            maxLength={REQUIRED_DIGITS + 1}
            className="pl-9 tabular-nums tracking-wide"
            placeholder={`${REQUIRED_DIGITS}-digit mobile number`}
            value={group(digits)}
            onChange={(e) => put(e.target.value, "first")}
            // Handled here rather than left to onChange so a pasted number
            // keeps its last ten digits: numbers are copied off a caller ID or
            // out of a chat with "+91" attached, and that prefix is not part of
            // what identifies the customer.
            onPaste={(e) => {
              e.preventDefault();
              put(e.clipboardData.getData("text"), "last");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready) void search(digits);
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={!ready || isFetching}
          onClick={() => void search(digits)}
        >
          {isFetching ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Search className="mr-1 size-4" />
          )}
          Find
        </Button>
      </div>

      {/* One line of guidance, replaced by the result once there is one. The
          number is the only way in, so say so before staff go looking. */}
      {!searched && !error && (
        <p className="px-0.5 text-xs text-muted-foreground">
          {isFetching
            ? "Looking this number up…"
            : `Enter the customer's ${REQUIRED_DIGITS}-digit number to find them, or add them if they're new.`}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {searched && result && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
              {(result.name ?? "?").slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                {result.name ?? "Unnamed customer"}
                {/* Staff typed this record's details and nobody confirmed them.
                    Worth knowing before reading the email back to someone. */}
                {!result.isVerified && (
                  <span
                    title="Details were entered by staff and haven't been confirmed by the customer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    <ShieldAlert className="size-3" />
                    Unverified
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {result.email ?? result.phone ?? "No contact on file"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => onSelect(result)}
          >
            Use
          </Button>
        </div>
      )}

      {searched && !result && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-3">
          <p className="text-sm text-muted-foreground">
            No customer on {group(searched)}.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddNew(searched)}
          >
            <UserPlus className="mr-1 size-3.5" />
            Add this customer
          </Button>
        </div>
      )}
    </div>
  );
}
