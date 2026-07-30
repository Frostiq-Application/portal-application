import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock,
  Ban,
} from "@/components/ui/icons";
import type { TenantHealth, TenantMigrationState } from "@/types/tenancy";
import { MIGRATION_STATE } from "@/lib/tenancy";

const HEALTH: Record<
  TenantHealth,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary"; Icon: typeof CheckCircle2 }
> = {
  healthy: { label: "Up to date", variant: "success", Icon: CheckCircle2 },
  pending: { label: "Behind", variant: "warning", Icon: Clock },
  drifted: { label: "Drifted", variant: "destructive", Icon: AlertTriangle },
  failed: { label: "Failed", variant: "destructive", Icon: CircleAlert },
  orphaned: { label: "Orphaned", variant: "secondary", Icon: Ban },
};

export function TenantHealthBadge({ health }: { health: TenantHealth }) {
  const { label, variant, Icon } = HEALTH[health];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function MigrationStateBadge({ state }: { state: TenantMigrationState }) {
  const { label, variant } = MIGRATION_STATE[state];
  return <Badge variant={variant}>{label}</Badge>;
}
