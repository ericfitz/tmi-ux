/**
 * Base validation utilities and common validation functions
 */

import { ValidationError, ValidationContext, FieldValidationRule } from './types';

/**
 * Utility class for common validation operations
 */
// SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: static helpers for building validation errors and checking field constraints (pure)
export class ValidationUtils {
  /**
   * Create a validation error
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: build a structured validation error from code, message, path, and severity (pure)
  static createError(
    code: string,
    message: string,
    path: string,
    severity: 'error' | 'warning' | 'info' = 'error',
    context?: Record<string, unknown>,
  ): ValidationError {
    return {
      code,
      message,
      path,
      severity,
      context,
    };
  }

  /**
   * Check if a value is a valid UUID
   * Supports UUID versions 0-F (including UUIDv7)
   */
  // SEM@8204f18f96000bb3b226ff2185ce61a6f687dd6d: validate a string conforms to UUID format (pure)
  static isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Check if a value is a valid email
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: validate a string conforms to email address format (pure)
  static isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Check if a value is a valid URL
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: validate a string is a parseable URL (pure)
  static isValidURL(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a value is a valid RFC3339 date-time
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: validate a string is a well-formed RFC3339 date-time (pure)
  static isValidDateTime(value: string): boolean {
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!dateTimeRegex.test(value)) {
      return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  /**
   * Get the type of a value
   */
  // SEM@59d014b875b85af28377dda6bfef40ba3531dcef: return the canonical type name of a value, distinguishing null and array (pure)
  static getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Build a JSONPath string
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: build a JSONPath string from a base path and child key (pure)
  static buildPath(basePath: string, key: string | number): string {
    if (basePath === '') return String(key);
    if (typeof key === 'number') return `${basePath}[${key}]`;
    if (key.includes('.') || key.includes('[')) return `${basePath}["${key}"]`;
    return `${basePath}.${key}`;
  }

  /** Format type validators keyed by type name. */
  private static readonly FORMAT_VALIDATORS: Record<string, (v: string) => boolean> = {
    // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: format validator entry for UUID strings (pure)
    uuid: (v: string) => ValidationUtils.isValidUUID(v),
    // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: format validator entry for email address strings (pure)
    email: (v: string) => ValidationUtils.isValidEmail(v),
    // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: format validator entry for URL strings (pure)
    url: (v: string) => ValidationUtils.isValidURL(v),
    // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: format validator entry for RFC3339 date-time strings (pure)
    'date-time': (v: string) => ValidationUtils.isValidDateTime(v),
  };

  /**
   * Validate a single field according to validation rules
   */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: validate a single field value against its rule, returning the first error or null (pure)
  static validateField(
    value: unknown,
    rule: FieldValidationRule,
    context: ValidationContext,
  ): ValidationError | null {
    const { field } = rule;
    const path = context.currentPath ? `${context.currentPath}.${field}` : field;

    if (rule.required && (value === undefined || value === null)) {
      return ValidationUtils.createError(
        'FIELD_REQUIRED',
        `Required field '${field}' is missing`,
        path,
      );
    }

    if (value === undefined || value === null) {
      return null;
    }

    return (
      ValidationUtils.validateType(value, rule, path) ??
      ValidationUtils.validateLength(value, rule, path) ??
      ValidationUtils.validateEnum(value, rule, path) ??
      ValidationUtils.validatePattern(value, rule, path) ??
      (rule.customValidator ? rule.customValidator(value, { ...context, currentPath: path }) : null)
    );
  }

  /** Validate field type, including format types (uuid, email, url, date-time). */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: validate a field value matches its declared type or format (pure)
  private static validateType(
    value: unknown,
    rule: FieldValidationRule,
    path: string,
  ): ValidationError | null {
    if (!rule.type) {
      return null;
    }
    const actualType = ValidationUtils.getType(value);
    const formatValidator = ValidationUtils.FORMAT_VALIDATORS[rule.type];
    const typeValid = formatValidator
      ? actualType === 'string' && formatValidator(value as string)
      : actualType === rule.type;

    if (!typeValid) {
      return ValidationUtils.createError(
        'INVALID_TYPE',
        `Field '${rule.field}' expected type '${rule.type}' but got '${actualType}'`,
        path,
        'error',
        { expectedType: rule.type, actualType, value },
      );
    }
    return null;
  }

  /** Validate field length (for strings and arrays). */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: validate a string or array field satisfies min/max length constraints (pure)
  private static validateLength(
    value: unknown,
    rule: FieldValidationRule,
    path: string,
  ): ValidationError | null {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return null;
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return ValidationUtils.createError(
        'MIN_LENGTH_VIOLATION',
        `Field '${rule.field}' length ${value.length} is less than minimum ${rule.minLength}`,
        path,
        'error',
        { minLength: rule.minLength, actualLength: value.length },
      );
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return ValidationUtils.createError(
        'MAX_LENGTH_VIOLATION',
        `Field '${rule.field}' length ${value.length} exceeds maximum ${rule.maxLength}`,
        path,
        'error',
        { maxLength: rule.maxLength, actualLength: value.length },
      );
    }
    return null;
  }

  /** Validate field value against allowed enum values. */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: validate a field value is among allowed enum values (pure)
  private static validateEnum(
    value: unknown,
    rule: FieldValidationRule,
    path: string,
  ): ValidationError | null {
    if (!rule.enum || rule.enum.includes(value as string)) {
      return null;
    }
    const displayValue =
      typeof value === 'string' ? value : typeof value === 'number' ? value : '[object]';
    return ValidationUtils.createError(
      'INVALID_ENUM_VALUE',
      `Field '${rule.field}' value '${displayValue}' is not one of allowed values: ${rule.enum.join(', ')}`,
      path,
      'error',
      { allowedValues: rule.enum, actualValue: value },
    );
  }

  /** Validate field value against a regex pattern. */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: validate a string field matches a required regex pattern (pure)
  private static validatePattern(
    value: unknown,
    rule: FieldValidationRule,
    path: string,
  ): ValidationError | null {
    if (!rule.pattern || typeof value !== 'string' || rule.pattern.test(value)) {
      return null;
    }
    return ValidationUtils.createError(
      'PATTERN_MISMATCH',
      `Field '${rule.field}' value '${value}' does not match required pattern`,
      path,
      'error',
      { pattern: rule.pattern.source, value },
    );
  }
}

/**
 * Base validator class that provides common validation functionality
 */
// SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: abstract base providing error accumulation and field/array validation helpers (mutates shared state)
export abstract class BaseValidator {
  protected errors: ValidationError[] = [];
  protected warnings: ValidationError[] = [];

  /**
   * Add an error to the validation results
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: accumulate a validation error or warning into instance state (mutates shared state)
  protected addError(error: ValidationError): void {
    if (error.severity === 'warning') {
      this.warnings.push(error);
    } else {
      this.errors.push(error);
    }
  }

  /**
   * Validate an object against a set of field rules
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: validate an object against a set of field rules, accumulating errors (mutates shared state)
  protected validateFields(
    obj: unknown,
    rules: FieldValidationRule[],
    context: ValidationContext,
  ): void {
    for (const rule of rules) {
      const value = this.getNestedValue(obj, rule.field);
      const error = ValidationUtils.validateField(value, rule, context);
      if (error) {
        this.addError(error);
      }
    }
  }

  /**
   * Get a nested value from an object using dot notation or array indices
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: fetch a nested property from an object via dot-notation path (pure)
  protected getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;

      // Handle array access like "items[0]"
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        const array = (current as Record<string, unknown>)[arrayKey];
        return Array.isArray(array) ? array[parseInt(index, 10)] : undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, obj);
  }

  /**
   * Validate that all items in an array pass validation
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: validate each item in an array, collecting errors per element (pure)
  protected validateArray<T>(
    array: T[] | undefined,
    path: string,
    validator: (item: T, index: number, itemPath: string) => ValidationError[],
  ): void {
    if (!array || !Array.isArray(array)) return;

    array.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      const itemErrors = validator(item, index, itemPath);
      itemErrors.forEach(error => this.addError(error));
    });
  }

  /**
   * Clear all errors and warnings
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: reset accumulated validation errors and warnings (mutates shared state)
  protected clearErrors(): void {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Get all errors and warnings
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: return a snapshot of current validation errors and warnings (pure)
  protected getResults(): { errors: ValidationError[]; warnings: ValidationError[] } {
    return {
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }
}
