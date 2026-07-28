/** Super Admin → Tenancy. Mirrors service-application/src/modules/tenancy-ops. */

export type TenantHealth = "healthy" | "pending" | "drifted" | "failed" | "orphaned";

export type TenantMigrationState =
  | "applied"
  | "pending"
  | "failed"
  /** Ledger says applied, but the migration's SQL has changed since. */
  | "checksum_mismatch"
  /** Ledger says applied, but the schema does not actually have the change. */
  | "structural_drift";

export type TenantMigrationKind = "feature" | "bugfix" | "schema" | "backfill";

export interface TenantStatus {
  schemaName: string;
  accountId: string | null;
  accountName: string | null;
  appSlug: string | null;
  accountStatus: string | null;
  /** A schema with no owning account — usually a deleted brand's leftovers. */
  orphaned: boolean;
  health: TenantHealth;
  appliedCount: number;
  pendingCount: number;
  failedCount: number;
  driftCount: number;
  totalMigrations: number;
  lastSyncedAt: string | null;
}

export interface TenantMigrationRow {
  migrationId: string;
  description: string;
  kind: TenantMigrationKind;
  feature?: string | null;
  state: TenantMigrationState;
  appliedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface TenantDetail {
  meta: {
    schemaName: string;
    accountId: string | null;
    accountName: string | null;
    appSlug: string | null;
    accountStatus: string | null;
  } | null;
  migrations: TenantMigrationRow[];
}

export interface MigrationCatalogueEntry {
  migrationId: string;
  description: string;
  kind: TenantMigrationKind;
  feature: string | null;
  checksum: string;
  appliedTenants: number;
  totalTenants: number;
}

export interface SyncTaskResult {
  schemaName: string;
  migrationId: string;
  status: "applied" | "skipped" | "failed" | "locked";
  durationMs: number;
  error?: string;
}

export interface SyncResult {
  /** Null for dry runs — they are rehearsals and are not recorded. */
  runId: string | null;
  dryRun: boolean;
  /** Work is still running; counts are a snapshot. Poll the run for truth. */
  background?: boolean;
  status: "succeeded" | "partial" | "failed";
  totalTasks: number;
  appliedCount: number;
  skippedCount: number;
  failedCount: number;
  results: SyncTaskResult[];
}

export interface TenantSyncRun {
  id: string;
  status: "running" | "succeeded" | "partial" | "failed";
  trigger: "manual" | "provisioning" | "startup";
  dryRun: boolean;
  triggeredBy: string | null;
  targetSchemas: string[];
  targetMigrations: string[];
  totalTasks: number;
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}
