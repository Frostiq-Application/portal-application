/**
 * Single-file upload to `/assets/upload` over XHR, so the caller can render a
 * real progress bar. `fetch` (and therefore RTK Query) reports nothing until a
 * request finishes, which on a twenty-photo batch means twenty tiles sitting at
 * "uploading…" with no sign of life.
 *
 * This is deliberately the *fast path* only: it takes the access token as given
 * and does not refresh it. Callers fall back to the RTK mutation on any failure,
 * which goes through `baseQueryWithReauth` and therefore handles an expired
 * token — see GalleryTab.
 */

export interface UploadedAsset {
  url: string;
  key: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export function uploadWithProgress(
  file: File | Blob,
  opts: {
    folder?: string;
    token: string | null;
    /** 0 → 1. Fires on every progress event the browser emits. */
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  },
): Promise<UploadedAsset> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    if (opts.folder) form.append("folder", opts.folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/assets/upload`);
    if (opts.token) xhr.setRequestHeader("authorization", `Bearer ${opts.token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as UploadedAsset);
      } catch {
        reject(new Error("Upload returned an unreadable response"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/**
 * Runs `worker` over `items` with at most `limit` in flight. Uploading twenty
 * files at once starves the connection and stalls every bar; one at a time
 * wastes the pipe. Four is the sweet spot on a normal connection.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
