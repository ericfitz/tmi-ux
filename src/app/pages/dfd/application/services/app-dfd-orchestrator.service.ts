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
import { AuthService } from '../../../../auth/services/auth.service';
import { ServerConnectionService } from '../../../../core/services/server-connection.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { AppGraphOperationManager } from './app-graph-operation-manager.service';
import { AppPersistenceCoordinator } from './app-persistence-coordinator.service';
import { AppDiagramLoadingService } from './app-diagram-loading.service';
import { AppExportService } from './app-export.service';
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
  readonly readOnly: boolean;
  readonly autoSaveMode: 'auto' | 'manual';
  readonly joinCollaboration?: boolean;
}

export interface DfdState {
  readonly initialized: boolean;
  readonly loading: boolean;
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
  autoSaves: number; // Not readonly - needs to be mutable for tracking
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

  // Simplified autosave tracking
  private _lastSavedHistoryIndex = -1;
  private _autoSaveEnabled = true;

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
    private readonly authService: AuthService,
    private readonly serverConnectionService: ServerConnectionService,
    private readonly collaborationService: DfdCollaborationService,
    private readonly appGraphOperationManager: AppGraphOperationManager,
    private readonly appPersistenceCoordinator: AppPersistenceCoordinator,
    private readonly appDiagramLoadingService: AppDiagramLoadingService,
    private readonly appExportService: AppExportService,
    private readonly infraNodeConfigurationService: InfraNodeConfigurationService,
    private readonly dfdInfrastructure: AppDfdFacade,
  ) {
    this.logger.debug('AppDfdOrchestrator initialized (simplified autosave)');
    this._setupEventIntegration();
  }

  /**
   * Initialize the DFD system
   */
  initialize(params: DfdInitializationParams): Observable<boolean> {
    this.logger.debug('AppDfdOrchestrator: Initializing DFD system', {
      diagramId: params.diagramId,
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
    this._autoSaveEnabled = params.autoSaveMode === 'auto';

    return this._performInitialization(params).pipe(
      tap(() => {
        this._updateState({
          initialized: true,
          loading: false,
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

    // Check if in active collaboration session (socket is guaranteed connected if true)
    const isCollaborating = this.collaborationService.isCollaborating();
    const useWebSocket = isCollaborating;

    this.logger.debug('Manual save strategy selection', {
      isCollaborating,
      willUseWebSocket: useWebSocket,
    });

    const saveOperation = {
      diagramId: this._initParams.diagramId,
      threatModelId: this._initParams.threatModelId,
      data: this._getGraphData(),
      metadata: {
        saveType: 'manual',
        userId: this.authService.userId,
        userEmail: this.authService.userEmail,
        userName: this.authService.username,
      },
    };

    return this.appPersistenceCoordinator.save(saveOperation, useWebSocket).pipe(
      map(result => {
        if (result.success) {
          this._stats.autoSaves++;
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
    };

    const graph = this.dfdInfrastructure.getGraph();
    if (!graph) {
      this._updateState({ loading: false, error: 'Graph not initialized' });
      return throwError(() => new Error('Graph not initialized'));
    }

    // Determine if we should allow localStorage fallback (local provider without server)
    const allowLocalStorageFallback = this._isLocalProviderOffline();

    return this.appPersistenceCoordinator.load(loadOperation, allowLocalStorageFallback).pipe(
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
                    exportPrep.viewBox,
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
              graph.toPNG(
                (dataUri: string) => {
                  try {
                    const blob = this._dataUriToBlob(dataUri, 'image/png');
                    observer.next(blob);
                    observer.complete();
                  } catch (error) {
                    observer.error(error);
                  }
                },
                { backgroundColor: 'white', padding: 20, quality: 1 },
              );
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
              graph.toJPEG(
                (dataUri: string) => {
                  try {
                    const blob = this._dataUriToBlob(dataUri, 'image/jpeg');
                    observer.next(blob);
                    observer.complete();
                  } catch (error) {
                    observer.error(error);
                  }
                },
                { backgroundColor: 'white', padding: 20, quality: 0.8 },
              );
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
    return {
      enabled: this._autoSaveEnabled,
      lastSavedHistoryIndex: this._lastSavedHistoryIndex,
      hasUnsavedChanges: this._state$.value.hasUnsavedChanges,
      lastSaved: this._state$.value.lastSaved,
    };
  }

  enableAutoSave(): void {
    this._autoSaveEnabled = true;
    this.logger.debug('Auto-save enabled');
  }

  disableAutoSave(): void {
    this._autoSaveEnabled = false;
    this.logger.debug('Auto-save disabled');
  }

  /**
   * Collaboration management - removed
   * Collaboration state is now managed entirely by DfdCollaborationService
   * Use collaborationService.createSession() / joinSession() / leaveSession() instead
   */

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

  /**
   * Collaboration state observable - removed
   * Use DfdCollaborationService.collaborationState$ instead
   */

  get selectionChanged$(): Observable<string[]> {
    return this.dfdInfrastructure.selectionChanged$.pipe(map(change => change.selected));
  }

  get historyChanged$(): Observable<{ canUndo: boolean; canRedo: boolean }> {
    return this.dfdInfrastructure.historyChanged$;
  }

  get operationCompleted$(): Observable<any> {
    return this.appGraphOperationManager.operationCompleted$;
  }

  get saveCompleted$(): Observable<any> {
    return this.appPersistenceCoordinator.saveStatus$;
  }

  get loadCompleted$(): Observable<any> {
    return this.appPersistenceCoordinator.loadStatus$;
  }

  get error$(): Observable<string> {
    return this._state$.pipe(
      map(state => state.error),
      filter(error => error !== null),
    );
  }

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

      case 'delete':
      case 'backspace': {
        // Delete selected cells
        if (this._state$.value.readOnly) {
          this.logger.debug('Cannot delete cells in read-only mode');
          return true; // Prevent default behavior
        }

        const selectedCells = this.getSelectedCells();
        if (selectedCells.length > 0) {
          this.deleteSelectedCells().subscribe({
            next: result => {
              if (result.success) {
                this.logger.debug('Selected cells deleted via keyboard shortcut', {
                  count: result.metadata?.['deletedCount'],
                });
              }
            },
            error: error => this.logger.error('Delete via keyboard failed', { error }),
          });
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
          });

          return this.dfdInfrastructure.createNodeWithIntelligentPositioning(nodeType, true).pipe(
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
    const graph = this.getGraph;
    if (!graph) {
      return throwError(() => new Error('Graph not initialized'));
    }

    const selectedCellIds = this.getSelectedCells();
    if (selectedCellIds.length === 0) {
      return of({
        success: true,
        operationId: `delete-none-${Date.now()}`,
        operationType: 'delete-node',
        affectedCellIds: [],
        timestamp: Date.now(),
        metadata: { message: 'No cells selected for deletion' },
      });
    }

    // Use the infrastructure facade's deleteSelectedCells method which properly handles
    // both nodes and edges with correct port visibility updates
    return this.dfdInfrastructure.deleteSelectedCells().pipe(
      map(result => ({
        success: result.success,
        operationId: `batch-delete-${Date.now()}`,
        operationType: 'delete-node' as const,
        affectedCellIds: selectedCellIds,
        timestamp: Date.now(),
        metadata: { deletedCount: result.deletedCount },
      })),
      tap(result => {
        if (result.success) {
          this._markUnsavedChanges();
        }
      }),
    );
  }

  /**
   * Save/Load aliases
   */
  saveManually(): Observable<any> {
    return this.save();
  }

  /**
   * Save diagram manually with image data (for thumbnails)
   */
  saveManuallyWithImage(imageData: { svg?: string }): Observable<any> {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debug('AppDfdOrchestrator: Manual save with image triggered', {
      hasSvg: !!imageData.svg,
    });

    const graph = this.dfdInfrastructure.getGraph();

    // Use AppDiagramService (accessed via loading service) to save with image data
    return (this.appDiagramLoadingService as any).diagramService
      .saveDiagramChangesWithImage(
        graph,
        this._initParams.diagramId,
        this._initParams.threatModelId,
        imageData,
      )
      .pipe(
        tap((success: boolean) => {
          if (success) {
            this._updateState({
              hasUnsavedChanges: false,
              lastSaved: new Date(),
            });
            this.logger.info('Diagram saved with image successfully');
          }
        }),
        catchError((error: unknown) => {
          this.logger.error('Manual save with image failed', { error });
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

    // Determine if we should allow localStorage fallback (local provider without server)
    const allowLocalStorageFallback = this._isLocalProviderOffline();

    return this.appPersistenceCoordinator.load(loadOperation, allowLocalStorageFallback).pipe(
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
      userId: this.authService.userId,
      isCollaborating: this.collaborationService.isCollaborating(),
      permissions: ['read', 'write'],
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false,
    };

    // Note: Validation callbacks are now configured directly in graph options during creation

    // Autosave is enabled/disabled based on autoSaveMode param (set in constructor)

    // Special handling for joinCollaboration flow:
    // When joining a collaboration session, we need to wait for the WebSocket connection
    // to be established before loading the diagram.
    if (params.joinCollaboration) {
      this.logger.info(
        'Skipping automatic diagram load - waiting for WebSocket connection (joinCollaboration=true)',
        {
          diagramId: params.diagramId,
        },
      );

      // Initialize with empty diagram - the diagram will be loaded later
      // once the WebSocket connection is established
      this.logger.debug('Diagram initialization complete - waiting for collaboration connection');
      return of(true);
    }

    // Load existing diagram data if available (normal flow without collaboration intent)
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
      }),
    );
  }

  private _setupEventIntegration(): void {
    // Simple history-based auto-save trigger
    this.dfdInfrastructure.historyModified$.subscribe(({ historyIndex, isUndo, isRedo }) => {
      this._markUnsavedChanges();
      this._triggerAutoSave(historyIndex, isUndo, isRedo);
    });
  }

  /**
   * Simplified autosave logic - no queue, no complex tracking
   */
  private _triggerAutoSave(historyIndex: number, _isUndo: boolean, _isRedo: boolean): void {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return;
    }

    // Skip if autosave disabled
    if (!this._autoSaveEnabled) {
      return;
    }

    // Simple deduplication - skip if already saved this history index
    if (historyIndex <= this._lastSavedHistoryIndex) {
      this.logger.debug('Skipping autosave - already saved', {
        historyIndex,
        lastSaved: this._lastSavedHistoryIndex,
      });
      return;
    }

    const diagramId = this._initParams.diagramId;
    const threatModelId = this._initParams.threatModelId;
    const data = this._getGraphData();

    // Check if local provider without server connection (offline mode)
    if (this._isLocalProviderOffline()) {
      this.logger.debug('Saving to localStorage (local provider offline)', { diagramId });
      this.appPersistenceCoordinator.saveToLocalStorage(diagramId, threatModelId, data).subscribe({
        next: result => {
          if (result.success) {
            this._lastSavedHistoryIndex = historyIndex;
            this._stats.autoSaves++;
            this._updateState({
              hasUnsavedChanges: false,
              lastSaved: new Date(),
            });
          }
        },
        error: error => {
          this.logger.error('LocalStorage autosave failed', { error, diagramId });
        },
      });
      return;
    }

    // Normal save - WebSocket (if in collaboration session) or REST
    // If isCollaborating() returns true, WebSocket is guaranteed to be connected
    const isCollaborating = this.collaborationService.isCollaborating();
    const useWebSocket = isCollaborating;

    this.logger.debug('Autosave strategy selection', {
      isCollaborating,
      willUseWebSocket: useWebSocket,
    });

    const saveOperation = {
      diagramId,
      threatModelId,
      data,
      metadata: {
        saveType: 'auto',
        historyIndex,
        userId: this.authService.userId,
        userEmail: this.authService.userEmail,
        userName: this.authService.username,
      },
    };

    this.appPersistenceCoordinator.save(saveOperation, useWebSocket).subscribe({
      next: result => {
        if (result.success) {
          this._lastSavedHistoryIndex = historyIndex;
          this._stats.autoSaves++;
          this._updateState({
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
          this.logger.debug('Autosave completed', {
            historyIndex,
            strategy: useWebSocket ? 'WebSocket' : 'REST',
          });
        }
      },
      error: error => {
        this.logger.error('Autosave failed', {
          error,
          diagramId,
          historyIndex,
        });
      },
    });
  }

  /**
   * Check if we're using local provider without server connection
   */
  private _isLocalProviderOffline(): boolean {
    const isLocalProvider = (this.authService as any).isUsingLocalProvider;
    const isServerReachable = this.serverConnectionService.currentDetailedStatus.isServerReachable;

    return isLocalProvider && !isServerReachable;
  }

  private _getGraphData(): any {
    const graph = this.dfdInfrastructure.getGraph();
    if (!graph) {
      return { nodes: [], edges: [] };
    }

    const graphJson = graph.toJSON();
    const cells = graphJson.cells || [];

    const nodes = cells
      .filter((cell: any) => cell.shape !== 'edge')
      .map((cell: any) => ({
        ...cell,
        type: 'node',
      }));

    const edges = cells
      .filter((cell: any) => cell.shape === 'edge')
      .map((cell: any) => ({
        ...cell,
        type: 'edge',
      }));

    return { nodes, edges };
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
      readOnly: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      error: null,
    };
  }

  // Simplified autosave - no strategy context needed

  // Plugin setup is now handled by the infrastructure facade/graph adapter

  // History filtering is now handled by the infrastructure facade/graph adapter
}
