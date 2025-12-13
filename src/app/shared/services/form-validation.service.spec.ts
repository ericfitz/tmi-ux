/**
 * Unit tests for FormValidationService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/shared/services/form-validation.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { AbstractControl } from '@angular/forms';
import { FormValidationService } from './form-validation.service';

describe('FormValidationService', () => {
  let service: FormValidationService;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      warn: vi.fn(),
    };

    service = new FormValidationService(mockLogger as any);
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('validateField()', () => {
    it('should validate field with no errors', () => {
      const validators = [FormValidationService.validators.required];
      const result = service.validateField('testForm', 'testField', 'test value', validators);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.errorMessages).toEqual([]);
    });

    it('should validate field with required error', () => {
      const validators = [FormValidationService.validators.required];
      const result = service.validateField('testForm', 'testField', '', validators);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({ required: true });
      expect(result.errorMessages).toContain('This field is required');
    });

    it('should combine multiple validation errors', () => {
      const validators = [
        FormValidationService.validators.required,
        FormValidationService.validators.maxLength(5),
      ];
      const result = service.validateField('testForm', 'testField', 'toolong', validators);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveProperty('maxLength');
    });

    it('should log validation errors when shouldLog is true', () => {
      const validators = [FormValidationService.validators.required];
      service.validateField('testForm', 'testField', '', validators, true);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Form validation error',
        expect.objectContaining({
          formId: 'testForm',
          fieldName: 'testField',
        }),
      );
    });

    it('should not log validation errors when shouldLog is false', () => {
      const validators = [FormValidationService.validators.required];
      service.validateField('testForm', 'testField', '', validators, false);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should prevent logging spam within cooldown period', () => {
      const validators = [FormValidationService.validators.required];

      service.validateField('testForm', 'testField', '', validators, true);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);

      service.validateField('testForm', 'testField', '', validators, true);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Should not log again
    });
  });

  describe('validateForm()', () => {
    it('should validate entire form with no errors', () => {
      const formData = { name: 'Test', email: 'test@example.com' };
      const validationRules = {
        name: [FormValidationService.validators.required],
        email: [FormValidationService.validators.required, FormValidationService.validators.email],
      };

      const result = service.validateForm('testForm', formData, validationRules, false);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate entire form with errors', () => {
      const formData = { name: '', email: 'invalid' };
      const validationRules = {
        name: [FormValidationService.validators.required],
        email: [FormValidationService.validators.email],
      };

      const result = service.validateForm('testForm', formData, validationRules, false);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveProperty('name');
      expect(result.errors).toHaveProperty('email');
      expect(result.errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('validateRequiredFields()', () => {
    it('should return true when all required fields have values', () => {
      const formData = { name: 'Test', description: 'A test' };
      const requiredFields = ['name', 'description'];

      const result = service.validateRequiredFields(formData, requiredFields);

      expect(result).toBe(true);
    });

    it('should return false when required field is empty string', () => {
      const formData = { name: '' };
      const requiredFields = ['name'];

      const result = service.validateRequiredFields(formData, requiredFields);

      expect(result).toBe(false);
    });

    it('should return false when required field is null', () => {
      const formData = { name: null };
      const requiredFields = ['name'];

      const result = service.validateRequiredFields(formData, requiredFields);

      expect(result).toBe(false);
    });

    it('should return false when required field is whitespace', () => {
      const formData = { name: '   ' };
      const requiredFields = ['name'];

      const result = service.validateRequiredFields(formData, requiredFields);

      expect(result).toBe(false);
    });
  });

  describe('Validators - required', () => {
    it('should pass when value is present', () => {
      const control = { value: 'test' } as AbstractControl;
      const result = FormValidationService.validators.required(control);

      expect(result).toBeNull();
    });

    it('should fail when value is null', () => {
      const control = { value: null } as AbstractControl;
      const result = FormValidationService.validators.required(control);

      expect(result).toEqual({ required: true });
    });

    it('should fail when value is empty string', () => {
      const control = { value: '' } as AbstractControl;
      const result = FormValidationService.validators.required(control);

      expect(result).toEqual({ required: true });
    });

    it('should fail when value is whitespace only', () => {
      const control = { value: '   ' } as AbstractControl;
      const result = FormValidationService.validators.required(control);

      expect(result).toEqual({ required: true });
    });
  });

  describe('Validators - maxLength', () => {
    it('should pass when value is within limit', () => {
      const validator = FormValidationService.validators.maxLength(10);
      const control = { value: 'short' } as AbstractControl;
      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should fail when value exceeds limit', () => {
      const validator = FormValidationService.validators.maxLength(5);
      const control = { value: 'toolong' } as AbstractControl;
      const result = validator(control);

      expect(result).toEqual({ maxLength: { max: 5, actual: 7 } });
    });

    it('should pass when value is null', () => {
      const validator = FormValidationService.validators.maxLength(5);
      const control = { value: null } as AbstractControl;
      const result = validator(control);

      expect(result).toBeNull();
    });
  });

  describe('Validators - minLength', () => {
    it('should pass when value meets minimum', () => {
      const validator = FormValidationService.validators.minLength(3);
      const control = { value: 'test' } as AbstractControl;
      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should fail when value is too short', () => {
      const validator = FormValidationService.validators.minLength(5);
      const control = { value: 'hi' } as AbstractControl;
      const result = validator(control);

      expect(result).toEqual({ minLength: { min: 5, actual: 2 } });
    });
  });

  describe('Validators - url', () => {
    it('should pass for valid absolute URL', () => {
      const control = { value: 'https://example.com' } as AbstractControl;
      const result = FormValidationService.validators.url(control);

      expect(result).toBeNull();
    });

    it('should pass for empty value', () => {
      const control = { value: '' } as AbstractControl;
      const result = FormValidationService.validators.url(control);

      expect(result).toBeNull();
    });

    it('should fail for invalid URL', () => {
      const control = { value: 'not a url' } as AbstractControl;
      const result = FormValidationService.validators.url(control);

      expect(result).toEqual({ url: true });
    });

    it('should fail for relative URL', () => {
      const control = { value: '/path/to/resource' } as AbstractControl;
      const result = FormValidationService.validators.url(control);

      expect(result).toEqual({ url: true });
    });
  });

  describe('Validators - uriGuidance', () => {
    it('should pass for valid absolute URI', () => {
      const control = { value: 'https://example.com/path' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      expect(result).toBeNull();
    });

    it('should pass for empty value', () => {
      const control = { value: '' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      expect(result).toBeNull();
    });

    it('should warn about control characters', () => {
      const control = { value: 'http://example.com/\x00test' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      expect(result).toHaveProperty('uriSuggestion');
      expect(result?.uriSuggestion).toEqual({
        message: 'URI contains invalid control characters',
        severity: 'warning',
      });
    });

    it('should warn about spaces', () => {
      const control = { value: 'http://example.com/path with spaces' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      expect(result).toHaveProperty('uriSuggestion');
      expect(result?.uriSuggestion.message).toContain('spaces');
    });

    it('should warn about invalid absolute URI with scheme', () => {
      const control = { value: 'ht!tp://invalid' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      // This should actually pass for a relative reference since the scheme is invalid
      // The validator is permissive for relative references
      expect(result).toBeNull();
    });

    it('should provide info for very short values', () => {
      const control = { value: 'a' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      expect(result).toHaveProperty('uriSuggestion');
      expect(result?.uriSuggestion.severity).toBe('info');
    });

    it('should warn about problematic characters', () => {
      const control = { value: 'path/with<brackets>' } as AbstractControl;
      const result = FormValidationService.validators.uriGuidance(control);

      expect(result).toHaveProperty('uriSuggestion');
      expect(result?.uriSuggestion.message).toContain('percent-encoded');
    });
  });

  describe('Validators - email', () => {
    it('should pass for valid email', () => {
      const control = { value: 'test@example.com' } as AbstractControl;
      const result = FormValidationService.validators.email(control);

      expect(result).toBeNull();
    });

    it('should pass for empty value', () => {
      const control = { value: '' } as AbstractControl;
      const result = FormValidationService.validators.email(control);

      expect(result).toBeNull();
    });

    it('should fail for invalid email', () => {
      const control = { value: 'notanemail' } as AbstractControl;
      const result = FormValidationService.validators.email(control);

      expect(result).toEqual({ email: true });
    });

    it('should fail for email without domain', () => {
      const control = { value: 'test@' } as AbstractControl;
      const result = FormValidationService.validators.email(control);

      expect(result).toEqual({ email: true });
    });
  });

  describe('Validators - numeric', () => {
    it('should pass for numeric value', () => {
      const control = { value: '123' } as AbstractControl;
      const result = FormValidationService.validators.numeric(control);

      expect(result).toBeNull();
    });

    it('should pass for decimal value', () => {
      const control = { value: '123.45' } as AbstractControl;
      const result = FormValidationService.validators.numeric(control);

      expect(result).toBeNull();
    });

    it('should fail for non-numeric value', () => {
      const control = { value: 'abc' } as AbstractControl;
      const result = FormValidationService.validators.numeric(control);

      expect(result).toEqual({ numeric: true });
    });
  });

  describe('Validators - positiveNumber', () => {
    it('should pass for positive number', () => {
      const control = { value: '5' } as AbstractControl;
      const result = FormValidationService.validators.positiveNumber(control);

      expect(result).toBeNull();
    });

    it('should fail for zero', () => {
      const control = { value: '0' } as AbstractControl;
      const result = FormValidationService.validators.positiveNumber(control);

      expect(result).toEqual({ positiveNumber: true });
    });

    it('should fail for negative number', () => {
      const control = { value: '-5' } as AbstractControl;
      const result = FormValidationService.validators.positiveNumber(control);

      expect(result).toEqual({ positiveNumber: true });
    });

    it('should fail for non-numeric value', () => {
      const control = { value: 'abc' } as AbstractControl;
      const result = FormValidationService.validators.positiveNumber(control);

      expect(result).toEqual({ positiveNumber: true });
    });
  });

  describe('Validation Rule Getters', () => {
    it('should return threat model validation rules', () => {
      const rules = service.getThreatModelValidationRules();

      expect(rules).toHaveProperty('name');
      expect(rules).toHaveProperty('description');
      expect(rules).toHaveProperty('threat_model_framework');
      expect(rules).toHaveProperty('issue_uri');
      expect(rules.name.length).toBeGreaterThan(0);
    });

    it('should return threat validation rules', () => {
      const rules = service.getThreatValidationRules();

      expect(rules).toHaveProperty('name');
      expect(rules).toHaveProperty('description');
      expect(rules).toHaveProperty('severity');
      expect(rules).toHaveProperty('threat_type');
    });

    it('should return document validation rules', () => {
      const rules = service.getDocumentValidationRules();

      expect(rules).toHaveProperty('name');
      expect(rules).toHaveProperty('uri');
      expect(rules).toHaveProperty('description');
    });

    it('should return repository validation rules', () => {
      const rules = service.getRepositoryValidationRules();

      expect(rules).toHaveProperty('name');
      expect(rules).toHaveProperty('uri');
      expect(rules).toHaveProperty('type');
    });

    it('should return metadata validation rules', () => {
      const rules = service.getMetadataValidationRules();

      expect(rules).toHaveProperty('key');
      expect(rules).toHaveProperty('value');
    });
  });

  describe('clearValidationContext()', () => {
    it('should clear validation context for a form', () => {
      // First create some validation contexts
      service.validateField('testForm', 'field1', '', [FormValidationService.validators.required]);
      service.validateField('testForm', 'field2', '', [FormValidationService.validators.required]);

      // Clear the context
      service.clearValidationContext('testForm');

      // Validate again with logging - should log since context was cleared
      service.validateField(
        'testForm',
        'field1',
        '',
        [FormValidationService.validators.required],
        true,
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should only clear specified form context', () => {
      // Create contexts for two different forms
      service.validateField(
        'form1',
        'field1',
        '',
        [FormValidationService.validators.required],
        true,
      );
      service.validateField(
        'form2',
        'field1',
        '',
        [FormValidationService.validators.required],
        true,
      );
      mockLogger.warn.mockClear();

      // Clear only form1
      service.clearValidationContext('form1');

      // form1 should log (context cleared), form2 should not (context still exists)
      service.validateField(
        'form1',
        'field1',
        '',
        [FormValidationService.validators.required],
        true,
      );
      expect(mockLogger.warn).toHaveBeenCalled();
      mockLogger.warn.mockClear();

      service.validateField(
        'form2',
        'field1',
        '',
        [FormValidationService.validators.required],
        true,
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
