import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImageIcon,
  Images,
  Loader2,
  Plus,
  Trash2,
} from "@/components/ui/icons";
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

function BannerCard({
  banner,
  index,
  total,
  onMove,
  reordering,
}: {
  banner: Banner;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  reordering: boolean;
}) {
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
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
            #{index + 1}
          </span>
          <ScopeBadge shopId={banner.shopId} accountId={banner.accountId} />
        </div>
        {banner.tapAction === "open_url" && banner.tapTarget && (
          <a
            href={banner.tapTarget}
            target="_blank"
            rel="noopener noreferrer"
            title={banner.tapTarget}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
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
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={reordering || index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="Move banner up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={reordering || index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="Move banner down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
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
        </div>
      </CardContent>
    </Card>
  );
}

export function BannersTab() {
  const { data: banners, isLoading } = useListBannersQuery();
  const [createBanner, { isLoading: creating }] = useCreateBannerMutation();
  const [updateBanner] = useUpdateBannerMutation();
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [link, setLink] = useState("");
  const [reordering, setReordering] = useState(false);

  const list = banners ?? [];

  const add = async () => {
    if (!imageUrl.trim()) return toast.error("Add an image first");
    const url = link.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return toast.error("Link must start with http:// or https://");
    }
    try {
      await createBanner({
        imageUrl: imageUrl.trim(),
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        tapAction: url ? "open_url" : undefined,
        tapTarget: url || undefined,
        displayOrder: list.length,
      }).unwrap();
      toast.success("Banner added");
      setImageUrl("");
      setTitle("");
      setSubtitle("");
      setCtaLabel("");
      setLink("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setReordering(true);
    try {
      await Promise.all(
        next
          .map((b, i) => ({ b, i }))
          .filter(({ b, i }) => b.displayOrder !== i)
          .map(({ b, i }) =>
            updateBanner({ id: b.id, body: { displayOrder: i } }).unwrap(),
          ),
      );
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setReordering(false);
    }
  };

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
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Link</Label>
                <Input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://example.com/offer"
                />
                <p className="text-xs text-muted-foreground">
                  Optional — where the banner takes the customer when tapped.
                </p>
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
          {list.map((b, i) => (
            <BannerCard
              key={b.id}
              banner={b}
              index={i}
              total={list.length}
              onMove={move}
              reordering={reordering}
            />
          ))}
        </div>
      )}
    </div>
  );
}
