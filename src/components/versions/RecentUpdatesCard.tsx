import { Link } from "react-router-dom";
import { ArrowRight, Rocket } from "@/components/ui/icons";
import { useVersionHistoryQuery } from "@/features/api/versionsApi";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Enough to show the shape of recent activity without becoming the page. */
const SHOWN = 4;

/**
 * The releases a bakery has had, on the page where they already look up what
 * their account is. Deliberately a summary — version, what it was called, when
 * it landed and what it touched — with the notes themselves a click away on
 * the What's new page.
 */
export function RecentUpdatesCard() {
  const { data: versions, isLoading } = useVersionHistoryQuery();
  const current = versions?.[0];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4" />
          Updates
        </CardTitle>
        {current && (
          <Badge variant="secondary" className="font-normal">
            You&apos;re on v{current.version}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (versions ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No updates have been released yet.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {versions?.slice(0, SHOWN).map((v) => (
                <li key={v.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <span className="w-14 shrink-0 text-sm font-semibold">
                    {v.version}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm">
                      {v.title ?? "Release"}
                      {!v.seen && (
                        <Badge className="px-1.5 py-0 text-[0.65rem]">New</Badge>
                      )}
                    </p>
                    {v.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {v.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="font-normal"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(v.releasedAt)}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
              <Link to="/whats-new">
                See what changed
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
