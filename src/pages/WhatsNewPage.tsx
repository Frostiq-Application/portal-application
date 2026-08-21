import { useState } from "react";
import { Rocket, Sparkles } from "@/components/ui/icons";
import { useVersionHistoryQuery } from "@/features/api/versionsApi";
import { formatDate } from "@/lib/utils";
import { Markdown } from "@/components/common/Markdown";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What's new — the release history a bakery reads back through.
 *
 * The dialog only ever shows the newest note, and only once. This is where
 * someone answers "which version am I on, and what came with the ones before
 * it" — the question that otherwise ends up in a support call.
 *
 * Every role reaches it: whatever changed, somebody on the floor is the one
 * looking at the screen it changed.
 */
export function WhatsNewPage() {
  const { data: versions, isLoading } = useVersionHistoryQuery();
  const current = versions?.[0];

  // The newest release opens by default — that is what someone came to read.
  // Kept in state so it stays open once they start expanding older ones.
  const [open, setOpen] = useState<string[] | null>(null);
  const expanded = open ?? (current ? [current.id] : []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="What's new"
        description="Every update to Frostique, newest first, and what arrived with it."
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (versions ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Rocket className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nothing to read yet</p>
              <p className="text-sm text-muted-foreground">
                Updates will show up here as they are released.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {current && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    You&apos;re on version {current.version}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Released {formatDate(current.releasedAt)}
                    {current.title ? ` · ${current.title}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="py-0">
              <Accordion
                type="multiple"
                value={expanded}
                onValueChange={setOpen}
              >
                {versions?.map((v) => (
                  <AccordionItem key={v.id} value={v.id} className="last:border-b-0">
                    <AccordionTrigger className="gap-3 text-left hover:no-underline">
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                        <span className="flex items-center gap-2">
                          <span className="text-base font-semibold">
                            {v.version}
                          </span>
                          {!v.seen && (
                            <Badge className="px-1.5 py-0 text-[0.65rem]">
                              New
                            </Badge>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-normal text-muted-foreground">
                          {v.title ?? "Release"}
                        </span>
                        {/* Tags sit beside the title so the list reads as
                            "what moved", not just "when". */}
                        <span className="flex flex-wrap gap-1.5">
                          {v.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="font-normal"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </span>
                        <span className="shrink-0 text-xs font-normal text-muted-foreground">
                          {formatDate(v.releasedAt)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6">
                      <Markdown>{v.notes}</Markdown>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
