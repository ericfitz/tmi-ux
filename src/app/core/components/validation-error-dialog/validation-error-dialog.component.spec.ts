// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  ValidationErrorDialogComponent,
  ValidationErrorData,
} from './validation-error-dialog.component';

describe('ValidationErrorDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  // SEM@e81349f7ea7bf60d484b2d87b1182fd5bd360a1f: construct a ValidationErrorDialogComponent with mock dependencies for testing (pure)
  function build(data: ValidationErrorData): ValidationErrorDialogComponent {
    return new ValidationErrorDialogComponent(mockDialogRef as never, data);
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
  });

  it('should create and expose the error data', () => {
    const component = build({ error: 'parse_error', errorDescription: 'bad json' });

    expect(component).toBeTruthy();
    expect(component.data.error).toBe('parse_error');
  });

  describe('getErrorAtText', () => {
    it('returns the substring starting at "Error at" when present', () => {
      const component = build({
        error: 'e',
        errorDescription: 'Some preamble. Error at line 5, column 3',
      });

      expect(component.getErrorAtText()).toBe('Error at line 5, column 3');
    });

    it('returns the whole description when "Error at" is absent', () => {
      const component = build({ error: 'e', errorDescription: 'just a message' });

      expect(component.getErrorAtText()).toBe('just a message');
    });

    it('returns an empty string for a missing description', () => {
      const component = build({ error: 'e', errorDescription: '' });

      expect(component.getErrorAtText()).toBe('');
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      const component = build({ error: 'e', errorDescription: 'd' });

      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
