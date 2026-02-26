/**
 * Tests for DfdDiagramValidator and DiagramValidatorFactory
 *
 * Covers: cell shape validation, node position/size validation,
 * edge source/target validation, cell relationship checks,
 * duplicate IDs, dangling references, self-referencing edges,
 * and the factory pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { DfdDiagramValidator, DiagramValidatorFactory } from './diagram-validators';
import { ValidationContext, ValidationError } from './types';
import { Diagram, Cell } from '../models/diagram.model';

describe('DfdDiagramValidator', () => {
  let validator: DfdDiagramValidator;
  let baseContext: ValidationContext;

  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  const validUUID2 = '550e8400-e29b-41d4-a716-446655440001';
  const validUUID3 = '550e8400-e29b-41d4-a716-446655440002';
  const validDateTime = '2025-01-15T10:30:00Z';

  function validDiagram(overrides: Partial<Diagram> = {}): Diagram {
    return {
      id: validUUID,
      name: 'Test Diagram',
      type: 'DFD-1.0.0',
      created_at: validDateTime,
      modified_at: validDateTime,
      ...overrides,
    };
  }

  function validNodeCell(id: string, overrides: Partial<Cell> = {}): Cell {
    return {
      id,
      shape: 'process',
      position: { x: 100, y: 200 },
      size: { width: 120, height: 60 },
      ...overrides,
    };
  }

  function validEdgeCell(
    id: string,
    source: string,
    target: string,
    overrides: Partial<Cell> = {},
  ): Cell {
    return {
      id,
      shape: 'edge',
      source,
      target,
      ...overrides,
    };
  }

  function hasError(errors: ValidationError[], code: string): boolean {
    return errors.some(e => e.code === code);
  }

  beforeEach(() => {
    validator = new DfdDiagramValidator();
    baseContext = {
      object: null,
      currentPath: 'diagram',
      data: {},
    };
  });

  describe('validate — diagram type support', () => {
    it('should accept DFD-1.0.0 type', () => {
      const diagram = validDiagram({ type: 'DFD-1.0.0' });
      const errors = validator.validate(diagram, baseContext);
      expect(hasError(errors, 'UNSUPPORTED_DIAGRAM_TYPE')).toBe(false);
    });

    it('should accept DFD-1.0.1 type (minor version)', () => {
      const diagram = validDiagram({ type: 'DFD-1.0.1' });
      const errors = validator.validate(diagram, baseContext);
      expect(hasError(errors, 'UNSUPPORTED_DIAGRAM_TYPE')).toBe(false);
    });

    it('should reject unsupported diagram type', () => {
      const diagram = validDiagram({ type: 'FLOW-2.0.0' });
      const errors = validator.validate(diagram, baseContext);
      expect(hasError(errors, 'UNSUPPORTED_DIAGRAM_TYPE')).toBe(true);
    });

    it('should reject null diagram', () => {
      const errors = validator.validate(null as any, baseContext);
      expect(hasError(errors, 'INVALID_DIAGRAM')).toBe(true);
    });

    it('should reject diagram with missing type', () => {
      const diagram = validDiagram({ type: '' });
      const errors = validator.validate(diagram, baseContext);
      expect(hasError(errors, 'UNSUPPORTED_DIAGRAM_TYPE')).toBe(true);
    });
  });

  describe('validateCells — cell shape validation', () => {
    it('should accept all valid node shapes', () => {
      const validShapes = ['actor', 'process', 'store', 'security-boundary', 'text-box'];
      for (const shape of validShapes) {
        const v = new DfdDiagramValidator();
        const cells: Cell[] = [validNodeCell(validUUID, { shape })];
        const errors = v.validateCells(cells, baseContext);
        const shapeErrors = errors.filter(e => e.code === 'INVALID_CELL_TYPE');
        expect(shapeErrors).toHaveLength(0);
      }
    });

    it('should accept edge shape', () => {
      const node1 = validNodeCell(validUUID);
      const node2 = validNodeCell(validUUID2);
      const edge = validEdgeCell(validUUID3, validUUID, validUUID2);
      const errors = validator.validateCells([node1, node2, edge], baseContext);
      expect(hasError(errors, 'INVALID_CELL_TYPE')).toBe(false);
    });

    it('should reject invalid cell shape', () => {
      const cell: Cell = { id: validUUID, shape: 'hexagon' };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'INVALID_CELL_TYPE')).toBe(true);
    });

    it('should reject cell without shape', () => {
      const cell = { id: validUUID } as Cell;
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_SHAPE')).toBe(true);
    });

    it('should reject null cell', () => {
      const errors = validator.validateCells([null as any], baseContext);
      expect(hasError(errors, 'INVALID_CELL')).toBe(true);
    });

    it('should reject non-array cells', () => {
      const errors = validator.validateCells('not-an-array' as any, baseContext);
      expect(hasError(errors, 'INVALID_CELLS')).toBe(true);
    });
  });

  describe('validateCells — cell ID validation', () => {
    it('should accept valid UUID cell id', () => {
      const cell = validNodeCell(validUUID);
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_CELL_ID')).toBe(false);
      expect(hasError(errors, 'INVALID_CELL_ID')).toBe(false);
    });

    it('should reject missing cell id', () => {
      const cell = {
        shape: 'process',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 30 },
      } as Cell;
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_CELL_ID')).toBe(true);
    });

    it('should reject non-UUID cell id', () => {
      const cell = validNodeCell('not-a-uuid');
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'INVALID_CELL_ID')).toBe(true);
    });
  });

  describe('validateCells — node position validation', () => {
    it('should accept nested position format', () => {
      const cell = validNodeCell(validUUID, { position: { x: 50, y: 100 } });
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_POSITION')).toBe(false);
      expect(hasError(errors, 'INVALID_POSITION')).toBe(false);
    });

    it('should accept flat position format (x, y properties)', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'process',
        x: 50,
        y: 100,
        size: { width: 120, height: 60 },
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_POSITION')).toBe(false);
    });

    it('should reject node without any position', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'process',
        size: { width: 120, height: 60 },
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_POSITION')).toBe(true);
    });

    it('should reject nested position with non-numeric coordinates', () => {
      const cell = validNodeCell(validUUID, {
        position: { x: 'abc' as any, y: 100 },
      });
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'INVALID_POSITION')).toBe(true);
    });
  });

  describe('validateCells — node size validation', () => {
    it('should accept nested size format', () => {
      const cell = validNodeCell(validUUID, { size: { width: 100, height: 80 } });
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_SIZE')).toBe(false);
    });

    it('should accept flat size format (width, height properties)', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'process',
        position: { x: 0, y: 0 },
        width: 100,
        height: 80,
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_SIZE')).toBe(false);
    });

    it('should reject node without any size', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'process',
        position: { x: 0, y: 0 },
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_SIZE')).toBe(true);
    });

    it('should reject size below minimum dimensions', () => {
      const cell = validNodeCell(validUUID, { size: { width: 20, height: 20 } });
      const errors = validator.validateCells([cell], baseContext);
      expect(errors.some(e => e.code === 'INVALID_DIMENSIONS' && e.severity === 'error')).toBe(
        true,
      );
    });

    it('should warn on zero-dimension size', () => {
      const cell = validNodeCell(validUUID, { size: { width: 0, height: 0 } });
      const errors = validator.validateCells([cell], baseContext);
      expect(errors.some(e => e.code === 'INVALID_DIMENSIONS' && e.severity === 'warning')).toBe(
        true,
      );
    });

    it('should reject nested size with non-numeric dimensions', () => {
      const cell = validNodeCell(validUUID, {
        size: { width: 'big' as any, height: 60 },
      });
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'INVALID_SIZE')).toBe(true);
    });
  });

  describe('validateCells — edge validation', () => {
    it('should accept edge with string source and target', () => {
      const node1 = validNodeCell(validUUID);
      const node2 = validNodeCell(validUUID2);
      const edge = validEdgeCell(validUUID3, validUUID, validUUID2);
      const errors = validator.validateCells([node1, node2, edge], baseContext);
      expect(hasError(errors, 'MISSING_EDGE_SOURCE')).toBe(false);
      expect(hasError(errors, 'MISSING_EDGE_TARGET')).toBe(false);
    });

    it('should accept edge with object source and target', () => {
      const node1 = validNodeCell(validUUID);
      const node2 = validNodeCell(validUUID2);
      const edge: Cell = {
        id: validUUID3,
        shape: 'edge',
        source: { cell: validUUID },
        target: { cell: validUUID2 },
      };
      const errors = validator.validateCells([node1, node2, edge], baseContext);
      expect(hasError(errors, 'INVALID_EDGE_SOURCE')).toBe(false);
      expect(hasError(errors, 'INVALID_EDGE_TARGET')).toBe(false);
    });

    it('should reject edge without source', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'edge',
        target: validUUID2,
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_EDGE_SOURCE')).toBe(true);
    });

    it('should reject edge without target', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'edge',
        source: validUUID2,
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'MISSING_EDGE_TARGET')).toBe(true);
    });

    it('should reject edge with invalid source format', () => {
      const cell: Cell = {
        id: validUUID,
        shape: 'edge',
        source: { notCell: 'foo' } as any,
        target: validUUID2,
      };
      const errors = validator.validateCells([cell], baseContext);
      expect(hasError(errors, 'INVALID_EDGE_SOURCE')).toBe(true);
    });

    it('should warn on self-referencing edge', () => {
      const node = validNodeCell(validUUID);
      const edge = validEdgeCell(validUUID2, validUUID, validUUID);
      const errors = validator.validateCells([node, edge], baseContext);
      expect(errors.some(e => e.code === 'SELF_REFERENCING_EDGE' && e.severity === 'warning')).toBe(
        true,
      );
    });
  });

  describe('validateCells — cell relationships', () => {
    it('should detect duplicate cell IDs', () => {
      const cell1 = validNodeCell(validUUID, { position: { x: 0, y: 0 } });
      const cell2 = validNodeCell(validUUID, { position: { x: 100, y: 0 } });
      const errors = validator.validateCells([cell1, cell2], baseContext);
      expect(hasError(errors, 'DUPLICATE_CELL_IDS')).toBe(true);
    });

    it('should report dangling edge source reference', () => {
      const node = validNodeCell(validUUID);
      const edge = validEdgeCell(validUUID2, '00000000-0000-0000-0000-000000000099', validUUID);
      const errors = validator.validateCells([node, edge], baseContext);
      expect(
        errors.some(
          e => e.code === 'INVALID_EDGE_SOURCE' && e.message.includes('does not reference'),
        ),
      ).toBe(true);
    });

    it('should report dangling edge target reference', () => {
      const node = validNodeCell(validUUID);
      const edge = validEdgeCell(validUUID2, validUUID, '00000000-0000-0000-0000-000000000099');
      const errors = validator.validateCells([node, edge], baseContext);
      expect(
        errors.some(
          e => e.code === 'INVALID_EDGE_TARGET' && e.message.includes('does not reference'),
        ),
      ).toBe(true);
    });

    it('should accept valid edge references', () => {
      const node1 = validNodeCell(validUUID);
      const node2 = validNodeCell(validUUID2);
      const edge = validEdgeCell(validUUID3, validUUID, validUUID2);
      const errors = validator.validateCells([node1, node2, edge], baseContext);
      const refErrors = errors.filter(e => e.message.includes('does not reference'));
      expect(refErrors).toHaveLength(0);
    });

    it('should handle empty cells array without errors', () => {
      const errors = validator.validateCells([], baseContext);
      expect(errors).toHaveLength(0);
    });

    it('should handle edge with object source in relationship validation', () => {
      const node1 = validNodeCell(validUUID);
      const node2 = validNodeCell(validUUID2);
      const edge: Cell = {
        id: validUUID3,
        shape: 'edge',
        source: { cell: validUUID },
        target: { cell: validUUID2 },
      };
      const errors = validator.validateCells([node1, node2, edge], baseContext);
      const refErrors = errors.filter(e => e.message.includes('does not reference'));
      expect(refErrors).toHaveLength(0);
    });
  });

  describe('validate — full diagram validation', () => {
    it('should validate diagram with cells', () => {
      const diagram = validDiagram({
        cells: [
          validNodeCell(validUUID),
          validNodeCell(validUUID2),
          validEdgeCell(validUUID3, validUUID, validUUID2),
        ],
      });
      const errors = validator.validate(diagram, baseContext);
      const hardErrors = errors.filter(e => e.severity === 'error');
      expect(hardErrors).toHaveLength(0);
    });

    it('should validate diagram without cells (undefined)', () => {
      const diagram = validDiagram({ cells: undefined });
      const errors = validator.validate(diagram, baseContext);
      expect(hasError(errors, 'INVALID_CELLS')).toBe(false);
    });
  });
});

describe('DiagramValidatorFactory', () => {
  it('should return DFD validator for DFD-1.0.0', () => {
    const v = DiagramValidatorFactory.getValidator('DFD-1.0.0');
    expect(v).not.toBeNull();
    expect(v!.diagramType).toBe('DFD-1.0.0');
  });

  it('should return DFD validator for DFD-1.0.5 (minor version)', () => {
    const v = DiagramValidatorFactory.getValidator('DFD-1.0.5');
    expect(v).not.toBeNull();
  });

  it('should return null for unsupported diagram type', () => {
    const v = DiagramValidatorFactory.getValidator('FLOW-2.0.0');
    expect(v).toBeNull();
  });

  it('should list supported diagram types', () => {
    const types = DiagramValidatorFactory.getSupportedTypes();
    expect(types).toContain('DFD-1.0.0');
  });
});
