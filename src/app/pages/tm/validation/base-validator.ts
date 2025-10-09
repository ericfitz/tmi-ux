/**
 * Base validation utilities and common validation functions
 */

import { ValidationError, ValidationContext, FieldValidationRule } from './types';

/**
 * Utility class for common validation operations
 */
export class ValidationUtils {
  /**
   * Create a validation error
   */
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
  static isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Check if a value is a valid email
   */
  static isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Check if a value is a valid URL
   */
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
  static getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Build a JSONPath string
   */
  static buildPath(basePath: string, key: string | number): string {
    if (basePath === '') return String(key);
    if (typeof key === 'number') return `${basePath}[${key}]`;
    if (key.includes('.') || key.includes('[')) return `${basePath}["${key}"]`;
    return `${basePath}.${key}`;
  }

  /**
   * Validate a single field according to validation rules
   */
  static validateField(
    value: unknown,
    rule: FieldValidationRule,
    context: ValidationContext,
  ): ValidationError | null {
    const {
      field,
      required,
      type,
      minLength,
      maxLength,
      enum: enumValues,
      pattern,
      customValidator,
    } = rule;
    const path = context.currentPath ? `${context.currentPath}.${field}` : field;

    // Check if required field is missing
    if (required && (value === undefined || value === null)) {
      return ValidationUtils.createError(
        'FIELD_REQUIRED',
        `Required field '${field}' is missing`,
        path,
      );
    }

    // Skip validation if field is optional and not present
    if (value === undefined || value === null) {
      return null;
    }

    // Type validation
    if (type) {
      const actualType = ValidationUtils.getType(value);
      let typeValid = false;

      switch (type) {
        case 'uuid':
          typeValid = actualType === 'string' && ValidationUtils.isValidUUID(value as string);
          break;
        case 'email':
          typeValid = actualType === 'string' && ValidationUtils.isValidEmail(value as string);
          break;
        case 'url':
          typeValid = actualType === 'string' && ValidationUtils.isValidURL(value as string);
          break;
        case 'date-time':
          typeValid = actualType === 'string' && ValidationUtils.isValidDateTime(value as string);
          break;
        default:
          typeValid = actualType === type;
      }

      if (!typeValid) {
        return ValidationUtils.createError(
          'INVALID_TYPE',
          `Field '${field}' expected type '${type}' but got '${actualType}'`,
          path,
          'error',
          { expectedType: type, actualType, value },
        );
      }
    }

    // Length validation
    if (typeof value === 'string' || Array.isArray(value)) {
      if (minLength !== undefined && value.length < minLength) {
        return ValidationUtils.createError(
          'MIN_LENGTH_VIOLATION',
          `Field '${field}' length ${value.length} is less than minimum ${minLength}`,
          path,
          'error',
          { minLength, actualLength: value.length },
        );
      }

      if (maxLength !== undefined && value.length > maxLength) {
        return ValidationUtils.createError(
          'MAX_LENGTH_VIOLATION',
          `Field '${field}' length ${value.length} exceeds maximum ${maxLength}`,
          path,
          'error',
          { maxLength, actualLength: value.length },
        );
      }
    }

    // Enum validation
    if (enumValues && !enumValues.includes(value as string)) {
      const displayValue =
        typeof value === 'string' ? value : typeof value === 'number' ? value : '[object]';
      return ValidationUtils.createError(
        'INVALID_ENUM_VALUE',
        `Field '${field}' value '${displayValue}' is not one of allowed values: ${enumValues.join(', ')}`,
        path,
        'error',
        { allowedValues: enumValues, actualValue: value },
      );
    }

    // Pattern validation
    if (pattern && typeof value === 'string' && !pattern.test(value)) {
      return ValidationUtils.createError(
        'PATTERN_MISMATCH',
        `Field '${field}' value '${value}' does not match required pattern`,
        path,
        'error',
        { pattern: pattern.source, value },
      );
    }

    // Custom validation
    if (customValidator) {
      return customValidator(value, { ...context, currentPath: path });
    }

    return null;
  }
}

/**
 * Base validator class that provides common validation functionality
 */
export abstract class BaseValidator {
  protected errors: ValidationError[] = [];
  protected warnings: ValidationError[] = [];

  /**
   * Add an error to the validation results
   */
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
  protected clearErrors(): void {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Get all errors and warnings
   */
  protected getResults(): { errors: ValidationError[]; warnings: ValidationError[] } {
    return {
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }
}
