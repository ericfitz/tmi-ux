// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { getUriSuggestionFromControl } from './form-validation.util';

describe('form-validation.util', () => {
  describe('getUriSuggestionFromControl', () => {
    it('should return null for null control', () => {
      expect(getUriSuggestionFromControl(null)).toBeNull();
    });

    it('should return null when control has no errors', () => {
      const control = new FormControl('valid-value');
      expect(getUriSuggestionFromControl(control)).toBeNull();
    });

    it('should return null when control has errors but no uriSuggestion', () => {
      const control = new FormControl('');
      control.setErrors({ required: true });
      expect(getUriSuggestionFromControl(control)).toBeNull();
    });

    it('should return message from uriSuggestion error', () => {
      const control = new FormControl('bad-uri');
      control.setErrors({
        uriSuggestion: { message: 'Consider using https:// prefix' },
      });
      expect(getUriSuggestionFromControl(control)).toBe('Consider using https:// prefix');
    });

    it('should return null when uriSuggestion has no message', () => {
      const control = new FormControl('bad-uri');
      control.setErrors({
        uriSuggestion: { severity: 'warning' },
      });
      expect(getUriSuggestionFromControl(control)).toBeNull();
    });

    it('should return null when uriSuggestion is a non-object value', () => {
      const control = new FormControl('bad-uri');
      control.setErrors({
        uriSuggestion: true,
      });
      expect(getUriSuggestionFromControl(control)).toBeNull();
    });

    it('should return null when uriSuggestion message is empty string', () => {
      const control = new FormControl('bad-uri');
      control.setErrors({
        uriSuggestion: { message: '' },
      });
      expect(getUriSuggestionFromControl(control)).toBeNull();
    });
  });
});
