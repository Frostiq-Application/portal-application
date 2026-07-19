import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useUploadAssetMutation } from "@/features/api/uploadApi";
import { apiError } from "@/lib/apiError";
import { compressImage } from "@/lib/compressImage";
import { cn } from "@/lib/utils";

interface Props {
  /** Current image URLs. */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Storage folder (module name), e.g. "products", "banners". */
  folder: string;
  /** Max number of images (1 = single). */
  max?: number;
  /** Thumbnail/tile shape. "square" (default, 80x80) or "banner" (16:9, full width). */
  aspect?: "square" | "banner";
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  folder,
  max = 8,
  aspect = "square",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, { isLoading }] = useUploadAssetMutation();
  const full = value.length >= max;
  const tileClass =
    aspect === "banner" ? "aspect-video w-full" : "h-20 w-20 shrink-0";

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - value.length;
    const chosen = Array.from(files).slice(0, remaining);
    const uploaded: string[] = [];
    for (const file of chosen) {
      try {
        // Oversized photos are compressed silently before upload.
        const prepared = await compressImage(file);
        const res = await upload({ file: prepared, folder }).unwrap();
        uploaded.push(res.url);
      } catch (err) {
        toast.error(apiError(err, `Failed to upload ${file.name}`));
      }
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {value.map((url, i) => (
        <div
          key={url + i}
          className={cn(
            "group relative overflow-hidden rounded-md border bg-muted",
            tileClass,
          )}
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition hover:border-primary hover:text-primary",
            tileClass,
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">Upload</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
    </div>
  );
}
