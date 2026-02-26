// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect } from 'vitest';
import { buildHttpParams } from './http-params.util';

describe('http-params.util', () => {
  describe('buildHttpParams', () => {
    it('should return undefined for undefined filter', () => {
      expect(buildHttpParams(undefined)).toBeUndefined();
    });

    it('should return undefined for empty object', () => {
      expect(buildHttpParams({})).toBeUndefined();
    });

    it('should include string values', () => {
      const result = buildHttpParams({ provider: 'github' });
      expect(result).toEqual({ provider: 'github' });
    });

    it('should include number values', () => {
      const result = buildHttpParams({ limit: 10, offset: 20 });
      expect(result).toEqual({ limit: 10, offset: 20 });
    });

    it('should include boolean values', () => {
      const result = buildHttpParams({ active: true, archived: false });
      expect(result).toEqual({ active: true, archived: false });
    });

    it('should exclude undefined values', () => {
      const result = buildHttpParams({ provider: 'github', limit: undefined });
      expect(result).toEqual({ provider: 'github' });
    });

    it('should exclude null values', () => {
      const result = buildHttpParams({ provider: 'github', limit: null });
      expect(result).toEqual({ provider: 'github' });
    });

    it('should return undefined when all values are null or undefined', () => {
      const result = buildHttpParams({ a: undefined, b: null });
      expect(result).toBeUndefined();
    });

    it('should handle mixed valid and invalid values', () => {
      const result = buildHttpParams({
        provider: 'google',
        limit: 25,
        active: true,
        deleted: undefined,
        archived: null,
      });
      expect(result).toEqual({ provider: 'google', limit: 25, active: true });
    });
  });
});
