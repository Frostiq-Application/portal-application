import { useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "@/components/ui/icons";

/** Full-screen lightbox for browsing a custom cake request's reference images. */
export function ImagePreviewDialog({
  urls,
  index,
  onIndexChange,
  onOpenChange,
}: {
  urls: string[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const open = index !== null;
  const hasMultiple = urls.length > 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!hasMultiple) return;
      if (e.key === "ArrowRight") onIndexChange(((index ?? 0) + 1) % urls.length);
      if (e.key === "ArrowLeft") onIndexChange(((index ?? 0) - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasMultiple, index, urls.length, onIndexChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onClick={() => onOpenChange(false)}
        >
          <DialogPrimitive.Title className="sr-only">
            Reference image preview
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Full-size view of the customer&apos;s reference image.
          </DialogPrimitive.Description>

          {index !== null && (
            <img
              src={urls[index]}
              alt={`Reference ${index + 1} of ${urls.length}`}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            onClick={(e) => e.stopPropagation()}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {hasMultiple && index !== null && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange((index - 1 + urls.length) % urls.length);
                }}
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">Previous image</span>
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange((index + 1) % urls.length);
                }}
              >
                <ChevronRight className="h-5 w-5" />
                <span className="sr-only">Next image</span>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                {index + 1} / {urls.length}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
