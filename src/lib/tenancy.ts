/**
 * Migration-state labels and hints.
 *
 * Kept out of TenantHealthBadge.tsx so that file exports only components —
 * a module mixing components with plain helpers drops out of Fast Refresh.
 */
import type { TenantMigrationState } from "@/types/tenancy";

export const MIGRATION_STATE: Record<
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

export function migrationStateHint(state: TenantMigrationState): string {
  return MIGRATION_STATE[state].hint;
}
