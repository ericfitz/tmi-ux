/**
 * Types for the rollback confirmation dialog.
 */

import { AuditObjectType } from '@app/pages/tm/models/audit-trail.model';

/** Configuration data for the rollback confirmation dialog */
export interface RollbackConfirmationDialogData {
  /** Display name of the entity being rolled back */
  entityName: string;

  /** Type of entity being rolled back */
  objectType: AuditObjectType;

  /** Version number being rolled back to */
  version: number;

  /** Human-readable change summary from the audit entry */
  changeSummary: string | null;

  /** Timestamp of the audit entry being rolled back to */
  timestamp: string;
}

/** Result returned when dialog closes */
export interface RollbackConfirmationDialogResult {
  confirmed: boolean;
}

/** Object types that require typed confirmation for rollback (data loss risk) */
export const ROLLBACK_TYPES_REQUIRING_CONFIRMATION: AuditObjectType[] = [
  'diagram',
  'threat',
  'note',
];

/** Maps AuditObjectType to translation key for display */
export const AUDIT_OBJECT_TYPE_TRANSLATION_KEY: Record<AuditObjectType, string> = {
  threat_model: 'common.objectTypes.threatModel',
  diagram: 'common.objectTypes.diagram',
  asset: 'common.objectTypes.asset',
  threat: 'common.objectTypes.threat',
  note: 'common.objectTypes.note',
  document: 'common.objectTypes.document',
  repository: 'common.objectTypes.repository',
};
