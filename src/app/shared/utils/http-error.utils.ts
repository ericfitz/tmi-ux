import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extract detailed error message from HTTP error response
 * Checks common API error message formats from various backend frameworks
 *
 * @param error HttpErrorResponse to extract message from
 * @returns Extracted error message or null if no message found
 */
export function extractHttpErrorMessage(error: HttpErrorResponse): string | null {
  try {
    const errorBody = error.error as unknown;

    // Handle string error bodies (e.g., plain text responses)
    if (typeof errorBody === 'string') {
      return errorBody;
    }

    // Handle object error bodies with common field names
    if (errorBody && typeof errorBody === 'object') {
      const errorObj = errorBody as Record<string, unknown>;

      // Check common error message field names in order of preference
      return (
        (errorObj['message'] as string) ||
        (errorObj['error_description'] as string) ||
        (errorObj['detail'] as string) ||
        (errorObj['error'] as string) ||
        null
      );
    }

    return null;
  } catch {
    // If we can't parse the error body, return null
    return null;
  }
}

/**
 * Extract both error and error description from HTTP error response
 * Useful for validation errors that may have both a summary and detail
 *
 * @param error HttpErrorResponse to extract from
 * @returns Object with error and errorDescription fields
 */
export function extractHttpErrorDetails(error: HttpErrorResponse): {
  error: string | null;
  errorDescription: string | null;
} {
  try {
    const errorBody = error.error as unknown;

    if (errorBody && typeof errorBody === 'object') {
      const errorObj = errorBody as Record<string, unknown>;
      return {
        error: (errorObj['error'] as string) || (errorObj['message'] as string) || null,
        errorDescription:
          (errorObj['error_description'] as string) || (errorObj['detail'] as string) || null,
      };
    }

    // Handle string error bodies
    if (typeof errorBody === 'string') {
      return {
        error: errorBody,
        errorDescription: null,
      };
    }

    return {
      error: null,
      errorDescription: null,
    };
  } catch {
    return {
      error: null,
      errorDescription: null,
    };
  }
}
