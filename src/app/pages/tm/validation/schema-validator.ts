/**
 * OpenAPI schema validation for ThreatModel objects
 * Validates against the tmi-openapi.json specification
 */

import { ValidationError, ValidationContext, FieldValidationRule } from './types';
import { BaseValidator, ValidationUtils } from './base-validator';

/**
 * Schema validator that validates ThreatModel objects against OpenAPI specification
 */
export class SchemaValidator extends BaseValidator {
  /**
   * Field validation rules based on the OpenAPI schema
   */
  private static readonly THREAT_MODEL_RULES: FieldValidationRule[] = [
    // Core required fields
    { field: 'id', required: true, type: 'uuid', maxLength: 36 },
    { field: 'name', required: true, type: 'string', maxLength: 256 },
    { field: 'created_at', required: true, type: 'date-time', maxLength: 24 },
    { field: 'modified_at', required: true, type: 'date-time', maxLength: 24 },
    { field: 'owner', required: true, type: 'string' },
    { field: 'created_by', required: true, type: 'string', maxLength: 256 },
    { field: 'threat_model_framework', required: true, type: 'string', enum: ['CIA', 'STRIDE', 'LINDDUN', 'DIE', 'PLOT4ai'] },
    { field: 'authorization', required: true, type: 'array' },

    // Optional fields
    { field: 'description', required: false, type: 'string', maxLength: 1024 },
    { field: 'issue_url', required: false, type: 'url', maxLength: 1024 },
    { field: 'metadata', required: false, type: 'array' },
    { field: 'documents', required: false, type: 'array' },
    { field: 'sourceCode', required: false, type: 'array' },
    { field: 'diagrams', required: false, type: 'array' },
    { field: 'threats', required: false, type: 'array' },
  ];

  private static readonly AUTHORIZATION_RULES: FieldValidationRule[] = [
    { field: 'subject', required: true, type: 'string' },
    { field: 'role', required: true, type: 'string', enum: ['reader', 'writer', 'owner'] },
  ];

  private static readonly METADATA_RULES: FieldValidationRule[] = [
    { field: 'key', required: true, type: 'string' },
    { field: 'value', required: true, type: 'string' },
  ];

  private static readonly DOCUMENT_RULES: FieldValidationRule[] = [
    { field: 'id', required: true, type: 'uuid' },
    { field: 'name', required: true, type: 'string' },
    { field: 'url', required: true, type: 'url' },
    { field: 'description', required: false, type: 'string' },
    { field: 'metadata', required: false, type: 'array' },
  ];

  private static readonly THREAT_RULES: FieldValidationRule[] = [
    { field: 'id', required: true, type: 'uuid' },
    { field: 'threat_model_id', required: true, type: 'uuid' },
    { field: 'name', required: true, type: 'string' },
    { field: 'threat_type', required: true, type: 'string' },
    { field: 'severity', required: true, type: 'string', enum: ['Unknown', 'None', 'Low', 'Medium', 'High', 'Critical'] },
    { field: 'created_at', required: true, type: 'date-time' },
    { field: 'modified_at', required: true, type: 'date-time' },
    
    // Optional fields
    { field: 'description', required: false, type: 'string' },
    { field: 'diagram_id', required: false, type: 'uuid' },
    { field: 'cell_id', required: false, type: 'string' },
    { field: 'score', required: false, type: 'number' },
    { field: 'priority', required: false, type: 'string' },
    { field: 'mitigated', required: false, type: 'boolean' },
    { field: 'status', required: false, type: 'string' },
    { field: 'issue_url', required: false, type: 'url' },
    { field: 'metadata', required: false, type: 'array' },
  ];

  private static readonly DIAGRAM_RULES: FieldValidationRule[] = [
    { field: 'id', required: true, type: 'uuid' },
    { field: 'name', required: true, type: 'string' },
    { field: 'type', required: true, type: 'string' },
    { field: 'created_at', required: true, type: 'date-time' },
    { field: 'modified_at', required: true, type: 'date-time' },
    
    // Optional fields
    { field: 'description', required: false, type: 'string' },
    { field: 'metadata', required: false, type: 'array' },
    { field: 'cells', required: false, type: 'array' },
  ];

  /**
   * Validate a ThreatModel object against the OpenAPI schema
   */
  validateThreatModel(threatModel: any, context: ValidationContext): ValidationError[] {
    this.clearErrors();

    if (!threatModel || typeof threatModel !== 'object') {
      this.addError(ValidationUtils.createError(
        'INVALID_OBJECT',
        'ThreatModel must be a valid object',
        context.currentPath
      ));
      return this.getResults().errors;
    }

    // Validate top-level fields
    this.validateFields(threatModel, SchemaValidator.THREAT_MODEL_RULES, context);

    // Validate nested arrays
    this.validateAuthorizationArray(threatModel.authorization, context);
    this.validateMetadataArray(threatModel.metadata, context);
    this.validateDocumentArray(threatModel.documents, context);
    this.validateThreatArray(threatModel.threats, context);
    this.validateDiagramArray(threatModel.diagrams, context);

    return this.getResults().errors;
  }

  /**
   * Validate authorization array
   */
  private validateAuthorizationArray(authorization: any, context: ValidationContext): void {
    if (!authorization) return;

    if (!Array.isArray(authorization)) {
      this.addError(ValidationUtils.createError(
        'INVALID_TYPE',
        'Authorization must be an array',
        ValidationUtils.buildPath(context.currentPath, 'authorization')
      ));
      return;
    }

    this.validateArray(
      authorization,
      ValidationUtils.buildPath(context.currentPath, 'authorization'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.AUTHORIZATION_RULES, itemContext);
        return [];
      }
    );

    // Additional validation: ensure at least one owner exists
    const owners = authorization.filter((auth: any) => auth?.role === 'owner');
    if (owners.length === 0) {
      this.addError(ValidationUtils.createError(
        'NO_OWNER',
        'ThreatModel must have at least one owner',
        ValidationUtils.buildPath(context.currentPath, 'authorization'),
        'error'
      ));
    }
  }

  /**
   * Validate metadata array
   */
  private validateMetadataArray(metadata: any, context: ValidationContext): void {
    if (!metadata) return;

    if (!Array.isArray(metadata)) {
      this.addError(ValidationUtils.createError(
        'INVALID_TYPE',
        'Metadata must be an array',
        ValidationUtils.buildPath(context.currentPath, 'metadata')
      ));
      return;
    }

    this.validateArray(
      metadata,
      ValidationUtils.buildPath(context.currentPath, 'metadata'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.METADATA_RULES, itemContext);
        return [];
      }
    );

    // Check for duplicate keys
    const keys = metadata.map((item: any) => item?.key).filter(Boolean);
    const duplicateKeys = keys.filter((key: string, index: number) => keys.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      this.addError(ValidationUtils.createError(
        'DUPLICATE_METADATA_KEYS',
        `Duplicate metadata keys found: ${duplicateKeys.join(', ')}`,
        ValidationUtils.buildPath(context.currentPath, 'metadata'),
        'warning'
      ));
    }
  }

  /**
   * Validate documents array
   */
  private validateDocumentArray(documents: any, context: ValidationContext): void {
    if (!documents) return;

    if (!Array.isArray(documents)) {
      this.addError(ValidationUtils.createError(
        'INVALID_TYPE',
        'Documents must be an array',
        ValidationUtils.buildPath(context.currentPath, 'documents')
      ));
      return;
    }

    this.validateArray(
      documents,
      ValidationUtils.buildPath(context.currentPath, 'documents'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.DOCUMENT_RULES, itemContext);
        
        // Validate nested metadata if present
        if (item?.metadata) {
          this.validateMetadataArray(item.metadata, itemContext);
        }
        
        return [];
      }
    );
  }

  /**
   * Validate threats array
   */
  private validateThreatArray(threats: any, context: ValidationContext): void {
    if (!threats) return;

    if (!Array.isArray(threats)) {
      this.addError(ValidationUtils.createError(
        'INVALID_TYPE',
        'Threats must be an array',
        ValidationUtils.buildPath(context.currentPath, 'threats')
      ));
      return;
    }

    this.validateArray(
      threats,
      ValidationUtils.buildPath(context.currentPath, 'threats'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.THREAT_RULES, itemContext);
        
        // Validate nested metadata if present
        if (item?.metadata) {
          this.validateMetadataArray(item.metadata, itemContext);
        }

        // Additional validation: threat_model_id should match the parent threat model
        if (item?.threat_model_id && (context.object as { id?: string })?.id && item.threat_model_id !== (context.object as { id?: string }).id) {
          this.addError(ValidationUtils.createError(
            'THREAT_MODEL_ID_MISMATCH',
            `Threat threat_model_id '${item.threat_model_id}' does not match parent ThreatModel id '${(context.object as { id?: string }).id}'`,
            ValidationUtils.buildPath(itemPath, 'threat_model_id'),
            'error'
          ));
        }
        
        return [];
      }
    );
  }

  /**
   * Validate diagrams array
   */
  private validateDiagramArray(diagrams: any, context: ValidationContext): void {
    if (!diagrams) return;

    if (!Array.isArray(diagrams)) {
      this.addError(ValidationUtils.createError(
        'INVALID_TYPE',
        'Diagrams must be an array',
        ValidationUtils.buildPath(context.currentPath, 'diagrams')
      ));
      return;
    }

    this.validateArray(
      diagrams,
      ValidationUtils.buildPath(context.currentPath, 'diagrams'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.DIAGRAM_RULES, itemContext);
        
        // Validate nested metadata if present
        if (item?.metadata) {
          this.validateMetadataArray(item.metadata, itemContext);
        }
        
        return [];
      }
    );
  }
}