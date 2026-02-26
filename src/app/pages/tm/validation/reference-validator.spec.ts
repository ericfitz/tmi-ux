/**
 * Tests for InternalReferenceValidator
 *
 * Covers: threat→diagram references, threat→cell references,
 * orphaned threats, cross-references (owner in authorization),
 * metadata reference validation, and invalid input handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { InternalReferenceValidator } from './reference-validator';
import { ValidationContext, ValidationError } from './types';

describe('InternalReferenceValidator', () => {
  let validator: InternalReferenceValidator;
  let baseContext: ValidationContext;

  const tmId = '550e8400-e29b-41d4-a716-446655440000';
  const diagramId = '123e4567-e89b-12d3-a456-426614174000';
  const diagramId2 = '123e4567-e89b-12d3-a456-426614174001';
  const cellId = '00000000-0000-0000-0000-000000000001';
  const cellId2 = '00000000-0000-0000-0000-000000000002';
  const threatId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const validDateTime = '2025-01-15T10:30:00Z';

  function validPrincipal(overrides: any = {}): any {
    return {
      principal_type: 'user',
      provider: 'tmi',
      provider_id: 'user-1',
      ...overrides,
    };
  }

  function validThreatModel(overrides: any = {}): any {
    return {
      id: tmId,
      name: 'Test Model',
      created_at: validDateTime,
      modified_at: validDateTime,
      owner: validPrincipal(),
      created_by: validPrincipal(),
      threat_model_framework: 'STRIDE',
      authorization: [
        {
          principal_type: 'user',
          provider: 'tmi',
          provider_id: 'user-1',
          role: 'owner',
        },
      ],
      diagrams: [
        {
          id: diagramId,
          name: 'Diagram 1',
          type: 'DFD-1.0.0',
          cells: [{ id: cellId }, { id: cellId2 }],
        },
      ],
      threats: [],
      documents: [],
      ...overrides,
    };
  }

  function validThreat(overrides: any = {}): any {
    return {
      id: threatId,
      threat_model_id: tmId,
      name: 'Test Threat',
      threat_type: ['Spoofing'],
      severity: 'High',
      created_at: validDateTime,
      modified_at: validDateTime,
      diagram_id: diagramId,
      cell_id: cellId,
      ...overrides,
    };
  }

  function hasError(errors: ValidationError[], code: string): boolean {
    return errors.some(e => e.code === code);
  }

  beforeEach(() => {
    validator = new InternalReferenceValidator();
    baseContext = {
      object: null,
      currentPath: 'threatModel',
      data: {},
    };
  });

  describe('validateReferences — invalid input', () => {
    it('should reject null threat model', () => {
      const errors = validator.validateReferences(null as any, baseContext);
      expect(hasError(errors, 'INVALID_THREAT_MODEL')).toBe(true);
    });

    it('should reject non-object threat model', () => {
      const errors = validator.validateReferences('string' as any, baseContext);
      expect(hasError(errors, 'INVALID_THREAT_MODEL')).toBe(true);
    });
  });

  describe('validateReferences — valid model', () => {
    it('should accept a well-formed model with consistent references', () => {
      const tm = validThreatModel({
        threats: [validThreat()],
      });
      const errors = validator.validateReferences(tm, baseContext);
      const hardErrors = errors.filter(e => e.severity === 'error');
      expect(hardErrors).toHaveLength(0);
    });

    it('should accept model with no threats', () => {
      const tm = validThreatModel({ threats: [] });
      const errors = validator.validateReferences(tm, baseContext);
      const hardErrors = errors.filter(e => e.severity === 'error');
      expect(hardErrors).toHaveLength(0);
    });

    it('should accept model with no diagrams and no threats', () => {
      const tm = validThreatModel({ diagrams: [], threats: [] });
      const errors = validator.validateReferences(tm, baseContext);
      const hardErrors = errors.filter(e => e.severity === 'error');
      expect(hardErrors).toHaveLength(0);
    });
  });

  describe('threat → diagram references', () => {
    it('should report threat referencing nonexistent diagram', () => {
      const tm = validThreatModel({
        threats: [validThreat({ diagram_id: '00000000-0000-0000-0000-000000000099' })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_DIAGRAM_REFERENCE')).toBe(true);
    });

    it('should accept threat referencing existing diagram', () => {
      const tm = validThreatModel({
        threats: [validThreat({ diagram_id: diagramId })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_DIAGRAM_REFERENCE')).toBe(false);
    });

    it('should accept threat with no diagram_id', () => {
      const tm = validThreatModel({
        diagrams: [], // no diagrams → no orphan warning
        threats: [validThreat({ diagram_id: undefined, cell_id: undefined })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_DIAGRAM_REFERENCE')).toBe(false);
    });
  });

  describe('threat → cell references', () => {
    it('should report threat referencing nonexistent cell in existing diagram', () => {
      const tm = validThreatModel({
        threats: [validThreat({ diagram_id: diagramId, cell_id: 'nonexistent-cell' })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_CELL_REFERENCE')).toBe(true);
    });

    it('should accept threat referencing existing cell in existing diagram', () => {
      const tm = validThreatModel({
        threats: [validThreat({ diagram_id: diagramId, cell_id: cellId })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_CELL_REFERENCE')).toBe(false);
    });

    it('should classify cell_id without diagram_id as warning (not in returned errors)', () => {
      // ORPHANED_CELL_REFERENCE has severity='warning', so BaseValidator routes
      // it to this.warnings. validateReferences() returns only this.getResults().errors.
      const tm = validThreatModel({
        threats: [validThreat({ diagram_id: undefined, cell_id: cellId })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'ORPHANED_CELL_REFERENCE')).toBe(false);
    });
  });

  describe('threat_model_id mismatch', () => {
    it('should report threat_model_id mismatch', () => {
      const tm = validThreatModel({
        threats: [validThreat({ threat_model_id: '00000000-0000-0000-0000-000000000099' })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_THREAT_MODEL_REFERENCE')).toBe(true);
    });

    it('should accept matching threat_model_id', () => {
      const tm = validThreatModel({
        threats: [validThreat({ threat_model_id: tmId })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_THREAT_MODEL_REFERENCE')).toBe(false);
    });
  });

  describe('cross-references — owner in authorization', () => {
    it('should never fire OWNER_NOT_IN_AUTHORIZATION (buildReferenceMap adds owner to userIds)', () => {
      // BUG DOCUMENTATION: buildReferenceMap() always adds owner's composite key
      // to referenceMap.userIds (line 112), then validateCrossReferences() checks
      // if ownerCompositeKey is in userIds — it always is, making this warning
      // impossible to trigger. The check is dead code.
      const tm = validThreatModel({
        owner: validPrincipal({ provider: 'external', provider_id: 'ext-user' }),
        authorization: [
          {
            principal_type: 'user',
            provider: 'tmi',
            provider_id: 'user-1',
            role: 'owner',
          },
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      // The warning can never fire because owner is always in userIds
      expect(hasError(errors, 'OWNER_NOT_IN_AUTHORIZATION')).toBe(false);
    });

    it('should not warn when owner is in authorization list', () => {
      const tm = validThreatModel({
        owner: validPrincipal(),
        authorization: [
          {
            principal_type: 'user',
            provider: 'tmi',
            provider_id: 'user-1',
            role: 'owner',
          },
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'OWNER_NOT_IN_AUTHORIZATION')).toBe(false);
    });
  });

  describe('cross-references — creator in authorization', () => {
    it('should never fire CREATOR_NOT_IN_AUTHORIZATION (buildReferenceMap adds created_by to userIds)', () => {
      // BUG DOCUMENTATION: Same as owner — buildReferenceMap() always adds
      // created_by's composite key to referenceMap.userIds (line 115-117),
      // making the CREATOR_NOT_IN_AUTHORIZATION check dead code.
      const tm = validThreatModel({
        created_by: validPrincipal({ provider: 'old-provider', provider_id: 'old-user' }),
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'CREATOR_NOT_IN_AUTHORIZATION')).toBe(false);
    });

    it('should not emit info when creator is in authorization', () => {
      const tm = validThreatModel({
        created_by: validPrincipal(),
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'CREATOR_NOT_IN_AUTHORIZATION')).toBe(false);
    });
  });

  describe('orphaned threats', () => {
    it('should report orphaned threats when diagrams exist but threats have no diagram_id', () => {
      const tm = validThreatModel({
        diagrams: [{ id: diagramId, name: 'D1', type: 'DFD', cells: [] }],
        threats: [validThreat({ diagram_id: undefined, cell_id: undefined })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'ORPHANED_THREATS')).toBe(true);
    });

    it('should not report orphaned threats when no diagrams exist', () => {
      const tm = validThreatModel({
        diagrams: [],
        threats: [validThreat({ diagram_id: undefined, cell_id: undefined })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'ORPHANED_THREATS')).toBe(false);
    });

    it('should not report orphaned threats when all threats reference diagrams', () => {
      const tm = validThreatModel({
        threats: [validThreat({ diagram_id: diagramId })],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'ORPHANED_THREATS')).toBe(false);
    });
  });

  describe('metadata reference validation', () => {
    it('should detect metadata with UUID value referencing threat key that does not match any threat', () => {
      const tm = validThreatModel({
        documents: [
          {
            id: diagramId,
            name: 'Doc',
            uri: 'https://example.com',
            metadata: [
              {
                key: 'related_threat',
                value: '00000000-0000-0000-0000-000000000099',
              },
            ],
          },
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'POTENTIAL_INVALID_THREAT_REFERENCE')).toBe(true);
    });

    it('should not flag metadata with non-UUID values', () => {
      const tm = validThreatModel({
        documents: [
          {
            id: diagramId,
            name: 'Doc',
            uri: 'https://example.com',
            metadata: [{ key: 'threat_notes', value: 'some plain text' }],
          },
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'POTENTIAL_INVALID_THREAT_REFERENCE')).toBe(false);
    });

    it('should not flag metadata UUID when it matches an existing threat', () => {
      const tm = validThreatModel({
        threats: [validThreat()],
        documents: [
          {
            id: diagramId,
            name: 'Doc',
            uri: 'https://example.com',
            metadata: [{ key: 'related_threat', value: threatId }],
          },
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'POTENTIAL_INVALID_THREAT_REFERENCE')).toBe(false);
    });
  });

  describe('multiple diagrams and threats', () => {
    it('should validate threats against correct diagram cell sets', () => {
      const tm = validThreatModel({
        diagrams: [
          {
            id: diagramId,
            name: 'D1',
            type: 'DFD',
            cells: [{ id: cellId }],
          },
          {
            id: diagramId2,
            name: 'D2',
            type: 'DFD',
            cells: [{ id: cellId2 }],
          },
        ],
        threats: [
          validThreat({ id: threatId, diagram_id: diagramId, cell_id: cellId }),
          validThreat({
            id: '6ba7b810-9dad-11d1-80b4-00c04fd430c9',
            diagram_id: diagramId2,
            cell_id: cellId2,
          }),
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_CELL_REFERENCE')).toBe(false);
    });

    it('should catch cell referenced from wrong diagram', () => {
      const tm = validThreatModel({
        diagrams: [
          {
            id: diagramId,
            name: 'D1',
            type: 'DFD',
            cells: [{ id: cellId }],
          },
          {
            id: diagramId2,
            name: 'D2',
            type: 'DFD',
            cells: [{ id: cellId2 }],
          },
        ],
        threats: [
          // cellId belongs to diagramId, but threat references diagramId2
          validThreat({ diagram_id: diagramId2, cell_id: cellId }),
        ],
      });
      const errors = validator.validateReferences(tm, baseContext);
      expect(hasError(errors, 'INVALID_CELL_REFERENCE')).toBe(true);
    });
  });
});
