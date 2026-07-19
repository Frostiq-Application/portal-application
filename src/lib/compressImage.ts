/**
 * Silent client-side image compression. Files over MAX_BYTES are re-encoded
 * (downscaled + JPEG quality ladder) until they fit — the user never sees a
 * "file too large" error for oversized photos.
 */

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_EDGE = 2560; // long-edge cap; plenty for banners & product shots
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.45];
const SCALE_STEP = 0.8;
const MAX_SCALE_ROUNDS = 5;

/** Raster types we can safely re-encode (skip SVG + animated GIF). */
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/;

function renderToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES || !COMPRESSIBLE.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const initialScale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    let scale = initialScale;

    for (let round = 0; round < MAX_SCALE_ROUNDS; round++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      for (const quality of QUALITY_STEPS) {
        const blob = await renderToBlob(bitmap, width, height, quality);
        if (blob && blob.size <= MAX_BYTES) {
          bitmap.close();
          const name = file.name.replace(/\.\w+$/, "") + ".jpg";
          return new File([blob], name, { type: "image/jpeg" });
        }
      }
      scale *= SCALE_STEP;
    }
    bitmap.close();
  } catch {
    // Fall through — upload the original; the API enforces its own limit.
  }
  return file;
}
