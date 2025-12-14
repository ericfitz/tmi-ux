/**
 * Tests for AppCellOperationConverterService
 *
 * Test framework: Vitest
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-cell-operation-converter.service.spec.ts
 * IMPORTANT: Do not skip or disable tests. Always troubleshoot to root cause and fix.
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { AppCellOperationConverterService } from './app-cell-operation-converter.service';
import { Cell } from '../../../../core/types/websocket-message.types';
import {
  CreateNodeOperation,
  UpdateNodeOperation,
  CreateEdgeOperation,
  UpdateEdgeOperation,
} from '../../types/graph-operation.types';

describe('AppCellOperationConverterService', () => {
  let service: AppCellOperationConverterService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    service = new AppCellOperationConverterService(mockLogger as any);
  });

  describe('convertCellsToOperations', () => {
    it('should convert added cells to create operations', () => {
      const newCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {
          text: { text: 'Process 1' },
        },
      };

      const operations = service.convertCellsToOperations([newCell], [], 'user-interaction');

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('create-node');
      expect((operations[0] as CreateNodeOperation).nodeData.id).toBe('node1');
      expect((operations[0] as CreateNodeOperation).nodeData.nodeType).toBe('process');
    });

    it('should convert updated cells to update operations', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {
          text: { text: 'Process 1' },
        },
      };

      const updatedCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 150, y: 150 },
        size: { width: 120, height: 60 },
        attrs: {
          text: { text: 'Process 1 Updated' },
        },
      };

      const operations = service.convertCellsToOperations(
        [updatedCell],
        [previousCell],
        'user-interaction',
      );

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('update-node');
      expect((operations[0] as UpdateNodeOperation).nodeId).toBe('node1');
      expect((operations[0] as UpdateNodeOperation).updates.position).toEqual({ x: 150, y: 150 });
    });

    it('should convert deleted cells to delete operations', () => {
      const deletedCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {
          text: { text: 'Process 1' },
        },
      };

      const operations = service.convertCellsToOperations([], [deletedCell], 'user-interaction');

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('delete-node');
      expect((operations[0] as any).nodeId).toBe('node1');
    });

    it('should handle mixed operations (add, update, delete)', () => {
      const previousCells: Cell[] = [
        {
          id: 'node1',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          attrs: { text: { text: 'Process 1' } },
        },
        {
          id: 'node2',
          shape: 'datastore',
          position: { x: 200, y: 200 },
          size: { width: 120, height: 60 },
          attrs: { text: { text: 'Datastore 1' } },
        },
      ];

      const currentCells: Cell[] = [
        {
          id: 'node1',
          shape: 'process',
          position: { x: 150, y: 150 },
          size: { width: 120, height: 60 },
          attrs: { text: { text: 'Process 1 Updated' } },
        },
        {
          id: 'node3',
          shape: 'external-entity',
          position: { x: 300, y: 300 },
          size: { width: 120, height: 60 },
          attrs: { text: { text: 'External Entity 1' } },
        },
      ];

      const operations = service.convertCellsToOperations(
        currentCells,
        previousCells,
        'user-interaction',
      );

      expect(operations).toHaveLength(3);
      const updateOp = operations.find(op => op.type === 'update-node');
      const createOp = operations.find(op => op.type === 'create-node');
      const deleteOp = operations.find(op => op.type === 'delete-node');

      expect(updateOp).toBeDefined();
      expect((updateOp as UpdateNodeOperation).nodeId).toBe('node1');

      expect(createOp).toBeDefined();
      expect((createOp as CreateNodeOperation).nodeData.id).toBe('node3');

      expect(deleteOp).toBeDefined();
      expect((deleteOp as any).nodeId).toBe('node2');
    });
  });

  describe('convertCellToOperation', () => {
    it('should create node operation for new node', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {
          text: { text: 'Process 1' },
        },
      };

      const operation = service.convertCellToOperation(cell, undefined, 'user-interaction');

      expect(operation).not.toBeNull();
      expect(operation?.type).toBe('create-node');
      expect(operation?.source).toBe('user-interaction');
      expect((operation as CreateNodeOperation).nodeData.id).toBe('node1');
    });

    it('should create edge operation for new edge', () => {
      const cell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        attrs: {},
      };

      const operation = service.convertCellToOperation(cell, undefined, 'user-interaction');

      expect(operation).not.toBeNull();
      expect(operation?.type).toBe('create-edge');
      expect((operation as CreateEdgeOperation).sourceNodeId).toBe('node1');
      expect((operation as CreateEdgeOperation).targetNodeId).toBe('node2');
    });

    it('should create update node operation for existing node', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: { text: { text: 'Process 1' } },
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 150, y: 150 },
        size: { width: 120, height: 60 },
        attrs: { text: { text: 'Process 1 Updated' } },
      };

      const operation = service.convertCellToOperation(
        currentCell,
        previousCell,
        'user-interaction',
      );

      expect(operation).not.toBeNull();
      expect(operation?.type).toBe('update-node');
      expect((operation as UpdateNodeOperation).nodeId).toBe('node1');
    });

    it('should create update edge operation for existing edge', () => {
      const previousCell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        attrs: {},
      };

      const currentCell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node3', port: 'in' },
        attrs: {},
      };

      const operation = service.convertCellToOperation(
        currentCell,
        previousCell,
        'user-interaction',
      );

      expect(operation).not.toBeNull();
      expect(operation?.type).toBe('update-edge');
      expect((operation as UpdateEdgeOperation).edgeId).toBe('edge1');
    });
  });

  describe('createNodeOperation', () => {
    it('should create node operation with all required fields', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {
          text: { text: 'Process 1' },
        },
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createNodeOperation(cell, baseOperation);

      expect(operation.type).toBe('create-node');
      expect(operation.nodeData.id).toBe('node1');
      expect(operation.nodeData.nodeType).toBe('process');
      expect(operation.nodeData.position).toEqual({ x: 100, y: 100 });
      expect(operation.nodeData.size).toEqual({ width: 120, height: 60 });
      expect(operation.nodeData.label).toBe('Process 1');
    });

    it('should handle node without label', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {},
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createNodeOperation(cell, baseOperation);

      expect(operation.nodeData.label).toBeUndefined();
    });

    it('should include additional X6 properties', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: { text: { text: 'Process 1' } },
        ports: { items: [] },
        data: { customData: 'test' },
        visible: true,
        zIndex: 1,
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createNodeOperation(cell, baseOperation);

      expect(operation.nodeData.properties.ports).toEqual({ items: [] });
      expect(operation.nodeData.properties.data).toEqual({ customData: 'test' });
      expect(operation.nodeData.properties.visible).toBe(true);
      expect(operation.nodeData.properties.zIndex).toBe(1);
    });
  });

  describe('createNodeUpdateOperation', () => {
    it('should create update node operation with all fields', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: { text: { text: 'Process 1' } },
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 150, y: 150 },
        size: { width: 140, height: 80 },
        attrs: { text: { text: 'Process 1 Updated' } },
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createNodeUpdateOperation(currentCell, previousCell, baseOperation);

      expect(operation.type).toBe('update-node');
      expect(operation.nodeId).toBe('node1');
      expect(operation.updates.position).toEqual({ x: 150, y: 150 });
      expect(operation.updates.size).toEqual({ width: 140, height: 80 });
      expect(operation.updates.label).toBe('Process 1 Updated');
    });
  });

  describe('createEdgeOperation', () => {
    it('should create edge operation with source and target', () => {
      const cell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        attrs: {},
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createEdgeOperation(cell, baseOperation);

      expect(operation.type).toBe('create-edge');
      expect(operation.sourceNodeId).toBe('node1');
      expect(operation.targetNodeId).toBe('node2');
      expect(operation.sourcePortId).toBe('out');
      expect(operation.targetPortId).toBe('in');
      expect(operation.edgeInfo).toBeDefined();
    });

    it('should include vertices when present', () => {
      const cell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        vertices: [
          { x: 200, y: 200 },
          { x: 250, y: 250 },
        ],
        attrs: {},
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createEdgeOperation(cell, baseOperation);

      expect(operation.edgeInfo.vertices).toHaveLength(2);
    });

    it('should include labels when present', () => {
      const cell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        labels: [{ attrs: { text: { text: 'Label 1' } } }],
        attrs: {},
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createEdgeOperation(cell, baseOperation);

      expect(operation.edgeInfo.labels).toHaveLength(1);
    });
  });

  describe('createEdgeUpdateOperation', () => {
    it('should create update edge operation', () => {
      const previousCell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        attrs: {},
      };

      const currentCell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node3', port: 'in' },
        attrs: {},
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createEdgeUpdateOperation(currentCell, previousCell, baseOperation);

      expect(operation.type).toBe('update-edge');
      expect(operation.edgeId).toBe('edge1');
      expect(operation.updates).toBeDefined();
    });

    it('should include updated vertices', () => {
      const previousCell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        vertices: [{ x: 200, y: 200 }],
        attrs: {},
      };

      const currentCell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        vertices: [
          { x: 200, y: 200 },
          { x: 250, y: 250 },
        ],
        attrs: {},
      };

      const baseOperation = {
        id: 'op-1',
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const operation = service.createEdgeUpdateOperation(currentCell, previousCell, baseOperation);

      expect(operation.updates.vertices).toHaveLength(2);
    });
  });

  describe('createDeleteOperation', () => {
    it('should create delete node operation', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: { text: { text: 'Process 1' } },
      };

      const operation = service.createDeleteOperation(cell, 'user-interaction');

      expect(operation.type).toBe('delete-node');
      expect((operation as any).nodeId).toBe('node1');
      expect(operation.source).toBe('user-interaction');
    });

    it('should create delete edge operation', () => {
      const cell: Cell = {
        id: 'edge1',
        shape: 'edge',
        source: { cell: 'node1', port: 'out' },
        target: { cell: 'node2', port: 'in' },
        attrs: {},
      };

      const operation = service.createDeleteOperation(cell, 'user-interaction');

      expect(operation.type).toBe('delete-edge');
      expect((operation as any).edgeId).toBe('edge1');
      expect(operation.source).toBe('user-interaction');
    });

    it('should set source to undo-redo when specified', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: { text: { text: 'Process 1' } },
      };

      const operation = service.createDeleteOperation(cell, 'undo-redo');

      expect(operation.source).toBe('undo-redo');
    });
  });
});
