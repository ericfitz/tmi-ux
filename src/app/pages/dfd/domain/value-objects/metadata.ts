/**
 * Metadata entry for storing key-value pairs
 * Matches the Metadata schema from the OpenAPI specification
 */
export interface Metadata {
  /**
   * Metadata key identifier
   */
  key: string;

  /**
   * Metadata value content
   */
  value: string;
}

/**
 * Converts an array of Metadata entries to a Record object
 */
export function metadataToRecord(metadata: Metadata[]): Record<string, string> {
  const record: Record<string, string> = {};
  metadata.forEach(entry => {
    record[entry.key] = entry.value;
  });
  return record;
}

/**
 * Converts a Record object to an array of Metadata entries
 * Ensures all values are strings and logs warnings for non-string values
 */
export function recordToMetadata(record: Record<string, string>): Metadata[] {
  return Object.entries(record).map(([key, value]) =>
    safeMetadataEntry(key, value, 'recordToMetadata'),
  );
}

/**
 * Safely creates a metadata entry, ensuring the value is always a string
 * Logs a warning if conversion from non-string is required
 *
 * @param key - The metadata key
 * @param value - The metadata value (should be string, but may be any at runtime)
 * @param source - The source location/function calling this (for logging)
 * @returns A Metadata entry with guaranteed string value
 */
export function safeMetadataEntry(key: string, value: unknown, source?: string): Metadata {
  // If value is already a string, return as-is
  if (typeof value === 'string') {
    return { key, value };
  }

  // Non-string value detected - log warning
  const valueType = value === null ? 'null' : value === undefined ? 'undefined' : typeof value;

  const isObject = valueType === 'object';
  const stringValue = isObject ? JSON.stringify(value) : String(value);

  // Use console.warn for immediate visibility - this will be caught by LoggerService if configured
  console.warn(`[Metadata Conversion Warning] Non-string value detected in metadata`, {
    source: source || 'unknown',
    key,
    valueType,
    originalValue: value,
    convertedValue: stringValue,
    isObject,
  });

  return { key, value: stringValue };
}

/**
 * Merges multiple metadata arrays, with later entries overriding earlier ones
 */
export function mergeMetadata(...metadataArrays: Metadata[][]): Metadata[] {
  const combined = new Map<string, string>();

  metadataArrays.forEach(array => {
    array.forEach(entry => {
      combined.set(entry.key, entry.value);
    });
  });

  return Array.from(combined.entries()).map(([key, value]) => ({ key, value }));
}

/**
 * Filters metadata entries by key prefix
 */
export function filterMetadataByPrefix(metadata: Metadata[], prefix: string): Metadata[] {
  return metadata.filter(entry => entry.key.startsWith(prefix));
}

/**
 * Gets a metadata value by key, with optional default value
 */
export function getMetadataValue(
  metadata: Metadata[],
  key: string,
  defaultValue?: string,
): string | undefined {
  const entry = metadata.find(m => m.key === key);
  return entry?.value ?? defaultValue;
}
