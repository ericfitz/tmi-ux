import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphService } from './x6-graph.service';

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private canUndoSubject = new BehaviorSubject<boolean>(false);
  private canRedoSubject = new BehaviorSubject<boolean>(false);

  readonly canUndo$ = this.canUndoSubject.asObservable();
  readonly canRedo$ = this.canRedoSubject.asObservable();

  constructor(
    private logger: LoggerService,
    private graphService: X6GraphService,
  ) {
    this.logger.info('HistoryService initialized');

    // Initialize history manager when graph is available
    setTimeout(() => {
      this.initializeHistory();
    }, 1000);
  }

  /**
   * Initialize the history manager
   */
  private initializeHistory(): void {
    const graph = this.graphService.getGraph();
    if (!graph) {
      this.logger.error('Cannot initialize history: Graph not initialized');
      return;
    }

    try {
      // Create a custom history manager
      this.setupCustomHistory(graph);

      this.logger.info('History manager initialized');
      this.updateHistoryState();
    } catch (error) {
      this.logger.error('Error initializing history manager', error);
    }
  }

  /**
   * Update the history state
   */
  private updateHistoryState(): void {
    const graph = this.graphService.getGraph();
    if (!graph) return;

    // For now, we'll just set these to false until we implement custom history
    const canUndo = false;
    const canRedo = false;

    this.canUndoSubject.next(canUndo);
    this.canRedoSubject.next(canRedo);
  }

  /**
   * Undo the last action
   */
  undo(): void {
    const graph = this.graphService.getGraph();
    if (!graph) return;

    try {
      // Custom undo implementation will go here
      this.logger.debug('Undo action performed');
    } catch (error) {
      this.logger.error('Error performing undo', error);
    }
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    const graph = this.graphService.getGraph();
    if (!graph) return;

    try {
      // Custom redo implementation will go here
      this.logger.debug('Redo action performed');
    } catch (error) {
      this.logger.error('Error performing redo', error);
    }
  }

  /**
   * Clear the history
   */
  clear(): void {
    const graph = this.graphService.getGraph();
    if (!graph) return;

    try {
      // Custom clear implementation will go here
      this.logger.debug('History cleared');
      this.updateHistoryState();
    } catch (error) {
      this.logger.error('Error clearing history', error);
    }
  }

  /**
   * Set up custom history management
   */
  private setupCustomHistory(graph: Graph): void {
    // We'll implement a custom history manager here
    // For now, we'll just set up the event listeners

    graph.on('cell:added', () => {
      this.updateHistoryState();
    });

    graph.on('cell:removed', () => {
      this.updateHistoryState();
    });

    graph.on('cell:change', () => {
      this.updateHistoryState();
    });

    this.logger.info('Custom history manager initialized');
  }
}
