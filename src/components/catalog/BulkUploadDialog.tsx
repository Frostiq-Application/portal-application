import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  Cake,
  Check,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  X,
} from "@/components/ui/icons";
import {
  useBulkUploadCatalogMutation,
  useDownloadBulkUploadSampleMutation,
  type BulkSheetReport,
  type BulkUploadReport,
} from "@/features/api/catalogApi";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shopId: string;
}

type Phase = "drop" | "importing" | "done";

/** Import stages as the progress theatre presents them, in pipeline order. */
const STAGES = [
  { label: "Categories", icon: Layers, at: 30 },
  { label: "Products", icon: Cake, at: 65 },
  { label: "Add-ons", icon: Boxes, at: 90 },
] as const;

/** Per-sheet accents — same colour language as the catalog tab strip. */
const SHEET_ACCENT: Record<string, string> = {
  Categories: "#6366f1",
  Products: "#f59e0b",
  "Add-ons": "#14b8a6",
};

const SAMPLE_FILENAME = "frostique-catalog-template.xlsx";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads the bulk-upload template. Shared by the dialog and the page-header
 * dropdown so both entry points behave identically.
 */
export function useSampleFileDownload() {
  const [download, { isLoading }] = useDownloadBulkUploadSampleMutation();
  const run = useCallback(async () => {
    try {
      const blob = await download().unwrap();
      saveBlob(blob, SAMPLE_FILENAME);
    } catch (err) {
      toast.error(apiError(err));
    }
  }, [download]);
  return { downloadSample: run, downloading: isLoading };
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One success-burst particle: flight baked into CSS vars, drawn by `crumb`. */
interface Particle {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  delay: number;
  size: number;
}

const PARTICLE_COLORS = ["#f59e0b", "#6366f1", "#14b8a6", "#10b981", "#ec4899"];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const distance = 46 + Math.random() * 42;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 24,
      rot: (Math.random() - 0.5) * 540,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      delay: Math.random() * 0.12,
      size: 5 + Math.random() * 4,
    };
  });
}

/**
 * Bulk catalog import (spec 2026-08-10): drop an .xlsx, watch it import, read
 * the per-row verdict. Three acts in one dialog —
 *
 *  drop      a pointer-lit dropzone that reacts to hover, drag and bad files;
 *  importing staged progress theatre (the request is one call, but Categories →
 *            Products → Add-ons is genuinely the order the server works in);
 *  done      counters that count, a crumb-burst on a clean run, and the failed
 *            rows spelled out with a fix-and-reupload error workbook.
 *
 * All motion is the app's own keyframe set, honours prefers-reduced-motion,
 * and never blocks the data: reduced-motion users get the same facts standing
 * still.
 */
export function BulkUploadDialog({ open, onOpenChange, shopId }: Props) {
  const [phase, setPhase] = useState<Phase>("drop");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<BulkUploadReport | null>(null);

  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload] = useBulkUploadCatalogMutation();
  const { downloadSample, downloading } = useSampleFileDownload();

  const reset = useCallback(() => {
    setPhase("drop");
    setFile(null);
    setDragOver(false);
    setRejected(false);
    setProgress(0);
    setReport(null);
  }, []);

  // A fresh open starts a fresh story; closing mid-import stays disallowed
  // via the buttons, but a re-open should never show stale results.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  /** The pointer spotlight: vars only, no re-render per mousemove. */
  const trackPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = zoneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  const takeFile = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      // The flinch reads "wrong file" before the toast is even parsed.
      setRejected(true);
      setTimeout(() => setRejected(false), 450);
      toast.error("Only .xlsx files work here — start from the sample file");
      return;
    }
    setFile(f);
  }, []);

  // Progress theatre: ease toward 90% while the request is in flight; the jump
  // to 100 happens only on a real response. Never fakes completion.
  useEffect(() => {
    if (phase !== "importing") return;
    const timer = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.06 : p));
    }, 120);
    return () => clearInterval(timer);
  }, [phase]);

  const startImport = useCallback(async () => {
    if (!file || !shopId) return;
    setPhase("importing");
    setProgress(4);
    const started = performance.now();
    try {
      const result = await upload({ file, shopId }).unwrap();
      // Let the bar be seen finishing — a result that beats the animation
      // to the screen feels broken, not fast.
      const minShow = 900;
      const wait = Math.max(0, minShow - (performance.now() - started));
      setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setReport(result);
          setPhase("done");
        }, 320);
      }, wait);
    } catch (err) {
      toast.error(apiError(err));
      setPhase("drop");
      setProgress(0);
    }
  }, [file, shopId, upload]);

  const downloadErrorReport = useCallback(() => {
    if (!report?.errorReportBase64) return;
    const bytes = Uint8Array.from(atob(report.errorReportBase64), (c) =>
      c.charCodeAt(0),
    );
    saveBlob(new Blob([bytes], { type: XLSX_MIME }), "catalog-upload-errors.xlsx");
  }, [report]);

  const sheets = useMemo(
    () =>
      report ? [report.categories, report.products, report.addons] : [],
    [report],
  );
  const totals = useMemo(() => {
    const sum = (pick: (s: BulkSheetReport) => number) =>
      sheets.reduce((acc, s) => acc + pick(s), 0);
    return {
      created: sum((s) => s.created),
      skipped: sum((s) => s.skipped.length),
      failed: sum((s) => s.failed.length),
      rows: sum((s) => s.total),
    };
  }, [sheets]);
  const allFailures = useMemo(
    () =>
      sheets.flatMap((s) =>
        s.failed.map((f) => ({ ...f, sheet: s.sheet })),
      ),
    [sheets],
  );
  const clean = report !== null && totals.failed === 0 && totals.created > 0;

  // A long failure list scrolls, and a row sliced off at the container's edge
  // reads as a rendering fault rather than "there is more". Track whether
  // anything is still below the fold so the list can say so.
  const [moreBelow, setMoreBelow] = useState(false);
  const measureList = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
  }, []);
  // One burst per report — memo keeps the particles from re-scattering on
  // unrelated re-renders.
  const particles = useMemo(
    () => (clean ? makeParticles(14) : []),
    [clean],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // No closing mid-flight: the import is running server-side either way,
        // and a dismissed dialog would just hide the verdict.
        if (!o && phase === "importing") return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk upload</DialogTitle>
          <DialogDescription>
            {phase === "done"
              ? "Here's how your file went."
              : "One Excel file — categories, products and add-ons together."}
          </DialogDescription>
        </DialogHeader>

        {/* ------------------------------------------------ act 1: the drop */}
        {phase === "drop" && (
          <div className="space-y-3">
            <div
              ref={zoneRef}
              role="button"
              tabIndex={0}
              aria-label="Upload your catalog file"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onPointerMove={trackPointer}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                takeFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center outline-none transition-all duration-300",
                "focus-visible:ring-2 focus-visible:ring-ring",
                // The spotlight that follows the pointer — the room notices
                // you before you've done anything, which is most of the charm.
                "[background:radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,40%),hsl(var(--primary)/0.08),transparent_70%)]",
                dragOver
                  ? "scale-[1.01] border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
                rejected && "motion-safe:animate-pay-nudge border-destructive",
              )}
            >
              {/* Sonar rings say "this is a live surface" while a file hovers. */}
              <div className="relative mb-4 flex size-20 items-center justify-center">
                {dragOver && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-pay-ring" />
                    <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-pay-ring [animation-delay:0.8s]" />
                  </>
                )}
                <div
                  className={cn(
                    "relative flex size-20 items-center justify-center rounded-full border bg-card shadow-sm transition-transform duration-300",
                    dragOver
                      ? "scale-110 border-primary text-primary"
                      : "text-muted-foreground group-hover:scale-105 group-hover:text-primary motion-safe:animate-splash-bob",
                  )}
                >
                  <CloudUpload className="size-9" />
                </div>
              </div>

              {file ? (
                <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm motion-safe:animate-pay-pop">
                  <FileSpreadsheet className="size-8 shrink-0 text-emerald-600" />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)} · ready to import
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 shrink-0"
                    aria-label="Remove file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {dragOver
                      ? "Release to add your file"
                      : "Drag your filled-in sheet here"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    or click to browse · .xlsx only
                  </p>
                </>
              )}

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => takeFile(e.target.files?.[0] ?? undefined)}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadSample}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Download className="mr-2 size-4" />
                )}
                Download sample file
              </Button>
              <Button onClick={startImport} disabled={!file || !shopId}>
                Import catalog
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------- act 2: the importing */}
        {phase === "importing" && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center">
              <div className="relative mb-3 flex size-16 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-pay-ring" />
                <div className="relative flex size-16 items-center justify-center rounded-full border bg-card shadow-sm">
                  <FileSpreadsheet className="size-7 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium">Importing your catalog…</p>
              <p className="text-xs text-muted-foreground">
                Don't close this — it only takes a moment.
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="relative h-full overflow-hidden rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <span className="absolute inset-y-0 w-1/3 bg-white/30 motion-safe:animate-splash-track motion-reduce:hidden" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {STAGES.map((stage) => {
                  const running = progress < stage.at;
                  const done = progress >= stage.at;
                  const StageIcon = stage.icon;
                  return (
                    <div
                      key={stage.label}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors duration-300",
                        done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" />
                      ) : (
                        <StageIcon
                          className={cn("size-3.5", running && "motion-safe:animate-pulse")}
                        />
                      )}
                      {stage.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ act 3: the verdict */}
        {phase === "done" && report && (
          <div className="space-y-4">
            <div className="flex flex-col items-center pt-1">
              <div className="relative mb-2 flex size-16 items-center justify-center">
                {clean && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-emerald-500/15 motion-safe:animate-pay-ring" />
                    {/* The crumb burst — earned only by a fully clean import. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 motion-reduce:hidden"
                    >
                      {particles.map((p, i) => (
                        <span
                          key={i}
                          className="absolute block rounded-[2px] motion-safe:animate-crumb"
                          style={{
                            width: p.size,
                            height: p.size,
                            backgroundColor: p.color,
                            animationDelay: `${p.delay}s`,
                            ["--dx" as string]: `${p.dx}px`,
                            ["--dy" as string]: `${p.dy}px`,
                            ["--rot" as string]: `${p.rot}deg`,
                          }}
                        />
                      ))}
                    </span>
                  </>
                )}
                <div
                  className={cn(
                    "relative flex size-16 items-center justify-center rounded-full border shadow-sm motion-safe:animate-pay-pop",
                    clean
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950"
                      : totals.created > 0
                        ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950"
                        : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {clean ? (
                    <CheckCircle2 className="size-8" />
                  ) : (
                    <AlertTriangle className="size-8" />
                  )}
                </div>
              </div>
              <p className="text-sm font-medium">
                {clean
                  ? "Everything imported beautifully"
                  : totals.created > 0
                    ? "Imported, with a few things to fix"
                    : totals.rows === 0
                      ? "The file had no rows to import"
                      : "Nothing imported — see what went wrong"}
              </p>
              <p className="text-xs text-muted-foreground">
                <AnimatedNumber value={totals.created} duration={700} /> created
                {" · "}
                <AnimatedNumber value={totals.skipped} duration={700} /> already
                existed
                {" · "}
                <AnimatedNumber value={totals.failed} duration={700} /> failed
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {sheets.map((s, i) => (
                <div
                  key={s.sheet}
                  className="rounded-xl border bg-card p-3 text-center motion-safe:animate-card-in"
                  style={{
                    animationDelay: `${i * 90}ms`,
                    borderTopWidth: 3,
                    borderTopColor: SHEET_ACCENT[s.sheet] ?? "transparent",
                  }}
                >
                  <p className="text-2xl font-semibold tabular-nums">
                    <AnimatedNumber value={s.created} duration={800} />
                  </p>
                  <p className="text-xs font-medium">{s.sheet}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.found
                      ? `${s.skipped.length} skipped · ${s.failed.length} failed`
                      : "sheet not in file"}
                  </p>
                </div>
              ))}
            </div>

            {allFailures.length > 0 && (
              <div className="relative">
                <div
                  ref={measureList}
                  onScroll={(e) => measureList(e.currentTarget)}
                  className="max-h-44 space-y-1 overflow-y-auto rounded-xl border bg-muted/30 p-2"
                >
                  {allFailures.map((f, i) => (
                    <div
                      key={`${f.sheet}-${f.row}-${i}`}
                      className="flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-xs motion-safe:animate-row-enter"
                      style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
                    >
                      <span
                        className="mt-1 size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SHEET_ACCENT[f.sheet] }}
                      />
                      <div className="min-w-0">
                        <span className="font-medium">
                          {f.sheet} · row {f.row}
                          {f.name ? ` · ${f.name}` : ""}
                        </span>
                        <span className="text-muted-foreground"> — {f.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Fades the sliced-off row and names what's hidden, so a long
                    list reads as scrollable rather than broken. */}
                {moreBelow && (
                  <div className="pointer-events-none absolute inset-x-px bottom-px flex h-12 items-end justify-center rounded-b-xl bg-gradient-to-t from-background via-background/85 to-transparent pb-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Scroll for the rest
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {report.errorReportBase64 && (
                <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                  <Download className="mr-2 size-4" />
                  Download error report
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={reset}>
                Upload another file
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
