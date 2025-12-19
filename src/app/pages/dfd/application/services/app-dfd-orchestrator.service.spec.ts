/**
 * Test suite for AppDfdOrchestrator
 */

import '@angular/compiler';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';

// Mock X6 Graph before importing AppDfdOrchestrator
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
    toSVG: vi.fn((callback: (svgString: string) => void) => {
      // Simulate X6's callback-based API
      callback('<svg></svg>');
    }),
    toPNG: vi.fn((callback: (dataUri: string) => void) => {
      // Simulate X6's callback-based API with a base64 data URI
      callback(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      );
    }),

    // Mock properties that don't exist
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

import { AppDfdOrchestrator, DfdInitializationParams } from './app-dfd-orchestrator.service';
import { OperationResult, CreateNodeOperation } from '../../types/graph-operation.types';
import { LoadResult } from '../../types/persistence.types';

describe('AppDfdOrchestrator', () => {
  let service: AppDfdOrchestrator;
  let mockLogger: any;
  let mockAuthService: any;
  let mockServerConnectionService: any;
  let mockCollaborationService: any;
  let mockGraphOperationManager: any;
  let mockPersistenceCoordinator: any;
  let mockDiagramLoadingService: any;
  let mockExportService: any;
  let mockDfdFacade: any;
  let mockContainerElement: HTMLElement;
  let mockAppStateService: any;
  let mockInfraWebsocketAdapter: any;
  let mockAppDiagramOperationBroadcaster: any;
  let mockUiPresenterCoordinator: any;
  let mockSelectionAdapter: any;
  let mockDfdStateStore: any;
  let mockAppDiagramResyncService: any;
  let mockAppRemoteOperationHandler: any;
  let mockAppHistoryService: any;
  let mockAppOperationRejectionHandler: any;
  let mockAppOperationStateManager: any;
  let mockMatDialog: any;

  beforeEach(() => {
    // Create all required mocks
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockAuthService = {
      getCurrentUser: vi.fn().mockReturnValue(of({ id: 'user-1', email: 'test@example.com' })),
      isAuthenticated: vi.fn().mockReturnValue(of(true)),
    };

    mockServerConnectionService = {
      isConnected: vi.fn().mockReturnValue(true),
      serverMode: vi.fn().mockReturnValue('remote'),
      currentDetailedStatus: { isServerReachable: true, mode: 'remote' },
    };

    mockCollaborationService = {
      isCollaborating: vi.fn().mockReturnValue(false),
    };

    mockGraphOperationManager = {
      execute: vi.fn(),
      executeBatch: vi.fn(),
      validate: vi.fn(),
      canExecute: vi.fn(),
      operationCompleted$: new Subject(),
    };

    mockPersistenceCoordinator = {
      save: vi.fn().mockReturnValue(
        of({
          success: true,
          operationId: 'save-123',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
        }),
      ),
      load: vi.fn().mockReturnValue(
        of({
          success: true,
          diagramId: 'test-diagram',
          data: { cells: [] },
          source: 'api',
          timestamp: Date.now(),
        }),
      ),
      saveStatus$: new Subject(),
    };

    mockDiagramLoadingService = {
      loadDiagram: vi.fn().mockReturnValue(of({ success: true, data: { cells: [] } })),
      loadCellsIntoGraph: vi.fn(),
    };

    mockExportService = {
      exportDiagram: vi.fn(),
      prepareImageExport: vi.fn().mockReturnValue({
        width: 800,
        height: 600,
        cells: [],
        viewBox: '0 0 800 600',
        exportOptions: { padding: 20 },
      }),
      processSvg: vi.fn((svgString: string) => svgString),
    };

    // Create a mock graph that will be returned by facade.getGraph()
    const mockGraph = {
      dispose: vi.fn(),
      resize: vi.fn(),
      clearCells: vi.fn(),
      addNode: vi.fn(),
      addEdge: vi.fn(),
      getCells: vi.fn().mockReturnValue([]),
      getNodes: vi.fn().mockReturnValue([]),
      getEdges: vi.fn().mockReturnValue([]),
      getCellById: vi.fn(),
      select: vi.fn(),
      unselect: vi.fn(),
      getSelectedCells: vi.fn().mockReturnValue([]),
      toJSON: vi.fn().mockReturnValue({ cells: [] }),
      toSVG: vi.fn((callback: (svgString: string) => void) => {
        callback('<svg></svg>');
      }),
      toPNG: vi.fn((callback: (dataUri: string) => void) => {
        callback(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        );
      }),
      selectAll: vi.fn(),
      cleanSelection: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    const historyModifiedSubject = new Subject();
    const triggerResyncSubject = new Subject();
    const diagramStateSyncSubject = new Subject();

    mockDfdFacade = {
      initializeGraph: vi.fn().mockReturnValue(of(true)),
      getGraph: vi.fn().mockReturnValue(mockGraph),
      graphAdapter: {},
      selectAll: vi.fn(),
      clearSelection: vi.fn(),
      getSelectedCells: vi.fn().mockReturnValue([]),
      deleteSelected: vi.fn(),
      deleteSelectedCells: vi.fn().mockReturnValue(of({ success: true, deletedCount: 0 })),
      handleResize: vi.fn(),
      destroy: vi.fn(),
      dispose: vi.fn(),
      setReadOnlyMode: vi.fn(),
      historyModified$: historyModifiedSubject.asObservable(),
    };

    mockAppStateService = {
      triggerResyncEvents$: triggerResyncSubject.asObservable(),
      diagramStateSyncEvents$: diagramStateSyncSubject.asObservable(),
      getState: vi.fn(),
      setState: vi.fn(),
      initialize: vi.fn(),
      setReadOnly: vi.fn(),
      getCurrentState: vi.fn().mockReturnValue({
        isApplyingRemoteChange: false,
        readOnly: false,
      }),
    };

    mockInfraWebsocketAdapter = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      onMessage: vi.fn(),
      initialize: vi.fn(),
    };

    mockAppDiagramOperationBroadcaster = {
      broadcast: vi.fn(),
      onRemoteOperation: vi.fn(),
      dispose: vi.fn(),
    };

    mockUiPresenterCoordinator = {
      setPresenterMode: vi.fn(),
      clearPresenterMode: vi.fn(),
      initialize: vi.fn(),
    };

    mockSelectionAdapter = {
      initializePlugins: vi.fn(),
      selectAll: vi.fn(),
      clearSelection: vi.fn(),
      getSelectedCells: vi.fn().mockReturnValue([]),
    };

    mockDfdStateStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      reset: vi.fn(),
    };

    mockAppDiagramResyncService = {
      triggerResync: vi.fn(),
      resync: vi.fn(),
      initialize: vi.fn(),
    };

    mockAppRemoteOperationHandler = {
      initialize: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
      }),
      resetStats: vi.fn(),
    };

    mockAppHistoryService = {
      initialize: vi.fn(),
      addHistoryEntry: vi.fn(),
      undo: vi.fn().mockReturnValue(of({ success: true })),
      redo: vi.fn().mockReturnValue(of({ success: true })),
      canUndo: vi.fn().mockReturnValue(false),
      canRedo: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
      getUndoStack: vi.fn().mockReturnValue([]),
      getRedoStack: vi.fn().mockReturnValue([]),
      historyStateChange$: new Subject(),
    };

    mockAppOperationRejectionHandler = {
      initialize: vi.fn(),
      ngOnDestroy: vi.fn(),
    };

    mockAppOperationStateManager = {
      dragCompletions$: new Subject(),
      setAppStateService: vi.fn(),
      executeAtomicOperation: vi.fn((graph: any, operation: () => any) => operation()),
      executeCompoundOperation: vi.fn((graph: any, operation: () => any) => operation()),
      executeFinalizeDragOperation: vi.fn((graph: any, operation: () => any) => operation()),
      executeVisualEffect: vi.fn((graph: any, operation: () => any) => operation()),
    };

    mockMatDialog = {
      open: vi.fn(),
      closeAll: vi.fn(),
    };

    // Create mock container element
    mockContainerElement = document.createElement('div');
    mockContainerElement.style.width = '800px';
    mockContainerElement.style.height = '600px';
    document.body.appendChild(mockContainerElement);

    // Create service with correct dependencies
    service = new AppDfdOrchestrator(
      mockLogger,
      mockAuthService,
      mockServerConnectionService,
      mockCollaborationService,
      mockGraphOperationManager,
      mockPersistenceCoordinator,
      mockDiagramLoadingService,
      mockExportService,
      mockAppStateService,
      mockInfraWebsocketAdapter,
      mockDfdFacade,
      mockAppDiagramOperationBroadcaster,
      mockAppRemoteOperationHandler,
      mockAppHistoryService,
      mockAppOperationStateManager,
      mockUiPresenterCoordinator,
      mockSelectionAdapter,
      mockDfdStateStore,
      mockAppDiagramResyncService,
      mockAppOperationRejectionHandler,
      mockMatDialog,
    );
  });

  afterEach(() => {
    document.body.removeChild(mockContainerElement);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have initial state', () => {
      const state = service.getState();
      expect(state.initialized).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.readOnly).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.lastSaved).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should have empty statistics initially', () => {
      const stats = service.getStats();
      expect(stats.totalOperations).toBe(0);
      expect(stats.operationsPerMinute).toBe(0);
      expect(stats.errorRate).toBe(0);
    });
  });

  describe('DFD System Initialization', () => {
    let initParams: DfdInitializationParams;

    beforeEach(() => {
      initParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
        joinCollaboration: false,
      };

      // Mock successful load
      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );
    });

    it('should initialize successfully', () => {
      return new Promise<void>((resolve, reject) => {
        service.initialize(initParams).subscribe({
          next: (success: boolean) => {
            expect(success).toBe(true);

            const state = service.getState();
            expect(state.initialized).toBe(true);
            expect(state.loading).toBe(false);
            expect(state.readOnly).toBe(false);
            expect(state.error).toBeNull();

            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle read-only mode', () => {
      const readOnlyParams = { ...initParams, readOnly: true };

      return new Promise<void>((resolve, reject) => {
        service.initialize(readOnlyParams).subscribe({
          next: () => {
            const state = service.getState();
            expect(state.readOnly).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle collaboration mode', () => {
      const collabParams = { ...initParams, joinCollaboration: true };

      return new Promise<void>((resolve, reject) => {
        service.initialize(collabParams).subscribe({
          next: () => {
            const state = service.getState();
            // Collaboration state is managed by DfdCollaborationService
            // Just verify initialization succeeded
            expect(state.initialized).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should prevent double initialization', () => {
      return new Promise<void>((resolve, reject) => {
        service.initialize(initParams).subscribe({
          next: () => {
            // Try to initialize again
            service.initialize(initParams).subscribe({
              next: () => reject(new Error('Should have rejected double initialization')),
              error: error => {
                expect(error.message).toContain('already initialized');
                resolve();
              },
            });
          },
          error: reject,
        });
      });
    });

    it('should handle initialization failures', () => {
      // Mock load failure
      mockPersistenceCoordinator.load.mockReturnValue(throwError(() => new Error('Load failed')));

      return new Promise<void>((resolve, reject) => {
        service.initialize(initParams).subscribe({
          next: () => {
            // Should still succeed even if initial load fails
            const state = service.getState();
            expect(state.initialized).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should set loading state during initialization', () => {
      let loadingStateObserved = false;

      return new Promise<void>((resolve, reject) => {
        service.state$.subscribe(state => {
          if (state.loading) {
            loadingStateObserved = true;
          }
        });

        service.initialize(initParams).subscribe({
          next: () => {
            expect(loadingStateObserved).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Operation Execution', () => {
    let createNodeOperation: CreateNodeOperation;
    let mockResult: OperationResult;

    beforeEach(async () => {
      // Initialize the service first
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();

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

      mockResult = {
        success: true,
        operationId: 'op-123',
        operationType: 'create-node',
        affectedCellIds: ['node-123'],
        timestamp: Date.now(),
        metadata: {},
      };
    });

    it('should execute operations successfully', () => {
      mockGraphOperationManager.execute.mockReturnValue(of(mockResult));

      return new Promise<void>((resolve, reject) => {
        service.executeOperation(createNodeOperation).subscribe({
          next: (result: OperationResult) => {
            expect(result.success).toBe(true);
            expect(mockGraphOperationManager.execute).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should prevent operations when not initialized', () => {
      // Create a new service instance that's not initialized
      const uninitializedService = new AppDfdOrchestrator(
        mockLogger,
        mockAuthService,
        mockServerConnectionService,
        mockCollaborationService,
        mockGraphOperationManager,
        mockPersistenceCoordinator,
        mockDiagramLoadingService,
        mockExportService,
        mockAppStateService,
        mockInfraWebsocketAdapter,
        mockDfdFacade,
        mockAppDiagramOperationBroadcaster,
        mockAppRemoteOperationHandler,
        mockAppHistoryService,
        mockAppOperationStateManager,
        mockUiPresenterCoordinator,
        mockSelectionAdapter,
        mockDfdStateStore,
        mockAppDiagramResyncService,
        mockAppOperationRejectionHandler,
        mockMatDialog,
      );

      return new Promise<void>((resolve, reject) => {
        uninitializedService.executeOperation(createNodeOperation).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error.message).toContain('not initialized');
            resolve();
          },
        });
      });
    });

    it('should prevent write operations in read-only mode', () => {
      service.setReadOnly(true);

      return new Promise<void>((resolve, reject) => {
        service.executeOperation(createNodeOperation).subscribe({
          next: () => reject(new Error('Should have rejected write operation')),
          error: error => {
            expect(error.message).toContain('read-only mode');
            resolve();
          },
        });
      });
    });

    it('should execute batch operations', () => {
      const operations = [createNodeOperation];
      const batchResults = [mockResult];

      mockGraphOperationManager.executeBatch.mockReturnValue(of(batchResults));

      return new Promise<void>((resolve, reject) => {
        service.executeBatch(operations).subscribe({
          next: (results: OperationResult[]) => {
            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(mockGraphOperationManager.executeBatch).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should update statistics on operation completion', () => {
      mockGraphOperationManager.execute.mockReturnValue(of(mockResult));

      return new Promise<void>((resolve, reject) => {
        service.executeOperation(createNodeOperation).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalOperations).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    // Test removed: Obsolete after history-based auto-save refactor
    // Auto-save is now triggered through a different mechanism
  });

  describe('High-Level User Actions', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();
    });

    it('should add nodes', () => {
      const mockResult: OperationResult = {
        success: true,
        operationId: 'add-node-123',
        operationType: 'create-node',
        affectedCellIds: ['node-123'],
        timestamp: Date.now(),
        metadata: {},
      };

      mockGraphOperationManager.execute.mockReturnValue(of(mockResult));

      return new Promise<void>((resolve, reject) => {
        service.addNode('process', { x: 200, y: 200 }).subscribe({
          next: (result: OperationResult) => {
            expect(result.success).toBe(true);
            expect(result.operationType).toBe('create-node');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should delete selected cells when cells are selected', () => {
      // Mock graph with selected cells
      const mockGraph = {
        getSelectedCells: vi.fn().mockReturnValue([{ id: 'cell-1' }]),
      };

      // Replace the graph in the service
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);
      vi.spyOn(service, 'getSelectedCells').mockReturnValue(['cell-1']);

      // Mock the facade to return success
      mockDfdFacade.deleteSelectedCells.mockReturnValue(of({ success: true, deletedCount: 1 }));

      return new Promise<void>((resolve, reject) => {
        service.deleteSelectedCells().subscribe({
          next: (result: OperationResult) => {
            expect(result.success).toBe(true);
            expect(mockDfdFacade.deleteSelectedCells).toHaveBeenCalled();
            expect(result.affectedCellIds).toEqual(['cell-1']);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle deletion when no cells are selected', () => {
      const mockGraph = {
        getSelectedCells: vi.fn().mockReturnValue([]),
      };

      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      return new Promise<void>((resolve, reject) => {
        service.deleteSelectedCells().subscribe({
          next: (result: OperationResult) => {
            expect(result.success).toBe(true);
            expect(result.affectedCellIds).toHaveLength(0);
            expect(result.metadata?.['message']).toContain('No cells selected');
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Save and Load Operations', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();
    });

    it('should save manually', () => {
      // mockPersistenceCoordinator.save is already set up to return success in beforeEach

      return new Promise<void>((resolve, reject) => {
        service.saveManually().subscribe({
          next: (result: boolean) => {
            expect(result).toBe(true);
            expect(mockPersistenceCoordinator.save).toHaveBeenCalled();

            const state = service.getState();
            expect(state.hasUnsavedChanges).toBe(false);
            expect(state.lastSaved).not.toBeNull();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should load diagram', () => {
      const loadResult: LoadResult = {
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { cells: [] },
        timestamp: Date.now(),
        metadata: {},
      };

      mockPersistenceCoordinator.load.mockReturnValue(of(loadResult));

      return new Promise<void>((resolve, reject) => {
        service.loadDiagram().subscribe({
          next: (result: LoadResult) => {
            expect(result.success).toBe(true);
            expect(mockPersistenceCoordinator.load).toHaveBeenCalled();

            const state = service.getState();
            expect(state.hasUnsavedChanges).toBe(false);
            expect(state.lastSaved).not.toBeNull();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should prevent loading when unsaved changes exist', () => {
      // Simulate unsaved changes
      service['_hasUnsavedChanges'] = true;

      return new Promise<void>((resolve, reject) => {
        service.loadDiagram(false).subscribe({
          next: () => reject(new Error('Should have prevented load')),
          error: error => {
            expect(error.message).toContain('Unsaved changes exist');
            resolve();
          },
        });
      });
    });

    it('should force load when requested', () => {
      // Simulate unsaved changes
      service['_hasUnsavedChanges'] = true;

      const loadResult: LoadResult = {
        success: true,
        operationId: 'force-load-123',
        diagramId: 'test-diagram',
        data: { cells: [] },
        timestamp: Date.now(),
        metadata: {},
      };

      mockPersistenceCoordinator.load.mockReturnValue(of(loadResult));

      return new Promise<void>((resolve, reject) => {
        service.loadDiagram(true).subscribe({
          next: (result: LoadResult) => {
            expect(result.success).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();
    });

    it('should export diagram as PNG', () => {
      const mockGraph = {
        getSelectedCells: vi.fn(() => []),
        unselect: vi.fn(),
        toPNG: vi.fn((callback: (dataUri: string) => void) => {
          // Simulate X6's callback-based API with a base64 data URI
          callback(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          );
        }),
      };

      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      return new Promise<void>((resolve, reject) => {
        service.exportDiagram('png').subscribe({
          next: (blob: Blob) => {
            expect(blob.type).toBe('image/png');
            expect(mockGraph.toPNG).toHaveBeenCalled();
            expect(mockGraph.toPNG).toHaveBeenCalledWith(
              expect.any(Function),
              expect.objectContaining({ backgroundColor: 'white', padding: 20, quality: 1 }),
            );
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should export diagram as SVG', () => {
      const mockGraph = {
        getSelectedCells: vi.fn(() => []),
        unselect: vi.fn(),
        toSVG: vi.fn((callback: (svgString: string) => void) => {
          // Simulate X6's callback-based API
          callback('<svg>test</svg>');
        }),
      };

      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      return new Promise<void>((resolve, reject) => {
        service.exportDiagram('svg').subscribe({
          next: (blob: Blob) => {
            expect(blob.type).toBe('image/svg+xml');
            expect(mockGraph.toSVG).toHaveBeenCalled();
            expect(mockGraph.toSVG).toHaveBeenCalledWith(
              expect.any(Function),
              expect.objectContaining({ padding: 20 }),
            );
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle unsupported export formats', () => {
      return new Promise<void>((resolve, reject) => {
        service.exportDiagram('pdf' as any).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error.message).toContain('Unsupported export format');
            resolve();
          },
        });
      });
    });
  });

  describe('Auto-Save Management', () => {
    it('should get auto-save state', () => {
      const state = service.getAutoSaveState();
      expect(state.enabled).toBeDefined();
      expect(state.lastSavedHistoryIndex).toBeDefined();
      expect(state.hasUnsavedChanges).toBeDefined();
      expect(state.lastSaved).toBeDefined();
    });

    it('should enable auto-save', () => {
      service.enableAutoSave();
      const state = service.getAutoSaveState();
      expect(state.enabled).toBe(true);
    });

    it('should disable auto-save', () => {
      service.disableAutoSave();
      const state = service.getAutoSaveState();
      expect(state.enabled).toBe(false);
    });
  });

  describe('Selection Management', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();
    });

    it('should select all cells', () => {
      const mockGraph = {
        selectAll: vi.fn(),
      };
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      service.selectAll();
      expect(mockGraph.selectAll).toHaveBeenCalled();
    });

    it('should clear selection', () => {
      const mockCell1 = { id: 'cell-1' };
      const mockCell2 = { id: 'cell-2' };
      const mockGraph = {
        getSelectedCells: vi.fn().mockReturnValue([mockCell1, mockCell2]),
        getCellById: vi.fn((id: string) => (id === 'cell-1' ? mockCell1 : mockCell2)),
        unselect: vi.fn(),
      };
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      service.clearSelection();
      expect(mockGraph.unselect).toHaveBeenCalledWith(mockCell1);
      expect(mockGraph.unselect).toHaveBeenCalledWith(mockCell2);
    });

    it('should get selected cells', () => {
      const mockGraph = {
        getSelectedCells: vi.fn(),
      };
      const mockCells = [{ id: 'cell-1' }, { id: 'cell-2' }];
      mockGraph.getSelectedCells.mockReturnValue(mockCells);
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      const selectedIds = service.getSelectedCells();
      expect(selectedIds).toEqual(['cell-1', 'cell-2']);
    });

    it('should return empty array when no graph', () => {
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(null);

      const selectedIds = service.getSelectedCells();
      expect(selectedIds).toEqual([]);
    });
  });

  describe('State Management', () => {
    it('should set read-only mode', () => {
      service.setReadOnly(true);
      const state = service.getState();
      expect(state.readOnly).toBe(true);

      service.setReadOnly(false);
      const updatedState = service.getState();
      expect(updatedState.readOnly).toBe(false);
    });

    it('should emit state changes', () => {
      let stateEmissions = 0;

      return new Promise<void>((resolve, _reject) => {
        service.state$.subscribe(state => {
          stateEmissions++;

          if (stateEmissions === 1) {
            // Initial state
            expect(state.readOnly).toBe(false);
          } else if (stateEmissions === 2) {
            // After setReadOnly
            expect(state.readOnly).toBe(true);
            resolve();
          }
        });

        service.setReadOnly(true);
      });
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();
    });

    it('should handle window resize', () => {
      const mockGraph = {
        resize: vi.fn(),
      };
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      service.onWindowResize();
      expect(mockGraph.resize).toHaveBeenCalled();
    });

    it('should handle keyboard shortcuts', () => {
      const mockGraph = {
        selectAll: vi.fn(),
        getSelectedCells: vi.fn().mockReturnValue([]),
        getCellById: vi.fn(),
        unselect: vi.fn(),
        toJSON: vi.fn().mockReturnValue({ cells: [] }),
      };
      vi.spyOn(service, 'getGraph', 'get').mockReturnValue(mockGraph);

      // Test Ctrl+S (save) - spy on save method
      const saveSpy = vi.spyOn(service, 'saveManually').mockReturnValue(of(true));

      const saveEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      service.onKeyDown(saveEvent);
      expect(saveSpy).toHaveBeenCalled();

      // Test Ctrl+A (select all)
      const selectAllEvent = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      service.onKeyDown(selectAllEvent);
      expect(mockGraph.selectAll).toHaveBeenCalled();

      // Test Escape (clear selection)
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      service.onKeyDown(escapeEvent);
      expect(mockGraph.getSelectedCells).toHaveBeenCalled();
    });

    it('should handle context menu', () => {
      const contextMenuEvent = new MouseEvent('contextmenu');
      vi.spyOn(contextMenuEvent, 'preventDefault');

      service.onContextMenu(contextMenuEvent);
      expect(contextMenuEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Destruction', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement,
        readOnly: false,
        autoSaveMode: 'auto',
      };

      mockPersistenceCoordinator.load.mockReturnValue(
        of({
          success: true,
          operationId: 'load-123',
          diagramId: 'test-diagram',
          data: { cells: [] },
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      await service.initialize(initParams).toPromise();
    });

    it('should destroy cleanly', () => {
      // mockPersistenceCoordinator.save is already set up to return success

      return new Promise<void>((resolve, reject) => {
        service.destroy().subscribe({
          next: () => {
            const state = service.getState();
            expect(state.initialized).toBe(false);
            expect(state.hasUnsavedChanges).toBe(false);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should reset to initial state', () => {
      return new Promise<void>((resolve, reject) => {
        service.reset().subscribe({
          next: () => {
            const state = service.getState();
            expect(state.hasUnsavedChanges).toBe(false);
            expect(state.lastSaved).toBeNull();
            expect(state.error).toBeNull();

            const stats = service.getStats();
            expect(stats.totalOperations).toBe(0);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should prevent operations on uninitialized system', () => {
      return new Promise<void>((resolve, reject) => {
        service.destroy().subscribe({
          next: () => {
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

            service.executeOperation(operation).subscribe({
              next: () => reject(new Error('Should have prevented operation')),
              error: error => {
                expect(error.message).toContain('not initialized');
                resolve();
              },
            });
          },
          error: reject,
        });
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalOperations).toBe(0);
      expect(stats.operationsPerMinute).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.collaborativeOperations).toBe(0);
      expect(stats.autoSaves).toBe(0);
    });
  });
});
