/**
 * OpenAPI schema validation for ThreatModel objects
 * Validates against the tmi-openapi.json specification
 */

import { ValidationError, ValidationContext, FieldValidationRule } from './types';
import { BaseValidator, ValidationUtils } from './base-validator';
import {
  ThreatModel,
  Threat,
  Metadata,
  Authorization,
  Document,
} from '../models/threat-model.model';
import { Diagram } from '../models/diagram.model';

/**
 * Schema validator that validates ThreatModel objects against OpenAPI specification
 */
export class SchemaValidator extends BaseValidator {
  /**
   * Framework threat type mappings
   * These should match the threat types defined in /assets/frameworks/*.json
   */
  private static readonly FRAMEWORK_THREAT_TYPES: Record<string, string[]> = {
    STRIDE: [
      'Spoofing',
      'Tampering',
      'Repudiation',
      'Information Disclosure',
      'Denial of Service',
      'Elevation of Privilege',
    ],
    CIA: ['Confidentiality', 'Integrity', 'Availability'],
    LINDDUN: [
      'Linkability',
      'Identifiability',
      'Non-repudiation',
      'Detectability',
      'Disclosure of Information',
      'Unawareness',
      'Non-compliance',
    ],
    DIE: ['Distributed', 'Immutable', 'Ephemeral'],
    PLOT4ai: [
      'Privacy',
      'Liability',
      'Opacity',
      'Technology',
      'Fairness',
      'Accountability',
      'Interpretability',
    ],
  };

  /**
   * Field validation rules based on the OpenAPI schema
   */
  private static readonly THREAT_MODEL_RULES: FieldValidationRule[] = [
    // Core required fields
    { field: 'id', required: true, type: 'uuid', maxLength: 36 },
    { field: 'name', required: true, type: 'string', maxLength: 256 },
    { field: 'created_at', required: true, type: 'date-time', maxLength: 24 },
    { field: 'modified_at', required: true, type: 'date-time', maxLength: 24 },
    // owner and created_by are Principal objects, not strings - validated separately
    { field: 'owner', required: true, type: 'object' },
    { field: 'created_by', required: true, type: 'object' },
    // Note: threat_model_framework is conditionally required (see validateThreatModel)
    {
      field: 'threat_model_framework',
      required: false,
      type: 'string',
      enum: ['CIA', 'STRIDE', 'LINDDUN', 'DIE', 'PLOT4ai'],
    },
    { field: 'authorization', required: true, type: 'array' },

    // Optional fields
    { field: 'description', required: false, type: 'string', maxLength: 1024 },
    // Note: issue_uri accepts any string per RFC 3986 (URI-reference)
    { field: 'issue_uri', required: false, type: 'string', maxLength: 1024 },
    { field: 'metadata', required: false, type: 'array' },
    { field: 'documents', required: false, type: 'array' },
    { field: 'repositories', required: false, type: 'array' },
    { field: 'diagrams', required: false, type: 'array' },
    { field: 'threats', required: false, type: 'array' },
  ];

  /**
   * Principal validation rules (for owner, created_by, and base of Authorization)
   * Based on OpenAPI Principal schema
   */
  private static readonly PRINCIPAL_RULES: FieldValidationRule[] = [
    {
      field: 'principal_type',
      required: true,
      type: 'string',
      enum: ['user', 'group'],
    },
    { field: 'provider', required: true, type: 'string', maxLength: 100 },
    { field: 'provider_id', required: true, type: 'string', maxLength: 500 },
    { field: 'display_name', required: false, type: 'string', maxLength: 256 },
    { field: 'email', required: false, type: 'string', maxLength: 320 },
  ];

  /**
   * Authorization extends Principal with a role field
   */
  private static readonly AUTHORIZATION_RULES: FieldValidationRule[] = [
    // Principal fields
    {
      field: 'principal_type',
      required: true,
      type: 'string',
      enum: ['user', 'group'],
    },
    { field: 'provider', required: true, type: 'string', maxLength: 100 },
    { field: 'provider_id', required: true, type: 'string', maxLength: 500 },
    { field: 'display_name', required: false, type: 'string', maxLength: 256 },
    { field: 'email', required: false, type: 'string', maxLength: 320 },
    // Authorization-specific field
    { field: 'role', required: true, type: 'string', enum: ['reader', 'writer', 'owner'] },
  ];

  private static readonly METADATA_RULES: FieldValidationRule[] = [
    { field: 'key', required: true, type: 'string' },
    { field: 'value', required: true, type: 'string' },
  ];

  private static readonly DOCUMENT_RULES: FieldValidationRule[] = [
    { field: 'id', required: true, type: 'uuid' },
    { field: 'name', required: true, type: 'string' },
    // Note: uri accepts any string per RFC 3986 (URI-reference)
    { field: 'uri', required: true, type: 'string' },
    { field: 'description', required: false, type: 'string' },
    { field: 'metadata', required: false, type: 'array' },
  ];

  private static readonly THREAT_RULES: FieldValidationRule[] = [
    { field: 'id', required: true, type: 'uuid' },
    { field: 'threat_model_id', required: true, type: 'uuid' },
    { field: 'name', required: true, type: 'string' },
    {
      field: 'threat_type',
      required: true,
      type: 'array',
    },
    // severity is a freeform string per OpenAPI (maxLength: 50)
    // The app uses numeric keys ('0'-'5') internally which map to translations:
    // 0=Critical, 1=High, 2=Medium, 3=Low, 4=Informational, 5=Unknown
    // We validate as string, not enum, to allow flexibility
    { field: 'severity', required: true, type: 'string', maxLength: 50 },
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
    // Note: issue_uri accepts any string per RFC 3986 (URI-reference)
    { field: 'issue_uri', required: false, type: 'string' },
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
  validateThreatModel(threatModel: ThreatModel, context: ValidationContext): ValidationError[] {
    this.clearErrors();

    if (!threatModel || typeof threatModel !== 'object') {
      this.addError(
        ValidationUtils.createError(
          'INVALID_OBJECT',
          'ThreatModel must be a valid object',
          context.currentPath,
        ),
      );
      return this.getResults().errors;
    }

    // Check if there are any threats
    const hasThreats = Array.isArray(threatModel.threats) && threatModel.threats.length > 0;

    // Validate top-level fields
    this.validateFields(threatModel, SchemaValidator.THREAT_MODEL_RULES, context);

    // Validate Principal objects (owner, created_by)
    this.validatePrincipal(threatModel.owner, 'owner', context);
    this.validatePrincipal(threatModel.created_by, 'created_by', context);

    // Conditional validation: framework is required if there are threats
    if (hasThreats) {
      if (!threatModel.threat_model_framework || threatModel.threat_model_framework.trim() === '') {
        this.addError(
          ValidationUtils.createError(
            'MISSING_REQUIRED_FIELD',
            "Field 'threat_model_framework' is required when threats are present",
            ValidationUtils.buildPath(context.currentPath, 'threat_model_framework'),
            'error',
          ),
        );
      }
    }

    // Validate nested arrays
    this.validateAuthorizationArray(threatModel.authorization, context);
    this.validateMetadataArray(threatModel.metadata, context);
    this.validateDocumentArray(threatModel.documents, context);
    this.validateThreatArray(threatModel.threats, context, threatModel.threat_model_framework);
    this.validateDiagramArray(threatModel.diagrams, context);

    return this.getResults().errors;
  }

  /**
   * Validate a Principal object (owner or created_by)
   */
  private validatePrincipal(
    principal: unknown,
    fieldName: string,
    context: ValidationContext,
  ): void {
    if (!principal) return;

    if (typeof principal !== 'object') {
      this.addError(
        ValidationUtils.createError(
          'INVALID_TYPE',
          `Field '${fieldName}' must be a Principal object`,
          ValidationUtils.buildPath(context.currentPath, fieldName),
        ),
      );
      return;
    }

    const principalContext = {
      ...context,
      currentPath: ValidationUtils.buildPath(context.currentPath, fieldName),
    };
    this.validateFields(principal, SchemaValidator.PRINCIPAL_RULES, principalContext);
  }

  /**
   * Validate authorization array
   */
  private validateAuthorizationArray(
    authorization: Authorization[] | null | undefined,
    context: ValidationContext,
  ): void {
    if (!authorization) return;

    if (!Array.isArray(authorization)) {
      this.addError(
        ValidationUtils.createError(
          'INVALID_TYPE',
          'Authorization must be an array',
          ValidationUtils.buildPath(context.currentPath, 'authorization'),
        ),
      );
      return;
    }

    this.validateArray(
      authorization,
      ValidationUtils.buildPath(context.currentPath, 'authorization'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.AUTHORIZATION_RULES, itemContext);
        return [];
      },
    );

    // Additional validation: ensure at least one owner exists
    const owners = authorization.filter((auth: Authorization) => auth?.role === 'owner');
    if (owners.length === 0) {
      this.addError(
        ValidationUtils.createError(
          'NO_OWNER',
          'ThreatModel must have at least one owner',
          ValidationUtils.buildPath(context.currentPath, 'authorization'),
          'error',
        ),
      );
    }
  }

  /**
   * Validate metadata array
   */
  private validateMetadataArray(
    metadata: Metadata[] | undefined,
    context: ValidationContext,
  ): void {
    if (!metadata) return;

    if (!Array.isArray(metadata)) {
      this.addError(
        ValidationUtils.createError(
          'INVALID_TYPE',
          'Metadata must be an array',
          ValidationUtils.buildPath(context.currentPath, 'metadata'),
        ),
      );
      return;
    }

    this.validateArray(
      metadata,
      ValidationUtils.buildPath(context.currentPath, 'metadata'),
      (item, index, itemPath) => {
        const itemContext = { ...context, currentPath: itemPath };
        this.validateFields(item, SchemaValidator.METADATA_RULES, itemContext);
        return [];
      },
    );

    // Check for duplicate keys
    const keys = metadata.map((item: Metadata) => item?.key).filter(Boolean);
    const duplicateKeys = keys.filter((key: string, index: number) => keys.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      this.addError(
        ValidationUtils.createError(
          'DUPLICATE_METADATA_KEYS',
          `Duplicate metadata keys found: ${duplicateKeys.join(', ')}`,
          ValidationUtils.buildPath(context.currentPath, 'metadata'),
          'warning',
        ),
      );
    }
  }

  /**
   * Validate documents array
   */
  private validateDocumentArray(
    documents: Document[] | undefined,
    context: ValidationContext,
  ): void {
    if (!documents) return;

    if (!Array.isArray(documents)) {
      this.addError(
        ValidationUtils.createError(
          'INVALID_TYPE',
          'Documents must be an array',
          ValidationUtils.buildPath(context.currentPath, 'documents'),
        ),
      );
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
      },
    );
  }

  /**
   * Validate threats array
   */
  private validateThreatArray(
    threats: Threat[] | undefined,
    context: ValidationContext,
    framework?: string,
  ): void {
    if (!threats) return;

    if (!Array.isArray(threats)) {
      this.addError(
        ValidationUtils.createError(
          'INVALID_TYPE',
          'Threats must be an array',
          ValidationUtils.buildPath(context.currentPath, 'threats'),
        ),
      );
      return;
    }

    // Get valid threat types for the framework
    const validThreatTypes =
      framework && SchemaValidator.FRAMEWORK_THREAT_TYPES[framework]
        ? SchemaValidator.FRAMEWORK_THREAT_TYPES[framework]
        : [];

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
        if (
          item?.threat_model_id &&
          (context.object as { id?: string })?.id &&
          item.threat_model_id !== (context.object as { id?: string }).id
        ) {
          this.addError(
            ValidationUtils.createError(
              'THREAT_MODEL_ID_MISMATCH',
              `Threat threat_model_id '${item.threat_model_id}' does not match parent ThreatModel id '${(context.object as { id?: string }).id}'`,
              ValidationUtils.buildPath(itemPath, 'threat_model_id'),
              'error',
            ),
          );
        }

        // Validate threat_type against framework
        if (framework && item?.threat_type && validThreatTypes.length > 0) {
          // Validate that threat_type is an array
          if (!Array.isArray(item.threat_type)) {
            this.addError(
              ValidationUtils.createError(
                'INVALID_TYPE',
                `Threat type must be an array, got ${typeof item.threat_type}`,
                ValidationUtils.buildPath(itemPath, 'threat_type'),
                'error',
              ),
            );
          } else {
            // Validate each threat type in the array against framework
            const invalidTypes = item.threat_type.filter(
              (tt: string) => !validThreatTypes.includes(tt),
            );

            if (invalidTypes.length > 0) {
              this.addError(
                ValidationUtils.createError(
                  'INVALID_THREAT_TYPE',
                  `Invalid threat types for framework '${framework}': ${invalidTypes.join(', ')}. Valid types are: ${validThreatTypes.join(', ')}`,
                  ValidationUtils.buildPath(itemPath, 'threat_type'),
                  'error',
                  {
                    framework,
                    invalidThreatTypes: invalidTypes,
                    validThreatTypes,
                  },
                ),
              );
            }

            // Validate array constraints (maxItems)
            if (item.threat_type.length > 20) {
              this.addError(
                ValidationUtils.createError(
                  'ARRAY_TOO_LONG',
                  `Threat type array cannot exceed 20 items, has ${item.threat_type.length}`,
                  ValidationUtils.buildPath(itemPath, 'threat_type'),
                  'error',
                ),
              );
            }

            // Check for duplicates
            const uniqueTypes = new Set(item.threat_type);
            if (uniqueTypes.size !== item.threat_type.length) {
              this.addError(
                ValidationUtils.createError(
                  'DUPLICATE_VALUES',
                  'Threat type array contains duplicate values',
                  ValidationUtils.buildPath(itemPath, 'threat_type'),
                  'warning',
                ),
              );
            }
          }
        }

        return [];
      },
    );
  }

  /**
   * Validate diagrams array
   */
  private validateDiagramArray(diagrams: Diagram[] | undefined, context: ValidationContext): void {
    if (!diagrams) return;

    if (!Array.isArray(diagrams)) {
      this.addError(
        ValidationUtils.createError(
          'INVALID_TYPE',
          'Diagrams must be an array',
          ValidationUtils.buildPath(context.currentPath, 'diagrams'),
        ),
      );
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
      },
    );
  }
}
