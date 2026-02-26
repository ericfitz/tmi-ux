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
 *
 * @param data Object that may contain sensitive data
 * @param options Redaction options
 * @returns Object with sensitive values redacted
 */
export function redactSensitiveData(data: unknown, options: RedactOptions = {}): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const redacted = Object.create(null) as Record<string, unknown>;
  const source = data as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      continue;
    }

    const value = source[key];
    const lowerKey = key.toLowerCase();
    const isAuthorizationField = lowerKey === 'authorization';

    if (isAuthorizationField && options.isHeaderContext) {
      if (typeof value === 'string' && value.length > 0) {
        if (value.startsWith('Bearer ')) {
          const tokenPart = value.substring(7);
          redacted[key] = `Bearer ${redactToken(tokenPart)}`;
        } else {
          redacted[key] = redactToken(value);
        }
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
      if (typeof value === 'string' && value.length > 0) {
        redacted[key] = redactToken(value);
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveData(value, options);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
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
