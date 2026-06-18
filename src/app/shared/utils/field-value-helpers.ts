import { TranslocoService } from '@jsverse/transloco';

/**
 * Field type definitions for threat model and threat fields
 */
// SEM@7f8b7a5dd18ae9c991ae27e35e7c953ec2a7d982: enumerate valid threat model and threat field type identifiers (pure)
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
// SEM@bc246638296101120ee12c9a3cdb6b0f93f13e71: list valid canonical keys for a field type in display order (pure)
export function getFieldKeysForFieldType(keyPrefix: FieldType): string[] {
  switch (keyPrefix) {
    case 'threatModels.status':
      return [
        'not_started',
        'in_progress',
        'pending_review',
        'remediation_required',
        'remediation_in_progress',
        'verification_pending',
        'approved',
        'rejected',
        'deferred',
        'closed',
      ];
    case 'threatEditor.threatStatus':
      return [
        'open',
        'confirmed',
        'mitigation_planned',
        'mitigation_in_progress',
        'verification_pending',
        'resolved',
        'accepted',
        'false_positive',
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
// SEM@d47739de2acf5e281b60be208f2dfa034ea03423: convert a legacy field value (numeric or localized string) to its canonical key (pure)
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
// SEM@d47739de2acf5e281b60be208f2dfa034ea03423: build the localized dropdown options list for a field type (pure)
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
 * Gets the display label for a stored field value.
 * Handles legacy values (numeric indices, localized strings) by migrating
 * them to the canonical camelCase key before looking up the translation.
 *
 * @param value The stored value (camelCase key, numeric key, or old localized string)
 * @param keyPrefix The translation key prefix
 * @param translocoService The Transloco service
 * @returns The translated label, the raw value as fallback, or empty string if null/undefined
 */
// SEM@a9878a701a7dd9c267ccc2dc9292958bb05e1fcd: fetch the localized display label for a stored field value, migrating legacy formats (pure)
export function getFieldLabel(
  value: string | null | undefined,
  keyPrefix: FieldType,
  translocoService: TranslocoService,
): string {
  if (!value) {
    return '';
  }

  const keys = getFieldKeysForFieldType(keyPrefix);

  // Fast path: already a valid camelCase key
  if (keys.includes(value)) {
    return translocoService.translate(`${keyPrefix}.${value}`);
  }

  // Try migrating legacy values (numeric indices, localized strings)
  const migratedKey = migrateFieldValue(value, keyPrefix, translocoService);
  if (migratedKey) {
    return translocoService.translate(`${keyPrefix}.${migratedKey}`);
  }

  // Unrecognized value — return as-is rather than a broken transloco key
  return value;
}

/**
 * Gets the tooltip/description for a stored field value
 *
 * @param value The camelCase key
 * @param keyPrefix The translation key prefix
 * @param translocoService The Transloco service
 * @returns The translated tooltip/description
 */
// SEM@7f8b7a5dd18ae9c991ae27e35e7c953ec2a7d982: fetch the localized tooltip text for a field value by type (pure)
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
// SEM@7f8b7a5dd18ae9c991ae27e35e7c953ec2a7d982: map a field type to its translation key tooltip suffix (pure)
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
// SEM@141c5177a23d03d5e9457daee40e8526092d1e5f: fetch a nested object property by dot-notation path, returning undefined if missing (pure)
function getNestedProperty(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, prop) => {
    if (current && typeof current === 'object' && prop in current) {
      return (current as Record<string, unknown>)[prop];
    }
    return undefined;
  }, obj);
}
