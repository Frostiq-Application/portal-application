import { useMemo, useState } from "react";
import { getCountries, getCountryCallingCode } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { Check, ChevronsUpDown } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Country {
  /** "IN" — what gets stored. */
  iso: string;
  dial: string;
  name: string;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * Every country, with its dialling code. Built once: the list is static, and
 * `Intl.DisplayNames` keeps the ~250 country names out of the bundle.
 */
function useCountries(): Country[] {
  return useMemo(
    () =>
      getCountries()
        .map((iso) => ({
          iso,
          dial: `+${getCountryCallingCode(iso)}`,
          name: regionNames.of(iso) ?? iso,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
}

/**
 * Picks the country the storefront's phone field starts on.
 *
 * The country is stored, not the dialling code, because the country is what a
 * phone field actually needs: +1 is both the US and Canada and they format
 * numbers differently, so a code alone can't tell the field how to behave.
 */
export function CountryCodeSelect({
  value,
  onChange,
}: {
  /** ISO 3166-1 alpha-2, e.g. "IN". */
  value: string;
  onChange: (iso: string) => void;
}) {
  const countries = useCountries();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = countries.find((c) => c.iso === value);
  const Flag = selected ? flags[selected.iso as keyof typeof flags] : undefined;

  const term = search.trim().toLowerCase();
  const filtered = term
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.dial.includes(term) ||
          c.iso.toLowerCase() === term,
      )
    : countries;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {Flag && (
              <span className="flex h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-muted [&_svg]:h-full [&_svg]:w-full">
                <Flag title={selected?.name ?? ""} />
              </span>
            )}
            <span className="truncate">
              {selected ? `${selected.name} (${selected.dial})` : value || "Select a country"}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country or code…"
            className="h-8"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No country found.
            </p>
          ) : (
            filtered.map((c) => {
              const RowFlag = flags[c.iso as keyof typeof flags];
              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => {
                    onChange(c.iso);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                    c.iso === value && "bg-accent",
                  )}
                >
                  <span className="flex h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-muted [&_svg]:h-full [&_svg]:w-full">
                    {RowFlag && <RowFlag title={c.name} />}
                  </span>
                  <span className="flex-1 truncate text-left">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.dial}</span>
                  {c.iso === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
