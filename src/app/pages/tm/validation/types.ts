/**
 * Validation framework types and interfaces
 * Provides a flexible, extensible system for validating threat model objects
 */

export interface ValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** JSONPath to the field that caused the error */
  path: string;
  /** Severity level of the validation error */
  severity: 'error' | 'warning' | 'info';
  /** Additional context data for the error */
  context?: Record<string, any>;
}

export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Array of validation errors found */
  errors: ValidationError[];
  /** Array of warnings (non-blocking issues) */
  warnings: ValidationError[];
  /** Validation metadata */
  metadata: {
    /** Timestamp when validation was performed */
    timestamp: string;
    /** Version of the validator used */
    validatorVersion: string;
    /** Time taken to perform validation in milliseconds */
    duration: number;
  };
}

export interface FieldValidationRule {
  /** Field name or JSONPath */
  field: string;
  /** Whether the field is required */
  required?: boolean;
  /** Expected type */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'uuid' | 'email' | 'url' | 'date-time';
  /** Minimum length for strings/arrays */
  minLength?: number;
  /** Maximum length for strings/arrays */
  maxLength?: number;
  /** Allowed values for enums */
  enum?: string[];
  /** Regular expression pattern for string validation */
  pattern?: RegExp;
  /** Custom validation function */
  customValidator?: (value: any, context: ValidationContext) => ValidationError | null;
}

export interface ValidationContext {
  /** The object being validated */
  object: any;
  /** Current path in the object */
  currentPath: string;
  /** Additional context data */
  data: Record<string, any>;
}

export interface DiagramValidator {
  /** Diagram type this validator handles (e.g., 'DFD-1.0.0') */
  diagramType: string;
  /** Version pattern this validator supports (for version flexibility) */
  versionPattern: RegExp;
  /** Validate a diagram object */
  validate(diagram: any, context: ValidationContext): ValidationError[];
  /** Validate cells within the diagram */
  validateCells(cells: any[], context: ValidationContext): ValidationError[];
}

export interface ReferenceValidator {
  /** Validate that all references are consistent */
  validateReferences(threatModel: any, context: ValidationContext): ValidationError[];
}

export interface ThreatModelValidator {
  /** Validate the entire threat model */
  validate(threatModel: any): ValidationResult;
}

/**
 * Configuration for the validation system
 */
export interface ValidationConfig {
  /** Whether to include warnings in the result */
  includeWarnings: boolean;
  /** Whether to stop validation on first error */
  failFast: boolean;
  /** Maximum number of errors to collect before stopping */
  maxErrors: number;
  /** Custom diagram validators to register */
  diagramValidators: DiagramValidator[];
  /** Additional field validation rules */
  customRules: FieldValidationRule[];
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  includeWarnings: true,
  failFast: false,
  maxErrors: 100,
  diagramValidators: [],
  customRules: [],
};