/**
 * Tests for EdgeOperationValidator
 *
 * Covers: create/update/delete edge validation, source/target node checks,
 * self-loop warnings, duplicate detection, style validation.
 */

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { LoggerService } from '../../../../core/services/logger.service';
import { EdgeOperationValidator } from './edge-operation-validator';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

describe('EdgeOperationValidator', () => {
  let validator: EdgeOperationValidator;
  let loggerService: MockLoggerService;

  // Minimal mock graph builder
  function createMockGraph(
    options: {
      cells?: Map<string, any>;
      nodes?: Map<string, any>;
      edges?: any[];
    } = {},
  ): any {
    const cells = options.cells ?? new Map();
    const edges = options.edges ?? [];

    return {
      getCellById: vi.fn((id: string) => cells.get(id) ?? null),
      getEdges: vi.fn(() => edges),
      getConnectedEdges: vi.fn(() => []),
    };
  }

  // Helper for a base operation shape
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

  // Helper for base context
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

  // Create a mock node cell
  function mockNode(id: string): any {
    return {
      id,
      isNode: () => true,
      isEdge: () => false,
    };
  }

  // Create a mock edge cell
  function mockEdge(id: string, sourceId?: string, targetId?: string): any {
    return {
      id,
      isNode: () => false,
      isEdge: () => true,
      getSource: () => ({ cell: sourceId }),
      getTarget: () => ({ cell: targetId }),
    };
  }

  beforeEach(() => {
    loggerService = createTypedMockLoggerService();
    validator = new EdgeOperationValidator(loggerService as unknown as LoggerService);
  });

  describe('canValidate', () => {
    it('should return true for create-edge', () => {
      expect(validator.canValidate(baseOperation('create-edge'))).toBe(true);
    });

    it('should return true for update-edge', () => {
      expect(validator.canValidate(baseOperation('update-edge'))).toBe(true);
    });

    it('should return true for delete-edge', () => {
      expect(validator.canValidate(baseOperation('delete-edge'))).toBe(true);
    });

    it('should return false for node operations', () => {
      expect(validator.canValidate(baseOperation('create-node'))).toBe(false);
      expect(validator.canValidate(baseOperation('delete-node'))).toBe(false);
    });
  });

  describe('validate create-edge', () => {
    it('should accept valid edge with existing source and target nodes', () => {
      const sourceNode = mockNode('node-1');
      const targetNode = mockNode('node-2');
      const cells = new Map<string, any>([
        ['node-1', sourceNode],
        ['node-2', targetNode],
      ]);
      const graph = createMockGraph({ cells, nodes: cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'data-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
    });

    it('should reject when source node does not exist', () => {
      const targetNode = mockNode('node-2');
      const cells = new Map<string, any>([['node-2', targetNode]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'nonexistent',
          targetNodeId: 'node-2',
          edgeType: 'data-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('not found'))).toBe(true);
    });

    it('should reject when target node does not exist', () => {
      const sourceNode = mockNode('node-1');
      const cells = new Map<string, any>([['node-1', sourceNode]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'nonexistent',
          edgeType: 'data-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('not found'))).toBe(true);
    });

    it('should reject when edge ID already exists', () => {
      const sourceNode = mockNode('node-1');
      const targetNode = mockNode('node-2');
      const existingEdge = mockEdge('edge-1');
      const cells = new Map<string, any>([
        ['node-1', sourceNode],
        ['node-2', targetNode],
        ['edge-1', existingEdge],
      ]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          id: 'edge-1',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'data-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('already exists'))).toBe(true);
    });

    it('should warn on self-loop (same source and target)', () => {
      const node = mockNode('node-1');
      const cells = new Map<string, any>([['node-1', node]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-1',
          edgeType: 'data-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('self-loop'))).toBe(true);
    });

    it('should warn on duplicate edge between same nodes', () => {
      const sourceNode = mockNode('node-1');
      const targetNode = mockNode('node-2');
      const existingEdge = mockEdge('existing-edge', 'node-1', 'node-2');
      const cells = new Map<string, any>([
        ['node-1', sourceNode],
        ['node-2', targetNode],
      ]);
      const graph = createMockGraph({ cells, edges: [existingEdge] });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'data-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('Similar edge already exists'))).toBe(
        true,
      );
    });

    it('should warn on invalid edge type', () => {
      const sourceNode = mockNode('node-1');
      const targetNode = mockNode('node-2');
      const cells = new Map<string, any>([
        ['node-1', sourceNode],
        ['node-2', targetNode],
      ]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'custom-flow',
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('Unusual edge type'))).toBe(true);
    });

    it('should reject non-string label', () => {
      const sourceNode = mockNode('node-1');
      const targetNode = mockNode('node-2');
      const cells = new Map<string, any>([
        ['node-1', sourceNode],
        ['node-2', targetNode],
      ]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'data-flow',
          label: 123,
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('label must be a string'))).toBe(true);
    });

    it('should reject invalid stroke color in style', () => {
      const sourceNode = mockNode('node-1');
      const targetNode = mockNode('node-2');
      const cells = new Map<string, any>([
        ['node-1', sourceNode],
        ['node-2', targetNode],
      ]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          edgeType: 'data-flow',
          style: { stroke: 'not-a-color' },
        },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Invalid stroke color'))).toBe(true);
    });

    it('should reject when graph is null', () => {
      const operation = baseOperation('create-edge', {
        edgeData: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
        },
      });

      const result = validator.validate(operation, baseContext(null));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Graph is not available'))).toBe(true);
    });
  });

  describe('validate update-edge', () => {
    it('should reject when edge does not exist', () => {
      const graph = createMockGraph();

      const operation = baseOperation('update-edge', {
        edgeId: 'nonexistent',
        updates: { label: 'New Label' },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('not found'))).toBe(true);
    });

    it('should reject when updating source to nonexistent node', () => {
      const edge = mockEdge('edge-1', 'node-1', 'node-2');
      const cells = new Map<string, any>([['edge-1', edge]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('update-edge', {
        edgeId: 'edge-1',
        updates: { sourceNodeId: 'nonexistent' },
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('not found'))).toBe(true);
    });
  });

  describe('validate delete-edge', () => {
    it('should accept with warning when edge does not exist', () => {
      const graph = createMockGraph();

      const operation = baseOperation('delete-edge', {
        edgeId: 'nonexistent',
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('not found'))).toBe(true);
    });

    it('should accept when edge exists', () => {
      const edge = mockEdge('edge-1');
      const cells = new Map<string, any>([['edge-1', edge]]);
      const graph = createMockGraph({ cells });

      const operation = baseOperation('delete-edge', {
        edgeId: 'edge-1',
      });

      const result = validator.validate(operation, baseContext(graph));
      expect(result.valid).toBe(true);
    });
  });
});
