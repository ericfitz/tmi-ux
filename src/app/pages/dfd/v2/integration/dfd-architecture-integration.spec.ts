/**
 * Integration tests for the new DFD architecture
 * Tests how all components work together
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { take } from 'rxjs/operators';

import { GraphOperationManager } from '../services/graph-operation-manager.service';
import { PersistenceCoordinator } from '../services/persistence-coordinator.service';
import { AutoSaveManager } from '../services/auto-save-manager.service';
import { DfdOrchestrator } from '../services/dfd-orchestrator.service';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
  OperationResult
} from '../types/graph-operation.types';
import { SaveResult, LoadResult } from '../types/persistence.types';
import { AutoSaveTriggerEvent, AutoSaveContext } from '../types/auto-save.types';

describe('DFD Architecture Integration', () => {
  let graphOperationManager: GraphOperationManager;
  let persistenceCoordinator: PersistenceCoordinator;
  let autoSaveManager: AutoSaveManager;
  let dfdOrchestrator: DfdOrchestrator;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockContainerElement: HTMLElement;

  beforeEach(() => {
    // Create logger spy
    mockLogger = jasmine.createSpyObj('LoggerService', [
      'info', 'debug', 'warn', 'error'
    ]);

    // Create mock container element
    mockContainerElement = document.createElement('div');
    mockContainerElement.style.width = '800px';
    mockContainerElement.style.height = '600px';
    document.body.appendChild(mockContainerElement);

    TestBed.configureTestingModule({
      providers: [
        GraphOperationManager,
        PersistenceCoordinator,
        AutoSaveManager,
        DfdOrchestrator,
        { provide: LoggerService, useValue: mockLogger }
      ]
    });

    graphOperationManager = TestBed.inject(GraphOperationManager);
    persistenceCoordinator = TestBed.inject(PersistenceCoordinator);
    autoSaveManager = TestBed.inject(AutoSaveManager);
    dfdOrchestrator = TestBed.inject(DfdOrchestrator);
  });

  afterEach(() => {
    document.body.removeChild(mockContainerElement);
  });

  describe('End-to-End Operation Flow', () => {
    it('should complete full operation cycle: create node → auto-save → persistence', (done) => {
      // Mock persistence strategy
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
        'save', 'load'
      ], {
        type: 'test-strategy',
        priority: 100
      });

      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      const loadResult: LoadResult = {
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      };

      mockStrategy.save.and.returnValue(of(saveResult));
      mockStrategy.load.and.returnValue(of(loadResult));
      persistenceCoordinator.addStrategy(mockStrategy);

      // Initialize DFD system
      const initParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        autoSaveMode: 'aggressive' as any
      };

      dfdOrchestrator.initialize(initParams).subscribe({
        next: () => {
          // Create a node operation
          const createNodeOp: CreateNodeOperation = {
            id: 'create-node-123',
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              nodeType: 'process',
              position: { x: 100, y: 100 },
              size: { width: 120, height: 60 },
              label: 'Integration Test Node',
              style: {},
              properties: {}
            }
          };

          // Execute through orchestrator
          dfdOrchestrator.executeOperation(createNodeOp).subscribe({
            next: (result: OperationResult) => {
              expect(result.success).toBe(true);
              
              // Verify auto-save was triggered (in aggressive mode)
              setTimeout(() => {
                expect(mockStrategy.save).toHaveBeenCalled();
                done();
              }, 100);
            },
            error: done.fail
          });
        },
        error: done.fail
      });
    });

    it('should handle complex operation sequences with proper state management', (done) => {
      // Setup persistence
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
        'save', 'load'
      ], {
        type: 'test-strategy',
        priority: 100
      });

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'save-batch',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      mockStrategy.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(mockStrategy);

      // Initialize
      dfdOrchestrator.initialize({
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        autoSaveMode: 'normal' as any
      }).subscribe({
        next: () => {
          // Sequence: Create node → Update node → Delete node
          const nodeId = 'test-node-sequence';

          const createOp: CreateNodeOperation = {
            id: 'create-1',
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              id: nodeId,
              nodeType: 'process',
              position: { x: 100, y: 100 },
              size: { width: 120, height: 60 },
              label: 'Sequence Node',
              style: {},
              properties: {}
            }
          };

          const updateOp: UpdateNodeOperation = {
            id: 'update-1',
            type: 'update-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeId,
            updates: {
              label: 'Updated Sequence Node',
              position: { x: 200, y: 200 }
            }
          };

          const deleteOp: DeleteNodeOperation = {
            id: 'delete-1',
            type: 'delete-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeId
          };

          // Execute sequence
          dfdOrchestrator.executeBatch([createOp, updateOp, deleteOp]).subscribe({
            next: (results: OperationResult[]) => {
              expect(results).toHaveSize(3);
              expect(results.every(r => r.success)).toBe(true);
              
              // Verify state is properly managed
              const stats = dfdOrchestrator.getStats();
              expect(stats.totalOperations).toBe(3);
              
              done();
            },
            error: done.fail
          });
        },
        error: done.fail
      });
    });
  });

  describe('Component Interaction', () => {
    it('should coordinate GraphOperationManager and AutoSaveManager', (done) => {
      // Set up auto-save in aggressive mode
      autoSaveManager.setPolicyMode('aggressive');

      // Create context
      const context: AutoSaveContext = {
        diagramId: 'test-diagram',
        userId: 'test-user',
        diagramData: { nodes: [], edges: [] },
        preferredStrategy: 'test-strategy'
      };

      // Mock persistence
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', ['save'], {
        type: 'test-strategy',
        priority: 100
      });

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'coordinated-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(mockStrategy);

      // Create trigger event
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };

      // Trigger auto-save
      autoSaveManager.trigger(triggerEvent, context).subscribe({
        next: (result) => {
          expect(result).not.toBeNull();
          expect(result!.success).toBe(true);
          expect(mockStrategy.save).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should coordinate PersistenceCoordinator caching with AutoSaveManager', (done) => {
      // Setup strategy
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
        'save', 'load'
      ], {
        type: 'cache-test-strategy',
        priority: 100
      });

      const testData = { nodes: ['node1'], edges: ['edge1'] };

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'cache-save',
        diagramId: 'cache-test',
        timestamp: Date.now(),
        metadata: {}
      }));

      mockStrategy.load.and.returnValue(of({
        success: true,
        operationId: 'cache-load',
        diagramId: 'cache-test',
        data: testData,
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(mockStrategy);

      // First save to populate cache
      persistenceCoordinator.save({
        diagramId: 'cache-test',
        data: testData,
        strategyType: 'cache-test-strategy'
      }).subscribe({
        next: () => {
          // Now load with cache enabled
          persistenceCoordinator.load({
            diagramId: 'cache-test',
            strategyType: 'cache-test-strategy',
            useCache: true
          }).subscribe({
            next: (loadResult: LoadResult) => {
              expect(loadResult.success).toBe(true);
              expect(loadResult.fromCache).toBe(true);
              expect(loadResult.data).toEqual(testData);
              
              // Strategy load should not be called due to cache hit
              expect(mockStrategy.load).not.toHaveBeenCalled();
              done();
            },
            error: done.fail
          });
        },
        error: done.fail
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle operation failures gracefully', (done) => {
      // Mock failing strategy
      const failingStrategy = jasmine.createSpyObj('FailingStrategy', [
        'save', 'load'
      ], {
        type: 'failing-strategy',
        priority: 100
      });

      const fallbackStrategy = jasmine.createSpyObj('FallbackStrategy', [
        'save', 'load'
      ], {
        type: 'fallback-strategy',
        priority: 50
      });

      // Primary fails, fallback succeeds
      failingStrategy.save.and.returnValue(of({
        success: false,
        operationId: 'failed-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        error: 'Primary strategy failed',
        metadata: {}
      }));

      fallbackStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'fallback-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(failingStrategy);
      persistenceCoordinator.addStrategy(fallbackStrategy);
      persistenceCoordinator.setFallbackStrategy('fallback-strategy');

      // Attempt save with failing primary
      persistenceCoordinator.save({
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        strategyType: 'failing-strategy'
      }).subscribe({
        next: (result: SaveResult) => {
          // Should succeed due to fallback
          expect(result.success).toBe(true);
          expect(fallbackStrategy.save).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should maintain consistency during complex operation failures', (done) => {
      // Initialize system
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
        'save', 'load'
      ], {
        type: 'consistency-test',
        priority: 100
      });

      mockStrategy.load.and.returnValue(of({
        success: true,
        operationId: 'init-load',
        diagramId: 'consistency-test',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      // Save will fail
      mockStrategy.save.and.returnValue(of({
        success: false,
        operationId: 'failed-consistency-save',
        diagramId: 'consistency-test',
        timestamp: Date.now(),
        error: 'Consistency test failure',
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(mockStrategy);

      dfdOrchestrator.initialize({
        diagramId: 'consistency-test',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        autoSaveMode: 'disabled' as any
      }).subscribe({
        next: () => {
          // Create operation that should succeed
          const createOp: CreateNodeOperation = {
            id: 'consistency-create',
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              nodeType: 'process',
              position: { x: 100, y: 100 },
              size: { width: 120, height: 60 },
              label: 'Consistency Node',
              style: {},
              properties: {}
            }
          };

          dfdOrchestrator.executeOperation(createOp).subscribe({
            next: (result: OperationResult) => {
              expect(result.success).toBe(true);
              
              // Now try manual save which will fail
              dfdOrchestrator.saveManually().subscribe({
                next: () => done.fail('Save should have failed'),
                error: () => {
                  // Verify system state is still consistent
                  const state = dfdOrchestrator.getState();
                  expect(state.initialized).toBe(true);
                  expect(state.hasUnsavedChanges).toBe(true); // Should still show unsaved changes
                  
                  const stats = dfdOrchestrator.getStats();
                  expect(stats.totalOperations).toBe(1); // Operation count should be accurate
                  
                  done();
                }
              });
            },
            error: done.fail
          });
        },
        error: done.fail
      });
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations correctly', (done) => {
      // Setup
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
        'save', 'load'
      ], {
        type: 'concurrent-test',
        priority: 100
      });

      mockStrategy.load.and.returnValue(of({
        success: true,
        operationId: 'concurrent-load',
        diagramId: 'concurrent-test',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'concurrent-save',
        diagramId: 'concurrent-test',
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(mockStrategy);

      dfdOrchestrator.initialize({
        diagramId: 'concurrent-test',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        autoSaveMode: 'disabled' as any
      }).subscribe({
        next: () => {
          // Create multiple concurrent operations
          const operations: CreateNodeOperation[] = Array.from({ length: 5 }, (_, i) => ({
            id: `concurrent-op-${i}`,
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              nodeType: 'process',
              position: { x: 100 + i * 50, y: 100 },
              size: { width: 120, height: 60 },
              label: `Concurrent Node ${i}`,
              style: {},
              properties: {}
            }
          }));

          // Execute all operations concurrently
          const results$ = operations.map(op => dfdOrchestrator.executeOperation(op));

          // Wait for all to complete
          Promise.all(results$.map(obs => obs.toPromise())).then(results => {
            expect(results).toHaveSize(5);
            expect(results.every(r => r.success)).toBe(true);
            
            const stats = dfdOrchestrator.getStats();
            expect(stats.totalOperations).toBe(5);
            
            done();
          }).catch(done.fail);
        },
        error: done.fail
      });
    });

    it('should manage operation timeouts appropriately', (done) => {
      // Configure short timeout
      graphOperationManager.configure({ operationTimeoutMs: 100 });

      // Create a slow mock that would exceed timeout
      const slowMockGraph = jasmine.createSpyObj('Graph', ['addNode']);
      
      // Simulate slow operation by never resolving
      const neverEndingPromise = new Promise(() => {
        // Never resolves to simulate timeout
      });
      slowMockGraph.addNode.and.returnValue(neverEndingPromise);

      const operation: CreateNodeOperation = {
        id: 'timeout-test',
        type: 'create-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeData: {
          nodeType: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          label: 'Timeout Node',
          style: {},
          properties: {}
        }
      };

      const context = {
        graph: slowMockGraph,
        diagramId: 'timeout-test',
        threatModelId: 'test-tm',
        userId: 'test-user',
        isCollaborating: false,
        permissions: ['read', 'write'],
        suppressValidation: false,
        suppressHistory: false,
        suppressBroadcast: false
      };

      graphOperationManager.execute(operation, context).subscribe({
        next: () => done.fail('Should have timed out'),
        error: (error) => {
          expect(error.name).toBe('TimeoutError');
          done();
        }
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should support custom configuration across all components', () => {
      // Configure each component
      graphOperationManager.configure({
        enableValidation: false,
        operationTimeoutMs: 45000
      });

      persistenceCoordinator.configure({
        enableCaching: false,
        operationTimeoutMs: 60000,
        maxCacheEntries: 200
      });

      autoSaveManager.configure({
        // Custom config would go here
      });

      // Verify configurations
      const graphConfig = graphOperationManager.getConfiguration();
      expect(graphConfig.enableValidation).toBe(false);
      expect(graphConfig.operationTimeoutMs).toBe(45000);

      const persistenceConfig = persistenceCoordinator.getConfiguration();
      expect(persistenceConfig.enableCaching).toBe(false);
      expect(persistenceConfig.operationTimeoutMs).toBe(60000);
      expect(persistenceConfig.maxCacheEntries).toBe(200);

      const autoSaveConfig = autoSaveManager.getConfiguration();
      expect(autoSaveConfig).toBeDefined();
    });

    it('should support extending functionality with custom components', () => {
      // Add custom validator
      const customValidator = jasmine.createSpyObj('CustomValidator', [
        'canValidate', 'validate'
      ], { priority: 200 });

      customValidator.canValidate.and.returnValue(true);
      customValidator.validate.and.returnValue({
        valid: true,
        errors: [],
        warnings: ['Custom validation warning']
      });

      graphOperationManager.addValidator(customValidator);

      // Add custom persistence strategy
      const customStrategy = jasmine.createSpyObj('CustomStrategy', [
        'save', 'load'
      ], {
        type: 'custom-strategy',
        priority: 200
      });

      customStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'custom-save',
        diagramId: 'test',
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(customStrategy);

      // Verify custom components are registered
      const strategies = persistenceCoordinator.getStrategies();
      expect(strategies).toContain(customStrategy);
    });
  });

  describe('Monitoring and Observability', () => {
    it('should provide comprehensive monitoring across all components', (done) => {
      // Setup basic persistence
      const mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
        'save', 'load'
      ], {
        type: 'monitoring-test',
        priority: 100
      });

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'monitoring-save',
        diagramId: 'monitoring-test',
        timestamp: Date.now(),
        metadata: {}
      }));

      mockStrategy.load.and.returnValue(of({
        success: true,
        operationId: 'monitoring-load',
        diagramId: 'monitoring-test',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      persistenceCoordinator.addStrategy(mockStrategy);

      // Initialize and perform operations
      dfdOrchestrator.initialize({
        diagramId: 'monitoring-test',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        autoSaveMode: 'aggressive' as any
      }).subscribe({
        next: () => {
          // Execute operation and monitor events
          const operation: CreateNodeOperation = {
            id: 'monitoring-op',
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData: {
              nodeType: 'process',
              position: { x: 100, y: 100 },
              size: { width: 120, height: 60 },
              label: 'Monitoring Node',
              style: {},
              properties: {}
            }
          };

          // Monitor operation completion
          dfdOrchestrator.operationCompleted$.pipe(take(1)).subscribe(result => {
            expect(result.success).toBe(true);

            // Check all component statistics
            const graphStats = graphOperationManager.getStats();
            expect(graphStats.totalOperations).toBeGreaterThan(0);

            const persistenceStats = persistenceCoordinator.getStats();
            expect(persistenceStats.totalOperations).toBeGreaterThan(0);

            const autoSaveStats = autoSaveManager.getStats();
            expect(autoSaveStats).toBeDefined();

            const orchestratorStats = dfdOrchestrator.getStats();
            expect(orchestratorStats.totalOperations).toBeGreaterThan(0);

            done();
          });

          dfdOrchestrator.executeOperation(operation).subscribe();
        },
        error: done.fail
      });
    });
  });
});