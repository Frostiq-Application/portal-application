import { useState } from "react";
import { Facebook, Instagram, Loader2, MessageCircle, Phone, Quote } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import {
  useGetAccountContentQuery,
  useUpsertAccountContentMutation,
} from "@/features/api/cmsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCountryCallingCode } from "react-phone-number-input";
import { CountryCodeSelect } from "./CountryCodeSelect";

/** What the storefront falls back to when the brand has never set one. */
const DEFAULT_COUNTRY = "IN";

/** "IN" → "+91"; anything unrecognised shows as-is rather than crashing. */
function dialCodeOf(iso: string): string {
  try {
    return `+${getCountryCallingCode(iso as Parameters<typeof getCountryCallingCode>[0])}`;
  } catch {
    return iso;
  }
}

export function BrandTab() {
  const { data } = useGetAccountContentQuery();
  const [save, { isLoading }] = useUpsertAccountContentMutation();
  const [tagline, setTagline] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [instagramUrl, setInstagram] = useState("");
  const [facebookUrl, setFacebook] = useState("");
  const [whatsappUrl, setWhatsapp] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY);

  // Seeded during render rather than in an effect: the fields fill in on the
  // same paint the fetched brand content arrives, not one frame later.
  const [seeded, setSeeded] = useState<typeof data>(undefined);
  if (data && data !== seeded) {
    setSeeded(data);
    setTagline(data.tagline ?? "");
    setAboutText(data.aboutText ?? "");
    setInstagram(data.instagramUrl ?? "");
    setFacebook(data.facebookUrl ?? "");
    setWhatsapp(data.whatsappUrl ?? "");
    setPhoneCountryCode(data.phoneCountryCode ?? DEFAULT_COUNTRY);
  }

  const submit = async () => {
    try {
      await save({
        tagline,
        aboutText,
        instagramUrl,
        facebookUrl,
        whatsappUrl,
        phoneCountryCode,
      }).unwrap();
      toast.success("Brand content saved");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storefront copy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Tagline</Label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Handcrafted cakes, baked fresh daily"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>About</Label>
              <Textarea
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                rows={5}
                placeholder="Tell customers your story…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Instagram</Label>
              <div className="relative">
                <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-500" />
                <Input
                  className="pl-9"
                  value={instagramUrl}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="instagram.com/…"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Facebook</Label>
              <div className="relative">
                <Facebook className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                <Input
                  className="pl-9"
                  value={facebookUrl}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="facebook.com/…"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>WhatsApp</Label>
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                <Input
                  className="pl-9"
                  value={whatsappUrl}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="wa.me/…"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer phone numbers</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Country</Label>
              <CountryCodeSelect
                value={phoneCountryCode}
                onChange={setPhoneCountryCode}
              />
              <p className="text-xs text-muted-foreground">
                The storefront's phone field starts here, so customers type
                only their local number.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>What the customer sees</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{dialCodeOf(phoneCountryCode)}</span>
                <span className="text-muted-foreground">98765 43210</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <Quote className="h-5 w-5 text-primary/60" />
              <p className="mt-1 text-sm font-medium">
                {tagline || "Your tagline appears here"}
              </p>
              <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                {aboutText || "Your about text will show on the storefront's about section."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {instagramUrl && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/10 text-pink-500">
                  <Instagram className="h-4 w-4" />
                </span>
              )}
              {facebookUrl && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
                  <Facebook className="h-4 w-4" />
                </span>
              )}
              {whatsappUrl && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600">
                  <MessageCircle className="h-4 w-4" />
                </span>
              )}
              {!instagramUrl && !facebookUrl && !whatsappUrl && (
                <span className="text-xs text-muted-foreground">
                  Add social links to show icons here.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
