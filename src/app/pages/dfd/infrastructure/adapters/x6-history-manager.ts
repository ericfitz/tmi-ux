import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * X6 History Manager
 * Handles undo/redo operations and history state management
 */
@Injectable()
export class X6HistoryManager {
  private readonly _historyChanged$ = new Subject<{ canUndo: boolean; canRedo: boolean }>();

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
   * Setup history event listeners for the graph
   */
  setupHistoryEvents(graph: Graph): void {
    // History events for undo/redo state tracking
    graph.on('history:undo', () => {
      this.logger.info('History undo event fired');
      this._emitHistoryStateChange(graph);
    });

    graph.on('history:redo', () => {
      this.logger.info('History redo event fired');
      this._emitHistoryStateChange(graph);
    });

    graph.on('history:change', () => {
      this.logger.debug('History change event fired');
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
      graph.undo();
      this.logger.info('Undo action performed');
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
      graph.redo();
      this.logger.info('Redo action performed');
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
   * Dispose of resources
   */
  dispose(): void {
    this._historyChanged$.complete();
  }

  /**
   * Emit history state change event
   */
  private _emitHistoryStateChange(graph: Graph): void {
    const canUndo = this.canUndo(graph);
    const canRedo = this.canRedo(graph);

    // Only emit and log if the state has actually changed
    if (canUndo !== this._previousCanUndo || canRedo !== this._previousCanRedo) {
      this._historyChanged$.next({ canUndo, canRedo });
      this.logger.debug('History state changed', { canUndo, canRedo });

      // Update previous state tracking
      this._previousCanUndo = canUndo;
      this._previousCanRedo = canRedo;
    }
  }
}
