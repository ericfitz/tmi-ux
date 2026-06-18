/**
 * Types for the admin audit-log UI (tmi-ux#679), matching the server contract
 * published on tmi dev/1.4.0 (tmi#398 + tmi#464). Hand-written because the
 * generated api-types.d.ts is built from tmi main, which lacks these schemas.
 */
import type {
  AuditActor,
  AuditChangeType,
  AuditEntry,
  AuditObjectType,
} from '@app/pages/tm/models/audit-trail.model';

export type { AuditActor, AuditChangeType, AuditEntry, AuditObjectType };

/** HTTP methods recorded by the system audit log. */
// SEM@8bd9eb2300a4586a96f96ac1068a4095ce979df5: enumerate HTTP methods recorded by the system audit log (pure)
export type AuditHttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A system audit entry: an immutable record of a successful /admin/* write. */
export interface SystemAuditEntry {
  id: string;
  actor: AuditActor;
  http_method: string;
  http_path: string;
  field_path: string;
  old_value_redacted: string | null;
  new_value_redacted: string | null;
  change_summary: string | null;
  created_at: string;
}

/** Common cursor-paginated list envelope returned by both audit list endpoints. */
export interface AuditListResponse<T> {
  entries: T[];
  total: number;
  limit: number;
  /** Cursor for the next (older) page; null/absent when exhausted. */
  next_cursor?: string | null;
  /** Cursor for the previous (newer) page; null/absent at the newest end. */
  prev_cursor?: string | null;
}

// SEM@8bd9eb2300a4586a96f96ac1068a4095ce979df5: type alias for a paginated list response of system audit entries (pure)
export type ListSystemAuditResponse = AuditListResponse<SystemAuditEntry>;
// SEM@8bd9eb2300a4586a96f96ac1068a4095ce979df5: cursor-paginated list envelope for threat-model audit entries (pure)
export type ListTmAuditResponse = AuditListResponse<AuditEntry>;

/** Active filters for the system audit list. All optional. */
export interface SystemAuditFilter {
  actor_email?: string;
  actor_provider?: string;
  created_after?: string;
  created_before?: string;
  http_method?: AuditHttpMethod;
  path_prefix?: string;
  field_path?: string;
}

/** Active filters for the threat-model audit list. All optional. */
export interface TmAuditFilter {
  actor_email?: string;
  actor_provider?: string;
  created_after?: string;
  created_before?: string;
  change_type?: AuditChangeType;
  object_type?: AuditObjectType;
  threat_model_id?: string;
}

// SEM@8bd9eb2300a4586a96f96ac1068a4095ce979df5: union of system and threat-model audit filter shapes (pure)
export type AuditFilter = SystemAuditFilter | TmAuditFilter;

/** Pagination request: forward/back cursor traversal OR around-anchor. Mutually exclusive cursor/around. */
export interface AuditPageRequest {
  limit?: number;
  cursor?: string;
  around?: string;
}

// SEM@8bd9eb2300a4586a96f96ac1068a4095ce979df5: enumerate supported audit log export formats (pure)
export type AuditExportFormat = 'csv' | 'ndjson';

/** Which audit stream a shared component is operating on. */
// SEM@8bd9eb2300a4586a96f96ac1068a4095ce979df5: discriminate which audit log stream a component targets (pure)
export type AuditStream = 'system' | 'tm';

/** A column definition for the audit table: how to render one column. */
export interface AuditColumnDef {
  /** Unique column key (used for matColumnDef + displayedColumns). */
  key: string;
  /** i18n key for the column header. */
  headerKey: string;
  /** Renders the cell text for a given row. */
  cell: (row: Record<string, unknown>) => string;
}
