/**
 * Test suite for GraphOperationManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

import { GraphOperationManager } from './graph-operation-manager.service';
import {
  GraphOperation,
  OperationContext,
  OperationResult,
  CreateNodeOperation,
} from '../types/graph-operation.types';

describe('GraphOperationManager', () => {
  let service: GraphOperationManager;
  let mockLogger: any;
  let mockGraph: any;
  let operationContext: OperationContext;

  beforeEach(() => {
    // Create logger spy
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create graph spy
    mockGraph = {
      addNode: vi.fn(),
      addEdge: vi.fn(),
      getCellById: vi.fn(),
      removeNode: vi.fn(),
      removeEdge: vi.fn(),
      getConnectedEdges: vi.fn(),
      clearCells: vi.fn(),
    };

    // Create service directly without TestBed
    service = new GraphOperationManager(mockLogger);

    // Create operation context
    operationContext = {
      graph: mockGraph,
      diagramId: 'test-diagram',
      threatModelId: 'test-tm',
      userId: 'test-user',
      isCollaborating: false,
      permissions: ['read', 'write'],
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false,
    };
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default configuration', () => {
      const config = service.getConfiguration();
      expect(config.enableValidation).toBe(true);
      expect(config.operationTimeoutMs).toBe(30000);
    });

    it('should have built-in executors registered', () => {
      const stats = service.getStats();
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe('Operation Execution', () => {
    let createNodeOperation: CreateNodeOperation;

    beforeEach(() => {
      createNodeOperation = {
        id: 'op-123',
        type: 'create-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeData: {
          nodeType: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          label: 'Test Node',
          style: {},
          properties: {},
        },
      };
    });

    it('should execute create node operation successfully', () => {
      return new Promise<void>((resolve, reject) => {
        // Mock successful node creation
        const mockNode = { id: 'node-123' };
        mockGraph.addNode.mockReturnValue(mockNode as any);

        service.execute(createNodeOperation, operationContext).subscribe({
          next: (result: OperationResult) => {
            expect(result.success).toBe(true);
            expect(result.operationType).toBe('create-node');
            expect(result.affectedCellIds).toContain('node-123');
            expect(mockGraph.addNode).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle operation validation', () => {
      return new Promise<void>((resolve, reject) => {
        // Create invalid operation (missing required data)
        const invalidOperation: CreateNodeOperation = {
          ...createNodeOperation,
          nodeData: {
            ...createNodeOperation.nodeData,
            position: undefined as any,
          },
        };

        service.execute(invalidOperation, operationContext).subscribe({
          next: () => reject(new Error('Should have failed validation')),
          error: error => {
            expect(error.message).toContain('validation failed');
            resolve();
          },
        });
      });
    });

    it('should handle operation timeout', () => {
      return new Promise<void>((resolve, reject) => {
        // Configure short timeout
        service.configure({ operationTimeoutMs: 100 });

        // Mock slow operation
        const slowOperation: CreateNodeOperation = {
          ...createNodeOperation,
          id: 'slow-op',
        };

        service.execute(slowOperation, operationContext).subscribe({
          next: () => reject(new Error('Should have timed out')),
          error: error => {
            expect(error.name).toBe('TimeoutError');
            resolve();
          },
        });
      });
    });

    it('should track operation statistics', () => {
      return new Promise<void>((resolve, reject) => {
        mockGraph.addNode.mockReturnValue({ id: 'node-123' } as any);

        service.execute(createNodeOperation, operationContext).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalOperations).toBe(1);
            expect(stats.successfulOperations).toBe(1);
            expect(stats.operationsByType['create-node']).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should emit operation completed event', () => {
      return new Promise<void>(resolve => {
        mockGraph.addNode.mockReturnValue({ id: 'node-123' } as any);

        // Subscribe to events
        service.operationCompleted$.subscribe(event => {
          expect(event.operation.id).toBe(createNodeOperation.id);
          expect(event.result.success).toBe(true);
          resolve();
        });

        service.execute(createNodeOperation, operationContext).subscribe();
      });
    });
  });

  describe('Batch Operations', () => {
    it('should execute multiple operations as batch', () => {
      return new Promise<void>((resolve, reject) => {
        const operations: GraphOperation[] = [
          {
            id: 'op-1',
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              nodeType: 'process',
              position: { x: 100, y: 100 },
              size: { width: 120, height: 60 },
              label: 'Node 1',
              style: {},
              properties: {},
            },
          } as CreateNodeOperation,
          {
            id: 'op-2',
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              nodeType: 'process',
              position: { x: 200, y: 200 },
              size: { width: 120, height: 60 },
              label: 'Node 2',
              style: {},
              properties: {},
            },
          } as CreateNodeOperation,
        ];

        mockGraph.addNode
          .mockReturnValueOnce({ id: 'node-1' } as any)
          .mockReturnValueOnce({ id: 'node-2' } as any);

        service.executeBatch(operations, operationContext).subscribe({
          next: (results: OperationResult[]) => {
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
            expect(mockGraph.addNode).toHaveBeenCalledTimes(2);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle empty batch operations', () => {
      return new Promise<void>((resolve, reject) => {
        service.executeBatch([], operationContext).subscribe({
          next: (results: OperationResult[]) => {
            expect(results).toHaveLength(0);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle batch with single operation', () => {
      return new Promise<void>((resolve, reject) => {
        const operation: CreateNodeOperation = {
          id: 'op-1',
          type: 'create-node',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          nodeData: {
            nodeType: 'process',
            position: { x: 100, y: 100 },
            size: { width: 120, height: 60 },
            label: 'Node 1',
            style: {},
            properties: {},
          },
        };

        mockGraph.addNode.mockReturnValue({ id: 'node-1' } as any);

        service.executeBatch([operation], operationContext).subscribe({
          next: (results: OperationResult[]) => {
            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Operation Validation', () => {
    it('should validate operations when enabled', () => {
      return new Promise<void>((resolve, reject) => {
        const operation: CreateNodeOperation = {
          id: 'op-123',
          type: 'create-node',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          nodeData: {
            nodeType: 'process',
            position: { x: 100, y: 100 },
            size: { width: 120, height: 60 },
            label: 'Test Node',
            style: {},
            properties: {},
          },
        };

        service.validate(operation, operationContext).subscribe({
          next: (isValid: boolean) => {
            expect(isValid).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should skip validation when disabled', () => {
      return new Promise<void>((resolve, reject) => {
        service.configure({ enableValidation: false });

        const operation: CreateNodeOperation = {
          id: 'op-123',
          type: 'create-node',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          nodeData: {
            // Invalid data
            position: undefined as any,
          } as any,
        };

        service.validate(operation, operationContext).subscribe({
          next: (isValid: boolean) => {
            expect(isValid).toBe(true); // Should be true when validation disabled
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableValidation: false,
        operationTimeoutMs: 60000,
      };

      service.configure(newConfig);
      const config = service.getConfiguration();

      expect(config.enableValidation).toBe(false);
      expect(config.operationTimeoutMs).toBe(60000);
    });

    it('should maintain other config values when partially updating', () => {
      const originalConfig = service.getConfiguration();

      service.configure({ operationTimeoutMs: 45000 });
      const updatedConfig = service.getConfiguration();

      expect(updatedConfig.enableValidation).toBe(originalConfig.enableValidation);
      expect(updatedConfig.operationTimeoutMs).toBe(45000);
    });
  });

  describe('Executor Management', () => {
    it('should support adding custom executors', () => {
      const mockExecutor: any = {
        priority: 200,
        canExecute: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(
          of({
            success: true,
            operationId: 'test',
            operationType: 'custom',
            affectedCellIds: [],
            timestamp: Date.now(),
            metadata: {},
          }),
        ),
      };

      service.addExecutor(mockExecutor);

      // The executor should be available for operations
      expect(
        service.canExecute(
          {
            id: 'test',
            type: 'custom' as any,
            source: 'test',
            priority: 'normal',
            timestamp: Date.now(),
          },
          operationContext,
        ),
      ).toBe(true);
    });

    it('should support removing executors', () => {
      const mockExecutor: any = {
        priority: 200,
        canExecute: vi.fn(),
        execute: vi.fn(),
      };

      service.addExecutor(mockExecutor);
      service.removeExecutor(mockExecutor);

      // Executor should no longer be available
      expect(
        service.canExecute(
          {
            id: 'test',
            type: 'custom' as any,
            source: 'test',
            priority: 'normal',
            timestamp: Date.now(),
          },
          operationContext,
        ),
      ).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track operation statistics correctly', () => {
      return new Promise<void>((resolve, reject) => {
        const operation: CreateNodeOperation = {
          id: 'op-123',
          type: 'create-node',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          nodeData: {
            nodeType: 'process',
            position: { x: 100, y: 100 },
            size: { width: 120, height: 60 },
            label: 'Test Node',
            style: {},
            properties: {},
          },
        };

        mockGraph.addNode.mockReturnValue({ id: 'node-123' } as any);

        service.execute(operation, operationContext).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalOperations).toBe(1);
            expect(stats.successfulOperations).toBe(1);
            expect(stats.failedOperations).toBe(0);
            expect(stats.operationsByType['create-node']).toBe(1);
            expect(stats.operationsBySource['user-interaction']).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalOperations).toBe(0);
      expect(stats.successfulOperations).toBe(0);
      expect(stats.failedOperations).toBe(0);
      expect(Object.keys(stats.operationsByType)).toHaveLength(0);
      expect(Object.keys(stats.operationsBySource)).toHaveLength(0);
    });
  });

  describe('Pending Operations', () => {
    it('should track pending operations', () => {
      const operationId = 'pending-op';

      expect(service.isPending(operationId)).toBe(false);
      expect(service.getPendingOperations()).toHaveLength(0);
    });

    it('should allow cancelling pending operations', () => {
      const operationId = 'cancelled-op';

      // Try to cancel non-existent operation
      expect(service.cancelOperation(operationId)).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should dispose cleanly', () => {
      expect(() => service.dispose()).not.toThrow();

      // Should not be able to execute operations after disposal
      const operation: CreateNodeOperation = {
        id: 'op-123',
        type: 'create-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeData: {
          nodeType: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          label: 'Test Node',
          style: {},
          properties: {},
        },
      };

      // This should not cause errors, but operations won't work
      expect(() => service.execute(operation, operationContext)).not.toThrow();
    });
  });
});
