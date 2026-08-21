import { useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  BellOff,
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  Users,
} from "@/components/ui/icons";
import {
  useDeleteVersionMutation,
  useListVersionsQuery,
} from "@/features/api/versionsApi";
import { apiError } from "@/lib/apiError";
import { cn, formatDate } from "@/lib/utils";
import type { AppVersion } from "@/types/versions";
import { PageHeader } from "@/components/layout/PageHeader";
import { VersionDialog } from "@/components/versions/VersionDialog";
import { VersionViewsSheet } from "@/components/versions/VersionViewsSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** First non-heading line of the note — enough to recognise a release by. */
function summarise(notes: string): string {
  const line = notes
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("---"));
  if (!line) return "No summary yet.";
  const clean = line.replace(/^[-*]\s*/, "").replace(/[*_`]/g, "");
  return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
}

export function VersionsPage() {
  const { data: versions, isLoading } = useListVersionsQuery();
  const [remove, { isLoading: removing }] = useDeleteVersionMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppVersion | null>(null);
  const [viewing, setViewing] = useState<AppVersion | null>(null);
  const [confirming, setConfirming] = useState<AppVersion | null>(null);

  // The live release is the top of the list — the API orders by release number,
  // so the first published row is the one users are being shown.
  const live = versions?.find((v) => v.isPublished);

  const onDelete = async () => {
    if (!confirming) return;
    try {
      await remove(confirming.id).unwrap();
      toast.success(`Version ${confirming.version} deleted`);
      setConfirming(null);
    } catch (err) {
      toast.error(apiError(err, "Could not delete this release"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Versions"
        description="Every release and the note that goes with it. The newest live release is shown to each portal user once, the next time they open the portal."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New release
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (versions ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Rocket className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No releases yet</p>
              <p className="text-sm text-muted-foreground">
                Add one and upload its .md note to start the log.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {versions?.map((v) => (
            <Card
              key={v.id}
              className={cn(
                // `group` is what the tag chips hang off: they stay out of the
                // way until the card is hovered, the way the reference cards do.
                "group relative overflow-hidden transition-shadow hover:shadow-md",
                v.id === live?.id && "ring-1 ring-primary/40",
              )}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold tracking-tight">
                      {v.version}
                    </span>
                    {v.id === live?.id && (
                      <Badge className="gap-1">
                        <BadgeCheck className="size-3" />
                        Live
                      </Badge>
                    )}
                    {!v.isPublished && <Badge variant="outline">Draft</Badge>}
                  </div>
                  {!v.notify && (
                    <span
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      title="Released quietly — no dialog for this one"
                    >
                      <BellOff className="size-3.5" />
                      Quiet
                    </span>
                  )}
                </div>

                <div className="min-h-[3.5rem]">
                  <p className="font-medium">{v.title ?? "Untitled release"}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {summarise(v.notes)}
                  </p>
                </div>

                {/*
                  Hover-revealed tags. Height and opacity both animate, so a card
                  with no tags never opens an empty gap and one with tags grows
                  into them rather than snapping.
                */}
                {v.tags.length > 0 && (
                  <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover:max-h-24 group-hover:opacity-100 group-focus-within:max-h-24 group-focus-within:opacity-100">
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {v.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>{formatDate(v.releasedAt)}</span>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                    onClick={() => setViewing(v)}
                  >
                    <Users className="size-3.5" />
                    {v.seenCount} read
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(v);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewing(v)}
                  >
                    <Eye className="size-3.5" />
                    Readers
                  </Button>
                  {v.fileUrl && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={v.fileUrl} target="_blank" rel="noreferrer">
                        <Download className="size-3.5" />
                        .md
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive hover:text-destructive"
                    onClick={() => setConfirming(v)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VersionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
      <VersionViewsSheet
        version={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <AlertDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete version {confirming?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The note and the record of who read it both go with it. If this
              release is live, the previous one becomes the newest again — and
              anyone who had already read that one will not be shown it twice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
            >
              {removing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
