/**
 * DfdOrchestrator - Main coordination service for the new DFD architecture
 *
 * This service orchestrates all DFD operations and serves as the main entry point:
 * - DFD system initialization and management
 * - Operation coordination between components
 * - State management and monitoring
 * - Integration with X6 graph library
 * - Collaboration and auto-save coordination
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, throwError, merge } from 'rxjs';
import { map, catchError, timeout, tap, finalize, switchMap, filter } from 'rxjs/operators';
import { Graph } from '@antv/x6';

import { LoggerService } from '../../../../core/services/logger.service';
import { GraphOperationManager } from './graph-operation-manager.service';
import { PersistenceCoordinator } from './persistence-coordinator.service';
import { AutoSaveManager } from './auto-save-manager.service';
import {
  GraphOperation,
  OperationContext,
  OperationResult,
  CreateNodeOperation,
  NodeData,
} from '../types/graph-operation.types';

// Simple interfaces that match what the tests expect
export interface DfdInitializationParams {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly containerElement: HTMLElement;
  readonly collaborationEnabled: boolean;
  readonly readOnly: boolean;
  readonly autoSaveMode: 'aggressive' | 'normal' | 'conservative' | 'manual';
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
}

export interface ExportFormat {
  readonly format: 'svg' | 'png' | 'pdf' | 'json';
  readonly options?: Record<string, any>;
}

@Injectable({
  providedIn: 'root',
})
export class DfdOrchestrator {
  private readonly _state$ = new BehaviorSubject<DfdState>(this._createInitialState());
  private readonly _stateChanged$ = new Subject<DfdState>();

  private _graph: Graph | null = null;
  private _initParams: DfdInitializationParams | null = null;
  private _operationContext: OperationContext | null = null;
  private _startTime = Date.now();

  // Statistics tracking
  private _stats: DfdStats = {
    totalOperations: 0,
    operationsPerMinute: 0,
    errorRate: 0,
    uptime: 0,
    lastActivity: null,
  };

  private _totalErrors = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly graphOperationManager: GraphOperationManager,
    private readonly persistenceCoordinator: PersistenceCoordinator,
    private readonly autoSaveManager: AutoSaveManager,
  ) {
    this.logger.debug('DfdOrchestrator initialized');
    this._setupEventIntegration();
  }

  /**
   * Initialize the DFD system
   */
  initialize(params: DfdInitializationParams): Observable<boolean> {
    this.logger.debug('DfdOrchestrator: Initializing DFD system', {
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

    this.logger.debug('DfdOrchestrator: Executing operation', {
      operationType: operation.type,
      operationId: operation.id,
    });

    this._stats.totalOperations++;
    this._stats.lastActivity = new Date();
    this._updateStats();

    return this.graphOperationManager.execute(operation, this._operationContext).pipe(
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

    this.logger.debug('DfdOrchestrator: Executing batch operations', {
      operationCount: operations.length,
    });

    this._stats.totalOperations += operations.length;
    this._stats.lastActivity = new Date();
    this._updateStats();

    return this.graphOperationManager.executeBatch(operations, this._operationContext).pipe(
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
    if (!this._initParams || !this._graph) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debug('DfdOrchestrator: Manual save triggered');

    const autoSaveContext = {
      diagramId: this._initParams.diagramId,
      userId: 'current-user', // In real implementation, get from auth service
      diagramData: this._getGraphData(),
      preferredStrategy: 'websocket',
    };

    return this.autoSaveManager.triggerManualSave(autoSaveContext).pipe(
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
    if (!targetDiagramId) {
      return throwError(() => new Error('No diagram ID provided'));
    }

    this.logger.debug('DfdOrchestrator: Loading diagram', { diagramId: targetDiagramId });

    this._updateState({ loading: true });

    const loadOperation = {
      diagramId: targetDiagramId,
      forceRefresh: false,
    };

    return this.persistenceCoordinator.load(loadOperation).pipe(
      map(result => {
        if (result.success && result.data) {
          this._loadGraphData(result.data);
          this._updateState({
            loading: false,
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
          return true;
        }
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
  export(format: ExportFormat): Observable<string | Blob> {
    if (!this._graph) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debug('DfdOrchestrator: Exporting diagram', { format: format.format });

    switch (format.format) {
      case 'svg':
        return of(this._graph.toSVG());
      case 'json':
        return of(JSON.stringify(this._getGraphData(), null, 2));
      case 'png':
      case 'pdf':
        return throwError(() => new Error(`Export format '${format.format}' not yet implemented`));
      default:
        return throwError(() => new Error(`Unsupported export format: ${format.format}`));
    }
  }

  /**
   * Auto-save management
   */
  getAutoSaveState(): any {
    return this.autoSaveManager.getState();
  }

  enableAutoSave(): void {
    this.autoSaveManager.enable();
    this.logger.debug('Auto-save enabled');
  }

  disableAutoSave(): void {
    this.autoSaveManager.disable();
    this.logger.debug('Auto-save disabled');
  }

  /**
   * Collaboration management
   */
  startCollaboration(): Observable<boolean> {
    this.logger.debug('DfdOrchestrator: Starting collaboration');
    this._updateState({ collaborating: true });
    return of(true);
  }

  stopCollaboration(): Observable<boolean> {
    this.logger.debug('DfdOrchestrator: Stopping collaboration');
    this._updateState({ collaborating: false });
    return of(true);
  }

  /**
   * Selection management
   */
  selectAll(): void {
    if (this._graph) {
      this._graph.select(this._graph.getCells());
      this.logger.debug('All cells selected');
    }
  }

  clearSelection(): void {
    if (this._graph) {
      this._graph.unselect(this._graph.getSelectedCells());
      this.logger.debug('Selection cleared');
    }
  }

  getSelectedCells(): any[] {
    if (!this._graph) {
      return [];
    }
    return this._graph.getSelectedCells();
  }

  /**
   * State management
   */
  setReadOnlyMode(readOnly: boolean): void {
    this._updateState({ readOnly });
    this.logger.debug('Read-only mode changed', { readOnly });
  }

  getState(): DfdState {
    return this._state$.value;
  }

  get stateChanged$(): Observable<DfdState> {
    return this._stateChanged$.asObservable();
  }

  /**
   * Event handling
   */
  handleWindowResize(): void {
    if (this._graph) {
      this._graph.resize();
      this.logger.debug('Graph resized for window resize');
    }
  }

  handleKeyboardShortcut(shortcut: string): boolean {
    this.logger.debug('Keyboard shortcut handled', { shortcut });
    // Implementation would handle various shortcuts
    return true;
  }

  handleContextMenu(event: MouseEvent): boolean {
    this.logger.debug('Context menu handled', { x: event.clientX, y: event.clientY });
    // Implementation would show context menu
    return true;
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
    };
    this._totalErrors = 0;
    this._startTime = Date.now();
    this.logger.debug('Statistics reset');
  }

  /**
   * Cleanup and destruction
   */
  destroy(): Observable<boolean> {
    this.logger.debug('DfdOrchestrator: Destroying DFD system');

    if (this._graph) {
      this._graph.dispose();
      this._graph = null;
    }

    this._updateState(this._createInitialState());
    this._initParams = null;
    this._operationContext = null;

    return of(true);
  }

  reset(): Observable<boolean> {
    this.logger.debug('DfdOrchestrator: Resetting DFD system');

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
    // Create X6 graph instance
    this._graph = new Graph({
      container: params.containerElement,
      width: params.containerElement.clientWidth,
      height: params.containerElement.clientHeight,
      grid: true,
      panning: true,
      mousewheel: true,
    });

    // Create operation context
    this._operationContext = {
      graph: this._graph,
      diagramId: params.diagramId,
      threatModelId: params.threatModelId,
      userId: 'current-user', // In real implementation, get from auth service
      isCollaborating: params.collaborationEnabled,
      permissions: ['read', 'write'],
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false,
    };

    // Configure auto-save manager
    this.autoSaveManager.setPolicyMode(params.autoSaveMode);

    // Load existing diagram data if available
    return this.load(params.diagramId).pipe(
      catchError(() => {
        // If load fails, just continue with empty diagram
        this.logger.debug('No existing diagram data found, starting with empty diagram');
        return of(true);
      }),
    );
  }

  private _setupEventIntegration(): void {
    // Listen to operation completed events and trigger auto-save
    this.graphOperationManager.operationCompleted$.subscribe(event => {
      this._markUnsavedChanges();
      this._triggerAutoSave(event.operation, event.result);
    });

    // Listen to auto-save completed events
    this.autoSaveManager.saveCompleted$.subscribe(result => {
      if (result.success) {
        this._updateState({
          hasUnsavedChanges: false,
          lastSaved: new Date(),
        });
      }
    });
  }

  private _triggerAutoSave(operation: GraphOperation, result: OperationResult): void {
    if (!this._initParams || !this._graph) {
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

    this.autoSaveManager.trigger(triggerEvent, autoSaveContext).subscribe();
  }

  private _triggerAutoSaveForBatch(operations: GraphOperation[], results: OperationResult[]): void {
    if (!this._initParams || !this._graph) {
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

    this.autoSaveManager.trigger(triggerEvent, autoSaveContext).subscribe();
  }

  private _getGraphData(): any {
    if (!this._graph) {
      return { nodes: [], edges: [] };
    }

    return {
      nodes: this._graph.getNodes().map(node => ({
        id: node.id,
        shape: node.shape,
        position: node.getPosition(),
        size: node.getSize(),
        attrs: node.getAttrs(),
        data: node.getData(),
      })),
      edges: this._graph.getEdges().map(edge => ({
        id: edge.id,
        shape: edge.shape,
        source: edge.getSource(),
        target: edge.getTarget(),
        attrs: edge.getAttrs(),
        data: edge.getData(),
      })),
    };
  }

  private _loadGraphData(data: any): void {
    if (!this._graph || !data) {
      return;
    }

    // Clear existing graph
    this._graph.clearCells();

    // Load nodes
    if (data.nodes) {
      data.nodes.forEach((nodeData: any) => {
        this._graph!.addNode(nodeData);
      });
    }

    // Load edges
    if (data.edges) {
      data.edges.forEach((edgeData: any) => {
        this._graph!.addEdge(edgeData);
      });
    }

    this.logger.debug('Graph data loaded', {
      nodeCount: data.nodes?.length || 0,
      edgeCount: data.edges?.length || 0,
    });
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
}
