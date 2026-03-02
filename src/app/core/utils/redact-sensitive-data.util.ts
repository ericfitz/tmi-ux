/**
 * Shared utility for redacting sensitive information from objects.
 * Uses security-hardened implementation with prototype pollution protection.
 */

/** Keys that indicate sensitive data requiring redaction */
const SENSITIVE_KEYS = [
  'bearer',
  'token',
  'password',
  'secret',
  'jwt',
  'refresh_token',
  'access_token',
  'api_key',
  'apikey',
  'authorization',
  'auth',
];

/** Keys that could enable prototype pollution attacks */
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface RedactOptions {
  /**
   * When true, Authorization headers get special handling:
   * Bearer tokens show the prefix ("Bearer ****...****") while
   * other authorization values are fully redacted with token masking.
   */
  isHeaderContext?: boolean;
}

/**
 * Redact sensitive information from an object.
 *
 * Security hardening:
 * - Creates null-prototype objects to prevent prototype pollution
 * - Skips __proto__, constructor, and prototype keys
 * - Uses Object.keys() for own-property iteration only
 * - Uses Object.fromEntries() to avoid bracket-notation property writes
 *
 * @param data Object that may contain sensitive data
 * @param options Redaction options
 * @returns Object with sensitive values redacted
 */
export function redactSensitiveData(data: unknown, options: RedactOptions = {}): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const source = data as Record<string, unknown>;

  const entries = Object.keys(source)
    .filter(key => !PROTOTYPE_POLLUTION_KEYS.has(key))
    .map(key => [key, redactValue(key, source[key], options)] as [string, unknown]);

  return Object.assign(Object.create(null) as Record<string, unknown>, Object.fromEntries(entries));
}

/** Determine the redacted value for a single key-value pair. */
function redactValue(key: string, value: unknown, options: RedactOptions): unknown {
  const lowerKey = key.toLowerCase();
  const isAuthorizationField = lowerKey === 'authorization';

  if (isAuthorizationField && options.isHeaderContext) {
    if (typeof value === 'string' && value.length > 0) {
      return value.startsWith('Bearer ')
        ? `Bearer ${redactToken(value.substring(7))}`
        : redactToken(value);
    }
    return '[REDACTED]';
  }

  if (SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
    return typeof value === 'string' && value.length > 0 ? redactToken(value) : '[REDACTED]';
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return redactSensitiveData(value, options);
  }

  return value;
}

/**
 * Redact a token while showing first and last few characters for debugging.
 * Tokens 8 characters or shorter are fully redacted.
 *
 * @param token The token string to redact
 * @returns Redacted token string (e.g., "abcd************wxyz")
 */
export function redactToken(token: string): string {
  if (token.length <= 8) {
    return '[REDACTED]';
  }
  const start = token.substring(0, 4);
  const end = token.substring(token.length - 4);
  const middle = '*'.repeat(Math.min(12, token.length - 8));
  return `${start}${middle}${end}`;
}
