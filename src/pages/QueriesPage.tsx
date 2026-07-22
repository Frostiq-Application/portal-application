import { Phone } from "lucide-react";
import { useListEnquiriesQuery } from "@/features/api/queriesApi";
import { ENQUIRY_TYPE_LABEL, ENQUIRY_TYPE_TONE } from "@/lib/enquiries";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function QueriesPage() {
  const { data, isLoading } = useListEnquiriesQuery({ page: 1, limit: 100 });
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Queries"
        description="Phone-number enquiries submitted from the landing page"
      />

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No queries yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {e.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        ENQUIRY_TYPE_TONE[e.type],
                      )}
                    >
                      {ENQUIRY_TYPE_LABEL[e.type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
