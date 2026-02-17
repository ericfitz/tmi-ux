/**
 * Tests for NodeOperationValidator
 *
 * Covers: create/update/delete node validation, ID conflicts,
 * size limits, label length, style validation, connected edges.
 */

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { LoggerService } from '../../../../core/services/logger.service';
import { NodeOperationValidator } from './node-operation-validator';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

describe('NodeOperationValidator', () => {
  let validator: NodeOperationValidator;
  let loggerService: MockLoggerService;

  function createMockGraph(
    options: {
      cells?: Map<string, any>;
      connectedEdges?: any[];
    } = {},
  ): any {
    const cells = options.cells ?? new Map();
    const connectedEdges = options.connectedEdges ?? [];

    return {
      getCellById: vi.fn((id: string) => cells.get(id) ?? null),
      getEdges: vi.fn(() => []),
      getConnectedEdges: vi.fn(() => connectedEdges),
    };
  }

  function baseOperation(type: string, overrides: any = {}): any {
    return {
      id: 'op-1',
      type,
      source: 'user-interaction',
      priority: 'normal',
      timestamp: Date.now(),
      ...overrides,
    };
  }

  function baseContext(graph: any, overrides: any = {}): any {
    return {
      graph,
      diagramId: 'diagram-1',
      threatModelId: 'tm-1',
      userId: 'user-1',
      isCollaborating: false,
      permissions: [],
      ...overrides,
    };
  }

  function mockNode(id: string): any {
    return {
      id,
      isNode: () => true,
      isEdge: () => false,
    };
  }

  function mockEdge(id: string): any {
    return {
      id,
      isNode: () => false,
      isEdge: () => true,
    };
  }

  beforeEach(() => {
    loggerService = createTypedMockLoggerService();
    validator = new NodeOperationValidator(loggerService as unknown as LoggerService);
  });

  describe('canValidate', () => {
    it('should return true for create-node', () => {
      expect(validator.canValidate(baseOperation('create-node'))).toBe(true);
    });

    it('should return true for update-node', () => {
      expect(validator.canValidate(baseOperation('update-node'))).toBe(true);
    });

    it('should return true for delete-node', () => {
      expect(validator.canValidate(baseOperation('delete-node'))).toBe(true);
    });

    it('should return false for edge operations', () => {
      expect(validator.canValidate(baseOperation('create-edge'))).toBe(false);
      expect(validator.canValidate(baseOperation('delete-edge'))).toBe(false);
    });
  });

  describe('validate create-node', () => {
    it('should accept valid node data', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          id: 'node-1',
          nodeType: 'process',
          position: { x: 100, y: 200 },
          size: { width: 120, height: 80 },
          label: 'Test Process',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
    });

    it('should reject when node ID already exists', () => {
      const existingNode = mockNode('node-1');
      const cells = new Map<string, any>([['node-1', existingNode]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-node', {
        nodeData: {
          id: 'node-1',
          nodeType: 'process',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('already exists'))).toBe(true);
    });

    it('should warn on unusual node type', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          nodeType: 'custom-type',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('Unusual node type'))).toBe(true);
    });

    it('should warn on very large size', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          nodeType: 'process',
          size: { width: 1500, height: 1500 },
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('very large'))).toBe(true);
    });

    it('should warn on very small size', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          nodeType: 'process',
          size: { width: 5, height: 5 },
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('very small'))).toBe(true);
    });

    it('should warn on long label', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          nodeType: 'process',
          label: 'A'.repeat(101),
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('very long'))).toBe(true);
    });

    it('should reject non-string label', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          nodeType: 'process',
          label: 42,
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('label must be a string'))).toBe(true);
    });

    it('should reject invalid fill color in style', () => {
      const graph = createMockGraph();

      const operation = baseOperation('create-node', {
        nodeData: {
          nodeType: 'process',
          style: { fill: 'not-a-color' },
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Invalid fill color'))).toBe(true);
    });

    it('should reject when graph is null', () => {
      const operation = baseOperation('create-node', {
        nodeData: { nodeType: 'process' },
      });

      const result = validator.validate(operation, baseContext(null));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Graph is not available'))).toBe(true);
    });
  });

  describe('validate update-node', () => {
    it('should reject when node does not exist', () => {
      const graph = createMockGraph();

      const operation = baseOperation('update-node', {
        nodeId: 'nonexistent',
        updates: { label: 'New Label' },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('not found'))).toBe(true);
    });

    it('should accept valid updates to existing node', () => {
      const node = mockNode('node-1');
      const cells = new Map<string, any>([['node-1', node]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('update-node', {
        nodeId: 'node-1',
        updates: { label: 'Updated Label' },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
    });
  });

  describe('validate delete-node', () => {
    it('should accept with warning when node does not exist', () => {
      const graph = createMockGraph();

      const operation = baseOperation('delete-node', {
        nodeId: 'nonexistent',
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('not found'))).toBe(true);
    });

    it('should warn about connected edges when node exists', () => {
      const node = mockNode('node-1');
      const cells = new Map<string, any>([['node-1', node]]);
      const connectedEdges = [mockEdge('e1'), mockEdge('e2')];
      const graph = createMockGraph({ cells, connectedEdges });

      const operation = baseOperation('delete-node', {
        nodeId: 'node-1',
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('2 connected edge'))).toBe(true);
    });

    it('should accept delete with no connected edges', () => {
      const node = mockNode('node-1');
      const cells = new Map<string, any>([['node-1', node]]);
      const graph = createMockGraph({ cells, connectedEdges: [] });

      const operation = baseOperation('delete-node', {
        nodeId: 'node-1',
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
