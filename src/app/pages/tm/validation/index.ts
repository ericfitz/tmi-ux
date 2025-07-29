/**
 * Validation framework exports
 * Main entry point for the ThreatModel validation system
 */

// Types and interfaces
export * from './types';

// Base validation utilities
export * from './base-validator';

// Schema validation
export * from './schema-validator';

// Diagram validation
export * from './diagram-validators';

// Reference validation
export * from './reference-validator';

// Main validation service
export * from './threat-model-validator.service';

// Re-export commonly used items
export { ThreatModelValidatorService } from './threat-model-validator.service';
export { ValidationUtils } from './base-validator';
export { DiagramValidatorFactory } from './diagram-validators';
export type {
  ValidationResult,
  ValidationError,
  ValidationConfig,
  DiagramValidator,
} from './types';
