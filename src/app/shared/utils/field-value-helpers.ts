import { TranslocoService } from '@jsverse/transloco';

/**
 * Field type definitions for threat model and threat fields
 */
export type FieldType =
  | 'threatModels.status'
  | 'threatEditor.threatStatus'
  | 'threatEditor.threatSeverity'
  | 'threatEditor.threatPriority';

/**
 * Option for dropdown display
 */
export interface FieldOption {
  key: string;
  label: string;
  tooltip: string;
}

/**
 * Returns the ordered array of valid camelCase keys for a field type.
 * The array order defines the canonical sort/display order.
 */
export function getFieldKeysForFieldType(keyPrefix: FieldType): string[] {
  switch (keyPrefix) {
    case 'threatModels.status':
      return [
        'notStarted',
        'inProgress',
        'pendingReview',
        'remediationRequired',
        'remediationInProgress',
        'verificationPending',
        'approved',
        'rejected',
        'deferred',
        'closed',
      ];
    case 'threatEditor.threatStatus':
      return [
        'open',
        'confirmed',
        'mitigationPlanned',
        'mitigationInProgress',
        'verificationPending',
        'resolved',
        'accepted',
        'falsePositive',
        'deferred',
        'closed',
      ];
    case 'threatEditor.threatSeverity':
      return ['critical', 'high', 'medium', 'low', 'informational', 'unknown'];
    case 'threatEditor.threatPriority':
      return ['immediate', 'high', 'medium', 'low', 'deferred'];
    default:
      return [];
  }
}

/**
 * Migrates old values (numeric keys or localized strings) to camelCase keys.
 *
 * @param value The stored value (camelCase key, numeric key, or old localized string)
 * @param keyPrefix The translation key prefix (e.g., 'threatEditor.threatSeverity')
 * @param translocoService The Transloco service for accessing translations
 * @returns The camelCase key, or null if no match found
 */
export function migrateFieldValue(
  value: string | null | undefined,
  keyPrefix: FieldType,
  translocoService: TranslocoService,
): string | null {
  if (!value) {
    return null;
  }

  const keys = getFieldKeysForFieldType(keyPrefix);

  // If already a valid camelCase key, return as-is
  if (keys.includes(value)) {
    return value;
  }

  // If numeric, map by index position to the corresponding camelCase key
  if (/^\d+$/.test(value)) {
    const idx = parseInt(value, 10);
    return idx >= 0 && idx < keys.length ? keys[idx] : null;
  }

  // If old localized string, search translations for a match
  const availableLangs = translocoService.getAvailableLangs() as string[];

  for (const lang of availableLangs) {
    const translations = translocoService.getTranslation(lang);

    for (const camelKey of keys) {
      const translationKey = `${keyPrefix}.${camelKey}`;
      const translatedValue = getNestedProperty(translations, translationKey);

      if (
        typeof translatedValue === 'string' &&
        translatedValue.toLowerCase() === value.toLowerCase()
      ) {
        return camelKey;
      }
    }
  }

  // No match found
  return null;
}

/**
 * Gets all available options for a field type
 *
 * @param keyPrefix The translation key prefix
 * @param translocoService The Transloco service
 * @returns Array of field options with keys, labels, and tooltips
 */
export function getFieldOptions(
  keyPrefix: FieldType,
  translocoService: TranslocoService,
): FieldOption[] {
  const keys = getFieldKeysForFieldType(keyPrefix);
  const tooltipSuffix = getTooltipSuffixForFieldType(keyPrefix);

  return keys.map(key => {
    const labelKey = `${keyPrefix}.${key}`;
    const tooltipKey = `${keyPrefix}.${key}.${tooltipSuffix}`;

    return {
      key,
      label: translocoService.translate(labelKey),
      tooltip: translocoService.translate(tooltipKey),
    };
  });
}

/**
 * Gets the display label for a stored field value
 *
 * @param value The camelCase key
 * @param keyPrefix The translation key prefix
 * @param translocoService The Transloco service
 * @returns The translated label, or empty string if invalid
 */
export function getFieldLabel(
  value: string | null | undefined,
  keyPrefix: FieldType,
  translocoService: TranslocoService,
): string {
  if (!value) {
    return '';
  }

  const labelKey = `${keyPrefix}.${value}`;
  return translocoService.translate(labelKey);
}

/**
 * Gets the tooltip/description for a stored field value
 *
 * @param value The camelCase key
 * @param keyPrefix The translation key prefix
 * @param translocoService The Transloco service
 * @returns The translated tooltip/description
 */
export function getFieldTooltip(
  value: string | null | undefined,
  keyPrefix: FieldType,
  translocoService: TranslocoService,
): string {
  if (!value) {
    return '';
  }

  const tooltipSuffix = getTooltipSuffixForFieldType(keyPrefix);
  const tooltipKey = `${keyPrefix}.${value}.${tooltipSuffix}`;
  return translocoService.translate(tooltipKey);
}

/**
 * Gets the tooltip suffix for a field type
 */
function getTooltipSuffixForFieldType(keyPrefix: FieldType): string {
  switch (keyPrefix) {
    case 'threatModels.status':
      return 'tooltip';
    case 'threatEditor.threatStatus':
    case 'threatEditor.threatSeverity':
    case 'threatEditor.threatPriority':
      return 'description';
    default:
      return 'description';
  }
}

/**
 * Helper to get nested property from object using dot notation
 */
function getNestedProperty(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, prop) => {
    if (current && typeof current === 'object' && prop in current) {
      return (current as Record<string, unknown>)[prop];
    }
    return undefined;
  }, obj);
}
