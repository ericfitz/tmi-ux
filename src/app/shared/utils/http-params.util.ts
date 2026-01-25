/**
 * Utility for building HTTP query parameters from filter objects.
 * Consolidates the common buildParams pattern used across admin services.
 */

/**
 * Type for valid HTTP parameter values
 */
export type HttpParamValue = string | number | boolean;

/**
 * Builds HTTP query parameters from a filter object.
 * Only includes properties that have defined, non-null values.
 *
 * @param filter - The filter object to convert
 * @returns A record of string/number/boolean values, or undefined if no valid params
 *
 * @example
 * ```typescript
 * const filter = { provider: 'github', limit: 10, offset: undefined };
 * const params = buildHttpParams(filter);
 * // Result: { provider: 'github', limit: 10 }
 * ```
 */
export function buildHttpParams<T extends object>(
  filter?: T,
): Record<string, HttpParamValue> | undefined {
  if (!filter) {
    return undefined;
  }

  const params: Record<string, HttpParamValue> = {};

  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null) {
      params[key] = value as HttpParamValue;
    }
  }

  return Object.keys(params).length > 0 ? params : undefined;
}
