/**
 * Types for the reusable delete confirmation dialog.
 */

/**
 * Object types that can be deleted via the confirmation dialog.
 */
export type DeleteObjectType =
  | 'threatModel'
  | 'diagram'
  | 'asset'
  | 'threat'
  | 'note'
  | 'document'
  | 'repository';

/**
 * Configuration data for the delete confirmation dialog.
 */
export interface DeleteConfirmationDialogData {
  /** Unique identifier of the object being deleted */
  id: string;

  /** Display name of the object being deleted */
  name: string;

  /** Type of object being deleted - determines messaging and behavior */
  objectType: DeleteObjectType;

  /**
   * Whether to show the sub-entities warning.
   * Only applicable for threatModel type.
   * Default: true for threatModel, ignored for others
   */
  showSubEntitiesWarning?: boolean;

  /**
   * Whether to show the reference-only warning.
   * Only applicable for document and repository types.
   * Default: true for document/repository, ignored for others
   */
  showReferenceOnlyWarning?: boolean;

  /**
   * Whether typed confirmation is required.
   * Default: true for threatModel, diagram, asset, threat, note
   * Default: false for document, repository
   */
  requireTypedConfirmation?: boolean;
}

/**
 * Result returned when dialog closes.
 */
export interface DeleteConfirmationDialogResult {
  /** True if user confirmed deletion */
  confirmed: boolean;
}

/**
 * Maps DeleteObjectType to the translation key for the object type name.
 */
export const OBJECT_TYPE_TRANSLATION_KEY: Record<DeleteObjectType, string> = {
  threatModel: 'common.objectTypes.threatModel',
  diagram: 'common.objectTypes.diagram',
  asset: 'common.objectTypes.asset',
  threat: 'common.objectTypes.threat',
  note: 'common.objectTypes.note',
  document: 'common.objectTypes.document',
  repository: 'common.objectTypes.repository',
};

/**
 * Maps DeleteObjectType to Material Symbols icon name.
 */
export const OBJECT_TYPE_ICON: Record<DeleteObjectType, string> = {
  threatModel: 'security',
  diagram: 'graph_3',
  asset: 'diamond',
  threat: 'skull',
  note: 'article',
  document: 'description',
  repository: 'code',
};

/**
 * Object types that require typed confirmation by default.
 */
export const TYPES_REQUIRING_CONFIRMATION: DeleteObjectType[] = [
  'threatModel',
  'diagram',
  'asset',
  'threat',
  'note',
];

/**
 * Object types that show reference-only warning by default.
 */
export const REFERENCE_ONLY_TYPES: DeleteObjectType[] = ['document', 'repository'];
