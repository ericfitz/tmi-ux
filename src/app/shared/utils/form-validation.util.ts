/**
 * Utilities for form validation patterns.
 * Consolidates common form validation helper patterns used across components.
 */

import { AbstractControl } from '@angular/forms';

/**
 * Interface for URI suggestion validation error
 */
export interface UriSuggestionError {
  message?: string;
  severity?: string;
}

/**
 * Extracts a URI suggestion message from a form control's validation errors.
 * Used by editor dialogs to show URI format suggestions to users.
 *
 * @param control - The form control to check for URI suggestions
 * @returns The suggestion message if present, null otherwise
 *
 * @example
 * ```typescript
 * const suggestion = getUriSuggestionFromControl(this.form.get('uri'));
 * if (suggestion) {
 *   // Display suggestion to user
 * }
 * ```
 */
export function getUriSuggestionFromControl(control: AbstractControl | null): string | null {
  if (!control) return null;

  const uriSuggestionError = control.errors?.['uriSuggestion'] as UriSuggestionError | undefined;
  if (uriSuggestionError && typeof uriSuggestionError === 'object') {
    return uriSuggestionError.message || null;
  }
  return null;
}
