import { Construction } from "@/components/ui/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Construction className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This section isn&rsquo;t built yet. It&rsquo;s next on the roadmap.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
