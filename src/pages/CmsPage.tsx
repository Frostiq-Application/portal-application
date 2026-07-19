import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { useAuth } from "@/hooks/useAuth";
import { isAccountAdmin } from "@/lib/roles";
import {
  useCreateAnnouncementMutation,
  useCreateBannerMutation,
  useDeleteAnnouncementMutation,
  useDeleteBannerMutation,
  useGetAccountContentQuery,
  useListAnnouncementsQuery,
  useListBannersQuery,
  useUpsertAccountContentMutation,
} from "@/features/api/cmsApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImageUploader } from "@/components/ImageUploader";
import { FeaturedTab } from "@/components/cms/FeaturedTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function BannersTab() {
  const { data: banners } = useListBannersQuery();
  const [createBanner, { isLoading }] = useCreateBannerMutation();
  const [deleteBanner] = useDeleteBannerMutation();
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const add = async () => {
    if (!imageUrl.trim()) return toast.error("Image URL required");
    try {
      await createBanner({
        imageUrl: imageUrl.trim(),
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
      }).unwrap();
      toast.success("Banner added");
      setImageUrl("");
      setTitle("");
      setSubtitle("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <Label>Image</Label>
            <ImageUploader
              value={imageUrl ? [imageUrl] : []}
              onChange={(urls) => setImageUrl(urls[0] ?? "")}
              folder="banners"
              max={1}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={add} disabled={isLoading}>Add banner</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(banners ?? []).map((b) => (
          <Card key={b.id} className="overflow-hidden">
            <img src={b.imageUrl} alt={b.title ?? "banner"} className="h-32 w-full object-cover" />
            <CardContent className="flex items-start justify-between pt-3">
              <div>
                <p className="text-sm font-medium">{b.title || "Untitled"}</p>
                {b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}
                <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                  {b.shopId ? "Branch" : b.accountId ? "Account" : "Platform"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteBanner(b.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(banners ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No banners yet.</p>
        )}
      </div>
    </div>
  );
}

function AnnouncementsTab() {
  const { data: items } = useListAnnouncementsQuery();
  const [create, { isLoading }] = useCreateAnnouncementMutation();
  const [remove] = useDeleteAnnouncementMutation();
  const [message, setMessage] = useState("");

  const add = async () => {
    if (!message.trim()) return toast.error("Message required");
    try {
      await create({ message: message.trim() }).unwrap();
      toast.success("Announcement added");
      setMessage("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex gap-3 pt-6">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Free delivery on orders over ₹999!"
          />
          <Button onClick={add} disabled={isLoading}>Add</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {(items ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border bg-background p-3">
            <div>
              <p className="text-sm">{a.message}</p>
              <p className="text-[10px] uppercase text-muted-foreground">
                {a.shopId ? "Branch" : a.accountId ? "Account" : "Platform"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {(items ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}

function BrandTab() {
  const { data } = useGetAccountContentQuery();
  const [save, { isLoading }] = useUpsertAccountContentMutation();
  const [tagline, setTagline] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [instagramUrl, setInstagram] = useState("");
  const [facebookUrl, setFacebook] = useState("");
  const [whatsappUrl, setWhatsapp] = useState("");

  useEffect(() => {
    if (data) {
      setTagline(data.tagline ?? "");
      setAboutText(data.aboutText ?? "");
      setInstagram(data.instagramUrl ?? "");
      setFacebook(data.facebookUrl ?? "");
      setWhatsapp(data.whatsappUrl ?? "");
    }
  }, [data]);

  const submit = async () => {
    try {
      await save({ tagline, aboutText, instagramUrl, facebookUrl, whatsappUrl }).unwrap();
      toast.success("Brand content saved");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <div className="flex flex-col gap-1.5">
          <Label>Tagline</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>About</Label>
          <Textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={4} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Instagram</Label>
            <Input value={instagramUrl} onChange={(e) => setInstagram(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Facebook</Label>
            <Input value={facebookUrl} onChange={(e) => setFacebook(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>WhatsApp</Label>
            <Input value={whatsappUrl} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
        </div>
        <div>
          <Button onClick={submit} disabled={isLoading}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CmsPage() {
  const { role } = useAuth();
  const showBrand = isAccountAdmin(role);
  return (
    <>
      <PageHeader title="CMS" description="Storefront banners, announcements & brand content" />
      <Tabs defaultValue="banners">
        <TabsList>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          {showBrand && <TabsTrigger value="brand">Brand</TabsTrigger>}
        </TabsList>
        <TabsContent value="banners" className="mt-4">
          <BannersTab />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab />
        </TabsContent>
        <TabsContent value="featured" className="mt-4">
          <FeaturedTab />
        </TabsContent>
        {showBrand && (
          <TabsContent value="brand" className="mt-4">
            <BrandTab />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
