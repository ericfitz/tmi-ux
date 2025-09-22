/**
 * DfdOrchestrator - Main coordination service for the DFD system
 * 
 * This service orchestrates all high-level DFD operations and coordinates
 * interactions between GraphOperationManager, PersistenceCoordinator, and AutoSaveManager.
 * It provides the main public API for DFD functionality.
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { v4 as uuid } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { 
  IDfdOrchestrator, 
  DfdInitializationParams, 
  DfdState, 
  DfdOperationStats,
  DfdOrchestratorConfig,
  DEFAULT_ORCHESTRATOR_CONFIG,
  DfdOperationContext
} from '../interfaces/dfd-orchestrator.interface';
import { IGraphOperationManager } from '../interfaces/graph-operation-manager.interface';
import { IPersistenceCoordinator } from '../interfaces/persistence-coordinator.interface';
import { IAutoSaveManager } from '../interfaces/auto-save-manager.interface';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  CreateNodeOperation
} from '../types/graph-operation.types';
import {
  SaveResult,
  LoadResult,
  LoadOperation
} from '../types/persistence.types';
import {
  AutoSaveContext,
  AutoSaveTriggerEvent
} from '../types/auto-save.types';

@Injectable({
  providedIn: 'root'
})
export class DfdOrchestrator implements IDfdOrchestrator {
  private _config: DfdOrchestratorConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG };
  private _graph: Graph | null = null;
  private _containerElement: HTMLElement | null = null;
  private _operationContext: DfdOperationContext | null = null;
  
  // State tracking
  private _stats: DfdOperationStats = this._createEmptyStats();
  private _initialized = false;
  private _loading = false;
  private _collaborating = false;
  private _readOnly = false;
  private _hasUnsavedChanges = false;
  private _lastSaved: Date | null = null;
  private _error: string | null = null;
  
  // Event subjects
  private readonly _state$ = new BehaviorSubject<DfdState>(this._createInitialState());
  private readonly _operationCompleted$ = new Subject<OperationResult>();
  private readonly _saveCompleted$ = new Subject<SaveResult>();
  private readonly _loadCompleted$ = new Subject<LoadResult>();
  private readonly _collaborationStateChanged$ = new Subject<boolean>();
  private readonly _selectionChanged$ = new Subject<string[]>();
  private readonly _error$ = new Subject<string>();
  
  // Public observables
  public readonly state$ = this._state$.asObservable();
  public readonly operationCompleted$ = this._operationCompleted$.asObservable();
  public readonly saveCompleted$ = this._saveCompleted$.asObservable();
  public readonly loadCompleted$ = this._loadCompleted$.asObservable();
  public readonly collaborationStateChanged$ = this._collaborationStateChanged$.asObservable();
  public readonly selectionChanged$ = this._selectionChanged$.asObservable();
  public readonly error$ = this._error$.asObservable();

  constructor(
    private logger: LoggerService,
    private graphOperationManager: IGraphOperationManager,
    private persistenceCoordinator: IPersistenceCoordinator,
    private autoSaveManager: IAutoSaveManager
  ) {
    this.logger.info('DfdOrchestrator initialized');
    this._subscribeToComponentEvents();
  }

  /**
   * Initialize the DFD system
   */
  initialize(params: DfdInitializationParams): Observable<boolean> {
    this.logger.info('Initializing DFD system', {
      diagramId: params.diagramId,
      threatModelId: params.threatModelId,
      collaboration: params.collaborationEnabled,
      readOnly: params.readOnly
    });

    if (this._initialized) {
      return throwError(() => new Error('DFD system already initialized'));
    }

    this._loading = true;
    this._updateState();

    // Store initialization parameters
    this._containerElement = params.containerElement;
    this._readOnly = params.readOnly || false;
    this._collaborating = params.collaborationEnabled || false;

    // Create operation context
    this._operationContext = {
      diagramId: params.diagramId,
      threatModelId: params.threatModelId,
      userId: 'current-user', // TODO: Get from auth service
      isCollaborating: this._collaborating,
      permissions: this._readOnly ? ['read'] : ['read', 'write']
    };

    return this._initializeGraph(params).pipe(
      switchMap(() => this._configureAutoSave(params)),
      switchMap(() => this._loadInitialDiagram(params)),
      tap(() => {
        this._initialized = true;
        this._loading = false;
        this._error = null;
        this.logger.info('DFD system initialization completed');
        this._updateState();
      }),
      map(() => true),
      catchError(error => {
        this._loading = false;
        this._error = `Initialization failed: ${String(error?.message || error)}`;
        this.logger.error('DFD initialization failed', { error });
        this._updateState();
        return throwError(() => error);
      })
    );
  }

  /**
   * Destroy the DFD system
   */
  destroy(): Observable<void> {
    this.logger.info('Destroying DFD system');

    // Save any pending changes
    return this._saveIfNeeded().pipe(
      switchMap(() => {
        // Clean up graph
        if (this._graph) {
          this._graph.dispose();
          this._graph = null;
        }

        // Reset state
        this._initialized = false;
        this._loading = false;
        this._collaborating = false;
        this._readOnly = false;
        this._hasUnsavedChanges = false;
        this._lastSaved = null;
        this._error = null;
        this._operationContext = null;
        this._containerElement = null;

        this._updateState();
        this.logger.info('DFD system destroyed');
        
        return of(void 0);
      })
    );
  }

  /**
   * Reset the DFD system
   */
  reset(): Observable<void> {
    this.logger.info('Resetting DFD system');

    if (!this._initialized) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    // Clear the graph
    if (this._graph) {
      this._graph.clearCells();
    }

    // Reset state
    this._hasUnsavedChanges = false;
    this._lastSaved = null;
    this._error = null;
    this._stats = this._createEmptyStats();

    this._updateState();
    return of(void 0);
  }

  /**
   * Execute a graph operation
   */
  executeOperation(operation: GraphOperation): Observable<OperationResult> {
    if (!this._initialized || !this._graph || !this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    if (this._readOnly && this._isWriteOperation(operation)) {
      return throwError(() => new Error('Operation not allowed in read-only mode'));
    }

    const context: OperationContext = {
      graph: this._graph,
      ...this._operationContext,
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false
    };

    this.logger.debug('Executing operation', {
      operationId: operation.id,
      operationType: operation.type,
      diagramId: this._operationContext.diagramId
    });

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        this._handleOperationCompleted(operation, result);
      }),
      catchError(error => {
        this._handleOperationError(operation, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Execute multiple operations as a batch
   */
  executeBatch(operations: GraphOperation[]): Observable<OperationResult[]> {
    if (!this._initialized || !this._graph || !this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    if (this._readOnly && operations.some(op => this._isWriteOperation(op))) {
      return throwError(() => new Error('Batch contains operations not allowed in read-only mode'));
    }

    const context: OperationContext = {
      graph: this._graph,
      ...this._operationContext,
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false
    };

    this.logger.debug('Executing batch operation', {
      operationCount: operations.length,
      diagramId: this._operationContext.diagramId
    });

    return this.graphOperationManager.executeBatch(operations, context).pipe(
      tap(results => {
        results.forEach((result, index) => {
          this._handleOperationCompleted(operations[index], result);
        });
      }),
      catchError(error => {
        this.logger.error('Batch operation failed', { error });
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a node to the diagram
   */
  addNode(nodeType: string, position?: { x: number; y: number }): Observable<OperationResult> {
    const operation: CreateNodeOperation = {
      id: uuid(),
      type: 'create-node',
      source: 'user-interaction',
      priority: 'normal',
      timestamp: Date.now(),
      nodeData: {
        nodeType,
        position: position || { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        label: `New ${nodeType}`,
        style: {},
        properties: {}
      }
    };

    return this.executeOperation(operation);
  }

  /**
   * Delete selected cells
   */
  deleteSelectedCells(): Observable<OperationResult> {
    if (!this._graph) {
      return throwError(() => new Error('Graph not available'));
    }

    const selectedCells = this._graph.getSelectedCells();
    if (selectedCells.length === 0) {
      return of({
        success: true,
        operationId: uuid(),
        operationType: 'delete-selection',
        affectedCellIds: [],
        timestamp: Date.now(),
        metadata: { message: 'No cells selected' }
      });
    }

    // Create delete operations for each selected cell
    const deleteOperations: GraphOperation[] = selectedCells.map(cell => {
      if (cell.isNode()) {
        return {
          id: uuid(),
          type: 'delete-node',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          nodeId: cell.id
        } as any; // DeleteNodeOperation
      } else {
        return {
          id: uuid(),
          type: 'delete-edge',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          edgeId: cell.id
        } as any; // DeleteEdgeOperation
      }
    });

    // Execute as batch operation
    return this.executeBatch(deleteOperations).pipe(
      map(results => ({
        success: results.every(r => r.success),
        operationId: uuid(),
        operationType: 'delete-selection',
        affectedCellIds: results.flatMap(r => r.affectedCellIds),
        timestamp: Date.now(),
        metadata: {
          deletedCount: selectedCells.length,
          individualResults: results
        }
      }))
    );
  }

  /**
   * Duplicate selected cells
   */
  duplicateSelectedCells(): Observable<OperationResult> {
    // TODO: Implement cell duplication logic
    return throwError(() => new Error('Duplicate operation not yet implemented'));
  }

  /**
   * Save manually
   */
  saveManually(): Observable<SaveResult> {
    if (!this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    const context: AutoSaveContext = {
      diagramId: this._operationContext.diagramId,
      userId: this._operationContext.userId,
      diagramData: this._getCurrentDiagramData(),
      preferredStrategy: 'websocket'
    };

    return this.autoSaveManager.triggerManualSave(context).pipe(
      tap(result => {
        if (result.success) {
          this._hasUnsavedChanges = false;
          this._lastSaved = new Date();
          this._updateState();
        }
      })
    );
  }

  /**
   * Load diagram
   */
  loadDiagram(force = false): Observable<LoadResult> {
    if (!this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    if (!force && this._hasUnsavedChanges) {
      return throwError(() => new Error('Unsaved changes exist. Use force=true to override.'));
    }

    const loadOperation: LoadOperation = {
      diagramId: this._operationContext.diagramId,
      strategyType: 'websocket',
      useCache: !force
    };

    this._loading = true;
    this._updateState();

    return this.persistenceCoordinator.load(loadOperation).pipe(
      switchMap(result => {
        if (result.success && result.data) {
          // Load the data into the graph
          return this._loadDiagramData(result.data).pipe(
            map(() => result)
          );
        }
        return of(result);
      }),
      tap(result => {
        this._loading = false;
        if (result.success) {
          this._hasUnsavedChanges = false;
          this._lastSaved = new Date();
          this._error = null;
        } else {
          this._error = result.error || 'Load failed';
        }
        this._updateState();
        this._loadCompleted$.next(result);
      }),
      catchError(error => {
        this._loading = false;
        this._error = `Load failed: ${error?.message || String(error)}`;
        this._updateState();
        return throwError(() => error);
      })
    );
  }

  /**
   * Export diagram
   */
  exportDiagram(format: 'png' | 'jpeg' | 'svg'): Observable<Blob> {
    if (!this._graph) {
      return throwError(() => new Error('Graph not available'));
    }

    try {
      switch (format) {
        case 'png':
          return of(this._graph.toPNG());
        case 'jpeg':
          return of(this._graph.toJPEG());
        case 'svg':
          return of(new Blob([this._graph.toSVG()], { type: 'image/svg+xml' }));
        default:
          return throwError(() => new Error(`Unsupported export format: ${String(format)}`));
      }
    } catch (error) {
      return throwError(() => error);
    }
  }

  /**
   * Undo last operation
   */
  undo(): Observable<OperationResult> {
    // TODO: Implement undo functionality
    return throwError(() => new Error('Undo not yet implemented'));
  }

  /**
   * Redo last undone operation
   */
  redo(): Observable<OperationResult> {
    // TODO: Implement redo functionality
    return throwError(() => new Error('Redo not yet implemented'));
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    // TODO: Implement undo check
    return false;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    // TODO: Implement redo check
    return false;
  }

  /**
   * Select all cells
   */
  selectAll(): void {
    if (this._graph) {
      this._graph.selectAll();
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    if (this._graph) {
      this._graph.cleanSelection();
    }
  }

  /**
   * Get selected cell IDs
   */
  getSelectedCells(): string[] {
    if (!this._graph) {
      return [];
    }
    return this._graph.getSelectedCells().map(cell => cell.id);
  }

  /**
   * Start collaboration
   */
  startCollaboration(): Observable<boolean> {
    // TODO: Implement collaboration logic
    this._collaborating = true;
    this._updateState();
    this._collaborationStateChanged$.next(true);
    return of(true);
  }

  /**
   * Stop collaboration
   */
  stopCollaboration(): Observable<boolean> {
    // TODO: Implement collaboration logic
    this._collaborating = false;
    this._updateState();
    this._collaborationStateChanged$.next(false);
    return of(true);
  }

  /**
   * Request presenter role
   */
  requestPresenterRole(): Observable<boolean> {
    // TODO: Implement presenter role logic
    return of(true);
  }

  /**
   * Get current state
   */
  getState(): DfdState {
    return this._state$.value;
  }

  /**
   * Get auto-save state
   */
  getAutoSaveState() {
    return this.autoSaveManager.getState();
  }

  /**
   * Enable auto-save
   */
  enableAutoSave(): void {
    this.autoSaveManager.enable();
  }

  /**
   * Disable auto-save
   */
  disableAutoSave(): void {
    this.autoSaveManager.disable();
  }

  /**
   * Set read-only mode
   */
  setReadOnly(readOnly: boolean): void {
    this._readOnly = readOnly;
    if (this._operationContext) {
      this._operationContext.permissions = readOnly ? ['read'] : ['read', 'write'];
    }
    this._updateState();
  }

  /**
   * Set collaboration enabled
   */
  setCollaborationEnabled(enabled: boolean): Observable<void> {
    if (enabled) {
      return this.startCollaboration().pipe(map(() => void 0));
    } else {
      return this.stopCollaboration().pipe(map(() => void 0));
    }
  }

  /**
   * Get statistics
   */
  getStats(): DfdOperationStats {
    return { ...this._stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = this._createEmptyStats();
  }

  /**
   * Get graph instance
   */
  getGraph(): Graph | null {
    return this._graph;
  }

  /**
   * Handle window resize
   */
  onWindowResize(): void {
    if (this._graph && this._containerElement) {
      this._graph.resize();
    }
  }

  /**
   * Handle keyboard events
   */
  onKeyDown(event: KeyboardEvent): void {
    if (!this._graph) return;

    // Handle common keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          this.saveManually().subscribe();
          break;
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            this.redo().subscribe();
          } else {
            this.undo().subscribe();
          }
          break;
        case 'a':
          event.preventDefault();
          this.selectAll();
          break;
        case 'd':
          event.preventDefault();
          this.duplicateSelectedCells().subscribe();
          break;
      }
    } else {
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          this.deleteSelectedCells().subscribe();
          break;
        case 'Escape':
          this.clearSelection();
          break;
      }
    }
  }

  /**
   * Handle context menu events
   */
  onContextMenu(event: MouseEvent): void {
    // TODO: Implement context menu logic
    event.preventDefault();
  }

  // Private implementation methods

  private _subscribeToComponentEvents(): void {
    // Subscribe to graph operation events
    this.graphOperationManager.operationCompleted$.subscribe(event => {
      this._operationCompleted$.next(event.result);
    });

    // Subscribe to auto-save events
    this.autoSaveManager.saveCompleted$.subscribe(result => {
      this._saveCompleted$.next(result);
    });
  }

  private _initializeGraph(params: DfdInitializationParams): Observable<void> {
    try {
      // Create X6 graph instance
      this._graph = new Graph({
        container: params.containerElement,
        width: params.containerElement.clientWidth,
        height: params.containerElement.clientHeight,
        background: {
          color: '#ffffff'
        },
        grid: {
          visible: true,
          type: 'doubleMesh',
          args: [
            { color: '#eee', thickness: 1 },
            { color: '#ddd', thickness: 1, factor: 4 }
          ]
        },
        selecting: {
          enabled: true,
          multiple: true,
          rubberband: true,
          movable: true
        },
        connecting: {
          router: 'manhattan',
          connector: 'rounded'
        },
        interacting: {
          nodeMovable: !this._readOnly,
          edgeMovable: !this._readOnly,
          arrowheadMovable: !this._readOnly,
          vertexMovable: !this._readOnly,
          vertexAddable: !this._readOnly,
          vertexDeletable: !this._readOnly
        }
      });

      // Set up graph event listeners
      this._setupGraphEventListeners();

      this.logger.debug('Graph initialized successfully');
      return of(void 0);
    } catch (error) {
      return throwError(() => new Error(`Graph initialization failed: ${String(error)}`));
    }
  }

  private _setupGraphEventListeners(): void {
    if (!this._graph) return;

    // Selection change events
    this._graph.on('selection:changed', ({ selected, removed: _removed }) => {
      const selectedIds = selected.map(cell => cell.id);
      this._selectionChanged$.next(selectedIds);
    });

    // Cell change events for auto-save triggers
    this._graph.on('cell:changed', ({ cell, options }) => {
      this._handleCellChanged(cell, options);
    });

    this._graph.on('cell:added', ({ cell, options }) => {
      this._handleCellAdded(cell, options);
    });

    this._graph.on('cell:removed', ({ cell, options }) => {
      this._handleCellRemoved(cell, options);
    });
  }

  private _configureAutoSave(_params: DfdInitializationParams): Observable<void> {
    // Configure auto-save based on parameters
    if (params.autoSaveMode) {
      this.autoSaveManager.setPolicyMode(params.autoSaveMode as any);
    }

    return of(void 0);
  }

  private _loadInitialDiagram(_params: DfdInitializationParams): Observable<void> {
    // Load the diagram data
    return this.loadDiagram().pipe(
      map(() => void 0),
      catchError(error => {
        // If load fails, start with empty diagram
        this.logger.warn('Initial diagram load failed, starting with empty diagram', { error });
        return of(void 0);
      })
    );
  }

  private _loadDiagramData(_data: any): Observable<void> {
    // TODO: Implement diagram data loading using LoadDiagramExecutor
    return of(void 0);
  }

  private _getCurrentDiagramData(): any {
    if (!this._graph) return null;

    // TODO: Extract current diagram data from graph
    return {
      nodes: [],
      edges: [],
      properties: {}
    };
  }

  private _saveIfNeeded(): Observable<void> {
    if (this._hasUnsavedChanges && this._operationContext) {
      return this.saveManually().pipe(
        map(() => void 0),
        catchError(() => of(void 0)) // Ignore save errors during cleanup
      );
    }
    return of(void 0);
  }

  private _isWriteOperation(operation: GraphOperation): boolean {
    const writeOperations = [
      'create-node', 'update-node', 'delete-node',
      'create-edge', 'update-edge', 'delete-edge',
      'batch-operation'
    ];
    return writeOperations.includes(operation.type);
  }

  private _handleOperationCompleted(operation: GraphOperation, result: OperationResult): void {
    this._stats.totalOperations++;
    
    if (result.success) {
      this._stats.operationsPerMinute = this._calculateOperationsPerMinute();
      this._hasUnsavedChanges = true;
      
      // Trigger auto-save
      if (this._operationContext) {
        const triggerEvent: AutoSaveTriggerEvent = {
          type: 'operation-completed',
          operationType: operation.type,
          affectedCellIds: result.affectedCellIds,
          timestamp: Date.now()
        };

        const context: AutoSaveContext = {
          diagramId: this._operationContext.diagramId,
          userId: this._operationContext.userId,
          diagramData: this._getCurrentDiagramData(),
          preferredStrategy: 'websocket'
        };

        this.autoSaveManager.trigger(triggerEvent, context).subscribe();
      }
    } else {
      this._stats.errorRate = this._calculateErrorRate();
    }

    this._updateState();
  }

  private _handleOperationError(operation: GraphOperation, error: any): void {
    this._stats.totalOperations++;
    this._stats.errorRate = this._calculateErrorRate();
    this._error = `Operation failed: ${error?.message || String(error)}`;
    this._updateState();
    this._error$.next(this._error);
  }

  private _handleCellChanged(cell: any, options: any): void {
    if (!options?.skipAutoSave) {
      this._hasUnsavedChanges = true;
      this._updateState();
    }
  }

  private _handleCellAdded(cell: any, options: any): void {
    if (!options?.skipAutoSave) {
      this._hasUnsavedChanges = true;
      this._updateState();
    }
  }

  private _handleCellRemoved(cell: any, options: any): void {
    if (!options?.skipAutoSave) {
      this._hasUnsavedChanges = true;
      this._updateState();
    }
  }

  private _updateState(): void {
    const state: DfdState = {
      initialized: this._initialized,
      loading: this._loading,
      collaborating: this._collaborating,
      readOnly: this._readOnly,
      hasUnsavedChanges: this._hasUnsavedChanges,
      lastSaved: this._lastSaved,
      error: this._error
    };

    this._state$.next(state);
  }

  private _createInitialState(): DfdState {
    return {
      initialized: false,
      loading: false,
      collaborating: false,
      readOnly: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      error: null
    };
  }

  private _createEmptyStats(): DfdOperationStats {
    return {
      totalOperations: 0,
      operationsPerMinute: 0,
      averageResponseTime: 0,
      errorRate: 0,
      collaborativeOperations: 0,
      autoSaves: 0
    };
  }

  private _calculateOperationsPerMinute(): number {
    // TODO: Implement proper calculation based on time windows
    return 0;
  }

  private _calculateErrorRate(): number {
    // TODO: Implement proper error rate calculation
    return 0;
  }
}