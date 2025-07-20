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
 * Legacy alias for backward compatibility
 * @deprecated Use Metadata instead
 */
export type MetadataEntry = Metadata;

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
 */
export function recordToMetadata(record: Record<string, string>): Metadata[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
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
export function getMetadataValue(metadata: Metadata[], key: string, defaultValue?: string): string | undefined {
  const entry = metadata.find(m => m.key === key);
  return entry?.value ?? defaultValue;
}