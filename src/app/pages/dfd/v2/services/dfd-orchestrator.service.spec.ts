/**
 * Test suite for DfdOrchestrator
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DfdOrchestrator } from './dfd-orchestrator.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { IGraphOperationManager } from '../interfaces/graph-operation-manager.interface';
import { IPersistenceCoordinator } from '../interfaces/persistence-coordinator.interface';
import { IAutoSaveManager } from '../interfaces/auto-save-manager.interface';
import {
  DfdInitializationParams
} from '../interfaces/dfd-orchestrator.interface';
import {
  GraphOperation,
  OperationResult,
  CreateNodeOperation
} from '../types/graph-operation.types';
import { SaveResult, LoadResult } from '../types/persistence.types';
import { AutoSaveState } from '../types/auto-save.types';

describe('DfdOrchestrator', () => {
  let service: DfdOrchestrator;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockGraphOperationManager: jasmine.SpyObj<IGraphOperationManager>;
  let mockPersistenceCoordinator: jasmine.SpyObj<IPersistenceCoordinator>;
  let mockAutoSaveManager: jasmine.SpyObj<IAutoSaveManager>;
  let mockContainerElement: HTMLElement;

  beforeEach(() => {
    // Create spies
    mockLogger = jasmine.createSpyObj('LoggerService', [
      'info', 'debug', 'warn', 'error'
    ]);

    mockGraphOperationManager = jasmine.createSpyObj('IGraphOperationManager', [
      'execute', 'executeBatch', 'validate', 'canExecute'
    ], {
      operationCompleted$: of({
        operation: {} as GraphOperation,
        result: {} as OperationResult,
        context: {} as any,
        executionTimeMs: 100
      })
    });

    mockPersistenceCoordinator = jasmine.createSpyObj('IPersistenceCoordinator', [
      'save', 'load', 'sync'
    ]);

    mockAutoSaveManager = jasmine.createSpyObj('IAutoSaveManager', [
      'trigger', 'triggerManualSave', 'enable', 'disable', 'getState'
    ], {
      saveCompleted$: of({} as SaveResult)
    });

    // Create mock container element
    mockContainerElement = document.createElement('div');
    mockContainerElement.style.width = '800px';
    mockContainerElement.style.height = '600px';
    document.body.appendChild(mockContainerElement);

    TestBed.configureTestingModule({
      providers: [
        DfdOrchestrator,
        { provide: LoggerService, useValue: mockLogger },
        { provide: IGraphOperationManager, useValue: mockGraphOperationManager },
        { provide: IPersistenceCoordinator, useValue: mockPersistenceCoordinator },
        { provide: IAutoSaveManager, useValue: mockAutoSaveManager }
      ]
    });

    service = TestBed.inject(DfdOrchestrator);
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
      expect(state.collaborating).toBe(false);
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
        collaborationEnabled: false,
        readOnly: false,
        autoSaveMode: 'normal'
      };

      // Mock successful load
      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));
    });

    it('should initialize successfully', (done) => {
      service.initialize(initParams).subscribe({
        next: (success: boolean) => {
          expect(success).toBe(true);
          
          const state = service.getState();
          expect(state.initialized).toBe(true);
          expect(state.loading).toBe(false);
          expect(state.readOnly).toBe(false);
          expect(state.error).toBeNull();
          
          done();
        },
        error: done.fail
      });
    });

    it('should handle read-only mode', (done) => {
      const readOnlyParams = { ...initParams, readOnly: true };

      service.initialize(readOnlyParams).subscribe({
        next: () => {
          const state = service.getState();
          expect(state.readOnly).toBe(true);
          done();
        },
        error: done.fail
      });
    });

    it('should handle collaboration mode', (done) => {
      const collabParams = { ...initParams, collaborationEnabled: true };

      service.initialize(collabParams).subscribe({
        next: () => {
          const state = service.getState();
          expect(state.collaborating).toBe(true);
          done();
        },
        error: done.fail
      });
    });

    it('should prevent double initialization', (done) => {
      service.initialize(initParams).subscribe({
        next: () => {
          // Try to initialize again
          service.initialize(initParams).subscribe({
            next: () => done.fail('Should have rejected double initialization'),
            error: (error) => {
              expect(error.message).toContain('already initialized');
              done();
            }
          });
        },
        error: done.fail
      });
    });

    it('should handle initialization failures', (done) => {
      // Mock load failure
      mockPersistenceCoordinator.load.and.returnValue(throwError(() => new Error('Load failed')));

      service.initialize(initParams).subscribe({
        next: () => {
          // Should still succeed even if initial load fails
          const state = service.getState();
          expect(state.initialized).toBe(true);
          done();
        },
        error: done.fail
      });
    });

    it('should set loading state during initialization', (done) => {
      let loadingStateObserved = false;

      service.state$.subscribe(state => {
        if (state.loading) {
          loadingStateObserved = true;
        }
      });

      service.initialize(initParams).subscribe({
        next: () => {
          expect(loadingStateObserved).toBe(true);
          done();
        },
        error: done.fail
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
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

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
          properties: {}
        }
      };

      mockResult = {
        success: true,
        operationId: 'op-123',
        operationType: 'create-node',
        affectedCellIds: ['node-123'],
        timestamp: Date.now(),
        metadata: {}
      };
    });

    it('should execute operations successfully', (done) => {
      mockGraphOperationManager.execute.and.returnValue(of(mockResult));

      service.executeOperation(createNodeOperation).subscribe({
        next: (result: OperationResult) => {
          expect(result.success).toBe(true);
          expect(mockGraphOperationManager.execute).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should prevent operations when not initialized', (done) => {
      // Create a new service instance that's not initialized
      const uninitializedService = new DfdOrchestrator(
        mockLogger,
        mockGraphOperationManager,
        mockPersistenceCoordinator,
        mockAutoSaveManager
      );

      uninitializedService.executeOperation(createNodeOperation).subscribe({
        next: () => done.fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('not initialized');
          done();
        }
      });
    });

    it('should prevent write operations in read-only mode', (done) => {
      service.setReadOnly(true);

      service.executeOperation(createNodeOperation).subscribe({
        next: () => done.fail('Should have rejected write operation'),
        error: (error) => {
          expect(error.message).toContain('read-only mode');
          done();
        }
      });
    });

    it('should execute batch operations', (done) => {
      const operations = [createNodeOperation];
      const batchResults = [mockResult];

      mockGraphOperationManager.executeBatch.and.returnValue(of(batchResults));

      service.executeBatch(operations).subscribe({
        next: (results: OperationResult[]) => {
          expect(results).toHaveSize(1);
          expect(results[0].success).toBe(true);
          expect(mockGraphOperationManager.executeBatch).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should update statistics on operation completion', (done) => {
      mockGraphOperationManager.execute.and.returnValue(of(mockResult));

      service.executeOperation(createNodeOperation).subscribe({
        next: () => {
          const stats = service.getStats();
          expect(stats.totalOperations).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should trigger auto-save on successful operations', (done) => {
      mockGraphOperationManager.execute.and.returnValue(of(mockResult));
      mockAutoSaveManager.trigger.and.returnValue(of(null));

      service.executeOperation(createNodeOperation).subscribe({
        next: () => {
          expect(mockAutoSaveManager.trigger).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });
  });

  describe('High-Level User Actions', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should add nodes', (done) => {
      const mockResult: OperationResult = {
        success: true,
        operationId: 'add-node-123',
        operationType: 'create-node',
        affectedCellIds: ['node-123'],
        timestamp: Date.now(),
        metadata: {}
      };

      mockGraphOperationManager.execute.and.returnValue(of(mockResult));

      service.addNode('process', { x: 200, y: 200 }).subscribe({
        next: (result: OperationResult) => {
          expect(result.success).toBe(true);
          expect(result.operationType).toBe('create-node');
          done();
        },
        error: done.fail
      });
    });

    it('should delete selected cells when cells are selected', (done) => {
      // Mock graph with selected cells
      const mockGraph = jasmine.createSpyObj('Graph', ['getSelectedCells']);
      const mockCell = jasmine.createSpyObj('Cell', ['isNode'], { id: 'cell-1' });
      mockCell.isNode.and.returnValue(true);
      mockGraph.getSelectedCells.and.returnValue([mockCell]);

      // Replace the graph in the service
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      const batchResults = [{
        success: true,
        operationId: 'delete-123',
        operationType: 'delete-node',
        affectedCellIds: ['cell-1'],
        timestamp: Date.now(),
        metadata: {}
      }];

      mockGraphOperationManager.executeBatch.and.returnValue(of(batchResults));

      service.deleteSelectedCells().subscribe({
        next: (result: OperationResult) => {
          expect(result.success).toBe(true);
          expect(mockGraphOperationManager.executeBatch).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should handle deletion when no cells are selected', (done) => {
      const mockGraph = jasmine.createSpyObj('Graph', ['getSelectedCells']);
      mockGraph.getSelectedCells.and.returnValue([]);

      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      service.deleteSelectedCells().subscribe({
        next: (result: OperationResult) => {
          expect(result.success).toBe(true);
          expect(result.affectedCellIds).toHaveSize(0);
          expect(result.metadata?.message).toContain('No cells selected');
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Save and Load Operations', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should save manually', (done) => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'manual-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      mockAutoSaveManager.triggerManualSave.and.returnValue(of(saveResult));

      service.saveManually().subscribe({
        next: (result: SaveResult) => {
          expect(result.success).toBe(true);
          expect(mockAutoSaveManager.triggerManualSave).toHaveBeenCalled();
          
          const state = service.getState();
          expect(state.hasUnsavedChanges).toBe(false);
          expect(state.lastSaved).not.toBeNull();
          done();
        },
        error: done.fail
      });
    });

    it('should load diagram', (done) => {
      const loadResult: LoadResult = {
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      };

      mockPersistenceCoordinator.load.and.returnValue(of(loadResult));

      service.loadDiagram().subscribe({
        next: (result: LoadResult) => {
          expect(result.success).toBe(true);
          expect(mockPersistenceCoordinator.load).toHaveBeenCalled();
          
          const state = service.getState();
          expect(state.hasUnsavedChanges).toBe(false);
          expect(state.lastSaved).not.toBeNull();
          done();
        },
        error: done.fail
      });
    });

    it('should prevent loading when unsaved changes exist', (done) => {
      // Simulate unsaved changes
      service['_hasUnsavedChanges'] = true;

      service.loadDiagram(false).subscribe({
        next: () => done.fail('Should have prevented load'),
        error: (error) => {
          expect(error.message).toContain('Unsaved changes exist');
          done();
        }
      });
    });

    it('should force load when requested', (done) => {
      // Simulate unsaved changes
      service['_hasUnsavedChanges'] = true;

      const loadResult: LoadResult = {
        success: true,
        operationId: 'force-load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      };

      mockPersistenceCoordinator.load.and.returnValue(of(loadResult));

      service.loadDiagram(true).subscribe({
        next: (result: LoadResult) => {
          expect(result.success).toBe(true);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should export diagram as PNG', (done) => {
      const mockGraph = jasmine.createSpyObj('Graph', ['toPNG']);
      const mockBlob = new Blob(['png data'], { type: 'image/png' });
      mockGraph.toPNG.and.returnValue(mockBlob);

      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      service.exportDiagram('png').subscribe({
        next: (blob: Blob) => {
          expect(blob.type).toBe('image/png');
          expect(mockGraph.toPNG).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should export diagram as SVG', (done) => {
      const mockGraph = jasmine.createSpyObj('Graph', ['toSVG']);
      mockGraph.toSVG.and.returnValue('<svg>test</svg>');

      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      service.exportDiagram('svg').subscribe({
        next: (blob: Blob) => {
          expect(blob.type).toBe('image/svg+xml');
          expect(mockGraph.toSVG).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should handle unsupported export formats', (done) => {
      service.exportDiagram('pdf' as any).subscribe({
        next: () => done.fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Unsupported export format');
          done();
        }
      });
    });
  });

  describe('Auto-Save Management', () => {
    it('should get auto-save state', () => {
      const mockState: AutoSaveState = {
        enabled: true,
        mode: 'normal',
        pendingSave: false,
        nextScheduledSave: null,
        lastSaveTime: null,
        changesSinceLastSave: 0,
        stats: {
          totalSaves: 0,
          successfulSaves: 0,
          failedSaves: 0,
          manualSaves: 0,
          scheduledSaves: 0,
          forcedSaves: 0,
          triggersReceived: 0,
          averageResponseTime: 0,
          lastResetTime: new Date()
        }
      };

      mockAutoSaveManager.getState.and.returnValue(mockState);

      const state = service.getAutoSaveState();
      expect(state.enabled).toBe(true);
      expect(state.mode).toBe('normal');
    });

    it('should enable auto-save', () => {
      service.enableAutoSave();
      expect(mockAutoSaveManager.enable).toHaveBeenCalled();
    });

    it('should disable auto-save', () => {
      service.disableAutoSave();
      expect(mockAutoSaveManager.disable).toHaveBeenCalled();
    });
  });

  describe('Collaboration Management', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should start collaboration', (done) => {
      service.startCollaboration().subscribe({
        next: (success: boolean) => {
          expect(success).toBe(true);
          
          const state = service.getState();
          expect(state.collaborating).toBe(true);
          done();
        },
        error: done.fail
      });
    });

    it('should stop collaboration', (done) => {
      service.stopCollaboration().subscribe({
        next: (success: boolean) => {
          expect(success).toBe(true);
          
          const state = service.getState();
          expect(state.collaborating).toBe(false);
          done();
        },
        error: done.fail
      });
    });

    it('should emit collaboration state changes', (done) => {
      service.collaborationStateChanged$.subscribe(collaborating => {
        expect(typeof collaborating).toBe('boolean');
        done();
      });

      service.startCollaboration().subscribe();
    });
  });

  describe('Selection Management', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should select all cells', () => {
      const mockGraph = jasmine.createSpyObj('Graph', ['selectAll']);
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      service.selectAll();
      expect(mockGraph.selectAll).toHaveBeenCalled();
    });

    it('should clear selection', () => {
      const mockGraph = jasmine.createSpyObj('Graph', ['cleanSelection']);
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      service.clearSelection();
      expect(mockGraph.cleanSelection).toHaveBeenCalled();
    });

    it('should get selected cells', () => {
      const mockGraph = jasmine.createSpyObj('Graph', ['getSelectedCells']);
      const mockCells = [
        { id: 'cell-1' },
        { id: 'cell-2' }
      ];
      mockGraph.getSelectedCells.and.returnValue(mockCells);
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      const selectedIds = service.getSelectedCells();
      expect(selectedIds).toEqual(['cell-1', 'cell-2']);
    });

    it('should return empty array when no graph', () => {
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(null);

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

    it('should emit state changes', (done) => {
      let stateEmissions = 0;

      service.state$.subscribe(state => {
        stateEmissions++;
        
        if (stateEmissions === 1) {
          // Initial state
          expect(state.readOnly).toBe(false);
        } else if (stateEmissions === 2) {
          // After setReadOnly
          expect(state.readOnly).toBe(true);
          done();
        }
      });

      service.setReadOnly(true);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should handle window resize', () => {
      const mockGraph = jasmine.createSpyObj('Graph', ['resize']);
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      service.onWindowResize();
      expect(mockGraph.resize).toHaveBeenCalled();
    });

    it('should handle keyboard shortcuts', () => {
      const mockGraph = jasmine.createSpyObj('Graph', ['selectAll', 'cleanSelection']);
      spyOnProperty(service, 'getGraph', 'get').and.returnValue(mockGraph);

      // Mock save result
      mockAutoSaveManager.triggerManualSave.and.returnValue(of({
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      // Test Ctrl+S (save)
      const saveEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      service.onKeyDown(saveEvent);
      expect(mockAutoSaveManager.triggerManualSave).toHaveBeenCalled();

      // Test Ctrl+A (select all)
      const selectAllEvent = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      service.onKeyDown(selectAllEvent);
      expect(mockGraph.selectAll).toHaveBeenCalled();

      // Test Escape (clear selection)
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      service.onKeyDown(escapeEvent);
      expect(mockGraph.cleanSelection).toHaveBeenCalled();
    });

    it('should handle context menu', () => {
      const contextMenuEvent = new MouseEvent('contextmenu');
      spyOn(contextMenuEvent, 'preventDefault');

      service.onContextMenu(contextMenuEvent);
      expect(contextMenuEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Destruction', () => {
    beforeEach(async () => {
      const initParams: DfdInitializationParams = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        containerElement: mockContainerElement
      };

      mockPersistenceCoordinator.load.and.returnValue(of({
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      }));

      await service.initialize(initParams).toPromise();
    });

    it('should destroy cleanly', (done) => {
      // Mock successful save for cleanup
      mockAutoSaveManager.triggerManualSave.and.returnValue(of({
        success: true,
        operationId: 'cleanup-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      service.destroy().subscribe({
        next: () => {
          const state = service.getState();
          expect(state.initialized).toBe(false);
          expect(state.hasUnsavedChanges).toBe(false);
          done();
        },
        error: done.fail
      });
    });

    it('should reset to initial state', (done) => {
      service.reset().subscribe({
        next: () => {
          const state = service.getState();
          expect(state.hasUnsavedChanges).toBe(false);
          expect(state.lastSaved).toBeNull();
          expect(state.error).toBeNull();
          
          const stats = service.getStats();
          expect(stats.totalOperations).toBe(0);
          done();
        },
        error: done.fail
      });
    });

    it('should prevent operations on uninitialized system', (done) => {
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
              properties: {}
            }
          };

          service.executeOperation(operation).subscribe({
            next: () => done.fail('Should have prevented operation'),
            error: (error) => {
              expect(error.message).toContain('not initialized');
              done();
            }
          });
        },
        error: done.fail
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