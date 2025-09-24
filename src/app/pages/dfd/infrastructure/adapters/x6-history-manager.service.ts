import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DFD_STYLING, DFD_STYLING_HELPERS } from '../../constants/styling-constants';

/**
 * X6 History Manager
 * Handles undo/redo operations and history state management
 */
@Injectable()
export class X6HistoryManager {
  private readonly _historyChanged$ = new Subject<{ canUndo: boolean; canRedo: boolean }>();
  private readonly _historyModified$ = new Subject<void>();
  private portStateManager: any = null;

  // Private properties to track previous undo/redo states
  private _previousCanUndo = false;
  private _previousCanRedo = false;

  constructor(private logger: LoggerService) {}

  /**
   * Observable for history state changes (undo/redo availability)
   */
  get historyChanged$(): Observable<{ canUndo: boolean; canRedo: boolean }> {
    return this._historyChanged$.asObservable();
  }

  /**
   * Observable for when history is actually modified (for auto-save)
   */
  get historyModified$(): Observable<void> {
    return this._historyModified$.asObservable();
  }

  /**
   * Set port state manager for handling port visibility during undo/redo operations
   */
  setPortStateManager(portStateManager: any): void {
    this.portStateManager = portStateManager;
  }

  /**
   * Setup history event listeners for the graph
   */
  setupHistoryEvents(graph: Graph): void {
    // History events for undo/redo state tracking
    graph.on('history:undo', () => {
      this.logger.info('History undo event fired');
      this._cleanupVisualEffectsAfterRestore(graph);
      this._emitHistoryStateChange(graph);
    });

    graph.on('history:redo', () => {
      this.logger.info('History redo event fired');
      this._cleanupVisualEffectsAfterRestore(graph);
      this._emitHistoryStateChange(graph);
    });

    graph.on('history:change', () => {
      this.logger.info('History change event fired - triggering auto-save');
      this._historyModified$.next();
      this._emitHistoryStateChange(graph);
    });

    graph.on('history:clear', () => {
      this.logger.info('History clear event fired');
      this._emitHistoryStateChange(graph);
    });
  }

  /**
   * Undo the last action using X6 history plugin
   */
  undo(graph: Graph): void {
    if (graph && typeof graph.undo === 'function') {
      // Temporarily disable history to prevent undo operations from being recorded
      this.disable(graph);

      graph.undo();
      this.logger.info('Undo action performed');

      // Re-enable history after undo is complete
      this.enable(graph);

      this._emitHistoryStateChange(graph);
    } else {
      this.logger.warn('Undo not available - history plugin may not be enabled');
    }
  }

  /**
   * Redo the last undone action using X6 history plugin
   */
  redo(graph: Graph): void {
    if (graph && typeof graph.redo === 'function') {
      // Temporarily disable history to prevent redo operations from being recorded
      this.disable(graph);

      graph.redo();
      this.logger.info('Redo action performed');

      // Re-enable history after redo is complete
      this.enable(graph);

      this._emitHistoryStateChange(graph);
    } else {
      this.logger.warn('Redo not available - history plugin may not be enabled');
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(graph: Graph): boolean {
    if (graph && typeof graph.canUndo === 'function') {
      return graph.canUndo();
    }
    return false;
  }

  /**
   * Check if redo is available
   */
  canRedo(graph: Graph): boolean {
    if (graph && typeof graph.canRedo === 'function') {
      return graph.canRedo();
    }
    return false;
  }

  /**
   * Clear the history stack
   */
  clearHistory(graph: Graph): void {
    if (graph && typeof graph.cleanHistory === 'function') {
      graph.cleanHistory();
      this.logger.info('History cleared');
      this._emitHistoryStateChange(graph);
    } else {
      this.logger.warn('Clear history not available - history plugin may not be enabled');
    }
  }

  /**
   * Temporarily disable history tracking
   */
  disable(graph: Graph): void {
    // this.logger.debug('[X6HistoryManager] Attempting to disable history', {
    //   hasGraph: !!graph,
    //   hasHistory: !!(graph && (graph as any).history),
    //   hasDisableMethod: !!(
    //     graph &&
    //     (graph as any).history &&
    //     typeof (graph as any).history.disable === 'function'
    //   ),
    //   graphType: graph ? graph.constructor.name : 'undefined',
    //   historyType:
    //     graph && (graph as any).history ? (graph as any).history.constructor.name : 'undefined',
    // });

    if (graph && (graph as any).history && typeof (graph as any).history.disable === 'function') {
      (graph as any).history.disable();
      this.logger.debugComponent('X6History', 'History tracking disabled');
    }
  }

  /**
   * Re-enable history tracking
   */
  enable(graph: Graph): void {
    if (graph && (graph as any).history && typeof (graph as any).history.enable === 'function') {
      (graph as any).history.enable();
      this.logger.debugComponent('X6History', 'History tracking enabled');
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._historyChanged$.complete();
  }

  /**
   * Clean up visual effects from restored cells after undo/redo operations.
   * This prevents visual effects like selection styling from persisting after restoration.
   */
  private _cleanupVisualEffectsAfterRestore(graph: Graph): void {
    const cells = graph.getCells();

    // CRITICAL FIX: Properly disable history during cleanup to prevent leaks
    this.disable(graph);
    try {
      // Batch all cleanup operations within history-disabled context
      graph.batchUpdate(() => {
        cells.forEach((cell: Cell) => {
          if (cell.isNode()) {
            const node = cell;
            this._cleanupNodeVisualEffects(node);
          } else if (cell.isEdge()) {
            const edge = cell;
            this._cleanupEdgeVisualEffects(edge);
          }
        });
      });

      // Update port visibility for all nodes after cleanup (show connected, hide unconnected)
      // Use setTimeout to ensure graph state is fully updated after undo/redo
      if (this.portStateManager) {
        setTimeout(() => {
          this.portStateManager.onConnectionChange(graph);
        }, 0);
      }

      // Clear any selection state since restored cells should not be selected
      // This must also be within the history-disabled context to prevent selection events
      graph.resetSelection();

      this.logger.debugComponent('X6History', 'Cleaned up visual effects after history restore', {
        cellsProcessed: cells.length,
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Always re-enable history even if cleanup fails
      this.enable(graph);
    }
  }

  /**
   * Clean up visual effects from a restored node
   */
  private _cleanupNodeVisualEffects(node: Node): void {
    const nodeType = this._getNodeType(node);

    // Remove selection filter effects
    if (nodeType === 'text-box') {
      const currentFilter = node.attr('text/filter');
      if (
        currentFilter &&
        typeof currentFilter === 'string' &&
        DFD_STYLING_HELPERS.isSelectionFilter(currentFilter)
      ) {
        node.attr('text/filter', 'none');
      }
    } else {
      const currentFilter = node.attr('body/filter');
      if (
        currentFilter &&
        typeof currentFilter === 'string' &&
        DFD_STYLING_HELPERS.isSelectionFilter(currentFilter)
      ) {
        node.attr('body/filter', 'none');
      }

      // Restore default stroke width if it has selection styling
      const currentStrokeWidth = node.attr('body/strokeWidth');
      const defaultStrokeWidth = DFD_STYLING_HELPERS.getDefaultStrokeWidth(nodeType as any);
      if (
        currentStrokeWidth === DFD_STYLING.SELECTION.STROKE_WIDTH &&
        defaultStrokeWidth !== DFD_STYLING.SELECTION.STROKE_WIDTH
      ) {
        node.attr('body/strokeWidth', defaultStrokeWidth);
      }
    }

    // Remove any tools that might be persisted
    node.removeTools();
  }

  /**
   * Clean up visual effects from a restored edge
   */
  private _cleanupEdgeVisualEffects(edge: Edge): void {
    // Remove selection filter effects from edges
    const currentFilter = edge.attr('line/filter');
    if (
      currentFilter &&
      typeof currentFilter === 'string' &&
      DFD_STYLING_HELPERS.isSelectionFilter(currentFilter)
    ) {
      edge.attr('line/filter', 'none');
    }

    // Remove any tools that might be persisted
    edge.removeTools();
  }

  /**
   * Get the node type for a given node
   */
  private _getNodeType(node: Node): string {
    // Try to get node type from metadata first
    if ((node as any).getNodeTypeInfo) {
      return (node as any).getNodeTypeInfo().type;
    }

    // Fall back to shape-based detection
    const shape = node.shape;
    if (shape?.includes('actor')) return 'actor';
    if (shape?.includes('process')) return 'process';
    if (shape?.includes('store')) return 'store';
    if (shape?.includes('security-boundary')) return 'security-boundary';
    if (shape?.includes('text-box')) return 'text-box';

    return 'unknown';
  }

  /**
   * Emit history state change event
   */
  private _emitHistoryStateChange(graph: Graph): void {
    const canUndo = this.canUndo(graph);
    const canRedo = this.canRedo(graph);

    // Only emit if the state has actually changed
    if (canUndo !== this._previousCanUndo || canRedo !== this._previousCanRedo) {
      this._historyChanged$.next({ canUndo, canRedo });
      this.logger.debugComponent('X6History', 'History state changed', { canUndo, canRedo });

      // Update previous state tracking
      this._previousCanUndo = canUndo;
      this._previousCanRedo = canRedo;
    }
  }
}
