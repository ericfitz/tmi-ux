/**
 * Minimal JSON Patch (RFC 6902) helpers for the admin edit dialogs.
 */

/** A single JSON Patch operation as sent with `application/json-patch+json`. */
export interface JsonPatchOperation {
  op: 'replace';
  path: string;
  value: unknown;
}

/**
 * Build `replace` operations for every listed key whose value differs between
 * `original` and `current` (deep-compared via JSON). Unchanged keys produce no
 * operation, so an untouched form yields an empty patch. Diff against the
 * form's own initial value, not the server object, so optional fields the
 * server omitted (undefined) and the form's empty defaults ('' / []) compare equal.
 * Every listed key must be a defined control: a `current` value of undefined
 * would serialize to a replace without a value, which is invalid JSON Patch.
 */
export function replaceOperations<T extends object>(
  original: T,
  current: Partial<T>,
  keys: ReadonlyArray<keyof T & string>,
): JsonPatchOperation[] {
  return keys
    .filter(key => JSON.stringify(original[key]) !== JSON.stringify(current[key]))
    .map(key => ({ op: 'replace' as const, path: `/${key}`, value: current[key] }));
}
