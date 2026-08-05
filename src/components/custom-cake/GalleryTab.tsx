import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EyeOff,
  GripVertical,
  ImagePlus,
  Images,
  Loader2,
  RefreshCw,
  Star,
  StarFilled,
  Trash2,
  TriangleAlert,
  X,
} from "@/components/ui/icons";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compressImage";
import { mapWithConcurrency, uploadWithProgress } from "@/lib/uploadWithProgress";
import { useUploadAssetMutation } from "@/features/api/uploadApi";
import {
  galleryApi,
  useAddGalleryImagesMutation,
  useDeleteGalleryImageMutation,
  useListGalleryImagesQuery,
  useReorderGalleryImagesMutation,
  useUpdateGalleryImageMutation,
  type GalleryImage,
  type GalleryImageInput,
} from "@/features/api/galleryApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Matches GALLERY_BULK_MAX on the server. */
const MAX_PER_BATCH = 30;
const UPLOAD_CONCURRENCY = 4;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** A file on its way to the bucket — rendered as a real tile from the moment
 * it's picked, so the grid never sits empty while photos upload. */
interface PendingUpload {
  localId: string;
  file: File;
  previewUrl: string;
  progress: number;
  failed: boolean;
}

export function GalleryTab({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.accessToken);
  const { data, isLoading } = useListGalleryImagesQuery(shopId, { skip: !shopId });
  const [addImages] = useAddGalleryImagesMutation();
  const [uploadViaRtk] = useUploadAssetMutation();
  const [reorder] = useReorderGalleryImagesMutation();

  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const images = useMemo(() => data ?? [], [data]);
  const featuredCount = images.filter((i) => i.isFeatured && i.isActive).length;

  // Object URLs leak if the tab unmounts mid-upload, so the cleanup needs the
  // list as it stands at unmount — not the empty one captured at mount.
  const pendingRef = useRef(pending);
  // Written in an effect, not during render: a render can be discarded and
  // replayed, and the ref would keep the value from the attempt React threw
  // away. The commit is the only point where "what is on screen" is settled.
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      for (const p of pendingRef.current) URL.revokeObjectURL(p.previewUrl);
    },
    [],
  );

  const setProgress = (localId: string, progress: number) =>
    setPending((list) =>
      list.map((p) => (p.localId === localId ? { ...p, progress } : p)),
    );

  /**
   * Upload one file. XHR first (real progress); on any failure retry through
   * RTK Query, whose base query refreshes an expired access token — the one
   * case where a whole batch would otherwise fail on a long-open tab.
   */
  const uploadOne = useCallback(
    async (item: PendingUpload): Promise<GalleryImageInput> => {
      const prepared = await compressImage(item.file);
      try {
        const res = await uploadWithProgress(prepared, {
          folder: "gallery",
          token,
          onProgress: (f) => setProgress(item.localId, Math.max(0.02, f * 0.98)),
        });
        setProgress(item.localId, 1);
        return { imageUrl: res.url, storageKey: res.key };
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") throw err;
        const res = await uploadViaRtk({ file: prepared, folder: "gallery" }).unwrap();
        setProgress(item.localId, 1);
        return { imageUrl: res.url, storageKey: res.key };
      }
    },
    [token, uploadViaRtk],
  );

  const runBatch = useCallback(
    async (batch: PendingUpload[]) => {
      const uploaded: GalleryImageInput[] = [];
      const failed: string[] = [];

      await mapWithConcurrency(batch, UPLOAD_CONCURRENCY, async (item) => {
        try {
          uploaded.push(await uploadOne(item));
          // Drop the tile only once its real row is about to exist, so the
          // grid never flickers back to a gap.
          setPending((list) => list.filter((p) => p.localId !== item.localId));
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          failed.push(item.localId);
          setPending((list) =>
            list.map((p) =>
              p.localId === item.localId ? { ...p, failed: true, progress: 0 } : p,
            ),
          );
        }
      });

      if (uploaded.length) {
        try {
          await addImages({ shopId, images: uploaded }).unwrap();
          toast.success(
            uploaded.length === 1
              ? "Image added to the gallery"
              : `${uploaded.length} images added to the gallery`,
          );
        } catch (err) {
          toast.error(apiError(err, "Images uploaded but could not be saved"));
        }
      }
      if (failed.length) {
        toast.error(
          `${failed.length} ${failed.length === 1 ? "photo" : "photos"} failed to upload. Retry from the grid.`,
        );
      }
    },
    [addImages, shopId, uploadOne],
  );

  const onFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (picked.length === 0) return;
      if (picked.length > MAX_PER_BATCH) {
        toast.info(`Taking the first ${MAX_PER_BATCH}. Add the rest in a second batch.`);
      }
      const batch: PendingUpload[] = picked.slice(0, MAX_PER_BATCH).map((file, i) => ({
        localId: `${Date.now()}-${i}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        failed: false,
      }));
      setPending((list) => [...batch, ...list]);
      void runBatch(batch);
    },
    [runBatch],
  );

  const retry = (item: PendingUpload) => {
    setPending((list) =>
      list.map((p) => (p.localId === item.localId ? { ...p, failed: false } : p)),
    );
    void runBatch([{ ...item, failed: false, progress: 0 }]);
  };

  const discard = (item: PendingUpload) => {
    setPending((list) => list.filter((p) => p.localId !== item.localId));
    URL.revokeObjectURL(item.previewUrl);
  };

  // ---- drag to reorder ----------------------------------------------------
  const onDropTile = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = images.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);

    // Reorder the cache first — the tile should land where it was dropped
    // before the request even leaves.
    dispatch(
      galleryApi.util.updateQueryData("listGalleryImages", shopId, (draft) => {
        draft.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        draft.forEach((row, index) => (row.displayOrder = index));
      }),
    );
    setDragId(null);
    reorder({ shopId, ids })
      .unwrap()
      .catch((err) => toast.error(apiError(err, "Could not save the new order")));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Design gallery</h2>
          <p className="text-sm text-muted-foreground">
            Photos of cakes you&rsquo;ve made. Customers browse them and tap
            &ldquo;make it like this&rdquo; to start a custom cake request.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {images.length} {images.length === 1 ? "image" : "images"}
            {featuredCount > 0 && ` · ${featuredCount} featured`}
          </span>
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Add images
          </Button>
        </div>
      </div>

      {/* Drop zone — click or drag, many at a time. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-8 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
        )}
      >
        <ImagePlus
          className={cn(
            "h-6 w-6 transition-colors",
            dragOver ? "text-primary" : "text-muted-foreground",
          )}
        />
        <p className="text-sm font-medium">
          Drop photos here, or <span className="text-primary">browse</span>
        </p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP or GIF · up to {MAX_PER_BATCH} at a time
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length > 0 && featuredCount === 0 && (
        <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            No featured images yet. The carousel on the storefront home screen
            shows <strong className="text-foreground">featured</strong> images
            only. Star a few so it appears.
          </p>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : images.length === 0 && pending.length === 0 ? (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No gallery images yet</EmptyTitle>
            <EmptyDescription>
              Upload photos of cakes you&rsquo;ve already made. They become the
              inspiration customers order from.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pending.map((item) => (
              <PendingTile
                key={item.localId}
                item={item}
                onRetry={() => retry(item)}
                onDiscard={() => discard(item)}
              />
            ))}
            {images.map((image) => (
              <GalleryTile
                key={image.id}
                image={image}
                shopId={shopId}
                dragging={dragId === image.id}
                onDragStart={() => setDragId(image.id)}
                onDragEnd={() => setDragId(null)}
                onDropTile={() => onDropTile(image.id)}
              />
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

/** A file mid-upload: its own preview, a real progress bar, and a way out. */
function PendingTile({
  item,
  onRetry,
  onDiscard,
}: {
  item: PendingUpload;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="relative aspect-square w-full bg-muted">
        <img
          src={item.previewUrl}
          alt=""
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            item.failed ? "opacity-40" : "opacity-60",
          )}
        />
        {item.failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70">
            <p className="px-2 text-center text-xs text-muted-foreground">
              Upload failed
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7" onClick={onRetry}>
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onDiscard}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-foreground/70" />
          </div>
        )}
      </div>
      {!item.failed && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${Math.round(item.progress * 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}

function GalleryTile({
  image,
  shopId,
  dragging,
  onDragStart,
  onDragEnd,
  onDropTile,
}: {
  image: GalleryImage;
  shopId: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropTile: () => void;
}) {
  const [update] = useUpdateGalleryImageMutation();
  const [remove, { isLoading: removing }] = useDeleteGalleryImageMutation();
  const [name, setName] = useState(image.name ?? "");
  const [over, setOver] = useState(false);

  // Another tab (or an optimistic rollback) changed the caption underneath us.
  // Applied during render so the field never shows the superseded caption.
  const [seenName, setSeenName] = useState(image.name ?? "");
  if ((image.name ?? "") !== seenName) {
    setSeenName(image.name ?? "");
    setName(image.name ?? "");
  }

  const saveName = () => {
    const next = name.trim();
    if (next === (image.name ?? "")) return;
    update({ id: image.id, shopId, name: next }).unwrap().catch((err) => {
      setName(image.name ?? "");
      toast.error(apiError(err, "Could not rename the image"));
    });
  };

  const toggle = (patch: { isFeatured?: boolean; isActive?: boolean }) =>
    update({ id: image.id, shopId, ...patch })
      .unwrap()
      .catch((err) => toast.error(apiError(err, "Could not update the image")));

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => {
        setOver(false);
        onDragEnd();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropTile();
      }}
      className={cn(
        "group relative overflow-hidden transition-all",
        dragging && "opacity-40",
        over && "ring-2 ring-primary",
        !image.isActive && "opacity-60",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <img
          src={image.imageUrl}
          alt={image.name ?? "Gallery image"}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Featured star — the storefront marquee reads exactly this flag. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => toggle({ isFeatured: !image.isFeatured })}
              className={cn(
                "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur transition-colors",
                image.isFeatured
                  ? "bg-amber-400 text-amber-950"
                  : "bg-black/45 text-white opacity-0 group-hover:opacity-100",
              )}
            >
              {image.isFeatured ? (
                <StarFilled className="h-4 w-4" />
              ) : (
                <Star className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {image.isFeatured ? "Shown in the home carousel" : "Feature on home"}
          </TooltipContent>
        </Tooltip>

        {!image.isActive && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            Hidden
          </span>
        )}

        <span className="absolute bottom-2 left-2 cursor-grab rounded-md bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggle({ isActive: !image.isActive })}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/70"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {image.isActive ? "Hide from storefront" : "Show on storefront"}
            </TooltipContent>
          </Tooltip>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this image?</AlertDialogTitle>
                <AlertDialogDescription>
                  It disappears from your storefront gallery and the file is
                  deleted. Requests already made from it are unaffected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={removing}
                  onClick={() =>
                    remove({ id: image.id, shopId })
                      .unwrap()
                      .catch((err) =>
                        toast.error(apiError(err, "Could not remove the image")),
                      )
                  }
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Caption: what the customer reads under the photo. Optional — a bulk
          upload shouldn't be held up by naming twenty cakes. */}
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setName(image.name ?? "");
        }}
        placeholder="Add a name…"
        className="h-9 rounded-none border-0 border-t text-xs focus-visible:ring-0"
      />
    </Card>
  );
}
