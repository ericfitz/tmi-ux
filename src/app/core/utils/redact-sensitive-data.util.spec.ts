import { describe, it, expect } from 'vitest';
import { redactSensitiveData, redactToken } from './redact-sensitive-data.util';

describe('redactToken', () => {
  it('should fully redact tokens 8 chars or shorter', () => {
    expect(redactToken('short')).toBe('[REDACTED]');
    expect(redactToken('12345678')).toBe('[REDACTED]');
  });

  it('should show first 4 and last 4 characters for longer tokens', () => {
    const result = redactToken('abcdefghijklmnop');
    expect(result).toMatch(/^abcd\*+mnop$/);
  });

  it('should cap middle masking at 12 asterisks', () => {
    const longToken = 'a'.repeat(100);
    const result = redactToken(longToken);
    expect(result).toBe('aaaa************aaaa');
  });

  it('should handle 9-char token (minimum partial redaction)', () => {
    const result = redactToken('123456789');
    expect(result).toBe('1234*6789');
  });
});

describe('redactSensitiveData', () => {
  it('should return non-object input as-is', () => {
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(undefined)).toBeUndefined();
    expect(redactSensitiveData('string')).toBe('string');
    expect(redactSensitiveData(42)).toBe(42);
  });

  it('should pass through non-sensitive keys', () => {
    const data = { name: 'test', count: 5, active: true };
    const result = redactSensitiveData(data) as Record<string, unknown>;
    expect(result['name']).toBe('test');
    expect(result['count']).toBe(5);
    expect(result['active']).toBe(true);
  });

  it('should redact all sensitive key names', () => {
    const sensitiveKeys = [
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

    for (const key of sensitiveKeys) {
      const data = { [key]: 'sensitive-value-12345' };
      const result = redactSensitiveData(data) as Record<string, unknown>;
      expect(result[key]).not.toBe('sensitive-value-12345');
      expect(typeof result[key]).toBe('string');
    }
  });

  it('should redact keys containing sensitive substrings', () => {
    const result = redactSensitiveData({
      my_password_field: 'secret123456789',
      x_api_key_header: 'key-value-12345',
    }) as Record<string, unknown>;

    expect(result['my_password_field']).toMatch(/^.{4}\*+.{4}$/);
    expect(result['x_api_key_header']).toMatch(/^.{4}\*+.{4}$/);
  });

  it('should case-insensitively match sensitive keys', () => {
    const result = redactSensitiveData({
      PASSWORD: 'sensitive123456789',
      Api_Key: 'key-value-12345678',
    }) as Record<string, unknown>;

    expect(result['PASSWORD']).not.toBe('sensitive123456789');
    expect(result['Api_Key']).not.toBe('key-value-12345678');
  });

  it('should fully redact non-string sensitive values', () => {
    const result = redactSensitiveData({
      token: 42,
      password: null,
      secret: undefined,
    }) as Record<string, unknown>;

    expect(result['token']).toBe('[REDACTED]');
    expect(result['password']).toBe('[REDACTED]');
    expect(result['secret']).toBe('[REDACTED]');
  });

  it('should fully redact empty string sensitive values', () => {
    const result = redactSensitiveData({
      token: '',
    }) as Record<string, unknown>;
    expect(result['token']).toBe('[REDACTED]');
  });

  it('should recursively redact nested objects', () => {
    const data = {
      user: 'test',
      credentials: {
        password: 'nested-secret-1234',
        nested: {
          api_key: 'deep-nested-key-val',
        },
      },
    };
    const result = redactSensitiveData(data) as Record<string, unknown>;
    expect(result['user']).toBe('test');

    const creds = result['credentials'] as Record<string, unknown>;
    expect(creds['password']).not.toBe('nested-secret-1234');

    const nested = creds['nested'] as Record<string, unknown>;
    expect(nested['api_key']).not.toBe('deep-nested-key-val');
  });

  it('should not recurse into arrays', () => {
    const data = { items: [{ password: 'secret' }] };
    const result = redactSensitiveData(data) as Record<string, unknown>;
    const items = result['items'] as Array<{ password: string }>;
    expect(items[0].password).toBe('secret');
  });

  describe('prototype pollution protection', () => {
    it('should skip __proto__ key', () => {
      const data = JSON.parse('{"__proto__": {"polluted": true}, "safe": "value"}');
      const result = redactSensitiveData(data) as Record<string, unknown>;
      expect(result['safe']).toBe('value');
      expect(result['__proto__']).toBeUndefined();
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });

    it('should skip constructor key', () => {
      const data = { constructor: 'attack', safe: 'value' };
      const result = redactSensitiveData(data) as Record<string, unknown>;
      expect(result['safe']).toBe('value');
      expect(result['constructor']).toBeUndefined();
    });

    it('should skip prototype key', () => {
      const data = { prototype: 'attack', safe: 'value' };
      const result = redactSensitiveData(data) as Record<string, unknown>;
      expect(result['safe']).toBe('value');
      expect(result['prototype']).toBeUndefined();
    });

    it('should create null-prototype result objects', () => {
      const result = redactSensitiveData({ key: 'value' }) as Record<string, unknown>;
      expect(Object.getPrototypeOf(result)).toBeNull();
    });
  });

  describe('isHeaderContext option', () => {
    it('should preserve Bearer prefix in authorization headers', () => {
      const result = redactSensitiveData(
        { authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.long-token-value' },
        { isHeaderContext: true },
      ) as Record<string, unknown>;

      const redacted = result['authorization'] as string;
      expect(redacted).toMatch(/^Bearer /);
      expect(redacted).not.toContain('eyJhbGciOiJSUzI1NiJ9');
    });

    it('should redact non-Bearer authorization headers', () => {
      const result = redactSensitiveData(
        { authorization: 'Basic dXNlcjpwYXNzd29yZA==' },
        { isHeaderContext: true },
      ) as Record<string, unknown>;

      const redacted = result['authorization'] as string;
      expect(redacted).not.toContain('Basic');
      expect(redacted).not.toContain('dXNlcjpwYXNzd29yZA==');
    });

    it('should fully redact empty authorization header', () => {
      const result = redactSensitiveData(
        { authorization: '' },
        { isHeaderContext: true },
      ) as Record<string, unknown>;
      expect(result['authorization']).toBe('[REDACTED]');
    });

    it('should redact authorization as a sensitive key without isHeaderContext', () => {
      const result = redactSensitiveData({
        authorization: 'Bearer some-long-token-value',
      }) as Record<string, unknown>;

      const redacted = result['authorization'] as string;
      // Without isHeaderContext, authorization is redacted like any other sensitive key
      // (no Bearer prefix preservation)
      expect(redacted).not.toBe('Bearer some-long-token-value');
    });
  });
});
