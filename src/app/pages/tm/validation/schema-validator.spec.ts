/**
 * Tests for SchemaValidator
 *
 * Covers: ThreatModel schema validation against OpenAPI spec,
 * framework-specific threat types, principal validation,
 * authorization array checks, metadata/document/diagram validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { SchemaValidator } from './schema-validator';
import { ValidationContext, ValidationError } from './types';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;
  let baseContext: ValidationContext;

  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  const validDateTime = '2025-01-15T10:30:00Z';

  function validPrincipal(overrides: any = {}): any {
    return {
      principal_type: 'user',
      provider: 'tmi',
      provider_id: 'user-1',
      ...overrides,
    };
  }

  function validAuthorization(overrides: any = {}): any {
    return {
      principal_type: 'user',
      provider: 'tmi',
      provider_id: 'user-1',
      role: 'owner',
      ...overrides,
    };
  }

  function validThreatModel(overrides: any = {}): any {
    return {
      id: validUUID,
      name: 'Test Model',
      created_at: validDateTime,
      modified_at: validDateTime,
      owner: validPrincipal(),
      created_by: validPrincipal(),
      threat_model_framework: 'STRIDE',
      authorization: [validAuthorization()],
      ...overrides,
    };
  }

  function validThreat(overrides: any = {}): any {
    return {
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      threat_model_id: validUUID,
      name: 'Test Threat',
      threat_type: ['Spoofing'],
      severity: 'High',
      created_at: validDateTime,
      modified_at: validDateTime,
      ...overrides,
    };
  }

  function hasError(errors: ValidationError[], code: string): boolean {
    return errors.some(e => e.code === code);
  }

  function hasErrorContaining(errors: ValidationError[], text: string): boolean {
    return errors.some(e => e.message.includes(text));
  }

  beforeEach(() => {
    validator = new SchemaValidator();
    baseContext = {
      object: null,
      currentPath: 'threatModel',
      data: {},
    };
  });

  describe('validateThreatModel — valid models', () => {
    it('should accept a well-formed ThreatModel with no errors', () => {
      const tm = validThreatModel();
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      const schemaErrors = errors.filter(e => e.severity === 'error');
      expect(schemaErrors).toHaveLength(0);
    });

    it('should accept model with all optional fields present', () => {
      const tm = validThreatModel({
        description: 'A description',
        issue_uri: 'https://example.com/issues/1',
        metadata: [{ key: 'k', value: 'v' }],
        documents: [
          {
            id: validUUID,
            name: 'Doc',
            uri: 'https://example.com',
          },
        ],
        diagrams: [
          {
            id: validUUID,
            name: 'Diagram',
            type: 'DFD-1.0.0',
            created_at: validDateTime,
            modified_at: validDateTime,
          },
        ],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      const schemaErrors = errors.filter(e => e.severity === 'error');
      expect(schemaErrors).toHaveLength(0);
    });
  });

  describe('validateThreatModel — null/invalid input', () => {
    it('should reject null input', () => {
      const errors = validator.validateThreatModel(null as any, baseContext);
      expect(hasError(errors, 'INVALID_OBJECT')).toBe(true);
    });

    it('should reject non-object input', () => {
      const errors = validator.validateThreatModel('not-an-object' as any, baseContext);
      expect(hasError(errors, 'INVALID_OBJECT')).toBe(true);
    });
  });

  describe('validateThreatModel — required fields', () => {
    it('should report missing name', () => {
      const tm = validThreatModel({ name: undefined });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasErrorContaining(errors, "'name' is missing")).toBe(true);
    });

    it('should report missing id', () => {
      const tm = validThreatModel({ id: undefined });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasErrorContaining(errors, "'id' is missing")).toBe(true);
    });

    it('should report missing created_at', () => {
      const tm = validThreatModel({ created_at: undefined });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasErrorContaining(errors, "'created_at' is missing")).toBe(true);
    });

    it('should report missing authorization', () => {
      const tm = validThreatModel({ authorization: undefined });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasErrorContaining(errors, "'authorization' is missing")).toBe(true);
    });
  });

  describe('validateThreatModel — type validation', () => {
    it('should reject invalid UUID for id', () => {
      const tm = validThreatModel({ id: 'not-a-uuid' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_TYPE')).toBe(true);
    });

    it('should reject invalid date-time for created_at', () => {
      const tm = validThreatModel({ created_at: 'not-a-date' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_TYPE')).toBe(true);
    });

    it('should reject name exceeding maxLength (256)', () => {
      const tm = validThreatModel({ name: 'A'.repeat(257) });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'MAX_LENGTH_VIOLATION')).toBe(true);
    });
  });

  describe('validateThreatModel — framework enum validation', () => {
    it('should accept valid framework values', () => {
      for (const fw of ['CIA', 'STRIDE', 'LINDDUN', 'DIE', 'PLOT4ai']) {
        const v = new SchemaValidator();
        const tm = validThreatModel({ threat_model_framework: fw });
        const ctx: ValidationContext = { object: tm, currentPath: 'tm', data: {} };
        const errors = v.validateThreatModel(tm, ctx);
        const enumErrors = errors.filter(
          e => e.code === 'INVALID_ENUM_VALUE' && e.path.includes('threat_model_framework'),
        );
        expect(enumErrors).toHaveLength(0);
      }
    });

    it('should reject invalid framework value', () => {
      const tm = validThreatModel({ threat_model_framework: 'CUSTOM' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_ENUM_VALUE')).toBe(true);
    });
  });

  describe('validateThreatModel — conditional framework requirement', () => {
    it('should require framework when threats are present', () => {
      const tm = validThreatModel({
        threat_model_framework: '',
        threats: [validThreat()],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'MISSING_REQUIRED_FIELD')).toBe(true);
      expect(hasErrorContaining(errors, 'threat_model_framework')).toBe(true);
    });

    it('should not require framework when no threats are present', () => {
      const tm = validThreatModel({
        threat_model_framework: undefined,
        threats: [],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      const fwErrors = errors.filter(
        e => e.message.includes('threat_model_framework') && e.code === 'MISSING_REQUIRED_FIELD',
      );
      expect(fwErrors).toHaveLength(0);
    });
  });

  describe('principal validation', () => {
    it('should reject non-object principal', () => {
      const tm = validThreatModel({ owner: 'not-an-object' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('must be a Principal object'))).toBe(true);
    });

    it('should validate principal fields', () => {
      const tm = validThreatModel({
        owner: { principal_type: 'invalid-type', provider: 'tmi' },
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_ENUM_VALUE')).toBe(true);
    });

    it('should require principal_type', () => {
      const tm = validThreatModel({
        owner: { provider: 'tmi', provider_id: 'u1' },
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasErrorContaining(errors, "'principal_type' is missing")).toBe(true);
    });
  });

  describe('authorization array validation', () => {
    it('should reject non-array authorization', () => {
      const tm = validThreatModel({ authorization: 'not-an-array' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('Authorization must be an array'))).toBe(true);
    });

    it('should require at least one owner', () => {
      const tm = validThreatModel({
        authorization: [validAuthorization({ role: 'reader' })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'NO_OWNER')).toBe(true);
    });

    it('should accept authorization with valid owner', () => {
      const tm = validThreatModel();
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'NO_OWNER')).toBe(false);
    });

    it('should validate authorization role enum', () => {
      const tm = validThreatModel({
        authorization: [validAuthorization({ role: 'admin' })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_ENUM_VALUE')).toBe(true);
    });
  });

  describe('metadata validation', () => {
    it('should reject non-array metadata', () => {
      const tm = validThreatModel({ metadata: 'not-an-array' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('Metadata must be an array'))).toBe(true);
    });

    it('should classify duplicate metadata keys as warning (not returned in errors)', () => {
      // DUPLICATE_METADATA_KEYS has severity='warning', so BaseValidator.addError()
      // routes it to this.warnings, not this.errors. validateThreatModel() returns
      // only this.getResults().errors, so duplicates are silently unreported to callers.
      const tm = validThreatModel({
        metadata: [
          { key: 'dup', value: 'v1' },
          { key: 'dup', value: 'v2' },
        ],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.code === 'DUPLICATE_METADATA_KEYS')).toBe(false);
    });

    it('should accept metadata with unique keys', () => {
      const tm = validThreatModel({
        metadata: [
          { key: 'k1', value: 'v1' },
          { key: 'k2', value: 'v2' },
        ],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.code === 'DUPLICATE_METADATA_KEYS')).toBe(false);
    });
  });

  describe('document validation', () => {
    it('should reject non-array documents', () => {
      const tm = validThreatModel({ documents: 'not-an-array' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('Documents must be an array'))).toBe(true);
    });

    it('should validate document required fields', () => {
      const tm = validThreatModel({
        documents: [{ name: 'Doc' }], // missing id and uri
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes("'id' is missing"))).toBe(true);
      expect(errors.some(e => e.message.includes("'uri' is missing"))).toBe(true);
    });

    it('should classify nested document duplicate metadata as warning (not in errors)', () => {
      // Same as top-level: DUPLICATE_METADATA_KEYS is severity='warning',
      // so it is routed to warnings and not returned by validateThreatModel().
      const tm = validThreatModel({
        documents: [
          {
            id: validUUID,
            name: 'Doc',
            uri: 'https://example.com',
            metadata: [
              { key: 'dup', value: 'v1' },
              { key: 'dup', value: 'v2' },
            ],
          },
        ],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.code === 'DUPLICATE_METADATA_KEYS')).toBe(false);
    });
  });

  describe('threat validation', () => {
    it('should reject non-array threats', () => {
      const tm = validThreatModel({ threats: 'not-an-array' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('Threats must be an array'))).toBe(true);
    });

    it('should validate threat required fields', () => {
      const tm = validThreatModel({
        threats: [{ name: 'Threat' }], // missing id, threat_model_id, etc.
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes("'id' is missing"))).toBe(true);
      expect(errors.some(e => e.message.includes("'threat_model_id' is missing"))).toBe(true);
      expect(errors.some(e => e.message.includes("'severity' is missing"))).toBe(true);
    });

    it('should detect threat_model_id mismatch with parent', () => {
      const tm = validThreatModel({
        threats: [validThreat({ threat_model_id: '00000000-0000-0000-0000-000000000099' })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'THREAT_MODEL_ID_MISMATCH')).toBe(true);
    });

    it('should accept matching threat_model_id', () => {
      const tm = validThreatModel({
        threats: [validThreat({ threat_model_id: validUUID })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'THREAT_MODEL_ID_MISMATCH')).toBe(false);
    });
  });

  describe('framework-specific threat type validation', () => {
    it('should accept valid STRIDE threat types', () => {
      const tm = validThreatModel({
        threat_model_framework: 'STRIDE',
        threats: [validThreat({ threat_type: ['Spoofing', 'Tampering'] })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_THREAT_TYPE')).toBe(false);
    });

    it('should reject invalid threat types for STRIDE framework', () => {
      const tm = validThreatModel({
        threat_model_framework: 'STRIDE',
        threats: [validThreat({ threat_type: ['InvalidType'] })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'INVALID_THREAT_TYPE')).toBe(true);
      expect(errors.some(e => e.message.includes('InvalidType'))).toBe(true);
    });

    it('should accept valid CIA threat types', () => {
      const v = new SchemaValidator();
      const tm = validThreatModel({
        threat_model_framework: 'CIA',
        threats: [validThreat({ threat_type: ['Confidentiality', 'Integrity'] })],
      });
      const ctx: ValidationContext = { object: tm, currentPath: 'tm', data: {} };
      const errors = v.validateThreatModel(tm, ctx);
      expect(hasError(errors, 'INVALID_THREAT_TYPE')).toBe(false);
    });

    it('should accept valid LINDDUN threat types', () => {
      const v = new SchemaValidator();
      const tm = validThreatModel({
        threat_model_framework: 'LINDDUN',
        threats: [validThreat({ threat_type: ['Linkability', 'Identifiability'] })],
      });
      const ctx: ValidationContext = { object: tm, currentPath: 'tm', data: {} };
      const errors = v.validateThreatModel(tm, ctx);
      expect(hasError(errors, 'INVALID_THREAT_TYPE')).toBe(false);
    });

    it('should accept valid DIE threat types', () => {
      const v = new SchemaValidator();
      const tm = validThreatModel({
        threat_model_framework: 'DIE',
        threats: [validThreat({ threat_type: ['Distributed', 'Immutable', 'Ephemeral'] })],
      });
      const ctx: ValidationContext = { object: tm, currentPath: 'tm', data: {} };
      const errors = v.validateThreatModel(tm, ctx);
      expect(hasError(errors, 'INVALID_THREAT_TYPE')).toBe(false);
    });

    it('should accept valid PLOT4ai threat types', () => {
      const v = new SchemaValidator();
      const tm = validThreatModel({
        threat_model_framework: 'PLOT4ai',
        threats: [validThreat({ threat_type: ['Privacy', 'Liability', 'Opacity'] })],
      });
      const ctx: ValidationContext = { object: tm, currentPath: 'tm', data: {} };
      const errors = v.validateThreatModel(tm, ctx);
      expect(hasError(errors, 'INVALID_THREAT_TYPE')).toBe(false);
    });

    it('should reject non-array threat_type', () => {
      const tm = validThreatModel({
        threat_model_framework: 'STRIDE',
        threats: [validThreat({ threat_type: 'Spoofing' })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('Threat type must be an array'))).toBe(true);
    });

    it('should reject threat_type array exceeding 20 items', () => {
      const longTypes = Array.from({ length: 21 }, () => 'Spoofing');
      const tm = validThreatModel({
        threat_model_framework: 'STRIDE',
        threats: [validThreat({ threat_type: longTypes })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(hasError(errors, 'ARRAY_TOO_LONG')).toBe(true);
    });

    it('should classify duplicate threat_type values as warning (not in errors)', () => {
      // DUPLICATE_VALUES has severity='warning', routed to warnings bucket
      const tm = validThreatModel({
        threat_model_framework: 'STRIDE',
        threats: [validThreat({ threat_type: ['Spoofing', 'Spoofing'] })],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.code === 'DUPLICATE_VALUES')).toBe(false);
    });
  });

  describe('diagram array validation', () => {
    it('should reject non-array diagrams', () => {
      const tm = validThreatModel({ diagrams: 'not-an-array' });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes('Diagrams must be an array'))).toBe(true);
    });

    it('should validate diagram required fields', () => {
      const tm = validThreatModel({
        diagrams: [{ name: 'Diagram' }], // missing id, type, dates
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      expect(errors.some(e => e.message.includes("'id' is missing"))).toBe(true);
      expect(errors.some(e => e.message.includes("'type' is missing"))).toBe(true);
    });

    it('should accept valid diagram', () => {
      const tm = validThreatModel({
        diagrams: [
          {
            id: validUUID,
            name: 'My Diagram',
            type: 'DFD-1.0.0',
            created_at: validDateTime,
            modified_at: validDateTime,
          },
        ],
      });
      baseContext.object = tm;
      const errors = validator.validateThreatModel(tm, baseContext);
      const diagramErrors = errors.filter(
        e => e.path.includes('diagrams') && e.severity === 'error',
      );
      expect(diagramErrors).toHaveLength(0);
    });
  });
});
