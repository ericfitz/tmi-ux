/**
 * Main ThreatModel validation service
 * Orchestrates all validation components to provide comprehensive validation
 */

import { Injectable } from '@angular/core';
import {
  ThreatModelValidator,
  ValidationResult,
  ValidationConfig,
  ValidationContext,
  DEFAULT_VALIDATION_CONFIG,
} from './types';
import { SchemaValidator } from './schema-validator';
import { DiagramValidatorFactory } from './diagram-validators';
import { InternalReferenceValidator } from './reference-validator';
import { ValidationUtils } from './base-validator';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class ThreatModelValidatorService implements ThreatModelValidator {
  private schemaValidator = new SchemaValidator();
  private referenceValidator = new InternalReferenceValidator();

  constructor(private logger: LoggerService) {}

  /**
   * Validate a complete ThreatModel object
   */
  validate(threatModel: any, config: Partial<ValidationConfig> = {}): ValidationResult {
    const startTime = Date.now();
    const validationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config };

    const context: ValidationContext = {
      object: threatModel,
      currentPath: '',
      data: { config: validationConfig },
    };

    const allErrors: ValidationResult['errors'] = [];
    const allWarnings: ValidationResult['warnings'] = [];

    try {
      this.logger.debugComponent('ThreatModelValidator', 'Starting ThreatModel validation', {
        threatModelId: threatModel?.id,
        threatModelName: threatModel?.name,
        config: validationConfig,
      });
      // 1. Schema validation
      const schemaErrors = this.schemaValidator.validateThreatModel(threatModel, context);
      this.categorizeErrors(schemaErrors, allErrors, allWarnings);

      if (validationConfig.failFast && allErrors.length > 0) {
        return this.buildResult(false, allErrors, allWarnings, startTime, validationConfig);
      }

      // 2. Diagram-specific validation
      const diagramErrors = this.validateDiagrams(threatModel, context, validationConfig);
      this.categorizeErrors(diagramErrors, allErrors, allWarnings);

      if (validationConfig.failFast && allErrors.length > 0) {
        return this.buildResult(false, allErrors, allWarnings, startTime, validationConfig);
      }

      // 3. Reference consistency validation
      const referenceErrors = this.referenceValidator.validateReferences(threatModel, context);
      this.categorizeErrors(referenceErrors, allErrors, allWarnings);

      // 4. Apply custom validation rules if provided
      if (validationConfig.customRules.length > 0) {
        const customErrors = this.applyCustomRules(threatModel, context, validationConfig);
        this.categorizeErrors(customErrors, allErrors, allWarnings);
      }

      // Check error limits
      if (allErrors.length > validationConfig.maxErrors) {
        allErrors.splice(validationConfig.maxErrors);
        allErrors.push(
          ValidationUtils.createError(
            'MAX_ERRORS_EXCEEDED',
            `Validation stopped after reaching maximum error limit of ${validationConfig.maxErrors}`,
            '',
            'error',
            { maxErrors: validationConfig.maxErrors },
          ),
        );
      }

      const isValid = allErrors.length === 0;
      const result = this.buildResult(isValid, allErrors, allWarnings, startTime, validationConfig);

      this.logger.debugComponent('ThreatModelValidator', 'ThreatModel validation completed', {
        valid: isValid,
        errorCount: allErrors.length,
        warningCount: allWarnings.length,
        duration: result.metadata.duration,
      });

      return result;
    } catch (error) {
      this.logger.error('ThreatModel validation failed with exception', error);

      allErrors.push(
        ValidationUtils.createError(
          'VALIDATION_EXCEPTION',
          `Validation failed due to internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          '',
          'error',
          { originalError: error },
        ),
      );

      return this.buildResult(false, allErrors, allWarnings, startTime, validationConfig);
    }
  }

  /**
   * Validate diagrams using type-specific validators
   */
  private validateDiagrams(
    threatModel: any,
    context: ValidationContext,
    config: ValidationConfig,
  ): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = [];

    if (!Array.isArray(threatModel?.diagrams)) {
      return errors;
    }

    threatModel.diagrams.forEach((diagram: any, index: number) => {
      const diagramPath = ValidationUtils.buildPath(
        ValidationUtils.buildPath(context.currentPath, 'diagrams'),
        index,
      );

      const diagramContext: ValidationContext = {
        ...context,
        currentPath: diagramPath,
      };

      // Get appropriate validator for diagram type
      const validator = DiagramValidatorFactory.getValidator(diagram?.type);

      if (!validator) {
        // Check if we have custom validators for this type
        const customValidator = config.diagramValidators.find(v =>
          v.versionPattern.test(diagram?.type || ''),
        );

        if (customValidator) {
          const diagramErrors = customValidator.validate(diagram, diagramContext);
          errors.push(...diagramErrors);
        } else {
          errors.push(
            ValidationUtils.createError(
              'UNSUPPORTED_DIAGRAM_TYPE',
              `No validator found for diagram type '${diagram?.type}'`,
              ValidationUtils.buildPath(diagramPath, 'type'),
              'warning',
              {
                diagramType: diagram?.type,
                supportedTypes: DiagramValidatorFactory.getSupportedTypes(),
              },
            ),
          );
        }
      } else {
        const diagramErrors = validator.validate(diagram, diagramContext);
        errors.push(...diagramErrors);
      }
    });

    return errors;
  }

  /**
   * Apply custom validation rules
   */
  private applyCustomRules(
    threatModel: any,
    context: ValidationContext,
    config: ValidationConfig,
  ): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = [];

    for (const rule of config.customRules) {
      const value = this.getNestedValue(threatModel, rule.field);
      const error = ValidationUtils.validateField(value, rule, context);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;

      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        const array = current[arrayKey];
        return Array.isArray(array) ? array[parseInt(index, 10)] : undefined;
      }

      return current[key];
    }, obj);
  }

  /**
   * Categorize errors into errors and warnings
   */
  private categorizeErrors(
    errors: ValidationResult['errors'],
    allErrors: ValidationResult['errors'],
    allWarnings: ValidationResult['warnings'],
  ): void {
    errors.forEach(error => {
      if (error.severity === 'warning' || error.severity === 'info') {
        allWarnings.push(error);
      } else {
        allErrors.push(error);
      }
    });
  }

  /**
   * Build the final validation result
   */
  private buildResult(
    valid: boolean,
    errors: ValidationResult['errors'],
    warnings: ValidationResult['warnings'],
    startTime: number,
    config: ValidationConfig,
  ): ValidationResult {
    const endTime = Date.now();

    return {
      valid,
      errors,
      warnings: config.includeWarnings ? warnings : [],
      metadata: {
        timestamp: new Date().toISOString(),
        validatorVersion: '1.0.0',
        duration: endTime - startTime,
      },
    };
  }

  /**
   * Validate just the schema (useful for quick validation)
   */
  validateSchema(threatModel: any): ValidationResult {
    const startTime = Date.now();
    const context: ValidationContext = {
      object: threatModel,
      currentPath: '',
      data: {},
    };

    const errors = this.schemaValidator.validateThreatModel(threatModel, context);
    const allErrors: ValidationResult['errors'] = [];
    const allWarnings: ValidationResult['warnings'] = [];

    this.categorizeErrors(errors, allErrors, allWarnings);

    return this.buildResult(
      allErrors.length === 0,
      allErrors,
      allWarnings,
      startTime,
      DEFAULT_VALIDATION_CONFIG,
    );
  }

  /**
   * Validate just the references (useful for incremental validation)
   */
  validateReferences(threatModel: any): ValidationResult {
    const startTime = Date.now();
    const context: ValidationContext = {
      object: threatModel,
      currentPath: '',
      data: {},
    };

    const errors = this.referenceValidator.validateReferences(threatModel, context);
    const allErrors: ValidationResult['errors'] = [];
    const allWarnings: ValidationResult['warnings'] = [];

    this.categorizeErrors(errors, allErrors, allWarnings);

    return this.buildResult(
      allErrors.length === 0,
      allErrors,
      allWarnings,
      startTime,
      DEFAULT_VALIDATION_CONFIG,
    );
  }

  /**
   * Register a custom diagram validator
   */
  registerDiagramValidator(validator: any): void {
    DiagramValidatorFactory.registerValidator(validator);
    this.logger.debugComponent('ThreatModelValidator', 'Registered custom diagram validator', {
      diagramType: validator.diagramType,
      versionPattern: validator.versionPattern.source,
    });
  }

  /**
   * Get supported diagram types
   */
  getSupportedDiagramTypes(): string[] {
    return DiagramValidatorFactory.getSupportedTypes();
  }
}
