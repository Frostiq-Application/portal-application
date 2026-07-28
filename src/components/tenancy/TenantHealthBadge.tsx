import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock,
  Ban,
} from "@/components/ui/icons";
import type { TenantHealth, TenantMigrationState } from "@/types/tenancy";

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

const STATE: Record<
  TenantMigrationState,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary"; hint: string }
> = {
  applied: { label: "Applied", variant: "success", hint: "Recorded and verified against the live schema." },
  pending: { label: "Pending", variant: "warning", hint: "Never run on this tenant." },
  failed: { label: "Failed", variant: "destructive", hint: "Last attempt errored — see the message below." },
  checksum_mismatch: {
    label: "Changed since",
    variant: "destructive",
    hint: "This migration's SQL was edited after it ran here. Re-sync to bring the tenant onto the current version.",
  },
  structural_drift: {
    label: "Drifted",
    variant: "destructive",
    hint: "Recorded as applied, but the schema no longer has the change — usually a restore or a manual edit.",
  },
};

export function MigrationStateBadge({ state }: { state: TenantMigrationState }) {
  const { label, variant } = STATE[state];
  return <Badge variant={variant}>{label}</Badge>;
}

export function migrationStateHint(state: TenantMigrationState): string {
  return STATE[state].hint;
}
