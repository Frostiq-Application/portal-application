import { useState } from "react";
import { Check, Loader2, Megaphone, Plus, Trash2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useListAnnouncementsQuery,
  useUpdateAnnouncementMutation,
  type Announcement,
} from "@/features/api/cmsApi";
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

/** Preset bar colours (bg / text) for the storefront announcement strip. */
const PRESETS: { name: string; bg: string; text: string }[] = [
  { name: "Default", bg: "#111827", text: "#ffffff" },
  { name: "Rose", bg: "#e11d48", text: "#ffffff" },
  { name: "Amber", bg: "#f59e0b", text: "#111827" },
  { name: "Emerald", bg: "#059669", text: "#ffffff" },
  { name: "Violet", bg: "#7c3aed", text: "#ffffff" },
];

function AnnouncementRow({ item }: { item: Announcement }) {
  const [updateAnnouncement] = useUpdateAnnouncementMutation();
  const [deleteAnnouncement, { isLoading: deleting }] =
    useDeleteAnnouncementMutation();

  const toggle = async (isActive: boolean) => {
    try {
      await updateAnnouncement({ id: item.id, body: { isActive } }).unwrap();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const remove = async () => {
    try {
      await deleteAnnouncement(item.id).unwrap();
      toast.success("Announcement removed");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-background p-3 transition-shadow hover:shadow-sm",
        !item.isActive && "opacity-60",
      )}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2"
        style={{
          backgroundColor: item.bgColor ?? "#111827",
          color: item.textColor ?? "#ffffff",
        }}
      >
        <Megaphone className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <p className="truncate text-sm font-medium">{item.message}</p>
      </div>
      <ScopeBadge shopId={item.shopId} accountId={item.accountId} />
      <Switch
        checked={item.isActive}
        onCheckedChange={toggle}
        aria-label="Toggle announcement"
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              It will stop showing on the storefront right away.
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
  );
}

export function AnnouncementsTab() {
  const { data: items, isLoading } = useListAnnouncementsQuery();
  const [create, { isLoading: creating }] = useCreateAnnouncementMutation();
  const [message, setMessage] = useState("");
  const [preset, setPreset] = useState(0);

  const add = async () => {
    if (!message.trim()) return toast.error("Write a message first");
    const { bg, text } = PRESETS[preset];
    try {
      await create({
        message: message.trim(),
        bgColor: bg,
        textColor: text,
      }).unwrap();
      toast.success("Announcement added");
      setMessage("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const list = items ?? [];
  const { bg, text } = PRESETS[preset];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Message</Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Free delivery on orders over ₹999!"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Bar colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setPreset(i)}
                  aria-label={p.name}
                  aria-pressed={preset === i}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-all",
                    preset === i && "ring-2 ring-ring",
                  )}
                  style={{ backgroundColor: p.bg, color: p.text }}
                >
                  {preset === i && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <Label className="text-muted-foreground">Preview</Label>
            <div
              className="mt-1.5 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
              style={{ backgroundColor: bg, color: text }}
            >
              <Megaphone className="h-4 w-4 shrink-0 opacity-80" />
              {message || "Your announcement appears here"}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={add} disabled={creating || !message.trim()}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add announcement
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>No announcements yet</EmptyTitle>
            <EmptyDescription>
              Add a scrolling message bar to highlight offers across the storefront.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <AnnouncementRow key={a.id} item={a} />
          ))}
        </div>
      )}
    </div>
  );
}
