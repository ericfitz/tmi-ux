/**
 * AppDfdOrchestrator - Main coordination service for the new DFD architecture
 *
 * This service orchestrates all DFD operations and serves as the main entry point:
 * - DFD system initialization and management
 * - Operation coordination between components
 * - State management and monitoring
 * - Integration with X6 graph library
 * - Collaboration and auto-save coordination
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap, filter } from 'rxjs/operators';
import '@antv/x6-plugin-export';

import { LoggerService } from '../../../../core/services/logger.service';
import { AppGraphOperationManager } from './app-graph-operation-manager.service';
import {
  AppPersistenceCoordinator,
  StrategySelectionContext,
} from './app-persistence-coordinator.service';
import { AppAutoSaveManager } from './app-auto-save-manager.service';
import { AppDiagramLoadingService } from './app-diagram-loading.service';
import { AppExportService } from './app-export.service';
import { InfraRestPersistenceStrategy } from '../../infrastructure/strategies/infra-rest-persistence.strategy';
import { WebSocketPersistenceStrategy } from '../../infrastructure/strategies/infra-websocket-persistence.strategy';
import { InfraCacheOnlyPersistenceStrategy } from '../../infrastructure/strategies/infra-cache-only-persistence.strategy';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { AppDfdFacade } from '../facades/app-dfd.facade';
import { NodeType } from '../../domain/value-objects/node-info';
import {
  GraphOperation,
  OperationContext,
  OperationResult,
  CreateNodeOperation,
  NodeData,
} from '../../types/graph-operation.types';

// Simple interfaces that match what the tests expect
export interface DfdInitializationParams {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly containerElement: HTMLElement;
  readonly collaborationEnabled: boolean;
  readonly readOnly: boolean;
  readonly autoSaveMode: 'aggressive' | 'normal' | 'conservative' | 'manual';
  readonly joinCollaboration?: boolean;
}

export interface DfdState {
  readonly initialized: boolean;
  readonly loading: boolean;
  readonly collaborating: boolean;
  readonly readOnly: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly lastSaved: Date | null;
  readonly error: string | null;
  readonly diagramId?: string;
  readonly threatModelId?: string;
}

export interface DfdStats {
  readonly totalOperations: number;
  readonly operationsPerMinute: number;
  readonly errorRate: number;
  readonly uptime: number;
  readonly lastActivity: Date | null;
  readonly collaborativeOperations: number;
  readonly autoSaves: number;
}

export interface ExportFormat {
  readonly format: 'svg' | 'png' | 'jpeg' | 'pdf' | 'json';
  readonly options?: Record<string, any>;
}

@Injectable()
export class AppDfdOrchestrator {
  private readonly _state$ = new BehaviorSubject<DfdState>(this._createInitialState());
  private readonly _stateChanged$ = new Subject<DfdState>();

  // Graph is now managed by the infrastructure facade, not directly by the orchestrator
  private _initParams: DfdInitializationParams | null = null;
  private _operationContext: OperationContext | null = null;
  private _containerElement: HTMLElement | null = null;
  private _startTime = Date.now();
  private _collaborationIntent = false;

  // Statistics tracking
  private _stats: DfdStats = {
    totalOperations: 0,
    operationsPerMinute: 0,
    errorRate: 0,
    uptime: 0,
    lastActivity: null,
    collaborativeOperations: 0,
    autoSaves: 0,
  };

  private _totalErrors = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly appGraphOperationManager: AppGraphOperationManager,
    private readonly appPersistenceCoordinator: AppPersistenceCoordinator,
    private readonly appAutoSaveManager: AppAutoSaveManager,
    private readonly appDiagramLoadingService: AppDiagramLoadingService,
    private readonly appExportService: AppExportService,
    private readonly infraNodeConfigurationService: InfraNodeConfigurationService,
    private readonly restStrategy: InfraRestPersistenceStrategy,
    private readonly webSocketStrategy: WebSocketPersistenceStrategy,
    private readonly cacheOnlyStrategy: InfraCacheOnlyPersistenceStrategy,
    private readonly dfdInfrastructure: AppDfdFacade,
  ) {
    this.logger.debug('AppDfdOrchestrator initialized');
    this._setupEventIntegration();
    this._setupPersistenceStrategies();
  }

  /**
   * Initialize the DFD system
   */
  initialize(params: DfdInitializationParams): Observable<boolean> {
    this.logger.debug('AppDfdOrchestrator: Initializing DFD system', {
      diagramId: params.diagramId,
      collaborationEnabled: params.collaborationEnabled,
      readOnly: params.readOnly,
    });

    // Check if already initialized
    if (this._state$.value.initialized) {
      return throwError(() => new Error('DFD system is already initialized'));
    }

    // Update state to loading
    this._updateState({
      loading: true,
      error: null,
    });

    this._initParams = params;
    this._containerElement = params.containerElement;
    this._collaborationIntent = params.joinCollaboration || false;

    return this._performInitialization(params).pipe(
      tap(() => {
        this._updateState({
          initialized: true,
          loading: false,
          collaborating: params.collaborationEnabled,
          readOnly: params.readOnly,
          diagramId: params.diagramId,
          threatModelId: params.threatModelId,
        });
      }),
      catchError(error => {
        this._updateState({
          loading: false,
          error: error.message || 'Initialization failed',
        });
        this.logger.error('DFD initialization failed', { error });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Execute a single graph operation
   */
  executeOperation(operation: GraphOperation): Observable<OperationResult> {
    if (!this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    if (this._state$.value.readOnly) {
      return throwError(() => new Error('Cannot execute operations in read-only mode'));
    }

    this.logger.debug('AppDfdOrchestrator: Executing operation', {
      operationType: operation.type,
      operationId: operation.id,
    });

    this._stats = {
      ...this._stats,
      totalOperations: this._stats.totalOperations + 1,
      lastActivity: new Date(),
    };
    this._updateStats();

    return this.appGraphOperationManager.execute(operation, this._operationContext).pipe(
      tap(result => {
        if (result.success) {
          this._markUnsavedChanges();
          this._triggerAutoSave(operation, result);
        } else {
          this._totalErrors++;
          this._updateStats();
        }
      }),
      catchError(error => {
        this._totalErrors++;
        this._updateStats();
        this.logger.error('Operation execution failed', { error, operation });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Execute multiple operations as a batch
   */
  executeBatch(operations: GraphOperation[]): Observable<OperationResult[]> {
    if (!this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    if (this._state$.value.readOnly) {
      return throwError(() => new Error('Cannot execute operations in read-only mode'));
    }

    this.logger.debug('AppDfdOrchestrator: Executing batch operations', {
      operationCount: operations.length,
    });

    this._stats = {
      ...this._stats,
      totalOperations: this._stats.totalOperations + operations.length,
      lastActivity: new Date(),
    };
    this._updateStats();

    return this.appGraphOperationManager.executeBatch(operations, this._operationContext).pipe(
      tap(results => {
        const successfulResults = results.filter(r => r.success);
        if (successfulResults.length > 0) {
          this._markUnsavedChanges();
          // Trigger auto-save for batch operations
          this._triggerAutoSaveForBatch(operations, results);
        }

        const errorCount = results.filter(r => !r.success).length;
        this._totalErrors += errorCount;
        this._updateStats();
      }),
      catchError(error => {
        this._totalErrors += operations.length;
        this._updateStats();
        this.logger.error('Batch execution failed', { error, operationCount: operations.length });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Manually save the diagram
   */
  save(): Observable<boolean> {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debug('AppDfdOrchestrator: Manual save triggered');

    const autoSaveContext = {
      diagramId: this._initParams.diagramId,
      userId: 'current-user', // In real implementation, get from auth service
      diagramData: this._getGraphData(),
      preferredStrategy: 'websocket',
    };

    return this.appAutoSaveManager.triggerManualSave(autoSaveContext).pipe(
      map(result => {
        if (result.success) {
          this._updateState({
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
          return true;
        }
        return false;
      }),
      catchError(error => {
        this.logger.error('Manual save failed', { error });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Load diagram data
   */
  load(diagramId?: string): Observable<boolean> {
    const targetDiagramId = diagramId || this._initParams?.diagramId;
    const threatModelId = this._initParams?.threatModelId;

    if (!targetDiagramId) {
      return throwError(() => new Error('No diagram ID provided'));
    }

    if (!threatModelId) {
      return throwError(() => new Error('No threat model ID available'));
    }

    this.logger.debug('AppDfdOrchestrator: Loading diagram', {
      diagramId: targetDiagramId,
      threatModelId,
    });

    this._updateState({ loading: true });

    const loadOperation = {
      diagramId: targetDiagramId,
      threatModelId,
      forceRefresh: false,
    };

    const graph = this.dfdInfrastructure.getGraph();
    if (!graph) {
      this._updateState({ loading: false, error: 'Graph not initialized' });
      return throwError(() => new Error('Graph not initialized'));
    }

    return this.appPersistenceCoordinator.load(loadOperation, this._createStrategyContext()).pipe(
      map(result => {
        if (result.success && result.data && result.data.cells) {
          this.logger.info('Diagram data loaded from persistence, loading cells into graph', {
            cellCount: result.data.cells.length,
          });

          // Use AppDiagramLoadingService to properly load cells into the graph
          // This ensures all edges get connector/router defaults from the domain layer
          this.appDiagramLoadingService.loadCellsIntoGraph(
            result.data.cells,
            graph,
            targetDiagramId,
            this.dfdInfrastructure.graphAdapter,
            {
              clearExisting: true,
              suppressHistory: true,
              updateEmbedding: true,
              source: 'orchestrator-load',
            },
          );

          this._updateState({
            loading: false,
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
          return true;
        }
        this._updateState({ loading: false });
        return false;
      }),
      catchError(error => {
        this._updateState({
          loading: false,
          error: error.message || 'Load failed',
        });
        this.logger.error('Diagram load failed', { error });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Export diagram in various formats
   */
  export(format: ExportFormat): Observable<Blob> {
    const graph = this.getGraph;
    if (!graph) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debug('AppDfdOrchestrator: Exporting diagram', { format: format.format });

    switch (format.format) {
      case 'svg': {
        if (graph.toSVG) {
          return new Observable<Blob>(observer => {
            try {
              // Prepare export with proper viewBox calculation
              const exportPrep = this.appExportService.prepareImageExport(graph);
              if (!exportPrep) {
                observer.error(new Error('Failed to prepare SVG export - no cells to export'));
                return;
              }

              graph.toSVG((svgString: string) => {
                try {
                  // Optimize SVG for export
                  const optimizedSvg = this.appExportService.processSvg(
                    svgString,
                    false,
                    exportPrep.viewBox
                  );
                  const blob = new Blob([optimizedSvg], { type: 'image/svg+xml' });
                  observer.next(blob);
                  observer.complete();
                } catch (error) {
                  observer.error(error);
                }
              }, exportPrep.exportOptions);
            } catch (error) {
              observer.error(error);
            }
          });
        }
        return throwError(() => new Error('SVG export not supported by graph library'));
      }
      case 'png': {
        if (graph.toPNG) {
          return new Observable<Blob>(observer => {
            try {
              graph.toPNG((dataUri: string) => {
                try {
                  const blob = this._dataUriToBlob(dataUri, 'image/png');
                  observer.next(blob);
                  observer.complete();
                } catch (error) {
                  observer.error(error);
                }
              }, { backgroundColor: 'white', padding: 20, quality: 1 });
            } catch (error) {
              observer.error(error);
            }
          });
        }
        return throwError(() => new Error('PNG export not supported by graph library'));
      }
      case 'jpeg': {
        if (graph.toJPEG) {
          return new Observable<Blob>(observer => {
            try {
              graph.toJPEG((dataUri: string) => {
                try {
                  const blob = this._dataUriToBlob(dataUri, 'image/jpeg');
                  observer.next(blob);
                  observer.complete();
                } catch (error) {
                  observer.error(error);
                }
              }, { backgroundColor: 'white', padding: 20, quality: 0.8 });
            } catch (error) {
              observer.error(error);
            }
          });
        }
        return throwError(() => new Error('JPEG export not supported by graph library'));
      }
      case 'json': {
        const jsonString = JSON.stringify(this._getGraphData(), null, 2);
        return of(new Blob([jsonString], { type: 'application/json' }));
      }
      case 'pdf':
        return throwError(() => new Error(`Unsupported export format: ${format.format}`));
      default:
        return throwError(() => new Error(`Unsupported export format: ${format.format}`));
    }
  }

  /**
   * Auto-save management
   */
  getAutoSaveState(): any {
    return this.appAutoSaveManager.getState();
  }

  enableAutoSave(): void {
    this.appAutoSaveManager.enable();
    this.logger.debug('Auto-save enabled');
  }

  disableAutoSave(): void {
    this.appAutoSaveManager.disable();
    this.logger.debug('Auto-save disabled');
  }

  /**
   * Collaboration management
   */
  startCollaboration(): Observable<boolean> {
    this.logger.debug('AppDfdOrchestrator: Starting collaboration');
    this._updateState({ collaborating: true });
    return of(true);
  }

  stopCollaboration(): Observable<boolean> {
    this.logger.debug('AppDfdOrchestrator: Stopping collaboration');
    this._updateState({ collaborating: false });
    return of(true);
  }

  /**
   * Selection management
   */
  selectAll(): void {
    const graph = this.getGraph;
    if (graph) {
      if (typeof graph.selectAll === 'function') {
        graph.selectAll();
      } else {
        graph.select(graph.getCells());
      }
      this.logger.debug('All cells selected');
    }
  }

  clearSelection(): void {
    const graph = this.getGraph;
    if (graph) {
      // Use known working X6 API: get selected cells and unselect them
      const selectedCells = this.getSelectedCells();
      selectedCells.forEach(cellId => {
        const cell = graph.getCellById(cellId);
        if (cell) {
          graph.unselect(cell);
        }
      });
      this.logger.debug('Selection cleared');
    }
  }

  getSelectedCells(): string[] {
    const graph = this.getGraph;
    if (!graph) {
      return [];
    }

    // Use the native X6 getSelectedCells method
    const selectedCells = graph.getSelectedCells();
    return selectedCells.map((cell: any) => cell.id);
  }

  /**
   * State management
   */
  setReadOnlyMode(readOnly: boolean): void {
    this._updateState({ readOnly });
    this.logger.debug('Read-only mode changed', { readOnly });
  }

  setReadOnly(readOnly: boolean): void {
    this.setReadOnlyMode(readOnly);
  }

  getState(): DfdState {
    return this._state$.value;
  }

  get stateChanged$(): Observable<DfdState> {
    return this._stateChanged$.asObservable();
  }

  get state$(): Observable<DfdState> {
    return this._state$.asObservable();
  }

  get collaborationStateChanged$(): Observable<boolean> {
    return this._state$.pipe(
      map(state => state.collaborating),
      filter((value, index) => index === 0 || value !== this._previousCollaborationState),
      tap(value => (this._previousCollaborationState = value)),
    );
  }

  private _previousCollaborationState = false;

  /**
   * Event handling
   */
  handleWindowResize(): void {
    const graph = this.getGraph;
    if (graph) {
      graph.resize();
      this.logger.debug('Graph resized for window resize');
    }
  }

  handleKeyboardShortcut(shortcut: string): boolean {
    this.logger.debug('Keyboard shortcut handled', { shortcut });

    switch (shortcut) {
      case 'ctrl+s':
        // Trigger manual save
        if (this._initParams && this.dfdInfrastructure.getGraph()) {
          this.saveManually().subscribe({
            next: () => this.logger.debug('Manual save triggered via keyboard shortcut'),
            error: error => this.logger.error('Manual save failed', { error }),
          });
        }
        return true;

      case 'ctrl+a': {
        // Select all
        const graph = this.getGraph;
        if (graph?.selectAll) {
          graph.selectAll();
        } else {
          this.selectAll();
        }
        return true;
      }

      case 'escape': {
        // Clear selection
        const clearGraph = this.getGraph;
        if (clearGraph?.cleanSelection) {
          clearGraph.cleanSelection();
        } else {
          this.clearSelection();
        }
        return true;
      }

      default:
        // Unhandled shortcut
        return false;
    }
  }

  handleContextMenu(event: MouseEvent): boolean {
    this.logger.debug('Context menu handled', { x: event.clientX, y: event.clientY });
    event.preventDefault();
    // Implementation would show context menu
    return true;
  }

  /**
   * Graph access
   */
  get getGraph(): any {
    // Delegate to the infrastructure facade which properly manages the graph
    return this.dfdInfrastructure.getGraph();
  }

  /**
   * High-level user actions
   */
  addNode(nodeData: NodeData): Observable<OperationResult>;
  addNode(nodeType: string, position?: { x: number; y: number }): Observable<OperationResult>;
  addNode(
    nodeDataOrType: NodeData | string,
    position?: { x: number; y: number },
  ): Observable<OperationResult> {
    if (!this._operationContext) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    if (this._state$.value.readOnly) {
      return throwError(() => new Error('Cannot add nodes in read-only mode'));
    }

    if (!this._containerElement) {
      return throwError(() => new Error('Container element not available'));
    }

    try {
      if (typeof nodeDataOrType === 'string') {
        // Handle the (nodeType, position) signature - use InfraNodeService for intelligent positioning
        const nodeType = nodeDataOrType as NodeType;

        // Use InfraNodeService's intelligent positioning algorithm if no position provided
        if (!position) {
          this.logger.debug('Using InfraNodeService intelligent positioning for node creation', {
            nodeType,
            containerSize: {
              width: this._containerElement.clientWidth,
              height: this._containerElement.clientHeight,
            },
          });

          return this.dfdInfrastructure
            .createNodeWithIntelligentPositioning(
              nodeType,
              this._containerElement.clientWidth,
              this._containerElement.clientHeight,
              this._initParams?.diagramId || 'unknown',
              true, // isInitialized
            )
            .pipe(
              map(() => ({
                success: true,
                operationId: `create-node-${Date.now()}`,
                operationType: 'create-node' as const,
                affectedCellIds: [], // Facade doesn't return the node ID, but creation will succeed
                timestamp: Date.now(),
                metadata: {
                  nodeType,
                  usedIntelligentPositioning: true,
                  method: 'AppDfdFacade.createNodeWithIntelligentPositioning',
                },
              })),
              catchError(error => {
                this.logger.error('AppDfdFacade node creation failed', {
                  error,
                  nodeType,
                });
                return of({
                  success: false,
                  operationId: `create-node-${Date.now()}`,
                  operationType: 'create-node' as const,
                  affectedCellIds: [],
                  timestamp: Date.now(),
                  error: `AppDfdFacade creation failed: ${error.message}`,
                });
              }),
            );
        } else {
          // Position provided - fall back to operation manager for explicit positioning
          const nodeData: NodeData = {
            nodeType: nodeType as any,
            position,
            size: { width: 120, height: 60 },
            label: nodeType,
            style: {},
            properties: {},
          };

          const operation: CreateNodeOperation = {
            id: `create-node-${Date.now()}`,
            type: 'create-node',
            source: 'user-interaction',
            priority: 'normal',
            timestamp: Date.now(),
            nodeData,
          };

          this.logger.debug('Using AppGraphOperationManager for explicit positioning', {
            nodeType,
            position,
          });

          return this.executeOperation(operation);
        }
      } else {
        // Handle the NodeData signature - fall back to operation manager
        const operation: CreateNodeOperation = {
          id: `create-node-${Date.now()}`,
          type: 'create-node',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          nodeData: nodeDataOrType,
        };

        this.logger.debug('Using AppGraphOperationManager for NodeData signature', {
          nodeType: nodeDataOrType.nodeType,
        });

        return this.executeOperation(operation);
      }
    } catch (error) {
      this.logger.error('Error in addNode method', { error });
      return of({
        success: false,
        operationId: `create-node-${Date.now()}`,
        operationType: 'create-node' as const,
        affectedCellIds: [],
        timestamp: Date.now(),
        error: `addNode failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  deleteSelectedCells(): Observable<OperationResult> {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length === 0) {
      return of({
        success: true,
        operationId: `delete-none-${Date.now()}`,
        operationType: 'delete-node',
        affectedCellIds: [],
        timestamp: Date.now(),
        metadata: { message: 'No cells selected for deletion' },
      });
    }

    const deleteOperations = selectedCells.map(cellId => ({
      id: `delete-${cellId}-${Date.now()}`,
      type: 'delete-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cellId,
    }));

    return this.executeBatch(deleteOperations).pipe(
      map(results => ({
        success: results.every(r => r.success),
        operationId: `batch-delete-${Date.now()}`,
        operationType: 'delete-node' as const,
        affectedCellIds: results.flatMap(r => r.affectedCellIds),
        timestamp: Date.now(),
        metadata: { deletedCount: results.length },
      })),
    );
  }

  /**
   * Save/Load aliases
   */
  saveManually(): Observable<any> {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debug('AppDfdOrchestrator: Manual save triggered');

    const autoSaveContext = {
      diagramId: this._initParams.diagramId,
      userId: 'current-user',
      diagramData: this._getGraphData(),
      preferredStrategy: 'websocket',
    };

    return this.appAutoSaveManager.triggerManualSave(autoSaveContext).pipe(
      tap(result => {
        if (result.success) {
          this._updateState({
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
        }
      }),
      catchError(error => {
        this.logger.error('Manual save failed', { error });
        return throwError(() => error);
      }),
    );
  }

  loadDiagram(forceLoad?: boolean): Observable<any>;
  loadDiagram(diagramId?: string, forceLoad?: boolean): Observable<any>;
  loadDiagram(diagramIdOrForceLoad?: string | boolean, forceLoad = false): Observable<any> {
    let targetDiagramId: string | undefined;
    let shouldForceLoad = false;

    if (typeof diagramIdOrForceLoad === 'boolean') {
      // Called as loadDiagram(forceLoad)
      shouldForceLoad = diagramIdOrForceLoad;
      targetDiagramId = this._initParams?.diagramId;
    } else {
      // Called as loadDiagram(diagramId, forceLoad)
      targetDiagramId = diagramIdOrForceLoad || this._initParams?.diagramId;
      shouldForceLoad = forceLoad;
    }

    if (!shouldForceLoad && this._state$.value.hasUnsavedChanges) {
      return throwError(() => new Error('Unsaved changes exist. Use forceLoad=true to override.'));
    }

    if (!targetDiagramId) {
      return throwError(() => new Error('No diagram ID provided'));
    }

    const threatModelId = this._initParams?.threatModelId;
    if (!threatModelId) {
      return throwError(() => new Error('No threat model ID available'));
    }

    this.logger.debug('AppDfdOrchestrator: Loading diagram', {
      diagramId: targetDiagramId,
      threatModelId,
    });

    this._updateState({ loading: true });

    const loadOperation = {
      diagramId: targetDiagramId,
      threatModelId,
      forceRefresh: shouldForceLoad,
    };

    const graph = this.dfdInfrastructure.getGraph();
    if (!graph) {
      this._updateState({ loading: false, error: 'Graph not initialized' });
      return throwError(() => new Error('Graph not initialized'));
    }

    return this.appPersistenceCoordinator.load(loadOperation, this._createStrategyContext()).pipe(
      tap(result => {
        if (result.success && result.data && result.data.cells) {
          this.logger.info('Diagram data loaded from persistence, loading cells into graph', {
            cellCount: result.data.cells.length,
          });

          // Use AppDiagramLoadingService to properly load cells into the graph
          // This ensures all edges get connector/router defaults from the domain layer
          this.appDiagramLoadingService.loadCellsIntoGraph(
            result.data.cells,
            graph,
            targetDiagramId,
            this.dfdInfrastructure.graphAdapter,
            {
              clearExisting: true,
              suppressHistory: true,
              updateEmbedding: true,
              source: 'orchestrator-loadDiagram',
            },
          );

          this._updateState({
            loading: false,
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
        }
      }),
      catchError(error => {
        this._updateState({
          loading: false,
          error: error.message || 'Load failed',
        });
        this.logger.error('Diagram load failed', { error });
        return throwError(() => error);
      }),
    );
  }

  get _hasUnsavedChanges(): boolean {
    return this._state$.value.hasUnsavedChanges;
  }

  set _hasUnsavedChanges(value: boolean) {
    this._updateState({ hasUnsavedChanges: value });
  }

  /**
   * Export aliases
   */
  exportDiagram(format: string): Observable<Blob> {
    return this.export({ format: format as any });
  }

  /**
   * Event handling aliases
   */
  onWindowResize(): void {
    this.handleWindowResize();
  }

  onKeyDown(event: KeyboardEvent): boolean {
    const shortcut = this._getKeyboardShortcut(event);
    return this.handleKeyboardShortcut(shortcut);
  }

  onContextMenu(event: MouseEvent): boolean {
    return this.handleContextMenu(event);
  }

  private _getKeyboardShortcut(event: KeyboardEvent): string {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * Statistics and monitoring
   */
  getStats(): DfdStats {
    return { ...this._stats };
  }

  resetStats(): void {
    this._stats = {
      totalOperations: 0,
      operationsPerMinute: 0,
      errorRate: 0,
      uptime: 0,
      lastActivity: null,
      collaborativeOperations: 0,
      autoSaves: 0,
    };
    this._totalErrors = 0;
    this._startTime = Date.now();
    this.logger.debug('Statistics reset');
  }

  /**
   * Cleanup and destruction
   */
  destroy(): Observable<boolean> {
    this.logger.debug('AppDfdOrchestrator: Destroying DFD system');

    // Graph disposal is now handled by the infrastructure facade
    this.dfdInfrastructure.dispose();

    this._updateState(this._createInitialState());
    this._initParams = null;
    this._operationContext = null;

    return of(true);
  }

  reset(): Observable<boolean> {
    this.logger.debug('AppDfdOrchestrator: Resetting DFD system');

    return this.destroy().pipe(
      switchMap(() => {
        if (this._initParams) {
          return this.initialize(this._initParams);
        }
        return of(true);
      }),
    );
  }

  /**
   * Private implementation methods
   */
  private _performInitialization(params: DfdInitializationParams): Observable<boolean> {
    // Initialize the graph through the infrastructure facade instead of creating our own
    this.dfdInfrastructure.initializeGraph(params.containerElement);

    // The graph is now properly initialized with history filtering
    // Continue with the rest of initialization
    return this._continueInitialization(params);
  }

  private _continueInitialization(params: DfdInitializationParams): Observable<boolean> {
    // Graph is now properly initialized by the facade with history filtering
    // Create operation context using the facade's graph
    this._operationContext = {
      graph: this.dfdInfrastructure.getGraph(),
      diagramId: params.diagramId,
      threatModelId: params.threatModelId,
      userId: 'current-user', // In real implementation, get from auth service
      isCollaborating: params.collaborationEnabled,
      permissions: ['read', 'write'],
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false,
    };

    // Note: Validation callbacks are now configured directly in graph options during creation

    // Configure auto-save manager
    this.appAutoSaveManager.setPolicyMode(params.autoSaveMode);

    // Load existing diagram data if available
    return this.load(params.diagramId).pipe(
      catchError(() => {
        // If load fails, just continue with empty diagram
        this.logger.debug('No existing diagram data found, starting with empty diagram');
        return of(true);
      }),
      tap(() => {
        // History is always enabled now - just clear the diagram loading state
        // to allow normal history recording after initialization
        this.logger.debug(
          'Diagram initialization complete - history filtering via GraphHistoryCoordinator',
        );
        if (params.collaborationEnabled) {
          this.logger.debug('Collaboration mode enabled - history managed by server');
        }
      }),
    );
  }

  private _setupEventIntegration(): void {
    // Listen to operation completed events and trigger auto-save
    this.appGraphOperationManager.operationCompleted$.subscribe(event => {
      this._markUnsavedChanges();
      this._triggerAutoSave(event.operation, event.result);
    });

    // Listen to auto-save completed events
    this.appAutoSaveManager.saveCompleted$.subscribe(result => {
      if (result.success) {
        this._updateState({
          hasUnsavedChanges: false,
          lastSaved: new Date(),
        });
      }
    });
  }

  private _setupPersistenceStrategies(): void {
    this.logger.debug('Setting up persistence strategies');

    // Register all available persistence strategies
    this.appPersistenceCoordinator.addStrategy(this.restStrategy);
    this.appPersistenceCoordinator.addStrategy(this.webSocketStrategy);
    this.appPersistenceCoordinator.addStrategy(this.cacheOnlyStrategy);

    // Set fallback strategy to REST API
    this.appPersistenceCoordinator.setFallbackStrategy('rest');

    this.logger.debug('Persistence strategies registered', {
      strategies: this.appPersistenceCoordinator.getStrategies().map(s => s.type),
      fallbackStrategy: 'rest',
    });
  }

  private _triggerAutoSave(operation: GraphOperation, result: OperationResult): void {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return;
    }

    const triggerEvent = {
      type: 'operation-completed' as const,
      operationType: operation.type,
      affectedCellIds: result.affectedCellIds,
      timestamp: Date.now(),
    };

    const autoSaveContext = {
      diagramId: this._initParams.diagramId,
      userId: 'current-user',
      diagramData: this._getGraphData(),
      preferredStrategy: 'websocket',
    };

    if (this.appAutoSaveManager.trigger) {
      this.appAutoSaveManager.trigger(triggerEvent, autoSaveContext)?.subscribe?.();
    }
  }

  private _triggerAutoSaveForBatch(
    _operations: GraphOperation[],
    results: OperationResult[],
  ): void {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return;
    }

    const triggerEvent = {
      type: 'operation-completed' as const,
      operationType: 'batch',
      affectedCellIds: results.flatMap(r => r.affectedCellIds),
      timestamp: Date.now(),
    };

    const autoSaveContext = {
      diagramId: this._initParams.diagramId,
      userId: 'current-user',
      diagramData: this._getGraphData(),
      preferredStrategy: 'websocket',
    };

    if (this.appAutoSaveManager.trigger) {
      this.appAutoSaveManager.trigger(triggerEvent, autoSaveContext)?.subscribe?.();
    }
  }

  private _getGraphData(): any {
    const graph = this.dfdInfrastructure.getGraph();
    if (!graph) {
      return { nodes: [], edges: [] };
    }
    return {
      nodes: graph.getNodes().map((node: any) => ({
        id: node.id,
        shape: node.shape,
        position: node.getPosition(),
        size: node.getSize(),
        attrs: node.getAttrs(),
        data: node.getData(),
      })),
      edges: graph.getEdges().map((edge: any) => ({
        id: edge.id,
        shape: edge.shape,
        source: edge.getSource(),
        target: edge.getTarget(),
        attrs: edge.getAttrs(),
        data: edge.getData(),
      })),
    };
  }

  /**
   * Convert data URI to Blob for image exports
   */
  private _dataUriToBlob(dataUri: string, mimeType: string): Blob {
    const byteString = atob(dataUri.split(',')[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  }

  private _markUnsavedChanges(): void {
    if (!this._state$.value.hasUnsavedChanges) {
      this._updateState({ hasUnsavedChanges: true });
    }
  }

  private _updateState(partialState: Partial<DfdState>): void {
    const currentState = this._state$.value;
    const newState = { ...currentState, ...partialState };
    this._state$.next(newState);
    this._stateChanged$.next(newState);
  }

  private _updateStats(): void {
    const uptimeMs = Date.now() - this._startTime;
    const uptimeMinutes = uptimeMs / (1000 * 60);

    this._stats = {
      ...this._stats,
      uptime: uptimeMs,
      operationsPerMinute: uptimeMinutes > 0 ? this._stats.totalOperations / uptimeMinutes : 0,
      errorRate:
        this._stats.totalOperations > 0 ? this._totalErrors / this._stats.totalOperations : 0,
    };
  }

  private _createInitialState(): DfdState {
    return {
      initialized: false,
      loading: false,
      collaborating: false,
      readOnly: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      error: null,
    };
  }

  /**
   * Create strategy selection context based on current state
   */
  private _createStrategyContext(): StrategySelectionContext {
    return {
      collaborationIntent: this._collaborationIntent,
      allowOfflineMode: true, // Allow offline fallback unless explicitly disabled
      fastTimeout: this._collaborationIntent, // Use faster timeouts for collaboration
    };
  }

  // Plugin setup is now handled by the infrastructure facade/graph adapter

  // History filtering is now handled by the infrastructure facade/graph adapter
}
