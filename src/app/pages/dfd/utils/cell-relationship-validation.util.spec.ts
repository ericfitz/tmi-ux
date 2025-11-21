/**
 * Tests for cell relationship validation utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cell } from '../../../core/types/websocket-message.types';
import { LoggerService } from '../../../core/services/logger.service';
import {
  validateAndFixParentChildRelationships,
  validateAffectedCellRelationships,
} from './cell-relationship-validation.util';

describe('Cell Relationship Validation', () => {
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    } as unknown as LoggerService;
  });

  describe('validateAndFixParentChildRelationships', () => {
    it('should pass validation when all relationships are valid', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null },
        { id: 'child1', shape: 'process', parent: 'parent1' },
        { id: 'child2', shape: 'store', parent: 'parent1' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
      expect(result.issues).toHaveLength(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should fix missing parent references', () => {
      const cells: Cell[] = [
        { id: 'child1', shape: 'process', parent: 'nonexistent-parent' },
        { id: 'child2', shape: 'store', parent: null },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('missing-parent');
      expect(result.issues[0].childId).toBe('child1');
      expect(result.issues[0].parentId).toBe('nonexistent-parent');
      expect(result.cells[0].parent).toBe(null); // Fixed
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should detect and fix circular relationships', () => {
      const cells: Cell[] = [
        { id: 'node1', shape: 'process', parent: 'node2' },
        { id: 'node2', shape: 'process', parent: 'node3' },
        { id: 'node3', shape: 'process', parent: 'node1' }, // Circular!
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
    });

    it('should prevent text-box from being a parent', () => {
      const cells: Cell[] = [
        { id: 'textbox1', shape: 'text-box', parent: null },
        { id: 'child1', shape: 'process', parent: 'textbox1' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues[0].type).toBe('invalid-parent-type');
      expect(result.cells[1].parent).toBe(null); // Fixed
    });

    it('should enforce security-boundary can only embed security-boundary', () => {
      const cells: Cell[] = [
        { id: 'boundary1', shape: 'security-boundary', parent: null },
        { id: 'boundary2', shape: 'security-boundary', parent: 'boundary1' }, // Valid
        { id: 'process1', shape: 'process', parent: null },
        { id: 'boundary3', shape: 'security-boundary', parent: 'process1' }, // Invalid
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues[0].type).toBe('invalid-child-type');
      expect(result.issues[0].childId).toBe('boundary3');
      expect(result.cells[3].parent).toBe(null); // Fixed
      // boundary2 should still have valid parent
      expect(result.cells[1].parent).toBe('boundary1');
    });

    it('should allow other shapes to embed into security-boundary', () => {
      const cells: Cell[] = [
        { id: 'boundary1', shape: 'security-boundary', parent: null },
        { id: 'process1', shape: 'process', parent: 'boundary1' },
        { id: 'store1', shape: 'store', parent: 'boundary1' },
        { id: 'actor1', shape: 'actor', parent: 'boundary1' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
    });

    it('should handle multiple issues in one validation', () => {
      const cells: Cell[] = [
        { id: 'textbox1', shape: 'text-box', parent: null },
        { id: 'child1', shape: 'process', parent: 'textbox1' }, // Invalid parent type
        { id: 'child2', shape: 'process', parent: 'missing' }, // Missing parent
        { id: 'boundary1', shape: 'security-boundary', parent: null },
        { id: 'boundary2', shape: 'security-boundary', parent: 'boundary1' }, // Valid
        { id: 'process1', shape: 'process', parent: null },
        { id: 'boundary3', shape: 'security-boundary', parent: 'process1' }, // Invalid child type
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(3);
      expect(result.issues).toHaveLength(3);

      // Verify all invalid relationships were fixed
      expect(result.cells[1].parent).toBe(null); // child1
      expect(result.cells[2].parent).toBe(null); // child2
      expect(result.cells[6].parent).toBe(null); // boundary3
      // Verify valid relationship preserved
      expect(result.cells[4].parent).toBe('boundary1'); // boundary2
    });

    it('should handle empty cell array', () => {
      const result = validateAndFixParentChildRelationships([], mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle cells with null parents', () => {
      const cells: Cell[] = [
        { id: 'node1', shape: 'process', parent: null },
        { id: 'node2', shape: 'process', parent: null },
        { id: 'node3', shape: 'store' }, // No parent field
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
    });

    it('should detect self-referencing circular relationship', () => {
      const cells: Cell[] = [
        { id: 'node1', shape: 'process', parent: 'node1' }, // Self-reference
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues[0].type).toBe('circular');
      expect(result.cells[0].parent).toBe(null);
    });

    it('should handle deep nesting hierarchies', () => {
      const cells: Cell[] = [
        { id: 'boundary1', shape: 'security-boundary', parent: null },
        { id: 'boundary2', shape: 'security-boundary', parent: 'boundary1' },
        { id: 'boundary3', shape: 'security-boundary', parent: 'boundary2' },
        { id: 'process1', shape: 'process', parent: 'boundary3' },
        { id: 'process2', shape: 'process', parent: 'process1' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
      // All valid nested relationships should be preserved
      expect(result.cells[1].parent).toBe('boundary1');
      expect(result.cells[2].parent).toBe('boundary2');
      expect(result.cells[3].parent).toBe('boundary3');
      expect(result.cells[4].parent).toBe('process1');
    });
  });

  describe('validateAffectedCellRelationships', () => {
    it('should validate only affected cells and their relationships', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null },
        { id: 'child1', shape: 'process', parent: 'parent1' },
        { id: 'child2', shape: 'process', parent: 'missing-parent' }, // Invalid but not affected
        { id: 'affected1', shape: 'process', parent: 'missing' }, // Invalid and affected
      ];

      const affectedIds = ['affected1'];
      const result = validateAffectedCellRelationships(affectedIds, cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].childId).toBe('affected1');
    });

    it('should include parent of affected cell in validation', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null },
        { id: 'child1', shape: 'process', parent: 'parent1' },
      ];

      const affectedIds = ['child1'];
      const result = validateAffectedCellRelationships(affectedIds, cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'CellRelationshipValidation',
        'Validating affected cell relationships',
        expect.objectContaining({
          affectedCells: 1,
          totalCellsToValidate: expect.any(Number),
        }),
      );
    });

    it('should include children of affected cell in validation', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null },
        { id: 'child1', shape: 'process', parent: 'parent1' },
        { id: 'child2', shape: 'store', parent: 'parent1' },
      ];

      const affectedIds = ['parent1'];
      const result = validateAffectedCellRelationships(affectedIds, cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      // Should validate parent1 and its children
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });

    it('should handle empty affected IDs', () => {
      const cells: Cell[] = [{ id: 'node1', shape: 'process', parent: null }];

      const result = validateAffectedCellRelationships([], cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
    });
  });

  describe('Bidirectional relationship validation', () => {
    it('should fix when parent.children contains child but child.parent is missing', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null, children: ['child1'] },
        { id: 'child1', shape: 'process', parent: null }, // Missing parent reference
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues[0].type).toBe('missing-child');
      expect(result.cells[1]['parent']).toBe('parent1'); // Fixed
    });

    it('should fix when parent.children contains child but child.parent points elsewhere', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null, children: ['child1'] },
        { id: 'parent2', shape: 'security-boundary', parent: null },
        { id: 'child1', shape: 'process', parent: 'parent2' }, // Points to wrong parent
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues[0].type).toBe('missing-child');
      expect(result.cells[2]['parent']).toBe('parent1'); // Fixed to match children array
    });

    it('should remove non-existent children from parent.children array', () => {
      const cells: Cell[] = [
        {
          id: 'parent1',
          shape: 'security-boundary',
          parent: null,
          children: ['child1', 'nonexistent', 'child2'],
        },
        { id: 'child1', shape: 'process', parent: 'parent1' },
        { id: 'child2', shape: 'process', parent: 'parent1' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(1);
      expect(result.issues[0].type).toBe('missing-child');
      expect(result.issues[0].childId).toBe('nonexistent');
      expect(result.cells[0]['children']).toEqual(['child1', 'child2']); // nonexistent removed
    });

    it('should handle cells with no children array', () => {
      const cells: Cell[] = [
        { id: 'parent1', shape: 'security-boundary', parent: null }, // No children array
        { id: 'child1', shape: 'process', parent: 'parent1' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(false);
      expect(result.fixCount).toBe(0);
    });

    it('should validate both directions in complex hierarchy', () => {
      const cells: Cell[] = [
        {
          id: 'boundary1',
          shape: 'security-boundary',
          parent: null,
          children: ['boundary2', 'process1', 'nonexistent'],
        },
        { id: 'boundary2', shape: 'security-boundary', parent: null, children: ['process2'] }, // Missing parent
        { id: 'process1', shape: 'process', parent: 'boundary1' }, // Correct
        { id: 'process2', shape: 'process', parent: 'boundary2' }, // Correct but boundary2 parent is wrong
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBe(2); // nonexistent removed + boundary2 parent fixed
      expect(result.cells[0]['children']).toEqual(['boundary2', 'process1']); // nonexistent removed
      expect(result.cells[1]['parent']).toBe('boundary1'); // boundary2 parent fixed
    });
  });

  describe('Edge cases', () => {
    it('should handle cells with edge shape (not nodes)', () => {
      const cells: Cell[] = [
        { id: 'node1', shape: 'process', parent: null },
        { id: 'node2', shape: 'process', parent: null },
        { id: 'edge1', shape: 'edge', source: 'node1', target: 'node2' },
      ];

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(false);
    });

    it('should handle very long circular chain safely', () => {
      // Create a circular chain of 50 nodes
      const cells: Cell[] = [];
      for (let i = 0; i < 50; i++) {
        cells.push({
          id: `node${i}`,
          shape: 'process',
          parent: `node${(i + 1) % 50}`, // Circular
        });
      }

      const result = validateAndFixParentChildRelationships(cells, mockLogger);

      expect(result.hadIssues).toBe(true);
      expect(result.fixCount).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
    });
  });
});
