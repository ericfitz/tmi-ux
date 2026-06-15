/**
 * Types for the admin audit-log UI (tmi-ux#679), matching the server contract
 * published on tmi dev/1.4.0 (tmi#398 + tmi#464). Hand-written because the
 * generated api-types.d.ts is built from tmi main, which lacks these schemas.
 */
import {
  AuditActor,
  AuditChangeType,
  AuditEntry,
  AuditObjectType,
} from '@app/pages/tm/models/audit-trail.model';

export { AuditActor, AuditChangeType, AuditEntry, AuditObjectType };

/** HTTP methods recorded by the system audit log. */
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

export type ListSystemAuditResponse = AuditListResponse<SystemAuditEntry>;
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

export type AuditFilter = SystemAuditFilter | TmAuditFilter;

/** Pagination request: forward/back cursor traversal OR around-anchor. Mutually exclusive cursor/around. */
export interface AuditPageRequest {
  limit?: number;
  cursor?: string;
  around?: string;
}

export type AuditExportFormat = 'csv' | 'ndjson';

/** Which audit stream a shared component is operating on. */
export type AuditStream = 'system' | 'tm';
