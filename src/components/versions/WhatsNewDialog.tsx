import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket } from "@/components/ui/icons";
import {
  useLatestVersionQuery,
  useMarkVersionSeenMutation,
} from "@/features/api/versionsApi";
import { formatDate } from "@/lib/utils";
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

/**
 * "What's new" — shown once per user per release.
 *
 * Whether it has been seen is a server-side record, not browser storage: the
 * same owner opens the portal on the shop laptop and on their phone, and local
 * storage would raise the same dialog on each of them and forget it the moment
 * a browser was cleared. It also lets the super admin see who has actually
 * read a release note.
 *
 * The dialog is skipped entirely when the release is marked quiet — which is
 * how 1.0.0 stays silent: everyone was already on it, so there is nothing to
 * announce.
 */
export function WhatsNewDialog() {
  const navigate = useNavigate();
  const { data } = useLatestVersionQuery();
  const [markSeen] = useMarkVersionSeenMutation();
  /**
   * The only local state is "this tab has already closed it". Open is derived
   * rather than stored, so the dialog appears the moment the query resolves —
   * no effect, no second render to get there.
   *
   * It is not the record of having read the note either: that write is the
   * `seen` row on the server. It only stops the dialog flashing back up in the
   * gap between the click and the request landing.
   */
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const open = Boolean(
    data && data.notify && !data.seen && data.id !== dismissedId,
  );

  const close = () => {
    if (!data) return;
    setDismissedId(data.id);
    void markSeen(data.id);
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="space-y-3 border-b border-border p-6 pb-4 text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Rocket className="size-4.5" />
              </span>
              <div>
                <DialogTitle className="text-lg">
                  {data.title ?? "What's new"}
                </DialogTitle>
                <DialogDescription>
                  Version {data.version} · {formatDate(data.releasedAt)}
                </DialogDescription>
              </div>
            </div>
            {data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Markdown>{data.notes}</Markdown>
          </div>

          <DialogFooter className="gap-2 border-t border-border p-4 sm:justify-between">
            {/* Reading the note counts as read either way — someone who wants
                the whole history shouldn't be shown this again to get it. */}
            <Button
              variant="ghost"
              onClick={() => {
                close();
                navigate("/whats-new");
              }}
            >
              See all updates
            </Button>
            <Button onClick={close}>Got it</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
