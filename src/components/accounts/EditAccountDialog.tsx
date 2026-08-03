import { useState } from "react";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { useUpdateAccountMutation } from "@/features/api/accountsApi";
import { apiError } from "@/lib/apiError";
import type { Account } from "@/types";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: Account | null;
}

export function EditAccountDialog({ open, onOpenChange, account }: Props) {
  const [updateAccount, { isLoading }] = useUpdateAccountMutation();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [themeColor, setThemeColor] = useState("");

  // Seeded during render rather than in an effect, so the fields are correct on
  // first paint instead of flashing the previous brand's values for a frame.
  const seedKey = open && account ? account.id : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    if (account) {
      setName(account.name);
      setOwnerName(account.ownerName);
      setOwnerPhone(account.ownerPhone);
      setLogoUrl(account.logoUrl ?? "");
      setBannerUrl(account.bannerUrl ?? "");
      setThemeColor(account.themeColor ?? "");
    }
  }

  const submit = async () => {
    if (!account) return;
    if (name.trim().length < 2) return toast.error("Brand name required");
    try {
      await updateAccount({
        id: account.id,
        body: {
          name: name.trim(),
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          // null, not undefined: undefined drops the key from the JSON body,
          // so clearing an image read as "don't touch it" and the old one came
          // straight back on the next fetch.
          logoUrl: logoUrl || null,
          bannerUrl: bannerUrl || null,
          themeColor: themeColor || null,
        },
      }).unwrap();
      toast.success("Shop updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Failed to update shop"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit shop</DialogTitle>
          <DialogDescription>Brand details, logo, and banner.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="name">Brand name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Divine Cake"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerName">Owner name</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Asha Mehta"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner phone</Label>
            <PhoneInput
              defaultCountry="IN"
              placeholder="Enter phone number"
              value={ownerPhone}
              onChange={(v) => setOwnerPhone(v ?? "")}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Logo</Label>
            <ImageUploader
              value={logoUrl ? [logoUrl] : []}
              onChange={(urls) => setLogoUrl(urls[0] ?? "")}
              folder="accounts"
              max={1}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Banner image</Label>
            <ImageUploader
              value={bannerUrl ? [bannerUrl] : []}
              onChange={(urls) => setBannerUrl(urls[0] ?? "")}
              folder="accounts"
              max={1}
              aspect="banner"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="themeColor">Accent color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={themeColor || "#e91e63"}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="themeColor"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#E91E63"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
