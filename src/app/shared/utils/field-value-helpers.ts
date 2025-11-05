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
 * Migrates old string values to new numeric key format
 * Checks the stored value against all localized strings and returns matching numeric key
 *
 * @param value The stored value (either already numeric key or old string value)
 * @param keyPrefix The translation key prefix (e.g., 'threatEditor.threatSeverity')
 * @param translocoService The Transloco service for accessing translations
 * @returns The numeric key as string, or null if no match found
 */
export function migrateFieldValue(
  value: string | null | undefined,
  keyPrefix: FieldType,
  translocoService: TranslocoService,
): string | null {
  if (!value) {
    return null;
  }

  // If already numeric, return as-is
  if (/^\d+$/.test(value)) {
    return value;
  }

  // Get all available languages
  const availableLangs = translocoService.getAvailableLangs() as string[];

  // Get the number of keys for this field type
  const keyCount = getKeyCountForFieldType(keyPrefix);

  // Check each language for a match
  for (const lang of availableLangs) {
    const translations = translocoService.getTranslation(lang);

    // Check each numeric key
    for (let i = 0; i < keyCount; i++) {
      const key = `${keyPrefix}.${i}`;
      const translatedValue = getNestedProperty(translations, key);

      if (
        typeof translatedValue === 'string' &&
        translatedValue.toLowerCase() === value.toLowerCase()
      ) {
        return String(i);
      }
    }
  }

  // No match found, return null
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
  const options: FieldOption[] = [];
  const keyCount = getKeyCountForFieldType(keyPrefix);
  const tooltipSuffix = getTooltipSuffixForFieldType(keyPrefix);

  for (let i = 0; i < keyCount; i++) {
    const key = String(i);
    const labelKey = `${keyPrefix}.${key}`;
    const tooltipKey = `${keyPrefix}.${key}.${tooltipSuffix}`;

    options.push({
      key,
      label: translocoService.translate(labelKey),
      tooltip: translocoService.translate(tooltipKey),
    });
  }

  return options;
}

/**
 * Gets the display label for a stored field value
 *
 * @param value The numeric key as string
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
 * @param value The numeric key as string
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
 * Gets the number of keys available for a field type
 */
function getKeyCountForFieldType(keyPrefix: FieldType): number {
  switch (keyPrefix) {
    case 'threatModels.status':
      return 10; // 0-9
    case 'threatEditor.threatStatus':
      return 10; // 0-9
    case 'threatEditor.threatSeverity':
      return 6; // 0-5
    case 'threatEditor.threatPriority':
      return 5; // 0-4
    default:
      return 0;
  }
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
  return path.split('.').reduce((current: any, prop) => current?.[prop], obj);
}
