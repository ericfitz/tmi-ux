import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import type { AppStateService } from './app-state.service';

/**
 * Interface for drag tracking data
 */
interface DragTrackingData {
  cellId: string;
  startTime: number;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  initialVertices?: Array<{ x: number; y: number }>;
  dragType: 'move' | 'resize' | 'vertex';
}

/**
 * Interface for drag completion event
 */
interface DragCompletionEvent {
  cellId: string;
  dragType: 'move' | 'resize' | 'vertex';
  duration: number;
  initialState: any;
  finalState: any;
}

/**
 * AppGraphHistoryCoordinator service - manages what gets included in X6 history
 * Provides proper filtering for visual effects, port visibility, and other non-semantic changes
 * Includes sophisticated drag completion tracking to ensure only final states are recorded
 */
@Injectable()
export class AppGraphHistoryCoordinator {
  private readonly _dragCompletions$ = new Subject<DragCompletionEvent>();
  private readonly _activeDrags = new Map<string, DragTrackingData>();
  private readonly _dragDebounceMap = new Map<string, number>();
  private readonly DRAG_COMPLETION_DELAY = 150; // ms to wait after drag stops before recording
  private _diagramLoadingState = false;
  private _currentOperationType: string | null = null;
  private _appStateService?: AppStateService;

  constructor(private logger: LoggerService) {}

  /**
   * Set the AppStateService (called after construction to avoid circular dependency)
   */
  setAppStateService(appStateService: AppStateService): void {
    this._appStateService = appStateService;
  }

  /**
   * Observable for drag completion events
   */
  get dragCompletions$(): Observable<DragCompletionEvent> {
    return this._dragCompletions$.asObservable();
  }

  /**
   * Execute an atomic operation by batching all changes into a single history entry
   */
  executeAtomicOperation<T>(graph: Graph, operation: () => T, _operationType?: string): T {
    return graph.batchUpdate(() => {
      return operation();
    });
  }

  /**
   * Execute a compound operation by batching all changes into a single history entry
   */
  executeCompoundOperation<T>(graph: Graph, operation: () => T, _operationType?: string): T {
    return graph.batchUpdate(() => {
      return operation();
    });
  }

  /**
   * Execute an operation that represents the final state of a drag operation
   * This ensures only the final position/size/vertices are recorded in history
   */
  executeFinalizeDragOperation<T>(graph: Graph, operation: () => T, _operationType?: string): T {
    return graph.batchUpdate(() => {
      return operation();
    });
  }

  /**
   * Execute a visual effect with history suppressed
   * Visual effects should never appear in undo/redo history
   */
  executeVisualEffect(graph: Graph, operation: () => void): void {
    const historyPlugin = (graph as any).history;
    if (
      historyPlugin &&
      typeof historyPlugin.disable === 'function' &&
      typeof historyPlugin.enable === 'function'
    ) {
      // Temporarily disable history for visual effects
      historyPlugin.disable();
      try {
        operation();
      } finally {
        // Re-enable history after the operation
        historyPlugin.enable();
      }
    } else {
      // No history plugin or already disabled, execute directly
      operation();
    }
  }

  /**
   * Execute a remote operation with history suppressed
   * Remote operations from collaboration should not create local history entries
   * Also sets isApplyingRemoteChange flag to prevent broadcasting these changes
   */
  executeRemoteOperation<T>(graph: Graph, operation: () => T): T {
    const historyPlugin = (graph as any).history;

    // Set flag to prevent broadcasting remote operations (including diagram load)
    const wasApplyingRemoteChange = this._appStateService?.getCurrentState().isApplyingRemoteChange;
    if (this._appStateService && !wasApplyingRemoteChange) {
      this._appStateService.setApplyingRemoteChange(true);
    }

    if (
      historyPlugin &&
      typeof historyPlugin.disable === 'function' &&
      typeof historyPlugin.enable === 'function'
    ) {
      // Temporarily disable history for remote operations
      historyPlugin.disable();
      try {
        return operation();
      } finally {
        // Re-enable history after the operation
        historyPlugin.enable();

        // Restore isApplyingRemoteChange flag
        if (this._appStateService && !wasApplyingRemoteChange) {
          this._appStateService.setApplyingRemoteChange(false);
        }
      }
    } else {
      // No history plugin or already disabled, execute directly
      try {
        return operation();
      } finally {
        // Restore isApplyingRemoteChange flag
        if (this._appStateService && !wasApplyingRemoteChange) {
          this._appStateService.setApplyingRemoteChange(false);
        }
      }
    }
  }

  /**
   * Execute multiple operations as a single atomic transaction
   * This creates one combined history entry instead of separate entries for each operation
   */
  executeAtomicTransaction<T>(
    graph: Graph,
    operation: () => T,
    transactionName: string = 'atomic-operation',
  ): T {
    const historyPlugin = (graph as any).history;
    if (
      historyPlugin &&
      typeof historyPlugin.disable === 'function' &&
      typeof historyPlugin.enable === 'function'
    ) {
      // Get initial graph state before operations
      const initialState = this._captureGraphState(graph);

      // Temporarily disable history for the compound operations
      historyPlugin.disable();
      let result: T;

      try {
        // Execute all operations without individual history entries
        result = operation();
      } finally {
        // Re-enable history after all operations complete
        historyPlugin.enable();
      }

      // Get final graph state after operations
      const finalState = this._captureGraphState(graph);

      // Manually add a single combined history entry
      this._addCombinedHistoryEntry(graph, initialState, finalState, transactionName);

      return result;
    } else {
      // No history plugin available, execute directly
      return operation();
    }
  }

  /**
   * Capture the current state of the graph for history comparison
   */
  private _captureGraphState(graph: Graph): any {
    return {
      cells: graph.getCells().map(cell => ({
        id: cell.id,
        type: cell.isNode() ? 'node' : 'edge',
        data: cell.toJSON(),
      })),
      timestamp: Date.now(),
    };
  }

  /**
   * Add a combined history entry representing the net change of a transaction
   */
  private _addCombinedHistoryEntry(
    graph: Graph,
    initialState: any,
    finalState: any,
    transactionName: string,
  ): void {
    try {
      // Create a synthetic history command that represents the entire transaction
      const historyPlugin = (graph as any).history;
      if (historyPlugin && typeof historyPlugin.addCommand === 'function') {
        const command = {
          id: `${transactionName}-${Date.now()}`,
          undo: () => {
            // Restore to initial state
            this._restoreGraphState(graph, initialState);
          },
          redo: () => {
            // Restore to final state
            this._restoreGraphState(graph, finalState);
          },
        };

        historyPlugin.addCommand(command);
        this.logger.debug(`Added atomic transaction to history: ${transactionName}`);
      }
    } catch (error) {
      this.logger.warn('Failed to add combined history entry', { error, transactionName });
    }
  }

  /**
   * Restore graph to a specific state
   */
  private _restoreGraphState(graph: Graph, state: any): void {
    try {
      // Clear current graph
      graph.clearCells();

      // Restore cells from state
      state.cells.forEach((cellState: any) => {
        if (cellState.type === 'node') {
          graph.addNode(cellState.data);
        } else {
          graph.addEdge(cellState.data);
        }
      });
    } catch (error) {
      this.logger.warn('Failed to restore graph state', { error });
    }
  }

  /**
   * Get default options for operation - visual effects should be excluded
   */
  getDefaultOptionsForOperation(): any {
    return {
      includeVisualEffects: false,
      includePortVisibility: false,
      includeHighlighting: false,
      includeToolChanges: false,
    };
  }

  /**
   * Start tracking a drag operation to capture only the final state
   */
  startDragTracking(
    cellId: string,
    dragType: 'move' | 'resize' | 'vertex',
    initialState: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
      vertices?: Array<{ x: number; y: number }>;
    },
  ): void {
    const trackingData: DragTrackingData = {
      cellId,
      startTime: Date.now(),
      dragType,
      initialPosition: initialState.position,
      initialSize: initialState.size,
      initialVertices: initialState.vertices,
    };

    this._activeDrags.set(cellId, trackingData);

    // Clear any existing debounce timer for this cell
    const existingTimer = this._dragDebounceMap.get(cellId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
  }

  /**
   * Update drag tracking - this extends the debounce timer
   */
  updateDragTracking(cellId: string): void {
    if (!this._activeDrags.has(cellId)) {
      return;
    }

    // Clear existing timer
    const existingTimer = this._dragDebounceMap.get(cellId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to detect drag completion
    const timer = setTimeout(() => {
      this._finalizeDrag(cellId);
    }, this.DRAG_COMPLETION_DELAY);

    this._dragDebounceMap.set(cellId, timer);
  }

  /**
   * Force completion of a drag operation (called when user releases mouse, etc.)
   */
  finalizeDragTracking(cellId: string, finalState: any): void {
    // Clear any pending timer
    const existingTimer = this._dragDebounceMap.get(cellId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this._dragDebounceMap.delete(cellId);
    }

    this._finalizeDrag(cellId, finalState);
  }

  /**
   * Check if a cell is currently being dragged
   */
  isDragInProgress(cellId: string): boolean {
    return this._activeDrags.has(cellId);
  }

  /**
   * Check if any drag operation is currently in progress
   */
  isAnyDragInProgress(): boolean {
    return this._activeDrags.size > 0;
  }

  /**
   * Cancel drag tracking for a cell (e.g., if drag is cancelled)
   */
  cancelDragTracking(cellId: string): void {
    this._activeDrags.delete(cellId);
    const existingTimer = this._dragDebounceMap.get(cellId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this._dragDebounceMap.delete(cellId);
    }
  }

  /**
   * Internal method to finalize a drag operation and emit completion event
   */
  private _finalizeDrag(cellId: string, providedFinalState?: any): void {
    const trackingData = this._activeDrags.get(cellId);
    if (!trackingData) {
      return;
    }

    const duration = Date.now() - trackingData.startTime;
    const initialState = {
      position: trackingData.initialPosition,
      size: trackingData.initialSize,
      vertices: trackingData.initialVertices,
    };

    const completionEvent: DragCompletionEvent = {
      cellId,
      dragType: trackingData.dragType,
      duration,
      initialState,
      finalState: providedFinalState || {}, // Final state can be provided or captured elsewhere
    };

    // Clean up tracking data
    this._activeDrags.delete(cellId);
    this._dragDebounceMap.delete(cellId);

    // Emit completion event
    this._dragCompletions$.next(completionEvent);
  }

  /**
   * Set diagram loading state to suppress history during initial load
   */
  setDiagramLoadingState(isLoading: boolean): void {
    this._diagramLoadingState = isLoading;
    this.logger.debugComponent('GraphHistoryCoordinator', 'Diagram loading state changed', {
      isLoading,
    });
  }

  /**
   * Check if diagram is currently loading
   */
  isDiagramLoading(): boolean {
    return this._diagramLoadingState;
  }

  /**
   * Set current operation type for context-aware filtering
   */
  setCurrentOperationType(operationType: string | null): void {
    this._currentOperationType = operationType;
  }

  /**
   * Get current operation type
   */
  getCurrentOperationType(): string | null {
    return this._currentOperationType;
  }

  /**
   * Execute an operation with diagram loading suppression
   */
  executeWithDiagramLoading<T>(operation: () => T): T {
    this.setDiagramLoadingState(true);
    try {
      return operation();
    } finally {
      this.setDiagramLoadingState(false);
    }
  }

  /**
   * Check if an operation should be excluded from history based on type
   */
  shouldExcludeOperationType(operationType?: string): boolean {
    if (!operationType) return false;
    return EXCLUDED_OPERATION_TYPES.has(operationType as any);
  }

  /**
   * Check if changes should be excluded during diagram loading
   */
  shouldExcludeDuringDiagramLoading(): boolean {
    return this._diagramLoadingState;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clear all active timers
    this._dragDebounceMap.forEach(timer => clearTimeout(timer));
    this._dragDebounceMap.clear();
    this._activeDrags.clear();
    this._dragCompletions$.complete();
  }

  /**
   * Check if an attribute path should be excluded from history
   * Returns true for visual-only attributes that shouldn't trigger undo/redo
   */
  shouldExcludeAttribute(attributePath?: string, propertyPath?: string): boolean {
    if (!attributePath && !propertyPath) {
      return false;
    }

    // Check full property path first (for port changes)
    if (propertyPath) {
      // Port visibility changes should be excluded
      if (this._isPortVisibilityPath(propertyPath)) {
        return true;
      }
    }

    // Check attribute path (for style/visual changes)
    if (attributePath) {
      return this._isVisualAttributePath(attributePath);
    }

    return false;
  }

  /**
   * Check if a property path represents a port visibility change
   */
  private _isPortVisibilityPath(propertyPath: string): boolean {
    // Port visibility paths look like: "ports/items/0/attrs/circle/style/visibility"
    return (
      propertyPath.includes('ports/items/') &&
      propertyPath.includes('/attrs/circle/style/visibility')
    );
  }

  /**
   * Check if an attribute path represents a visual-only change
   */
  private _isVisualAttributePath(attributePath: string): boolean {
    const visualPaths = [
      // Selection and hover effects
      'body/filter',
      'label/filter',
      'text/filter',
      'line/filter', // Edge line filter effects
      'wrap/filter', // Edge wrap filter effects

      // Stroke effects for selection/hover
      'body/stroke',
      'body/strokeWidth',
      'body/strokeDasharray',
      'line/stroke', // Edge stroke changes
      'line/strokeWidth', // Edge stroke width
      'line/strokeDasharray', // Edge dash patterns

      // Shadow and glow effects
      'body/dropShadow',
      'body/shadowOffsetX',
      'body/shadowOffsetY',
      'body/shadowBlur',
      'body/shadowColor',
      'line/dropShadow', // Edge shadows
      'text/dropShadow', // Text shadows

      // Port highlighting and visibility
      'circle/stroke',
      'circle/strokeWidth',
      'circle/fill',
      'circle/filter',
      'circle/style', // Port style changes
      'circle/visibility', // Port visibility
      'rect/stroke', // Rectangle port stroke
      'rect/fill', // Rectangle port fill
      'rect/visibility', // Rectangle port visibility

      // Tool-related attributes
      'tools',

      // Transform-related visual attributes
      'transform',
      'transform/translate',
      'transform/scale',

      // Opacity and visibility changes (may be visual effects)
      'body/opacity',
      'line/opacity',
      'text/opacity',

      // Z-index changes (handled separately but included here for completeness)
      'zIndex',

      // Highlighting and focus effects
      'highlight',
      'focus',
      'active',
      'selected',

      // Animation-related attributes
      'animation',
      'transition',
    ];

    // Check if the attribute path starts with any visual path
    return visualPaths.some(
      visualPath =>
        attributePath.startsWith(visualPath) ||
        attributePath.includes(`/${visualPath}`) ||
        attributePath.endsWith(`/${visualPath}`),
    );
  }
}

/**
 * History operation types - comprehensive set for proper filtering and grouping
 */
export const HISTORY_OPERATION_TYPES = {
  // Diagram-level operations
  DIAGRAM_LOAD: 'diagram-load',
  DIAGRAM_CLEAR: 'diagram-clear',

  // Node operations
  NODE_CREATE: 'node-create',
  NODE_DELETE: 'node-delete',
  NODE_MOVE_FINAL: 'node-move-final',
  NODE_RESIZE_FINAL: 'node-resize-final',
  NODE_LABEL_CHANGE: 'node-label-change',

  // Edge operations
  EDGE_CREATE: 'edge-create',
  EDGE_DELETE: 'edge-delete',
  EDGE_VERTEX_CHANGE_FINAL: 'edge-vertex-change-final',
  EDGE_CONNECTION_CHANGE: 'edge-connection-change',
  EDGE_LABEL_CHANGE: 'edge-label-change',
  EDGE_ADD_INVERSE: 'edge-add-inverse',

  // Multi-cell operations
  MULTI_CELL_DELETE: 'multi-cell-delete',
  MULTI_CELL_MOVE: 'multi-cell-move',

  // Z-order operations
  Z_ORDER_FORWARD: 'z-order-forward',
  Z_ORDER_BACKWARD: 'z-order-backward',
  Z_ORDER_TO_FRONT: 'z-order-to-front',
  Z_ORDER_TO_BACK: 'z-order-to-back',

  // Grouping operations
  GROUP_CREATE: 'group-create',
  GROUP_UNGROUP: 'group-ungroup',

  // Embedding operations
  NODE_EMBED: 'node-embed',
  NODE_UNEMBED: 'node-unembed',
  NODE_RE_EMBED: 'node-re-embed',

  // Collaboration operations
  REMOTE_OPERATION: 'remote-operation',

  // Visual operations (should be excluded)
  VISUAL_EFFECT: 'visual-effect',
  PORT_VISIBILITY: 'port-visibility',
  SELECTION_CHANGE: 'selection-change',
  TOOL_CHANGE: 'tool-change',

  // Interim operations (should be excluded)
  NODE_MOVE_INTERIM: 'node-move-interim',
  NODE_RESIZE_INTERIM: 'node-resize-interim',
  EDGE_VERTEX_INTERIM: 'edge-vertex-interim',
} as const;

/**
 * Type for history operation type values
 */
export type HistoryOperationType =
  (typeof HISTORY_OPERATION_TYPES)[keyof typeof HISTORY_OPERATION_TYPES];

/**
 * Operations that should be excluded from history
 */
export const EXCLUDED_OPERATION_TYPES = new Set<HistoryOperationType>([
  HISTORY_OPERATION_TYPES.VISUAL_EFFECT,
  HISTORY_OPERATION_TYPES.PORT_VISIBILITY,
  HISTORY_OPERATION_TYPES.SELECTION_CHANGE,
  HISTORY_OPERATION_TYPES.TOOL_CHANGE,
  HISTORY_OPERATION_TYPES.NODE_MOVE_INTERIM,
  HISTORY_OPERATION_TYPES.NODE_RESIZE_INTERIM,
  HISTORY_OPERATION_TYPES.EDGE_VERTEX_INTERIM,
]);

/**
 * Operations that should be grouped as compound operations
 */
export const COMPOUND_OPERATION_TYPES = new Set<HistoryOperationType>([
  HISTORY_OPERATION_TYPES.MULTI_CELL_DELETE,
  HISTORY_OPERATION_TYPES.MULTI_CELL_MOVE,
  HISTORY_OPERATION_TYPES.EDGE_ADD_INVERSE,
  HISTORY_OPERATION_TYPES.GROUP_CREATE,
  HISTORY_OPERATION_TYPES.GROUP_UNGROUP,
  HISTORY_OPERATION_TYPES.REMOTE_OPERATION,
]);
