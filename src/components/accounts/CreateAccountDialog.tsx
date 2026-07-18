import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isValidPhoneNumber } from "react-phone-number-input";
import { slugify } from "@/lib/utils";
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
  /** Once the user edits the slug by hand, stop syncing it from the brand name. */
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [createAccount, { isLoading }] = useCreateAccountMutation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { activate: false, ownerPhone: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await createAccount({
        ...values,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
      }).unwrap();
      setInviteToken(res.ownerInviteToken);
      toast.success(`Shop "${res.name}" created.`);
      reset({ activate: false, ownerPhone: "" });
      setSlugTouched(false);
      setLogoUrl("");
      setBannerUrl("");
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const close = () => {
    setOpen(false);
    setInviteToken(null);
    reset({ activate: false, ownerPhone: "" });
    setSlugTouched(false);
    setLogoUrl("");
    setBannerUrl("");
  };

  const setPasswordLink = inviteToken
    ? `${window.location.origin}/set-password?token=${inviteToken}`
    : "";

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
                  value={watch("ownerPhone")}
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
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="activate"
                  checked={watch("activate")}
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
                Share this set-password link with the owner. It expires in 7
                days — they&rsquo;ll choose their own password before signing
                in.
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-start gap-2 py-6">
              <Input readOnly value={setPasswordLink} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard?.writeText(setPasswordLink);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
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
