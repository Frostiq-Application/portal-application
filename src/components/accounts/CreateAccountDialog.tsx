import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { InviteSentPanel } from "@/components/common/InviteSentPanel";
import { isValidPhoneNumber } from "react-phone-number-input";
import { slugify, cn } from "@/lib/utils";
import { THEME_PRESETS } from "@/lib/theme";
import { useCreateAccountMutation } from "@/features/api/accountsApi";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const schema = z.object({
  name: z.string().min(2, "Brand name is required"),
  ownerName: z.string().min(2, "Owner name is required"),
  ownerEmail: z.string().email("Valid email required"),
  ownerPhone: z
    .string()
    .refine((v) => isValidPhoneNumber(v), "Enter a valid phone number"),
  appSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, dashes"),
  activate: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function extractError(err: unknown): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return msg ?? "Failed to create shop.";
}

export function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  // The form is reset the moment the account is created, so the address the
  // invite went to is read back off the response rather than the fields.
  const [ownerEmail, setOwnerEmail] = useState("");
  /** Once the user edits the slug by hand, stop syncing it from the brand name. */
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [themeColor, setThemeColor] = useState(THEME_PRESETS[0].hex);
  const [createAccount, { isLoading }] = useCreateAccountMutation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { activate: false, ownerPhone: "" },
  });

  // `useWatch` rather than `watch()`: the latter returns a fresh function that
  // can't be memoized safely, which makes React Compiler skip this component.
  const ownerPhone = useWatch({ control, name: "ownerPhone" });
  const activate = useWatch({ control, name: "activate" });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await createAccount({
        ...values,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        themeColor: themeColor || undefined,
      }).unwrap();
      setOwnerEmail(res.ownerEmail);
      setInviteToken(res.ownerInviteToken);
      toast.success(`Shop "${res.name}" created — invite sent to ${res.ownerEmail}.`);
      reset({ activate: false, ownerPhone: "" });
      setSlugTouched(false);
      setLogoUrl("");
      setBannerUrl("");
      setThemeColor(THEME_PRESETS[0].hex);
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const close = () => {
    setOpen(false);
    setInviteToken(null);
    setOwnerEmail("");
    reset({ activate: false, ownerPhone: "" });
    setSlugTouched(false);
    setLogoUrl("");
    setBannerUrl("");
    setThemeColor(THEME_PRESETS[0].hex);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <SheetTrigger asChild>
        <Button>New shop</Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        {!inviteToken ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex h-full min-h-0 flex-col"
          >
            <SheetHeader>
              <SheetTitle>Create shop</SheetTitle>
              <SheetDescription>
                Onboard a client brand. The owner receives a link to set
                their password.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-6">
              <Field label="Brand name" error={errors.name?.message}>
                <Input
                  placeholder="Divine Cake"
                  {...register("name", {
                    onChange: (e) => {
                      if (!slugTouched) {
                        setValue("appSlug", slugify(e.target.value), {
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                />
              </Field>
              <Field
                label="App slug"
                error={errors.appSlug?.message}
                hint="Auto-filled from the brand name."
              >
                <Input
                  placeholder="divine-cake"
                  {...register("appSlug", {
                    onChange: () => setSlugTouched(true),
                    // Normalise on blur, not per keystroke, so a trailing dash can be typed.
                    onBlur: (e) =>
                      setValue("appSlug", slugify(e.target.value), {
                        shouldValidate: true,
                      }),
                  })}
                />
              </Field>
              <Field label="Owner name" error={errors.ownerName?.message}>
                <Input placeholder="Asha Mehta" {...register("ownerName")} />
              </Field>
              <Field label="Owner phone" error={errors.ownerPhone?.message}>
                <PhoneInput
                  defaultCountry="IN"
                  placeholder="Enter phone number"
                  value={ownerPhone}
                  onChange={(v) => setValue("ownerPhone", v ?? "", { shouldValidate: true })}
                />
              </Field>
              <Field label="Owner email" error={errors.ownerEmail?.message}>
                <Input
                  type="email"
                  placeholder="asha@divinecake.com"
                  {...register("ownerEmail")}
                />
              </Field>
              <Field label="Logo">
                <ImageUploader
                  value={logoUrl ? [logoUrl] : []}
                  onChange={(urls) => setLogoUrl(urls[0] ?? "")}
                  folder="accounts"
                  max={1}
                />
              </Field>
              <Field label="Banner image">
                <ImageUploader
                  value={bannerUrl ? [bannerUrl] : []}
                  onChange={(urls) => setBannerUrl(urls[0] ?? "")}
                  folder="accounts"
                  max={1}
                  aspect="banner"
                />
              </Field>
              <Field
                label="Theme color"
                hint="The brand's accent — colours buttons, the active menu item and highlights in their portal."
              >
                <ThemeColorPicker value={themeColor} onChange={setThemeColor} />
              </Field>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="activate"
                  checked={activate}
                  onCheckedChange={(v) => setValue("activate", v)}
                />
                <Label htmlFor="activate" className="cursor-pointer">
                  Activate immediately (skip pending approval)
                </Label>
              </div>
            </div>

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader>
              <SheetTitle>Shop created</SheetTitle>
              <SheetDescription>
                The owner will choose their own password before signing in.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <InviteSentPanel
                email={ownerEmail}
                token={inviteToken}
                note="They'll set their own password from the link in the email and can start setting up the shop straight away. It expires in 7 days."
              />
            </div>
            <SheetFooter className="mt-auto">
              <Button onClick={close}>Done</Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Preset swatches plus a native custom-colour input, bound to a hex string. */
function ThemeColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const isPreset = THEME_PRESETS.some(
    (p) => p.hex.toLowerCase() === value.toLowerCase(),
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {THEME_PRESETS.map((p) => {
          const active = p.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              aria-label={p.name}
              aria-pressed={active}
              onClick={() => onChange(p.hex)}
              className={cn(
                "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                active
                  ? "ring-2 ring-offset-2 ring-offset-background"
                  : "border-border",
              )}
              style={{
                backgroundColor: p.hex,
                ...(active ? { boxShadow: `0 0 0 2px ${p.hex}` } : {}),
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Custom color"
          value={value || "#e91e63"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border bg-transparent p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#E91E63"
          className="max-w-[10rem] font-mono"
        />
        {!isPreset && value && (
          <span className="text-xs text-muted-foreground">Custom</span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
