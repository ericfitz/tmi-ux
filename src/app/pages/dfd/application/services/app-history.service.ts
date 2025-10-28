/**
 * AppHistoryService - Custom history management for undo/redo operations
 *
 * This service is responsible for:
 * - Maintaining undo/redo stacks for diagram operations
 * - Adding history entries for user operations
 * - Performing undo/redo by converting history entries back to operations
 * - Coordinating broadcast (collaboration) vs auto-save (solo mode)
 * - Providing observables for history state changes
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { AppGraphOperationManager } from './app-graph-operation-manager.service';
import { AppDiagramOperationBroadcaster } from './app-diagram-operation-broadcaster.service';
import { AppPersistenceCoordinator } from './app-persistence-coordinator.service';
import {
  HistoryEntry,
  HistoryState,
  HistoryConfig,
  HistoryStateChangeEvent,
  HistoryOperationEvent,
  DEFAULT_HISTORY_CONFIG,
  createEmptyHistoryState,
} from '../../types/history.types';
import { Cell } from '../../../../core/types/websocket-message.types';
import {
  GraphOperation,
  OperationContext,
  OperationResult,
  CreateNodeOperation,
  UpdateNodeOperation,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  NodeData,
} from '../../types/graph-operation.types';
import { EdgeInfo } from '../../domain/value-objects/edge-info';

@Injectable()
export class AppHistoryService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();

  // History state
  private _historyState: HistoryState;
  private _config: Required<HistoryConfig>;

  // Observables
  private readonly _historyStateChange$ = new Subject<HistoryStateChangeEvent>();
  private readonly _historyOperation$ = new Subject<HistoryOperationEvent>();
  private readonly _canUndo$ = new BehaviorSubject<boolean>(false);
  private readonly _canRedo$ = new BehaviorSubject<boolean>(false);

  // Operation context (set during initialization)
  private _operationContext: OperationContext | null = null;
  private _diagramId: string | null = null;
  private _threatModelId: string | null = null;

  // Statistics
  private _stats = {
    totalHistoryEntries: 0,
    undoCount: 0,
    redoCount: 0,
  };

  constructor(
    private readonly logger: LoggerService,
    private readonly collaborationService: DfdCollaborationService,
    private readonly graphOperationManager: AppGraphOperationManager,
    private readonly diagramOperationBroadcaster: AppDiagramOperationBroadcaster,
    private readonly persistenceCoordinator: AppPersistenceCoordinator,
  ) {
    this._config = { ...DEFAULT_HISTORY_CONFIG };
    this._historyState = createEmptyHistoryState(this._config.maxHistorySize);
    this.logger.debug('AppHistoryService initialized');
  }

  /**
   * Initialize the history service with operation context
   */
  initialize(
    operationContext: OperationContext,
    diagramId: string,
    threatModelId: string,
    config?: Partial<HistoryConfig>,
  ): void {
    this._operationContext = operationContext;
    this._diagramId = diagramId;
    this._threatModelId = threatModelId;

    if (config) {
      this._config = { ...this._config, ...config };
      this._historyState.maxStackSize = this._config.maxHistorySize;
    }

    this.logger.info('AppHistoryService initialized with context', {
      diagramId,
      threatModelId,
      maxHistorySize: this._config.maxHistorySize,
    });
  }

  /**
   * Observables for external subscribers
   */
  get historyStateChange$(): Observable<HistoryStateChangeEvent> {
    return this._historyStateChange$.asObservable();
  }

  get historyOperation$(): Observable<HistoryOperationEvent> {
    return this._historyOperation$.asObservable();
  }

  get canUndo$(): Observable<boolean> {
    return this._canUndo$.asObservable();
  }

  get canRedo$(): Observable<boolean> {
    return this._canRedo$.asObservable();
  }

  /**
   * Check if undo is currently available
   */
  canUndo(): boolean {
    return this._config.enabled && this._historyState.undoStack.length > 0;
  }

  /**
   * Check if redo is currently available
   */
  canRedo(): boolean {
    return this._config.enabled && this._historyState.redoStack.length > 0;
  }

  /**
   * Add a new history entry
   * This also triggers broadcast or auto-save based on session state
   */
  addHistoryEntry(entry: HistoryEntry): void {
    if (!this._config.enabled) {
      this.logger.debug('History disabled, skipping entry', { entry });
      return;
    }

    this.logger.debug('Adding history entry', {
      id: entry.id,
      operationType: entry.operationType,
      description: entry.description,
      cellCount: entry.cells.length,
    });

    // Add to undo stack
    this._historyState.undoStack.push(entry);
    this._stats.totalHistoryEntries++;

    // Clear redo stack (new actions invalidate redo)
    this._historyState.redoStack = [];

    // Enforce stack size limit
    if (this._historyState.undoStack.length > this._historyState.maxStackSize) {
      const removed = this._historyState.undoStack.shift();
      this.logger.debug('Removed oldest history entry due to size limit', {
        removedId: removed?.id,
      });
    }

    // Update current index
    this._historyState.currentIndex = this._historyState.undoStack.length - 1;

    // Emit history state change
    this._emitHistoryStateChange();

    // Emit operation event
    this._historyOperation$.next({
      operationType: 'add',
      entry,
      success: true,
      timestamp: Date.now(),
    });
  }

  /**
   * Perform undo operation
   * Pops entry from undo stack, executes reverse operation, pushes to redo stack
   */
  undo(): Observable<OperationResult> {
    if (!this.canUndo()) {
      return throwError(() => new Error('Cannot undo: no operations in undo stack'));
    }

    if (!this._operationContext) {
      return throwError(() => new Error('Cannot undo: operation context not initialized'));
    }

    // Pop from undo stack
    const entry = this._historyState.undoStack.pop();
    if (!entry) {
      return throwError(() => new Error('Failed to pop entry from undo stack'));
    }

    this.logger.info('Performing undo', {
      entryId: entry.id,
      description: entry.description,
    });

    this._stats.undoCount++;

    // Convert previous cells to operations
    const operations = this._convertCellsToOperations(
      entry.previousCells,
      entry.cells,
      'undo-redo',
    );

    if (operations.length === 0) {
      this.logger.warn('No operations generated for undo', { entry });
      return throwError(() => new Error('Failed to generate undo operations'));
    }

    // Execute operations
    return this._executeOperations(operations).pipe(
      tap(() => {
        // Push to redo stack
        this._historyState.redoStack.push(entry);

        // Update current index
        this._historyState.currentIndex = this._historyState.undoStack.length - 1;

        // Emit state change
        this._emitHistoryStateChange();

        // Emit operation event
        this._historyOperation$.next({
          operationType: 'undo',
          entry,
          success: true,
          timestamp: Date.now(),
        });
      }),
      catchError(error => {
        this.logger.error('Undo operation failed', { error, entry });

        // Put entry back on undo stack
        this._historyState.undoStack.push(entry);

        // Emit failure event
        this._historyOperation$.next({
          operationType: 'undo',
          entry,
          success: false,
          error: error.message || 'Undo failed',
          timestamp: Date.now(),
        });

        return throwError(() => error);
      }),
      map(() => ({
        success: true,
        operationType: 'batch-operation' as const,
        affectedCellIds: entry.previousCells.map(c => c.id),
        timestamp: Date.now(),
      })),
    );
  }

  /**
   * Perform redo operation
   * Pops entry from redo stack, executes forward operation, pushes to undo stack
   */
  redo(): Observable<OperationResult> {
    if (!this.canRedo()) {
      return throwError(() => new Error('Cannot redo: no operations in redo stack'));
    }

    if (!this._operationContext) {
      return throwError(() => new Error('Cannot redo: operation context not initialized'));
    }

    // Pop from redo stack
    const entry = this._historyState.redoStack.pop();
    if (!entry) {
      return throwError(() => new Error('Failed to pop entry from redo stack'));
    }

    this.logger.info('Performing redo', {
      entryId: entry.id,
      description: entry.description,
    });

    this._stats.redoCount++;

    // Convert cells to operations
    const operations = this._convertCellsToOperations(
      entry.cells,
      entry.previousCells,
      'undo-redo',
    );

    if (operations.length === 0) {
      this.logger.warn('No operations generated for redo', { entry });
      return throwError(() => new Error('Failed to generate redo operations'));
    }

    // Execute operations
    return this._executeOperations(operations).pipe(
      tap(() => {
        // Push back to undo stack
        this._historyState.undoStack.push(entry);

        // Update current index
        this._historyState.currentIndex = this._historyState.undoStack.length - 1;

        // Emit state change
        this._emitHistoryStateChange();

        // Emit operation event
        this._historyOperation$.next({
          operationType: 'redo',
          entry,
          success: true,
          timestamp: Date.now(),
        });
      }),
      catchError(error => {
        this.logger.error('Redo operation failed', { error, entry });

        // Put entry back on redo stack
        this._historyState.redoStack.push(entry);

        // Emit failure event
        this._historyOperation$.next({
          operationType: 'redo',
          entry,
          success: false,
          error: error.message || 'Redo failed',
          timestamp: Date.now(),
        });

        return throwError(() => error);
      }),
      map(() => ({
        success: true,
        operationType: 'batch-operation' as const,
        affectedCellIds: entry.cells.map(c => c.id),
        timestamp: Date.now(),
      })),
    );
  }

  /**
   * Clear all history
   */
  clear(): void {
    this._historyState.undoStack = [];
    this._historyState.redoStack = [];
    this._historyState.currentIndex = -1;
    this._emitHistoryStateChange();
    this.logger.info('History cleared');
  }

  /**
   * Get current undo stack (read-only)
   */
  getUndoStack(): ReadonlyArray<HistoryEntry> {
    return [...this._historyState.undoStack];
  }

  /**
   * Get current redo stack (read-only)
   */
  getRedoStack(): ReadonlyArray<HistoryEntry> {
    return [...this._historyState.redoStack];
  }

  /**
   * Get history statistics
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Find history entry by WebSocket operation_id
   * Searches the undo stack from most recent to oldest
   */
  findEntryByOperationId(operationId: string): HistoryEntry | null {
    // Search undo stack from most recent to oldest
    for (let i = this._historyState.undoStack.length - 1; i >= 0; i--) {
      if (this._historyState.undoStack[i].operationId === operationId) {
        return this._historyState.undoStack[i];
      }
    }
    return null;
  }

  /**
   * Undo all operations from the most recent back to and including the specified operation_id
   * Returns number of operations undone
   */
  undoUntilOperationId(operationId: string): Observable<{ undoCount: number; success: boolean }> {
    // First, scan to verify the operation exists
    const targetEntry = this.findEntryByOperationId(operationId);
    if (!targetEntry) {
      return throwError(
        () => new Error(`Cannot find history entry with operation_id: ${operationId}`),
      );
    }

    // Count how many undos we need to perform
    let undoCount = 0;
    for (let i = this._historyState.undoStack.length - 1; i >= 0; i--) {
      undoCount++;
      if (this._historyState.undoStack[i].operationId === operationId) {
        break;
      }
    }

    this.logger.info(`Will undo ${undoCount} operations to reach operation_id: ${operationId}`);

    // Perform the undos
    return this._performMultipleUndos(undoCount);
  }

  /**
   * Perform multiple undo operations sequentially
   * @private
   */
  private _performMultipleUndos(
    count: number,
  ): Observable<{ undoCount: number; success: boolean }> {
    if (count === 0) {
      return of({ undoCount: 0, success: true });
    }

    const undoObservables: Observable<OperationResult>[] = [];
    for (let i = 0; i < count; i++) {
      undoObservables.push(this.undo());
    }

    return forkJoin(undoObservables).pipe(
      map(results => ({
        undoCount: results.length,
        success: results.every(r => r.success),
      })),
      catchError(error => {
        this.logger.error('Failed to undo operations', { error, attemptedCount: count });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HistoryConfig>): void {
    this._config = { ...this._config, ...config };
    this._historyState.maxStackSize = this._config.maxHistorySize;
    this.logger.debug('History configuration updated', this._config);
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._historyStateChange$.complete();
    this._historyOperation$.complete();
    this._canUndo$.complete();
    this._canRedo$.complete();
    this.logger.debug('AppHistoryService destroyed');
  }

  /**
   * Emit history state change event
   */
  private _emitHistoryStateChange(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();

    // Update behavior subjects
    this._canUndo$.next(canUndo);
    this._canRedo$.next(canRedo);

    // Emit state change event
    this._historyStateChange$.next({
      canUndo,
      canRedo,
      undoStackSize: this._historyState.undoStack.length,
      redoStackSize: this._historyState.redoStack.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Convert Cell[] to GraphOperation[]
   */
  private _convertCellsToOperations(
    cells: Cell[],
    previousCells: Cell[],
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation[] {
    const operations: GraphOperation[] = [];

    cells.forEach(cell => {
      const previousCell = previousCells.find(c => c.id === cell.id);
      const operation = this._convertCellToOperation(cell, previousCell, source);

      if (operation) {
        operations.push(operation);
      }
    });

    return operations;
  }

  /**
   * Convert a single Cell to GraphOperation
   */
  private _convertCellToOperation(
    cell: Cell,
    previousCell: Cell | undefined,
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation | null {
    const baseOperation = {
      id: uuidv4(),
      source,
      priority: 'normal' as const,
      timestamp: Date.now(),
    };

    const isNode = cell.shape !== 'edge';

    // Determine operation type based on cell presence
    if (!previousCell) {
      // Cell was added
      if (isNode) {
        return this._createNodeOperation(cell, baseOperation);
      } else {
        return this._createEdgeOperation(cell, baseOperation);
      }
    } else {
      // Cell was updated
      if (isNode) {
        return this._updateNodeOperation(cell, previousCell, baseOperation);
      } else {
        return this._updateEdgeOperation(cell, previousCell, baseOperation);
      }
    }
  }

  /**
   * Create node operation from cell
   */
  private _createNodeOperation(
    cell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): CreateNodeOperation {
    const nodeData: NodeData = {
      id: cell.id,
      nodeType: cell.shape,
      position: cell.position,
      size: cell.size,
      label: typeof cell.label === 'string' ? cell.label : undefined,
      style: cell.attrs as Record<string, any>,
      properties: cell as Record<string, any>,
    };

    return {
      ...baseOperation,
      type: 'create-node',
      nodeData,
    } as CreateNodeOperation;
  }

  /**
   * Update node operation from cell
   */
  private _updateNodeOperation(
    cell: Cell,
    previousCell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): UpdateNodeOperation {
    const nodeData: Partial<NodeData> = {
      id: cell.id,
      nodeType: cell.shape,
      position: cell.position,
      size: cell.size,
      label: typeof cell.label === 'string' ? cell.label : undefined,
      style: cell.attrs as Record<string, any>,
      properties: cell as Record<string, any>,
    };

    return {
      ...baseOperation,
      type: 'update-node',
      nodeId: cell.id,
      updates: nodeData,
    } as UpdateNodeOperation;
  }

  /**
   * Create edge operation from cell
   */
  private _createEdgeOperation(
    cell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): CreateEdgeOperation {
    // Extract source and target node IDs for legacy field support
    const sourceNodeId =
      typeof cell.source === 'object' && cell.source !== null ? (cell.source as any).cell : '';
    const targetNodeId =
      typeof cell.target === 'object' && cell.target !== null ? (cell.target as any).cell : '';
    const sourcePortId =
      typeof cell.source === 'object' && cell.source !== null
        ? (cell.source as any).port
        : undefined;
    const targetPortId =
      typeof cell.target === 'object' && cell.target !== null
        ? (cell.target as any).port
        : undefined;

    // Use EdgeInfo.fromJSON to handle both new and legacy format
    const edgeInfo = EdgeInfo.fromJSON({
      id: cell.id,
      label: typeof cell.label === 'string' ? cell.label : undefined,
      source: cell.source as any,
      target: cell.target as any,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      vertices: (cell as any).vertices || [],
      attrs: cell.attrs as Record<string, any>,
    });

    return {
      ...baseOperation,
      type: 'create-edge',
      edgeInfo,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
    } as CreateEdgeOperation;
  }

  /**
   * Update edge operation from cell
   */
  private _updateEdgeOperation(
    cell: Cell,
    previousCell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): UpdateEdgeOperation {
    const edgeInfo: Partial<EdgeInfo> = {
      id: cell.id,
      labels: typeof cell.label === 'string' ? [{ attrs: { text: { text: cell.label } } }] : [],
      source:
        typeof cell.source === 'object' && cell.source !== null ? (cell.source as any) : undefined,
      target:
        typeof cell.target === 'object' && cell.target !== null ? (cell.target as any) : undefined,
      vertices: (cell as any).vertices,
      attrs: cell.attrs as Record<string, any>,
    };

    return {
      ...baseOperation,
      type: 'update-edge',
      edgeId: cell.id,
      updates: edgeInfo,
    } as UpdateEdgeOperation;
  }

  /**
   * Execute multiple operations
   */
  private _executeOperations(operations: GraphOperation[]): Observable<OperationResult> {
    if (!this._operationContext) {
      return throwError(() => new Error('Operation context not initialized'));
    }

    if (operations.length === 0) {
      return of({
        success: true,
        operationType: 'batch-operation' as const,
        affectedCellIds: [],
        timestamp: Date.now(),
      });
    }

    if (operations.length === 1) {
      return this.graphOperationManager.execute(operations[0], this._operationContext);
    }

    // Execute all operations in parallel
    const executions = operations.map(op =>
      this.graphOperationManager.execute(op, this._operationContext!),
    );

    return forkJoin(executions).pipe(
      map(results => {
        const allSuccessful = results.every(r => r.success);
        const affectedCellIds = results.flatMap(r => r.affectedCellIds || []);

        return {
          success: allSuccessful,
          operationType: 'batch-operation' as const,
          affectedCellIds,
          timestamp: Date.now(),
          error: allSuccessful
            ? undefined
            : 'Some operations failed: ' +
              results
                .filter(r => !r.success)
                .map(r => r.error)
                .join(', '),
        };
      }),
    );
  }
}
