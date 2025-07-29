// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { ThreatModelValidatorService } from './threat-model-validator.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ValidationConfig } from './types';

// Mock interfaces for type safety
interface MockLoggerService {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

describe('ThreatModelValidatorService', () => {
  let service: ThreatModelValidatorService;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Create mock for LoggerService
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create the service directly with mocked dependencies
    service = new ThreatModelValidatorService(mockLogger as unknown as LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('validate', () => {
    it('should validate a valid threat model', () => {
      const validThreatModel = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Threat Model',
        description: 'A test threat model',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        owner: 'test@example.com',
        created_by: 'test@example.com',
        threat_model_framework: 'STRIDE',
        authorization: [{ subject: 'test@example.com', role: 'owner' }],
        metadata: [],
        documents: [],
        diagrams: [],
        threats: [],
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
        // Missing required fields
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
        owner: 'test@example.com',
        created_by: 'test@example.com',
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
        owner: 'test@example.com',
        created_by: 'test@example.com',
        threat_model_framework: 'STRIDE',
        authorization: [{ subject: 'test@example.com', role: 'owner' }],
        diagrams: [
          {
            id: 'diagram-1',
            name: 'Test Diagram',
            type: 'DFD-1.0.0',
            created_at: '2025-01-01T00:00:00Z',
            modified_at: '2025-01-01T00:00:00Z',
            cells: [{ id: 'cell-1', vertex: true, value: 'Process' }],
          },
        ],
        threats: [
          {
            id: 'threat-1',
            threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Threat',
            threat_type: 'Tampering',
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

    it('should validate diagram cells', () => {
      const threatModelWithInvalidDiagram = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Threat Model',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        owner: 'test@example.com',
        created_by: 'test@example.com',
        threat_model_framework: 'STRIDE',
        authorization: [{ subject: 'test@example.com', role: 'owner' }],
        diagrams: [
          {
            id: 'diagram-1',
            name: 'Test Diagram',
            type: 'DFD-1.0.0',
            created_at: '2025-01-01T00:00:00Z',
            modified_at: '2025-01-01T00:00:00Z',
            cells: [
              { id: 'cell-1', vertex: true, edge: true }, // Invalid: both vertex and edge
              { id: 'cell-2', edge: true, source: 'cell-1', target: 'non-existent-cell' }, // Invalid target
              { vertex: true, value: 'Process' }, // Missing ID
            ],
          },
        ],
        threats: [],
      };

      const result = service.validate(threatModelWithInvalidDiagram);

      expect(result.valid).toBe(false);
      const diagramErrors = result.errors.filter(
        e => e.code.includes('CELL') || e.code.includes('EDGE'),
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

    it('should handle validation exceptions gracefully', () => {
      // Create a malformed object that might cause validation to throw
      const malformedObject = {
        get id() {
          throw new Error('Getter error');
        },
        name: 'Test',
      };

      const result = service.validate(malformedObject);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const exceptionError = result.errors.find(e => e.code === 'VALIDATION_EXCEPTION');
      expect(exceptionError).toBeDefined();
    });
  });

  describe('validateSchema', () => {
    it('should perform schema-only validation', () => {
      const threatModel = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Threat Model',
        created_at: '2025-01-01T00:00:00Z',
        modified_at: '2025-01-01T00:00:00Z',
        owner: 'test@example.com',
        created_by: 'test@example.com',
        threat_model_framework: 'STRIDE',
        authorization: [{ subject: 'test@example.com', role: 'owner' }],
        metadata: [],
        documents: [],
        threats: [],
        diagrams: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Test Diagram',
            type: 'UNSUPPORTED-TYPE', // This would fail diagram validation but not schema
            created_at: '2025-01-01T00:00:00Z',
            modified_at: '2025-01-01T00:00:00Z',
          },
        ],
      };

      const result = service.validateSchema(threatModel);

      expect(result.valid).toBe(true); // Schema validation should pass
    });
  });

  describe('validateReferences', () => {
    it('should perform reference-only validation', () => {
      const threatModel = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Threat Model',
        authorization: [{ subject: 'test@example.com', role: 'owner' }],
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
  });

  describe('diagram type support', () => {
    it('should list supported diagram types', () => {
      const supportedTypes = service.getSupportedDiagramTypes();

      expect(supportedTypes).toContain('DFD-1.0.0');
      expect(Array.isArray(supportedTypes)).toBe(true);
    });

    it('should allow registering custom diagram validators', () => {
      const customValidator = {
        diagramType: 'CUSTOM-1.0.0',
        versionPattern: /^CUSTOM-1\.0\.\d+$/,
        validate: vi.fn().mockReturnValue([]),
        validateCells: vi.fn().mockReturnValue([]),
      };

      service.registerDiagramValidator(customValidator);

      const supportedTypes = service.getSupportedDiagramTypes();
      expect(supportedTypes).toContain('CUSTOM-1.0.0');
    });
  });

  describe('validation result structure', () => {
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
  });
});
