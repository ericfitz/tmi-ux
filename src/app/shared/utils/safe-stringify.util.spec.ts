import { describe, it, expect } from 'vitest';
import { safeStringify } from './safe-stringify.util';

describe('safeStringify', () => {
  it('should stringify simple objects', () => {
    const result = safeStringify({ a: 1, b: 'hello' });
    expect(JSON.parse(result)).toEqual({ a: 1, b: 'hello' });
  });

  it('should stringify with indentation', () => {
    const result = safeStringify({ a: 1 }, 2);
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it('should handle null and undefined values', () => {
    const result = safeStringify({ a: null, b: undefined });
    const parsed = JSON.parse(result);
    expect(parsed.a).toBeNull();
    expect(parsed.b).toBeUndefined(); // undefined is omitted in JSON
  });

  it('should handle primitive types', () => {
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify('hello')).toBe('"hello"');
    expect(safeStringify(true)).toBe('true');
    expect(safeStringify(null)).toBe('null');
  });

  it('should handle circular references', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const result = safeStringify(obj);
    const parsed = JSON.parse(result);
    expect(parsed.a).toBe(1);
    expect(parsed.self).toBe('[Circular Reference]');
  });

  it('should handle functions by omitting them (JSON.stringify behavior)', () => {
    const obj = { fn: function myFunc() {}, a: 1 };
    const result = safeStringify(obj);
    const parsed = JSON.parse(result);
    // JSON.stringify omits function properties
    expect(parsed.fn).toBeUndefined();
    expect(parsed.a).toBe(1);
  });

  it('should truncate large arrays at default limit (100)', () => {
    const arr = Array.from({ length: 150 }, (_, i) => i);
    const result = safeStringify(arr);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(101); // 100 items + truncation message
    expect(parsed[100]).toBe('[... 50 more items]');
  });

  it('should not truncate arrays within limit', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const result = safeStringify(arr);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(50);
  });

  it('should use custom maxArrayLength', () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    const result = safeStringify(arr, 0, { maxArrayLength: 10 });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(11);
    expect(parsed[10]).toBe('[... 10 more items]');
  });

  it('should truncate objects with too many properties at default limit (50)', () => {
    const obj: any = {};
    for (let i = 0; i < 80; i++) {
      obj[`key${i}`] = i;
    }
    const result = safeStringify(obj);
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed)).toHaveLength(51); // 50 properties + '...'
    expect(parsed['...']).toBe('[30 more properties]');
  });

  it('should use custom maxProperties', () => {
    const obj: any = {};
    for (let i = 0; i < 30; i++) {
      obj[`key${i}`] = i;
    }
    const result = safeStringify(obj, 0, { maxProperties: 20 });
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed)).toHaveLength(21);
    expect(parsed['...']).toBe('[10 more properties]');
  });

  it('should handle deeply nested objects', () => {
    const obj = { a: { b: { c: { d: 'deep' } } } };
    const result = safeStringify(obj);
    const parsed = JSON.parse(result);
    expect(parsed.a.b.c.d).toBe('deep');
  });

  it('should produce fallback error object when serialization fails', () => {
    const obj = {
      toJSON() {
        throw new Error('custom error');
      },
    };
    const result = safeStringify(obj);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe('Failed to serialize object');
    expect(parsed.message).toBe('custom error');
  });

  it('should handle empty objects and arrays', () => {
    expect(safeStringify({})).toBe('{}');
    expect(safeStringify([])).toBe('[]');
  });
});
