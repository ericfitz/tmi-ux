/**
 * Integration tests for the new DFD architecture
 * Tests how all components work together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { take } from 'rxjs/operators';

// Mock X6 Graph before importing any services that use it
vi.mock('@antv/x6', () => {
  const createMockGraph = () => ({
    // Core graph methods
    dispose: vi.fn(),
    resize: vi.fn(),
    clearCells: vi.fn(),
    addNode: vi.fn(),
    addEdge: vi.fn(),
    getCells: vi.fn().mockReturnValue([]),
    getNodes: vi.fn().mockReturnValue([]),
    getEdges: vi.fn().mockReturnValue([]),
    getCellById: vi.fn(),

    // Selection methods
    select: vi.fn(),
    unselect: vi.fn(),
    getSelectedCells: vi.fn().mockReturnValue([]),

    // Export methods
    toSVG: vi.fn().mockReturnValue('<svg></svg>'),
    toPNG: vi.fn().mockReturnValue(new Blob()),

    // Mock properties that integration tests expect
    selectAll: vi.fn(),
    cleanSelection: vi.fn(),

    // Event system for integration
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  });

  return {
    Graph: vi.fn().mockImplementation(() => createMockGraph()),
  };
});

import { AppGraphOperationManager } from '../application/services/app-graph-operation-manager.service';
import { AppPersistenceCoordinator } from '../application/services/app-persistence-coordinator.service';
import { AppAutoSaveManager } from '../application/services/app-auto-save-manager.service';
import { AppDfdOrchestrator } from '../application/services/app-dfd-orchestrator.service';
import {
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
  OperationResult,
} from '../types/graph-operation.types';
import { SaveResult, LoadResult } from '../types/persistence.types';
import { AutoSaveTriggerEvent, AutoSaveContext } from '../types/auto-save.types';

describe('DFD Architecture Integration', () => {
  let appGraphOperationManager: AppGraphOperationManager;
  let appPersistenceCoordinator: AppPersistenceCoordinator;
  let appAutoSaveManager: AppAutoSaveManager;
  let appDfdOrchestrator: AppDfdOrchestrator;
  let mockLogger: any;
  let mockContainerElement: HTMLElement;

  beforeEach(() => {
    // Create logger spy
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create mock container element
    mockContainerElement = document.createElement('div');
    mockContainerElement.style.width = '800px';
    mockContainerElement.style.height = '600px';
    document.body.appendChild(mockContainerElement);

    // Create services directly without TestBed
    appGraphOperationManager = new AppGraphOperationManager(mockLogger);
    appPersistenceCoordinator = new AppPersistenceCoordinator(mockLogger);
    appAutoSaveManager = new AppAutoSaveManager(mockLogger, appPersistenceCoordinator);
    appDfdOrchestrator = new AppDfdOrchestrator(
      mockLogger,
      appGraphOperationManager,
      appPersistenceCoordinator,
      appAutoSaveManager,
    );
  });

  afterEach(() => {
    document.body.removeChild(mockContainerElement);
  });

  describe('End-to-End Operation Flow', () => {
    it('should complete full operation cycle: create node → auto-save → persistence', () => {
      // Mock persistence strategy
      const mockStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'test-strategy',
        priority: 100,
      };

      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };

      const loadResult: LoadResult = {
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {},
      };

      mockStrategy.save.mockReturnValue(of(saveResult));
      mockStrategy.load.mockReturnValue(of(loadResult));
      appPersistenceCoordinator.addStrategy(mockStrategy);

      // Initialize DFD system
      const initParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        autoSaveMode: 'aggressive' as any,
      };

      return new Promise<void>((resolve, reject) => {
        appDfdOrchestrator.initialize(initParams).subscribe({
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
                properties: {},
              },
            };

            // Execute through orchestrator
            appDfdOrchestrator.executeOperation(createNodeOp).subscribe({
              next: (result: OperationResult) => {
                expect(result.success).toBe(true);

                // Verify auto-save was triggered (in aggressive mode)
                setTimeout(() => {
                  expect(mockStrategy.save).toHaveBeenCalled();
                  resolve();
                }, 100);
              },
              error: reject,
            });
          },
          error: reject,
        });
      });
    });

    it('should handle complex operation sequences with proper state management', () => {
      // Setup persistence
      const mockStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'test-strategy',
        priority: 100,
      };

      mockStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'save-batch',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      mockStrategy.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { nodes: [], edges: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(mockStrategy);

      return new Promise<void>((resolve, reject) => {
        // Initialize
        appDfdOrchestrator
          .initialize({
            diagramId: 'test-diagram',
            threatModelId: 'test-tm',
            containerElement: mockContainerElement,
            autoSaveMode: 'normal' as any,
          })
          .subscribe({
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
                  properties: {},
                },
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
                  position: { x: 200, y: 200 },
                },
              };

              const deleteOp: DeleteNodeOperation = {
                id: 'delete-1',
                type: 'delete-node',
                source: 'user-interaction',
                priority: 'normal',
                timestamp: Date.now(),
                nodeId,
              };

              // Execute sequence
              appDfdOrchestrator.executeBatch([createOp, updateOp, deleteOp]).subscribe({
                next: (results: OperationResult[]) => {
                  expect(results).toHaveLength(3);
                  expect(results.every(r => r.success)).toBe(true);

                  // Verify state is properly managed
                  const stats = appDfdOrchestrator.getStats();
                  expect(stats.totalOperations).toBe(3);

                  resolve();
                },
                error: reject,
              });
            },
            error: reject,
          });
      });
    });
  });

  describe('Component Interaction', () => {
    it('should coordinate AppGraphOperationManager and AppAutoSaveManager', () => {
      // Set up auto-save in aggressive mode
      appAutoSaveManager.setPolicyMode('aggressive');

      // Create context
      const context: AutoSaveContext = {
        diagramId: 'test-diagram',
        userId: 'test-user',
        diagramData: { nodes: [], edges: [] },
        preferredStrategy: 'test-strategy',
      };

      // Mock persistence
      const mockStrategy = {
        save: vi.fn(),
        type: 'test-strategy',
        priority: 100,
      };

      mockStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'coordinated-save',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(mockStrategy);

      // Create trigger event
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };

      return new Promise<void>((resolve, reject) => {
        // Trigger auto-save
        appAutoSaveManager.trigger(triggerEvent, context).subscribe({
          next: result => {
            expect(result).not.toBeNull();
            expect(result.success).toBe(true);
            expect(mockStrategy.save).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should coordinate AppPersistenceCoordinator caching with AppAutoSaveManager', () => {
      // Setup strategy
      const mockStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'cache-test-strategy',
        priority: 100,
      };

      const testData = { nodes: ['node1'], edges: ['edge1'] };

      mockStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'cache-save',
          diagramId: 'cache-test',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      mockStrategy.load.mockReturnValue(
        of({
          success: true,
          operationId: 'cache-load',
          diagramId: 'cache-test',
          data: testData,
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(mockStrategy);

      return new Promise<void>((resolve, reject) => {
        // First save to populate cache
        appPersistenceCoordinator
          .save({
            diagramId: 'cache-test',
            data: testData,
            strategyType: 'cache-test-strategy',
          })
          .subscribe({
            next: () => {
              // Now load with cache enabled
              appPersistenceCoordinator
                .load({
                  diagramId: 'cache-test',
                  strategyType: 'cache-test-strategy',
                  useCache: true,
                })
                .subscribe({
                  next: (loadResult: LoadResult) => {
                    expect(loadResult.success).toBe(true);
                    expect(loadResult.fromCache).toBe(true);
                    expect(loadResult.data).toEqual(testData);

                    // Strategy load should not be called due to cache hit
                    expect(mockStrategy.load).not.toHaveBeenCalled();
                    resolve();
                  },
                  error: reject,
                });
            },
            error: reject,
          });
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle operation failures gracefully', () => {
      // Mock failing strategy
      const failingStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'failing-strategy',
        priority: 100,
      };

      const fallbackStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'fallback-strategy',
        priority: 50,
      };

      // Primary fails, fallback succeeds
      failingStrategy.save.mockReturnValue(
        of({
          success: false,
          operationId: 'failed-save',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          error: 'Primary strategy failed',
          metadata: {},
        }),
      );

      fallbackStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'fallback-save',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(failingStrategy);
      appPersistenceCoordinator.addStrategy(fallbackStrategy);
      appPersistenceCoordinator.setFallbackStrategy('fallback-strategy');

      return new Promise<void>((resolve, reject) => {
        // Attempt save with failing primary
        appPersistenceCoordinator
          .save({
            diagramId: 'test-diagram',
            data: { nodes: [], edges: [] },
            strategyType: 'failing-strategy',
          })
          .subscribe({
            next: (result: SaveResult) => {
              // Should succeed due to fallback
              expect(result.success).toBe(true);
              expect(fallbackStrategy.save).toHaveBeenCalled();
              resolve();
            },
            error: reject,
          });
      });
    });

    it('should maintain consistency during complex operation failures', () => {
      // Initialize system
      const mockStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'consistency-test',
        priority: 100,
      };

      mockStrategy.load.mockReturnValue(
        of({
          success: true,
          operationId: 'init-load',
          diagramId: 'consistency-test',
          data: { nodes: [], edges: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      // Save will fail
      mockStrategy.save.mockReturnValue(
        of({
          success: false,
          operationId: 'failed-consistency-save',
          diagramId: 'consistency-test',
          timestamp: Date.now(),
          error: 'Consistency test failure',
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(mockStrategy);

      return new Promise<void>((resolve, reject) => {
        appDfdOrchestrator
          .initialize({
            diagramId: 'consistency-test',
            threatModelId: 'test-tm',
            containerElement: mockContainerElement,
            autoSaveMode: 'disabled' as any,
          })
          .subscribe({
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
                  properties: {},
                },
              };

              appDfdOrchestrator.executeOperation(createOp).subscribe({
                next: (result: OperationResult) => {
                  expect(result.success).toBe(true);

                  // Now try manual save which will fail
                  appDfdOrchestrator.saveManually().subscribe({
                    next: () => reject(new Error('Save should have failed')),
                    error: () => {
                      // Verify system state is still consistent
                      const state = appDfdOrchestrator.getState();
                      expect(state.initialized).toBe(true);
                      expect(state.hasUnsavedChanges).toBe(true); // Should still show unsaved changes

                      const stats = appDfdOrchestrator.getStats();
                      expect(stats.totalOperations).toBe(1); // Operation count should be accurate

                      resolve();
                    },
                  });
                },
                error: reject,
              });
            },
            error: reject,
          });
      });
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations correctly', () => {
      // Setup
      const mockStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'concurrent-test',
        priority: 100,
      };

      mockStrategy.load.mockReturnValue(
        of({
          success: true,
          operationId: 'concurrent-load',
          diagramId: 'concurrent-test',
          data: { nodes: [], edges: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      mockStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'concurrent-save',
          diagramId: 'concurrent-test',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(mockStrategy);

      return new Promise<void>((resolve, reject) => {
        appDfdOrchestrator
          .initialize({
            diagramId: 'concurrent-test',
            threatModelId: 'test-tm',
            containerElement: mockContainerElement,
            autoSaveMode: 'disabled' as any,
          })
          .subscribe({
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
                  properties: {},
                },
              }));

              // Execute all operations concurrently
              const results$ = operations.map(op => appDfdOrchestrator.executeOperation(op));

              // Wait for all to complete
              Promise.all(results$.map(obs => obs.toPromise()))
                .then(results => {
                  expect(results).toHaveLength(5);
                  expect(results.every(r => r.success)).toBe(true);

                  const stats = appDfdOrchestrator.getStats();
                  expect(stats.totalOperations).toBe(5);

                  resolve();
                })
                .catch(reject);
            },
            error: reject,
          });
      });
    });

    it('should manage operation timeouts appropriately', () => {
      // Configure short timeout
      appGraphOperationManager.configure({ operationTimeoutMs: 100 });

      // Create a slow mock that would exceed timeout
      const slowMockGraph = {
        addNode: vi.fn(),
      };

      // Simulate slow operation by never resolving
      const neverEndingPromise = new Promise(() => {
        // Never resolves to simulate timeout
      });
      slowMockGraph.addNode.mockReturnValue(neverEndingPromise);

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
          properties: {},
        },
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
        suppressBroadcast: false,
      };

      return new Promise<void>((resolve, reject) => {
        appGraphOperationManager.execute(operation, context).subscribe({
          next: () => reject(new Error('Should have timed out')),
          error: error => {
            expect(error.name).toBe('TimeoutError');
            resolve();
          },
        });
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should support custom configuration across all components', () => {
      // Configure each component
      appGraphOperationManager.configure({
        enableValidation: false,
        operationTimeoutMs: 45000,
      });

      appPersistenceCoordinator.configure({
        enableCaching: false,
        operationTimeoutMs: 60000,
        maxCacheEntries: 200,
      });

      appAutoSaveManager.configure({
        // Custom config would go here
      });

      // Verify configurations
      const graphConfig = appGraphOperationManager.getConfiguration();
      expect(graphConfig.enableValidation).toBe(false);
      expect(graphConfig.operationTimeoutMs).toBe(45000);

      const persistenceConfig = appPersistenceCoordinator.getConfiguration();
      expect(persistenceConfig.enableCaching).toBe(false);
      expect(persistenceConfig.operationTimeoutMs).toBe(60000);
      expect(persistenceConfig.maxCacheEntries).toBe(200);

      const autoSaveConfig = appAutoSaveManager.getConfiguration();
      expect(autoSaveConfig).toBeDefined();
    });

    it('should support extending functionality with custom components', () => {
      // Add custom validator
      const customValidator = {
        canValidate: vi.fn().mockReturnValue(true),
        validate: vi.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: ['Custom validation warning'],
        }),
        priority: 200,
      };

      appGraphOperationManager.addValidator(customValidator);

      // Add custom persistence strategy
      const customStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'custom-strategy',
        priority: 200,
      };

      customStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'custom-save',
          diagramId: 'test',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(customStrategy);

      // Verify custom components are registered
      const strategies = appPersistenceCoordinator.getStrategies();
      expect(strategies).toContain(customStrategy);
    });
  });

  describe('Monitoring and Observability', () => {
    it('should provide comprehensive monitoring across all components', () => {
      // Setup basic persistence
      const mockStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'monitoring-test',
        priority: 100,
      };

      mockStrategy.save.mockReturnValue(
        of({
          success: true,
          operationId: 'monitoring-save',
          diagramId: 'monitoring-test',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      mockStrategy.load.mockReturnValue(
        of({
          success: true,
          operationId: 'monitoring-load',
          diagramId: 'monitoring-test',
          data: { nodes: [], edges: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      appPersistenceCoordinator.addStrategy(mockStrategy);

      return new Promise<void>((resolve, reject) => {
        // Initialize and perform operations
        appDfdOrchestrator
          .initialize({
            diagramId: 'monitoring-test',
            threatModelId: 'test-tm',
            containerElement: mockContainerElement,
            autoSaveMode: 'aggressive' as any,
          })
          .subscribe({
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
                  properties: {},
                },
              };

              // Monitor operation completion
              appDfdOrchestrator.operationCompleted$.pipe(take(1)).subscribe(result => {
                expect(result.success).toBe(true);

                // Check all component statistics
                const graphStats = appGraphOperationManager.getStats();
                expect(graphStats.totalOperations).toBeGreaterThan(0);

                const persistenceStats = appPersistenceCoordinator.getStats();
                expect(persistenceStats.totalOperations).toBeGreaterThan(0);

                const autoSaveStats = appAutoSaveManager.getStats();
                expect(autoSaveStats).toBeDefined();

                const orchestratorStats = appDfdOrchestrator.getStats();
                expect(orchestratorStats.totalOperations).toBeGreaterThan(0);

                resolve();
              });

              appDfdOrchestrator.executeOperation(operation).subscribe();
            },
            error: reject,
          });
      });
    });
  });
});
