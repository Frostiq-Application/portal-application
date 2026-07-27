import { useState } from "react";
import { ImageIcon, Images, Loader2, Plus, Trash2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  useCreateBannerMutation,
  useDeleteBannerMutation,
  useListBannersQuery,
  useUpdateBannerMutation,
  type Banner,
} from "@/features/api/cmsApi";
import { ImageUploader } from "@/components/ImageUploader";
import { ScopeBadge } from "@/components/cms/ScopeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Storefront-accurate preview of how the banner will look on the phone. */
function BannerPreview({
  imageUrl,
  title,
  subtitle,
  ctaLabel,
}: {
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
}) {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border bg-muted">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <span className="text-xs">Upload an image to preview</span>
        </div>
      )}
      {(title || subtitle || ctaLabel) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          {title && (
            <p className="text-sm font-semibold text-white drop-shadow">{title}</p>
          )}
          {subtitle && (
            <p className="text-xs text-white/85 drop-shadow">{subtitle}</p>
          )}
          {ctaLabel && (
            <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black">
              {ctaLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function BannerCard({ banner }: { banner: Banner }) {
  const [updateBanner] = useUpdateBannerMutation();
  const [deleteBanner, { isLoading: deleting }] = useDeleteBannerMutation();

  const toggle = async (isActive: boolean) => {
    try {
      await updateBanner({ id: banner.id, body: { isActive } }).unwrap();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const remove = async () => {
    try {
      await deleteBanner(banner.id).unwrap();
      toast.success("Banner removed");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-shadow hover:shadow-md",
        !banner.isActive && "opacity-70",
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        <img
          src={banner.imageUrl}
          alt={banner.title ?? "banner"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2">
          <ScopeBadge shopId={banner.shopId} accountId={banner.accountId} />
        </div>
        {(banner.title || banner.subtitle || banner.ctaLabel) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            {banner.title && (
              <p className="text-sm font-semibold text-white drop-shadow">
                {banner.title}
              </p>
            )}
            {banner.subtitle && (
              <p className="line-clamp-1 text-xs text-white/85 drop-shadow">
                {banner.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
      <CardContent className="flex items-center justify-between gap-2 py-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Switch
            checked={banner.isActive}
            onCheckedChange={toggle}
            aria-label="Toggle banner visibility"
          />
          {banner.isActive ? "Live" : "Hidden"}
        </label>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this banner?</AlertDialogTitle>
              <AlertDialogDescription>
                It will immediately disappear from the storefront. This can&rsquo;t be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={remove}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function BannersTab() {
  const { data: banners, isLoading } = useListBannersQuery();
  const [createBanner, { isLoading: creating }] = useCreateBannerMutation();
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");

  const add = async () => {
    if (!imageUrl.trim()) return toast.error("Add an image first");
    try {
      await createBanner({
        imageUrl: imageUrl.trim(),
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
      }).unwrap();
      toast.success("Banner added");
      setImageUrl("");
      setTitle("");
      setSubtitle("");
      setCtaLabel("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const list = banners ?? [];

  return (
    <div className="space-y-6">
      {/* Composer */}
      <Card>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Banner image</Label>
              <ImageUploader
                value={imageUrl ? [imageUrl] : []}
                onChange={(urls) => setImageUrl(urls[0] ?? "")}
                folder="banners"
                max={1}
                aspect="banner"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Fresh from the oven"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CTA label</Label>
                <Input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Shop now"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Subtitle</Label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Order your favourites today"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-muted-foreground">Preview</Label>
            <BannerPreview
              imageUrl={imageUrl}
              title={title}
              subtitle={subtitle}
              ctaLabel={ctaLabel}
            />
            <Button onClick={add} disabled={creating || !imageUrl} className="w-full">
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add banner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gallery */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>No banners yet</EmptyTitle>
            <EmptyDescription>
              Add your first hero banner above — it shows at the top of the storefront.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <BannerCard key={b.id} banner={b} />
          ))}
        </div>
      )}
    </div>
  );
}
