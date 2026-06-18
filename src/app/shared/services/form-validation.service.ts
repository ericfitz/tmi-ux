import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { LoggerService } from '../../core/services/logger.service';

/**
 * Validation result for a field or form
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors | null;
  errorMessages: string[];
}

/**
 * Context for validation logging to avoid spam
 */
interface ValidationContext {
  formId: string;
  fieldName: string;
  lastValidationTime?: Date;
  lastLoggedError?: string;
}

/**
 * Service for form validation with smart logging
 * Provides pre-save validation and prevents excessive error logging
 */
@Injectable({
  providedIn: 'root',
})
// SEM@de32c6e2bb816be8b98cbdd5c31310be7afc44a8: validate form fields and forms with throttled error logging (mutates shared state)
export class FormValidationService {
  // Track validation contexts to manage logging
  private _validationContexts = new Map<string, ValidationContext>();

  // Cooldown period for logging the same validation error (in ms)
  private _loggingCooldown = 60000; // 1 minute

  // SEM@0b80acf835f1ad7f9fc0e5cbaf2bc4f125615152: inject logger dependency (pure)
  constructor(private logger: LoggerService) {}

  /**
   * Validate a form field with smart error logging
   * Only logs validation errors at appropriate times to prevent spam
   * @param formId Unique form identifier
   * @param fieldName Field name being validated
   * @param value Current field value
   * @param validators Array of validator functions
   * @param shouldLog Whether this validation should be logged (e.g., on explicit save)
   * @returns Validation result
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: validate a single form field against given validators, logging errors on demand (mutates shared state)
  validateField(
    formId: string,
    fieldName: string,
    value: unknown,
    validators: ValidatorFn[],
    shouldLog: boolean = false,
  ): ValidationResult {
    const contextKey = `${formId}:${fieldName}`;
    let context = this._validationContexts.get(contextKey);

    if (!context) {
      context = { formId, fieldName };
      this._validationContexts.set(contextKey, context);
    }

    // Create a dummy form control for validation
    const control = { value, errors: null } as AbstractControl;
    let errors: ValidationErrors | null = null;

    // Run all validators
    for (const validator of validators) {
      const validatorErrors = validator(control);
      if (validatorErrors) {
        errors = errors ? { ...(errors as object), ...validatorErrors } : validatorErrors;
      }
    }

    const isValid = errors === null;
    const errorMessages = this.getErrorMessages(errors);

    // Update validation context
    context.lastValidationTime = new Date();

    // Smart logging logic
    if (!isValid && shouldLog) {
      this.logValidationError(context, fieldName, errorMessages, value);
    }

    return {
      isValid,
      errors,
      errorMessages,
    };
  }

  /**
   * Validate an entire form before saving
   * @param formId Unique form identifier
   * @param formData Form data to validate
   * @param validationRules Validation rules for each field
   * @param shouldLog Whether validation errors should be logged
   * @returns Overall validation result
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: validate all fields in a form against their validation rules and return aggregated result (mutates shared state)
  validateForm(
    formId: string,
    formData: Record<string, unknown>,
    validationRules: Record<string, ValidatorFn[]>,
    shouldLog: boolean = true,
  ): ValidationResult {
    let hasErrors = false;
    const allErrors: ValidationErrors = {};
    const allErrorMessages: string[] = [];

    // Validate each field
    Object.entries(validationRules).forEach(([fieldName, validators]) => {
      const fieldValue = formData[fieldName];
      const fieldResult = this.validateField(formId, fieldName, fieldValue, validators, shouldLog);

      if (!fieldResult.isValid) {
        hasErrors = true;
        if (fieldResult.errors) {
          allErrors[fieldName] = fieldResult.errors;
        }
        allErrorMessages.push(...fieldResult.errorMessages.map(msg => `${fieldName}: ${msg}`));
      }
    });

    return {
      isValid: !hasErrors,
      errors: hasErrors ? allErrors : null,
      errorMessages: allErrorMessages,
    };
  }

  /**
   * Validate required fields only (lightweight check for auto-save)
   * @param formData Form data to validate
   * @param requiredFields Array of required field names
   * @returns True if all required fields have values
   */
  // SEM@ac0adb03e4edbcb98601e3736cd190bd7839ff67: check that all required fields in form data have non-empty values (pure)
  validateRequiredFields(formData: Record<string, unknown>, requiredFields: string[]): boolean {
    return requiredFields.every(fieldName => {
      const value = formData[fieldName];
      return value != null && value !== '' && (typeof value !== 'string' || value.trim() !== '');
    });
  }

  /**
   * Common validator functions
   */
  static readonly validators = {
    /**
     * Validator for required fields
     */
    // SEM@ac0adb03e4edbcb98601e3736cd190bd7839ff67: validate that a field value is non-null and non-empty (pure)
    required: (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) {
        return { required: true };
      }
      return null;
    },

    /**
     * Validator for maximum length
     */
    // SEM@ac0adb03e4edbcb98601e3736cd190bd7839ff67: validate that a string field does not exceed a maximum character length (pure)
    maxLength: (max: number): ValidatorFn => {
      return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value as unknown;
        if (value && typeof value === 'string' && value.length > max) {
          return { maxLength: { max, actual: value.length } };
        }
        return null;
      };
    },

    /**
     * Validator for minimum length
     */
    // SEM@ac0adb03e4edbcb98601e3736cd190bd7839ff67: validate that a string field meets a minimum character length (pure)
    minLength: (min: number): ValidatorFn => {
      return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value as unknown;
        if (value && typeof value === 'string' && value.length < min) {
          return { minLength: { min, actual: value.length } };
        }
        return null;
      };
    },

    /**
     * Validator for URL format (strict - requires absolute URL with protocol)
     * Note: This is stricter than RFC 3986 URI validation
     */
    // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: validate that a field value is an absolute URL with a valid scheme (pure)
    url: (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (!value) return null; // Allow empty URLs

      try {
        new URL(value as string);
        return null;
      } catch {
        return { url: true };
      }
    },

    /**
     * Validator for RFC 3986 URI format (non-blocking guidance)
     * Accepts both absolute URIs and relative references per RFC 3986
     * Returns validation errors as suggestions, not blockers
     * @returns Validation error object with 'uriSuggestion' key if URI looks suspicious
     */
    // SEM@6343cd0e57d6b0ed35952dd942aef5ce57de8096: validate a URI field per RFC 3986, returning non-blocking suggestions for suspicious patterns (pure)
    uriGuidance: (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (!value || typeof value !== 'string') return null;

      const trimmedValue = value.trim();
      if (trimmedValue === '') return null;

      // Check for obviously invalid patterns
      // Control characters (except tab, newline which shouldn't be in URIs anyway)
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(trimmedValue)) {
        return {
          uriSuggestion: {
            message: 'URI contains invalid control characters',
            severity: 'warning',
          },
        };
      }

      // Spaces (should be percent-encoded as %20)
      if (trimmedValue.includes(' ')) {
        return {
          uriSuggestion: {
            message: 'URI contains spaces (should be percent-encoded as %20)',
            severity: 'warning',
          },
        };
      }

      // Check if it looks like an absolute URI (has a scheme)
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedValue);

      if (hasScheme) {
        // Try to validate as absolute URI
        try {
          new URL(trimmedValue);
          return null; // Valid absolute URI
        } catch {
          return {
            uriSuggestion: {
              message: 'URI appears to have a scheme but is not a valid absolute URI',
              severity: 'warning',
            },
          };
        }
      }

      // For relative references, check for some common issues
      // These are suggestions only - RFC 3986 is very permissive

      // Very short values that don't look like paths (single word with no path separators)
      if (trimmedValue.length < 4 && !/[/.]/.test(trimmedValue)) {
        return {
          uriSuggestion: {
            message: 'Consider using an absolute URI (e.g., https://example.com) or a path',
            severity: 'info',
          },
        };
      }

      // Contains angle brackets, quotes, or other characters that are commonly problematic
      if (/[<>"{}|\\^`]/.test(trimmedValue)) {
        return {
          uriSuggestion: {
            message: 'URI contains characters that may need to be percent-encoded',
            severity: 'info',
          },
        };
      }

      // If we get here, it's a relative reference or a reasonable-looking string
      return null;
    },

    /**
     * Validator for email format
     */
    // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: validate that a field value matches basic email address format (pure)
    email: (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (!value) return null; // Allow empty emails

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value as string)) {
        return { email: true };
      }
      return null;
    },

    /**
     * Validator for numeric values
     */
    // SEM@ac0adb03e4edbcb98601e3736cd190bd7839ff67: validate that a field value is a valid number (pure)
    numeric: (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (value && isNaN(Number(value))) {
        return { numeric: true };
      }
      return null;
    },

    /**
     * Validator for positive numbers
     */
    // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: validate that a field value is a positive number greater than zero (pure)
    positiveNumber: (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      if (value != null && (isNaN(Number(value)) || Number(value) <= 0)) {
        return { positiveNumber: true };
      }
      return null;
    },
  };

  /**
   * Get validation rules for threat model fields
   */
  // SEM@30b448e41d8f263e63cf8b40fb27c6d4d6bab9b4: build the validation rule set for threat model fields (pure)
  getThreatModelValidationRules(): Record<string, ValidatorFn[]> {
    return {
      name: [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(100),
      ],
      description: [FormValidationService.validators.maxLength(500)],
      threat_model_framework: [FormValidationService.validators.required],
      issue_uri: [FormValidationService.validators.url],
    };
  }

  /**
   * Get validation rules for threat fields
   */
  // SEM@de32c6e2bb816be8b98cbdd5c31310be7afc44a8: build validator rule set for threat form fields (pure)
  getThreatValidationRules(): Record<string, ValidatorFn[]> {
    return {
      name: [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(100),
      ],
      description: [FormValidationService.validators.maxLength(2048)],
      severity: [FormValidationService.validators.required],
      threat_type: [FormValidationService.validators.required],
      score: [FormValidationService.validators.positiveNumber],
      issue_uri: [FormValidationService.validators.url],
    };
  }

  /**
   * Get validation rules for document fields
   */
  // SEM@30b448e41d8f263e63cf8b40fb27c6d4d6bab9b4: build validator rule set for document form fields (pure)
  getDocumentValidationRules(): Record<string, ValidatorFn[]> {
    return {
      name: [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(100),
      ],
      uri: [FormValidationService.validators.required, FormValidationService.validators.url],
      description: [FormValidationService.validators.maxLength(500)],
    };
  }

  /**
   * Get validation rules for repository fields
   */
  // SEM@30b448e41d8f263e63cf8b40fb27c6d4d6bab9b4: build validator rule set for repository form fields (pure)
  getRepositoryValidationRules(): Record<string, ValidatorFn[]> {
    return {
      name: [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(100),
      ],
      uri: [FormValidationService.validators.required, FormValidationService.validators.url],
      type: [FormValidationService.validators.required],
      description: [FormValidationService.validators.maxLength(500)],
    };
  }

  /**
   * Get validation rules for metadata fields
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: build validator rule set for metadata key/value form fields (pure)
  getMetadataValidationRules(): Record<string, ValidatorFn[]> {
    return {
      key: [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(50),
      ],
      value: [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(500),
      ],
    };
  }

  /**
   * Clear validation context (call when form is destroyed)
   * @param formId Unique form identifier
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: delete all cached validation contexts for a given form (mutates shared state)
  clearValidationContext(formId: string): void {
    const keysToDelete = Array.from(this._validationContexts.keys()).filter(key =>
      key.startsWith(`${formId}:`),
    );

    keysToDelete.forEach(key => {
      this._validationContexts.delete(key);
    });
  }

  /**
   * Convert validation errors to user-friendly messages
   */
  // SEM@6343cd0e57d6b0ed35952dd942aef5ce57de8096: convert raw validation errors to user-facing message strings (pure)
  private getErrorMessages(errors: ValidationErrors | null): string[] {
    if (!errors) return [];

    const messages: string[] = [];

    Object.entries(errors).forEach(([errorType, errorValue]) => {
      switch (errorType) {
        case 'required':
          messages.push('This field is required');
          break;
        case 'maxLength': {
          const maxLength = errorValue as { max: number; actual: number };
          messages.push(
            `Maximum length is ${maxLength.max} characters (current: ${maxLength.actual})`,
          );
          break;
        }
        case 'minLength': {
          const minLength = errorValue as { min: number; actual: number };
          messages.push(
            `Minimum length is ${minLength.min} characters (current: ${minLength.actual})`,
          );
          break;
        }
        case 'url':
          messages.push('Please enter a valid URL');
          break;
        case 'uriSuggestion': {
          const suggestion = errorValue as { message: string; severity: string };
          messages.push(suggestion.message);
          break;
        }
        case 'email':
          messages.push('Please enter a valid email address');
          break;
        case 'numeric':
          messages.push('Please enter a valid number');
          break;
        case 'positiveNumber':
          messages.push('Please enter a positive number');
          break;
        default:
          messages.push(`Validation error: ${errorType}`);
      }
    });

    return messages;
  }

  /**
   * Log validation error with smart spam prevention
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: log a validation error with cooldown-based spam prevention (mutates shared state)
  private logValidationError(
    context: ValidationContext,
    fieldName: string,
    errorMessages: string[],
    value: unknown,
  ): void {
    const errorMessage = errorMessages.join(', ');
    const now = new Date();

    // Check if we should log this error (prevent spam)
    if (
      context.lastLoggedError === errorMessage &&
      context.lastValidationTime &&
      now.getTime() - context.lastValidationTime.getTime() < this._loggingCooldown
    ) {
      return; // Skip logging to prevent spam
    }

    // Log the validation error
    this.logger.warn('Form validation error', {
      formId: context.formId,
      fieldName,
      errorMessages,
      value: typeof value === 'string' ? value.substring(0, 100) : value, // Limit logged value length
    });

    // Update context to track this logged error
    context.lastLoggedError = errorMessage;
  }
}
