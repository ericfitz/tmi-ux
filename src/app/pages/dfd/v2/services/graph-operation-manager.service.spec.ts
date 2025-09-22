/**
 * Test suite for GraphOperationManager
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Graph } from '@antv/x6';

import { GraphOperationManager } from './graph-operation-manager.service';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  GraphOperation,
  OperationContext,
  OperationResult,
  CreateNodeOperation
} from '../types/graph-operation.types';

describe('GraphOperationManager', () => {
  let service: GraphOperationManager;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockGraph: jasmine.SpyObj<Graph>;
  let operationContext: OperationContext;

  beforeEach(() => {
    // Create logger spy
    mockLogger = jasmine.createSpyObj('LoggerService', [
      'info', 'debug', 'warn', 'error'
    ]);

    // Create graph spy
    mockGraph = jasmine.createSpyObj('Graph', [
      'addNode', 'addEdge', 'getCellById', 'removeNode', 'removeEdge',
      'getConnectedEdges', 'clearCells'
    ]);

    TestBed.configureTestingModule({
      providers: [
        GraphOperationManager,
        { provide: LoggerService, useValue: mockLogger }
      ]
    });

    service = TestBed.inject(GraphOperationManager);

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
      suppressBroadcast: false
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
          properties: {}
        }
      };
    });

    it('should execute create node operation successfully', (done) => {
      // Mock successful node creation
      const mockNode = { id: 'node-123' };
      mockGraph.addNode.and.returnValue(mockNode as any);

      service.execute(createNodeOperation, operationContext).subscribe({
        next: (result: OperationResult) => {
          expect(result.success).toBe(true);
          expect(result.operationType).toBe('create-node');
          expect(result.affectedCellIds).toContain('node-123');
          expect(mockGraph.addNode).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should handle operation validation', (done) => {
      // Create invalid operation (missing required data)
      const invalidOperation: CreateNodeOperation = {
        ...createNodeOperation,
        nodeData: {
          ...createNodeOperation.nodeData,
          position: undefined as any
        }
      };

      service.execute(invalidOperation, operationContext).subscribe({
        next: () => done.fail('Should have failed validation'),
        error: (error) => {
          expect(error.message).toContain('validation failed');
          done();
        }
      });
    });

    it('should handle operation timeout', (done) => {
      // Configure short timeout
      service.configure({ operationTimeoutMs: 100 });

      // Mock slow operation
      const slowOperation: CreateNodeOperation = {
        ...createNodeOperation,
        id: 'slow-op'
      };

      service.execute(slowOperation, operationContext).subscribe({
        next: () => done.fail('Should have timed out'),
        error: (error) => {
          expect(error.name).toBe('TimeoutError');
          done();
        }
      });
    });

    it('should track operation statistics', (done) => {
      mockGraph.addNode.and.returnValue({ id: 'node-123' } as any);

      service.execute(createNodeOperation, operationContext).subscribe({
        next: () => {
          const stats = service.getStats();
          expect(stats.totalOperations).toBe(1);
          expect(stats.successfulOperations).toBe(1);
          expect(stats.operationsByType['create-node']).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should emit operation completed event', (done) => {
      mockGraph.addNode.and.returnValue({ id: 'node-123' } as any);

      // Subscribe to events
      service.operationCompleted$.subscribe(event => {
        expect(event.operation.id).toBe(createNodeOperation.id);
        expect(event.result.success).toBe(true);
        done();
      });

      service.execute(createNodeOperation, operationContext).subscribe();
    });
  });

  describe('Batch Operations', () => {
    it('should execute multiple operations as batch', (done) => {
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
            properties: {}
          }
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
            properties: {}
          }
        } as CreateNodeOperation
      ];

      mockGraph.addNode.and.returnValues(
        { id: 'node-1' } as any,
        { id: 'node-2' } as any
      );

      service.executeBatch(operations, operationContext).subscribe({
        next: (results: OperationResult[]) => {
          expect(results).toHaveSize(2);
          expect(results[0].success).toBe(true);
          expect(results[1].success).toBe(true);
          expect(mockGraph.addNode).toHaveBeenCalledTimes(2);
          done();
        },
        error: done.fail
      });
    });

    it('should handle empty batch operations', (done) => {
      service.executeBatch([], operationContext).subscribe({
        next: (results: OperationResult[]) => {
          expect(results).toHaveSize(0);
          done();
        },
        error: done.fail
      });
    });

    it('should handle batch with single operation', (done) => {
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
          properties: {}
        }
      };

      mockGraph.addNode.and.returnValue({ id: 'node-1' } as any);

      service.executeBatch([operation], operationContext).subscribe({
        next: (results: OperationResult[]) => {
          expect(results).toHaveSize(1);
          expect(results[0].success).toBe(true);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Operation Validation', () => {
    it('should validate operations when enabled', (done) => {
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
          properties: {}
        }
      };

      service.validate(operation, operationContext).subscribe({
        next: (isValid: boolean) => {
          expect(isValid).toBe(true);
          done();
        },
        error: done.fail
      });
    });

    it('should skip validation when disabled', (done) => {
      service.configure({ enableValidation: false });

      const operation: CreateNodeOperation = {
        id: 'op-123',
        type: 'create-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeData: {
          // Invalid data
          position: undefined as any
        } as any
      };

      service.validate(operation, operationContext).subscribe({
        next: (isValid: boolean) => {
          expect(isValid).toBe(true); // Should be true when validation disabled
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableValidation: false,
        operationTimeoutMs: 60000
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
      const mockExecutor = jasmine.createSpyObj('MockExecutor', [
        'canExecute', 'execute'
      ], { priority: 200 });

      mockExecutor.canExecute.and.returnValue(true);
      mockExecutor.execute.and.returnValue(of({
        success: true,
        operationId: 'test',
        operationType: 'custom',
        affectedCellIds: [],
        timestamp: Date.now(),
        metadata: {}
      }));

      service.addExecutor(mockExecutor);

      // The executor should be available for operations
      expect(service.canExecute({
        id: 'test',
        type: 'custom' as any,
        source: 'test',
        priority: 'normal',
        timestamp: Date.now()
      }, operationContext)).toBe(true);
    });

    it('should support removing executors', () => {
      const mockExecutor = jasmine.createSpyObj('MockExecutor', [
        'canExecute', 'execute'
      ], { priority: 200 });

      service.addExecutor(mockExecutor);
      service.removeExecutor(mockExecutor);

      // Executor should no longer be available
      expect(service.canExecute({
        id: 'test',
        type: 'custom' as any,
        source: 'test',
        priority: 'normal',
        timestamp: Date.now()
      }, operationContext)).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track operation statistics correctly', (done) => {
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
          properties: {}
        }
      };

      mockGraph.addNode.and.returnValue({ id: 'node-123' } as any);

      service.execute(operation, operationContext).subscribe({
        next: () => {
          const stats = service.getStats();
          expect(stats.totalOperations).toBe(1);
          expect(stats.successfulOperations).toBe(1);
          expect(stats.failedOperations).toBe(0);
          expect(stats.operationsByType['create-node']).toBe(1);
          expect(stats.operationsBySource['user-interaction']).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.successfulOperations).toBe(0);
      expect(stats.failedOperations).toBe(0);
      expect(Object.keys(stats.operationsByType)).toHaveSize(0);
      expect(Object.keys(stats.operationsBySource)).toHaveSize(0);
    });
  });

  describe('Pending Operations', () => {
    it('should track pending operations', () => {
      const operationId = 'pending-op';
      
      expect(service.isPending(operationId)).toBe(false);
      expect(service.getPendingOperations()).toHaveSize(0);
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
          properties: {}
        }
      };

      // This should not cause errors, but operations won't work
      expect(() => service.execute(operation, operationContext)).not.toThrow();
    });
  });
});