import { describe, expect, it } from 'vitest';

import { isValidUrl } from './url.util';

describe('isValidUrl', () => {
  it('should return true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/issue/123')).toBe(true);
    expect(isValidUrl('https://example.com/path?query=value#fragment')).toBe(true);
  });

  it('should return false for empty or whitespace strings', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('   ')).toBe(false);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('just some text')).toBe(false);
  });

  it('should return false for null-like values', () => {
    expect(isValidUrl(null as unknown as string)).toBe(false);
    expect(isValidUrl(undefined as unknown as string)).toBe(false);
  });
});
