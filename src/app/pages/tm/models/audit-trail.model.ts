/**
 * Audit trail types matching the TMI API schema
 */

import { PaginationMetadata } from '@app/types/api-responses.types';

/** Object types that can appear in audit trail entries */
export type AuditObjectType =
  | 'threat_model'
  | 'diagram'
  | 'threat'
  | 'asset'
  | 'document'
  | 'note'
  | 'repository';

/** Change types recorded by the audit trail */
export type AuditChangeType =
  | 'created'
  | 'updated'
  | 'patched'
  | 'deleted'
  | 'rolled_back'
  | 'restored';

/** Denormalized user information stored with audit entries */
export interface AuditActor {
  email: string;
  provider: string;
  provider_id: string;
  display_name: string;
}

/** A single audit trail entry recording a mutation */
export interface AuditEntry {
  id: string;
  threat_model_id: string;
  object_type: AuditObjectType;
  object_id: string;
  version: number | null;
  change_type: AuditChangeType;
  actor: AuditActor;
  change_summary: string | null;
  created_at: string;
}

/** Paginated response from GET /threat_models/{id}/audit_trail */
export interface ListAuditTrailResponse extends PaginationMetadata {
  audit_entries: AuditEntry[];
}

/** Query parameters for listing audit trail entries */
export interface AuditTrailListParams {
  limit?: number;
  offset?: number;
  object_type?: AuditObjectType;
  change_type?: AuditChangeType;
  actor_email?: string;
  after?: string;
  before?: string;
}
