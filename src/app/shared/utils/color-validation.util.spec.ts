// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect } from 'vitest';
import { isValidColor } from './color-validation.util';

describe('color-validation.util', () => {
  describe('isValidColor', () => {
    describe('hex colors', () => {
      it('should accept 6-digit hex', () => {
        expect(isValidColor('#FF0000')).toBe(true);
      });

      it('should accept 3-digit hex', () => {
        expect(isValidColor('#F00')).toBe(true);
      });

      it('should accept lowercase hex', () => {
        expect(isValidColor('#ff0000')).toBe(true);
      });

      it('should accept mixed case hex', () => {
        expect(isValidColor('#aAbBcC')).toBe(true);
      });

      it('should reject hex without hash', () => {
        expect(isValidColor('FF0000')).toBe(false);
      });

      it('should reject 4-digit hex', () => {
        expect(isValidColor('#FF00')).toBe(false);
      });

      it('should reject 5-digit hex', () => {
        expect(isValidColor('#FF000')).toBe(false);
      });

      it('should reject 8-digit hex (RGBA)', () => {
        expect(isValidColor('#FF0000FF')).toBe(false);
      });

      it('should reject invalid hex characters', () => {
        expect(isValidColor('#GG0000')).toBe(false);
      });
    });

    describe('named colors', () => {
      it('should accept lowercase named colors', () => {
        expect(isValidColor('red')).toBe(true);
        expect(isValidColor('blue')).toBe(true);
        expect(isValidColor('green')).toBe(true);
      });

      it('should accept uppercase named colors', () => {
        expect(isValidColor('RED')).toBe(true);
        expect(isValidColor('Blue')).toBe(true);
      });

      it('should accept both gray and grey', () => {
        expect(isValidColor('gray')).toBe(true);
        expect(isValidColor('grey')).toBe(true);
      });

      it('should reject unsupported named colors', () => {
        expect(isValidColor('cyan')).toBe(false);
        expect(isValidColor('magenta')).toBe(false);
        expect(isValidColor('coral')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(isValidColor('')).toBe(false);
      });

      it('should reject arbitrary strings', () => {
        expect(isValidColor('not-a-color')).toBe(false);
      });
    });
  });
});
