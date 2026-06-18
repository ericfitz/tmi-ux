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
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: convert a metadata entry array to a key-value record (pure)
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
// SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: convert a key-value record to a metadata entry array (pure)
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
// SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: build a metadata entry coercing non-string values to string with warning (pure)
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
// SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: merge multiple metadata arrays, later entries overriding earlier by key (pure)
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
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: filter metadata entries whose key matches a given prefix (pure)
export function filterMetadataByPrefix(metadata: Metadata[], prefix: string): Metadata[] {
  return metadata.filter(entry => entry.key.startsWith(prefix));
}

/**
 * Gets a metadata value by key, with optional default value
 */
// SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: fetch a metadata value by key, returning a default if absent (pure)
export function getMetadataValue(
  metadata: Metadata[],
  key: string,
  defaultValue?: string,
): string | undefined {
  const entry = metadata.find(m => m.key === key);
  return entry?.value ?? defaultValue;
}
