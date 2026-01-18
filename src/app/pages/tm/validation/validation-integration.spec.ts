/**
 * Integration tests for the ThreatModel validation system
 * Tests the validation functionality without Angular TestBed
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ThreatModelValidatorService } from './threat-model-validator.service';
import { ValidationConfig } from './types';
import { createMockLoggerService } from '../../../../testing/mocks/mock-logger.service';

// Helper to create Principal objects for test fixtures
const createTestPrincipal = (
  email: string,
  type: 'user' | 'group' = 'user',
): {
  principal_type: 'user' | 'group';
  provider: string;
  provider_id: string;
  email: string;
  display_name: string;
} => ({
  principal_type: type,
  provider: 'test',
  provider_id: email,
  email,
  display_name: email.split('@')[0],
});

// Helper to create Authorization objects for test fixtures
const createTestAuthorization = (
  email: string,
  role: 'owner' | 'writer' | 'reader',
  type: 'user' | 'group' = 'user',
): {
  principal_type: 'user' | 'group';
  provider: string;
  provider_id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'writer' | 'reader';
} => ({
  principal_type: type,
  provider: 'test',
  provider_id: email,
  email,
  display_name: email.split('@')[0],
  role,
});

describe('ThreatModel Validation Integration', () => {
  let service: ThreatModelValidatorService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLoggerService();

    service = new ThreatModelValidatorService(mockLogger);
  });

  it('should validate a minimal valid threat model', () => {
    const validThreatModel = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model',
      created_at: '2025-01-01T00:00:00Z',
      modified_at: '2025-01-01T00:00:00Z',
      owner: createTestPrincipal('test@example.com'),
      created_by: createTestPrincipal('test@example.com'),
      threat_model_framework: 'STRIDE',
      authorization: [createTestAuthorization('test@example.com', 'owner')],
    };

    const result = service.validate(validThreatModel);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metadata.timestamp).toBeDefined();
    expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
  });

  it('should detect missing required fields', () => {
    const invalidThreatModel = {
      name: 'Test Threat Model',
      // Missing required fields: id, created_at, modified_at, owner, created_by, threat_model_framework, authorization
    };

    const result = service.validate(invalidThreatModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const requiredFieldErrors = result.errors.filter(e => e.code === 'FIELD_REQUIRED');
    expect(requiredFieldErrors.length).toBeGreaterThan(0);
  });

  it('should detect invalid field types', () => {
    const invalidThreatModel = {
      id: 'not-a-uuid',
      name: 123, // Should be string
      created_at: 'invalid-date',
      modified_at: '2025-01-01T00:00:00Z',
      owner: createTestPrincipal('test@example.com'),
      created_by: createTestPrincipal('test@example.com'),
      threat_model_framework: 'INVALID_FRAMEWORK',
      authorization: 'not-an-array',
    };

    const result = service.validate(invalidThreatModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const typeErrors = result.errors.filter(
      e => e.code === 'INVALID_TYPE' || e.code === 'INVALID_ENUM_VALUE',
    );
    expect(typeErrors.length).toBeGreaterThan(0);
  });

  it('should validate diagram references in threats', () => {
    const threatModelWithInvalidReferences = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model',
      created_at: '2025-01-01T00:00:00Z',
      modified_at: '2025-01-01T00:00:00Z',
      owner: createTestPrincipal('test@example.com'),
      created_by: createTestPrincipal('test@example.com'),
      threat_model_framework: 'STRIDE',
      authorization: [createTestAuthorization('test@example.com', 'owner')],
      diagrams: [
        {
          id: 'diagram-1',
          name: 'Test Diagram',
          type: 'DFD-1.0.0',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          cells: [{ id: 'cell-1', shape: 'process', x: 100, y: 100, width: 120, height: 60 }],
        },
      ],
      threats: [
        {
          id: 'threat-1',
          threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Threat',
          threat_type: ['Tampering'],
          severity: 'High',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          diagram_id: 'non-existent-diagram',
          cell_id: 'non-existent-cell',
        },
      ],
    };

    const result = service.validate(threatModelWithInvalidReferences);

    expect(result.valid).toBe(false);
    const referenceErrors = result.errors.filter(
      e => e.code === 'INVALID_DIAGRAM_REFERENCE' || e.code === 'INVALID_CELL_REFERENCE',
    );
    expect(referenceErrors.length).toBeGreaterThan(0);
  });

  it('should validate DFD diagram cells', () => {
    const threatModelWithInvalidDiagram = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model',
      created_at: '2025-01-01T00:00:00Z',
      modified_at: '2025-01-01T00:00:00Z',
      owner: createTestPrincipal('test@example.com'),
      created_by: createTestPrincipal('test@example.com'),
      threat_model_framework: 'STRIDE',
      authorization: [createTestAuthorization('test@example.com', 'owner')],
      diagrams: [
        {
          id: 'diagram-1',
          name: 'Test Diagram',
          type: 'DFD-1.0.0',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          cells: [
            { id: 'cell-1', shape: 'invalid-shape', x: 100, y: 100, width: 120, height: 60 }, // Invalid: unknown shape
            {
              id: 'cell-2',
              shape: 'edge',
              source: { cell: 'cell-1' },
              target: { cell: 'non-existent-cell' },
            }, // Invalid target
            { shape: 'process', x: 100, y: 100, width: 120, height: 60 }, // Missing ID
          ],
        },
      ],
      threats: [],
    };

    const result = service.validate(threatModelWithInvalidDiagram);

    expect(result.valid).toBe(false);
    const diagramErrors = result.errors.filter(
      e => e.code.includes('CELL') || e.code.includes('EDGE') || e.code === 'AMBIGUOUS_CELL_TYPE',
    );
    expect(diagramErrors.length).toBeGreaterThan(0);
  });

  it('should respect validation configuration', () => {
    const invalidThreatModel = {
      name: 'Test',
      // Missing many required fields
    };

    const config: Partial<ValidationConfig> = {
      failFast: true,
      maxErrors: 2,
      includeWarnings: false,
    };

    const result = service.validate(invalidThreatModel, config);

    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(0); // Warnings excluded
  });

  it('should perform schema-only validation', () => {
    const threatModel = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model',
      created_at: '2025-01-01T00:00:00Z',
      modified_at: '2025-01-01T00:00:00Z',
      owner: createTestPrincipal('test@example.com'),
      created_by: createTestPrincipal('test@example.com'),
      threat_model_framework: 'STRIDE',
      authorization: [createTestAuthorization('test@example.com', 'owner')],
      diagrams: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Diagram',
          type: 'UNSUPPORTED-TYPE', // This would fail diagram validation but not schema
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const result = service.validateSchema(threatModel);

    if (!result.valid) {
      console.error('Schema validation errors:', result.errors);
    }
    expect(result.valid).toBe(true); // Schema validation should pass
  });

  it('should perform reference-only validation', () => {
    const threatModel = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model',
      authorization: [createTestAuthorization('test@example.com', 'owner')],
      diagrams: [
        {
          id: 'diagram-1',
          name: 'Test Diagram',
        },
      ],
      threats: [
        {
          id: 'threat-1',
          threat_model_id: 'wrong-id', // Reference error
          diagram_id: 'diagram-1',
        },
      ],
    };

    const result = service.validateReferences(threatModel);

    expect(result.valid).toBe(false);
    const referenceError = result.errors.find(e => e.code === 'INVALID_THREAT_MODEL_REFERENCE');
    expect(referenceError).toBeDefined();
  });

  it('should list supported diagram types', () => {
    const supportedTypes = service.getSupportedDiagramTypes();

    expect(supportedTypes).toContain('DFD-1.0.0');
    expect(Array.isArray(supportedTypes)).toBe(true);
  });

  it('should return properly structured validation results', () => {
    const result = service.validate({});

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('metadata');

    expect(result.metadata).toHaveProperty('timestamp');
    expect(result.metadata).toHaveProperty('validatorVersion');
    expect(result.metadata).toHaveProperty('duration');

    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should include proper error context', () => {
    const invalidThreatModel = {
      id: 'invalid-uuid',
      name: 'Test',
    };

    const result = service.validate(invalidThreatModel);

    expect(result.errors.length).toBeGreaterThan(0);

    const uuidError = result.errors.find(e => e.code === 'INVALID_TYPE');
    expect(uuidError).toBeDefined();
    expect(uuidError?.path).toBeDefined();
    expect(uuidError?.context).toBeDefined();
  });

  it('should validate complex threat model with all components', () => {
    const complexThreatModel = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Complex Threat Model',
      description: 'A comprehensive threat model for testing',
      created_at: '2025-01-01T00:00:00Z',
      modified_at: '2025-01-02T00:00:00Z',
      owner: createTestPrincipal('owner@example.com'),
      created_by: createTestPrincipal('creator@example.com'),
      threat_model_framework: 'STRIDE',
      issue_uri: 'https://example.com/issues/123',
      authorization: [
        createTestAuthorization('owner@example.com', 'owner'),
        createTestAuthorization('user@example.com', 'writer'),
      ],
      metadata: [
        { key: 'version', value: '1.0' },
        { key: 'status', value: 'active' },
      ],
      documents: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Architecture Document',
          uri: 'https://example.com/docs/arch.pdf',
          description: 'System architecture documentation',
          metadata: [{ key: 'type', value: 'architecture' }],
        },
      ],
      diagrams: [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'System Flow',
          type: 'DFD-1.0.0',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          cells: [
            {
              id: '123e4567-e89b-12d3-a456-426614174010',
              shape: 'process',
              position: { x: 100, y: 100 },
              size: { width: 120, height: 60 },
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174011',
              shape: 'store',
              position: { x: 300, y: 100 },
              size: { width: 100, height: 60 },
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174012',
              shape: 'edge',
              source: { cell: '123e4567-e89b-12d3-a456-426614174010' },
              target: { cell: '123e4567-e89b-12d3-a456-426614174011' },
            },
          ],
        },
      ],
      threats: [
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'SQL Injection',
          description: 'Malicious SQL queries through input validation bypass',
          threat_type: ['Tampering'],
          severity: 'High',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          diagram_id: '123e4567-e89b-12d3-a456-426614174002',
          cell_id: '123e4567-e89b-12d3-a456-426614174010',
          score: 8.5,
          priority: 'Critical',
          mitigated: false,
          status: 'Open',
          metadata: [{ key: 'CVSS', value: '8.5' }],
        },
      ],
    };

    const result = service.validate(complexThreatModel);

    if (!result.valid) {
      console.error('Complex threat model validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(mockLogger.debugComponent).toHaveBeenCalled();
  });
});
