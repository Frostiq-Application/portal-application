import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, FileText, Loader2, Plus, X } from "@/components/ui/icons";
import {
  useCreateVersionMutation,
  useUpdateVersionMutation,
} from "@/features/api/versionsApi";
import { apiError } from "@/lib/apiError";
import type { AppVersion } from "@/types/versions";
import { Markdown } from "@/components/common/Markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const VERSION_RE = /^\d+\.\d+\.\d+$/;
/** Matches the server's cap — a release note is text, not a media file. */
const MAX_BYTES = 512 * 1024;

/** `YYYY-MM-DD` for the date picker, from an ISO timestamp. */
function dayOf(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

export function VersionDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = adding a new release. */
  editing: AppVersion | null;
}) {
  const [create, { isLoading: creating }] = useCreateVersionMutation();
  const [update, { isLoading: updating }] = useUpdateVersionMutation();
  const saving = creating || updating;

  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [releasedAt, setReleasedAt] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [notify, setNotify] = useState(true);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seeded during render rather than in an effect (house pattern, see
  // PlanEditorDialog): the fields are right on the first paint instead of
  // showing the previous release's note for a frame.
  const seedKey = open ? (editing?.id ?? "new") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setVersion(editing?.version ?? "");
    setTitle(editing?.title ?? "");
    setTags(editing?.tags ?? []);
    setTagDraft("");
    setReleasedAt(dayOf(editing?.releasedAt) || dayOf(new Date().toISOString()));
    setIsPublished(editing?.isPublished ?? false);
    setNotify(editing?.notify ?? true);
    setNotes(editing?.notes ?? "");
    setFile(null);
  }

  const versionValid = VERSION_RE.test(version.trim());
  const canSave = versionValid && notes.trim().length > 0 && !saving;

  const preview = useMemo(() => notes.trim(), [notes]);

  const addTag = (raw: string) => {
    const value = raw.trim().replace(/,$/, "");
    if (!value) return;
    if (tags.length >= 8) {
      toast.error("Eight tags is the most a card can carry");
      return;
    }
    if (!tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTags([...tags, value.slice(0, 40)]);
    }
    setTagDraft("");
  };

  /**
   * Reading the file here as well as sending it means the admin sees the note
   * exactly as the dialog will render it, before anything is saved.
   */
  const onPickFile = async (picked: File | null) => {
    if (!picked) return;
    if (!/\.(md|markdown|txt)$/i.test(picked.name)) {
      toast.error("Choose a .md file");
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error("That file is larger than 512 KB");
      return;
    }
    const text = (await picked.text()).trim();
    if (!text) {
      toast.error("That file is empty");
      return;
    }
    setFile(picked);
    setNotes(text);
  };

  const save = async () => {
    const body = {
      version: version.trim(),
      title: title.trim(),
      tags,
      releasedAt: releasedAt ? new Date(releasedAt).toISOString() : undefined,
      isPublished,
      notify,
      // Send the file when one was picked; the text goes up either way, so a
      // hand-edited note still saves.
      notes: notes.trim(),
      file,
    };
    try {
      if (editing) {
        await update({ id: editing.id, ...body }).unwrap();
        toast.success(`Version ${body.version} updated`);
      } else {
        await create(body).unwrap();
        toast.success(`Version ${body.version} added`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Could not save this release"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.version}` : "New release"}
          </DialogTitle>
          <DialogDescription>
            The note you upload here is what every portal user is shown once,
            the first time they open the portal after the release.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="version">Version number</Label>
            <Input
              id="version"
              placeholder="1.1.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {version && !versionValid
                ? "Three numbers separated by dots, like 1.1.0"
                : "Bigger number wins — that is how the newest release is decided."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Headline</Label>
            <Input
              id="title"
              placeholder="Bulk upload for menus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown at the top of the dialog people see.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 py-1 pl-2.5 pr-1"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                id="tags"
                className="min-w-[10rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                placeholder={tags.length ? "" : "Orders, Billing, Storefront…"}
                value={tagDraft}
                onChange={(e) => {
                  // A typed comma commits the tag, which is how people write
                  // lists without thinking about the control.
                  if (e.target.value.endsWith(",")) addTag(e.target.value);
                  else setTagDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagDraft);
                  } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={() => addTag(tagDraft)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Which part of the product moved. They show on the card when you
              hover it, and above the note people read.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="released">Release date</Label>
            <DatePicker
              id="released"
              value={releasedAt}
              onChange={setReleasedAt}
              clearable={false}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="published">Live</Label>
                <p className="text-xs text-muted-foreground">
                  Off keeps it a draft nobody sees.
                </p>
              </div>
              <Switch
                id="published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="notify">Announce it</Label>
                <p className="text-xs text-muted-foreground">
                  Off releases it quietly — no dialog.
                </p>
              </div>
              <Switch id="notify" checked={notify} onCheckedChange={setNotify} />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Release note</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  // Remounted whenever the form re-seeds, which is what clears
                  // the previously chosen filename — a file input's value can't
                  // be reset during render.
                  key={seeded ?? "closed"}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown"
                  className="hidden"
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <CloudUpload className="size-4" />
                  {file || editing?.fileName ? "Replace .md" : "Upload .md"}
                </Button>
              </div>
            </div>

            {(file || editing?.fileName) && (
              <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <FileText className="size-4" />
                <span className="truncate">
                  {file?.name ?? editing?.fileName}
                </span>
                {file && (
                  <button
                    type="button"
                    className="ml-auto underline"
                    onClick={() => setFile(null)}
                  >
                    Undo
                  </button>
                )}
              </div>
            )}

            <Textarea
              rows={10}
              className="font-mono text-xs"
              placeholder={"## What's new\n\n- …"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Markdown. Upload the file or write it here — either way this text
              is what gets saved.
            </p>
          </div>

          {preview && (
            <div className="space-y-2 md:col-span-2">
              <Label>Preview</Label>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-4">
                <Markdown>{preview}</Markdown>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {editing ? "Save changes" : "Add release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
