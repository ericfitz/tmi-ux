import { Injectable } from '@angular/core';
import { Graph, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { CollaborativeOperationService } from '../../services/collaborative-operation.service';
import { AppStateService } from './app-state.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { GraphHistoryCoordinator } from '../../services/graph-history-coordinator.service';
import { CellOperation } from '../../../../core/types/websocket-message.types';

/**
 * DiagramOperationBroadcaster - Captures X6 graph events and broadcasts them as collaborative operations
 *
 * Key responsibilities:
 * - Listen to X6 graph modification events
 * - Filter out visual effects using existing history filtering logic
 * - Batch related operations atomically
 * - Convert X6 events to CellOperation format
 * - Prevent echo effects when applying remote operations
 */
@Injectable()
export class DiagramOperationBroadcaster {
  private _graph: Graph | null = null;
  private _pendingOperations: CellOperation[] = [];
  private _isInAtomicOperation = false;
  private _eventListeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  constructor(
    private collaborativeOperationService: CollaborativeOperationService,
    private appStateService: AppStateService,
    private collaborationService: DfdCollaborationService,
    private historyCoordinator: GraphHistoryCoordinator,
    private logger: LoggerService,
  ) {}

  /**
   * Initialize event listeners on the X6 graph
   */
  initializeListeners(graph: Graph): void {
    if (!this.collaborationService.isCollaborating()) {
      this.logger.debug('Not in collaboration mode, skipping broadcast initialization');
      return;
    }

    this._graph = graph;
    this._setupEventListeners();
    this.logger.info('DiagramOperationBroadcaster initialized', {
      graphId: (graph as any).options?.id || 'unknown',
    });
  }

  /**
   * Start an atomic operation - all events until commit will be batched
   */
  startAtomicOperation(): void {
    if (!this.collaborationService.isCollaborating()) {
      return;
    }

    if (this._isInAtomicOperation) {
      this.logger.warn('Already in atomic operation, nested operations not supported');
      return;
    }

    this._isInAtomicOperation = true;
    this._pendingOperations = [];
    this.logger.debug('Started atomic operation');
  }

  /**
   * Commit the current atomic operation - sends all batched operations
   */
  commitAtomicOperation(): void {
    if (!this.collaborationService.isCollaborating()) {
      return;
    }

    if (!this._isInAtomicOperation) {
      this.logger.warn('No atomic operation in progress');
      return;
    }

    try {
      if (this._pendingOperations.length > 0) {
        this.logger.info('Committing atomic operation', {
          operationCount: this._pendingOperations.length,
          operations: this._pendingOperations.map(op => ({ id: op.id, operation: op.operation })),
        });

        // Send operations via collaborative service
        this.collaborativeOperationService
          .sendDiagramOperation([...this._pendingOperations])
          .subscribe({
            next: () => {
              this.logger.debug('Atomic operation broadcast successful');
            },
            error: error => {
              this.logger.error('Failed to broadcast atomic operation', error);
            },
          });
      } else {
        this.logger.debug('No operations to commit in atomic operation');
      }
    } finally {
      this._isInAtomicOperation = false;
      this._pendingOperations = [];
    }
  }

  /**
   * Cancel the current atomic operation - discards all batched operations
   */
  cancelAtomicOperation(): void {
    if (!this.collaborationService.isCollaborating()) {
      return;
    }

    if (this._isInAtomicOperation) {
      this.logger.debug('Cancelled atomic operation', {
        discardedOperations: this._pendingOperations.length,
      });
      this._isInAtomicOperation = false;
      this._pendingOperations = [];
    }
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    if (this._graph) {
      this._eventListeners.forEach(({ event, handler }) => {
        this._graph!.off(event, handler);
      });
      this._eventListeners = [];
      this._graph = null;
    }

    // Cancel any pending atomic operation
    this.cancelAtomicOperation();
    this.logger.debug('DiagramOperationBroadcaster disposed');
  }

  /**
   * Setup X6 event listeners
   */
  private _setupEventListeners(): void {
    if (!this._graph) {
      return;
    }

    // Listen to cell addition events
    const onCellAdded = ({ cell }: { cell: Cell }) => {
      this._handleCellEvent('cell:added', { cell });
    };

    // Listen to cell removal events
    const onCellRemoved = ({ cell }: { cell: Cell }) => {
      this._handleCellEvent('cell:removed', { cell });
    };

    // Listen to cell change events
    const onCellChanged = (args: any) => {
      this._handleCellEvent('cell:change:*', args);
    };

    // Register listeners
    this._graph.on('cell:added', onCellAdded);
    this._graph.on('cell:removed', onCellRemoved);
    this._graph.on('cell:change:*', onCellChanged);

    // Track listeners for cleanup
    this._eventListeners.push(
      { event: 'cell:added', handler: onCellAdded },
      { event: 'cell:removed', handler: onCellRemoved },
      { event: 'cell:change:*', handler: onCellChanged },
    );
  }

  /**
   * Handle X6 cell events and convert to collaborative operations
   */
  private _handleCellEvent(event: string, args: any): void {
    try {
      // Skip if we should not broadcast this change
      if (!this._shouldBroadcastChange(event, args)) {
        return;
      }

      // Convert X6 event to CellOperation
      const operation = this._convertX6EventToCellOperation(event, args);
      if (!operation) {
        return;
      }

      // Either add to pending batch or send immediately
      if (this._isInAtomicOperation) {
        this._pendingOperations.push(operation);
        this.logger.debug('Added operation to atomic batch', {
          operation: operation.operation,
          cellId: operation.id,
          batchSize: this._pendingOperations.length,
        });
      } else {
        // Send immediately for non-atomic operations
        this._sendSingleOperation(operation);
      }
    } catch (error) {
      this.logger.error('Error handling cell event', { event, error });
    }
  }

  /**
   * Determine if a change should be broadcast based on existing history filtering
   */
  private _shouldBroadcastChange(event: string, args: any): boolean {
    // Skip if applying remote changes (prevents echo)
    if (this.appStateService.getCurrentState().isApplyingRemoteChange) {
      this.logger.debug('Skipping broadcast - applying remote change');
      return false;
    }

    // Skip if not in collaboration mode
    if (!this.collaborationService.isCollaborating()) {
      return false;
    }

    // Use same filtering logic as X6 history
    // Exclude tool changes completely
    if (event === 'cell:change:tools') {
      return false;
    }

    // For attribute changes, check if only visual attributes changed
    if (event === 'cell:change:*' && args.key) {
      const attributePaths = this._extractAttributePaths(args);

      if (attributePaths.length === 0) {
        return false;
      }

      // Check if all changes are visual-only using history coordinator
      const isOnlyVisualAttributes = attributePaths.every(changePath => {
        return this.historyCoordinator.shouldExcludeAttribute(changePath);
      });

      if (isOnlyVisualAttributes) {
        this.logger.debug('Skipping broadcast - visual-only changes', { attributePaths });
        return false;
      }

      // Check for port visibility changes
      if (args.options?.propertyPath) {
        const isPortVisibilityOnly = this.historyCoordinator.shouldExcludeAttribute(
          undefined,
          args.options.propertyPath,
        );

        if (isPortVisibilityOnly) {
          this.logger.debug('Skipping broadcast - port visibility change', {
            propertyPath: args.options.propertyPath,
          });
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Extract attribute paths from X6 change event args
   */
  private _extractAttributePaths(args: any): string[] {
    const paths: string[] = [];

    if (args.key && typeof args.key === 'string') {
      // Handle attrs/path/to/property format
      if (args.key.startsWith('attrs/')) {
        const attributePath = args.key.replace('attrs/', '');
        paths.push(attributePath);
      } else {
        paths.push(args.key);
      }
    }

    return paths;
  }

  /**
   * Convert X6 event to CellOperation format
   */
  private _convertX6EventToCellOperation(event: string, args: any): CellOperation | null {
    const cell = args.cell;
    if (!cell || !cell.id) {
      this.logger.warn('Cannot convert event - invalid cell', { event });
      return null;
    }

    switch (event) {
      case 'cell:added':
        return {
          id: cell.id,
          operation: 'add',
          data: this._serializeCellData(cell),
        };

      case 'cell:removed':
        return {
          id: cell.id,
          operation: 'remove',
        };

      case 'cell:change:*': {
        const changes = this._extractSemanticChanges(args);
        if (!changes || Object.keys(changes).length === 0) {
          return null;
        }

        return {
          id: cell.id,
          operation: 'update',
          data: changes as any,
        };
      }

      default:
        this.logger.warn('Unknown event type for conversion', { event });
        return null;
    }
  }

  /**
   * Serialize cell data for add operations
   */
  private _serializeCellData(cell: Cell): any {
    const data: any = {
      id: cell.id,
      shape: cell.shape,
    };

    if (cell.isNode()) {
      const node = cell;
      const position = node.getPosition();
      const size = node.getSize();

      data.x = position.x;
      data.y = position.y;
      data.width = size.width;
      data.height = size.height;
      data.label = node.getAttrByPath('text/text') || '';

      // Include any custom attributes
      const attrs = node.getAttrs();
      if (attrs && Object.keys(attrs).length > 0) {
        data.attrs = attrs;
      }
    } else if (cell.isEdge()) {
      const edge = cell;

      data.source = edge.getSource();
      data.target = edge.getTarget();
      data.vertices = edge.getVertices();

      const labels = edge.getLabels();
      if (labels && labels.length > 0) {
        data.labels = labels;
      }

      const attrs = edge.getAttrs();
      if (attrs && Object.keys(attrs).length > 0) {
        data.attrs = attrs;
      }
    }

    return data;
  }

  /**
   * Extract only semantic changes from X6 change event
   */
  private _extractSemanticChanges(args: any): Record<string, any> | null {
    if (!args.key || !Object.prototype.hasOwnProperty.call(args, 'current')) {
      return null;
    }

    const changes: any = {};

    // Handle position changes
    if (args.key === 'position') {
      changes.x = args.current.x;
      changes.y = args.current.y;
    }
    // Handle size changes
    else if (args.key === 'size') {
      changes.width = args.current.width;
      changes.height = args.current.height;
    }
    // Handle label changes
    else if (args.key === 'attrs/text/text') {
      changes.label = args.current;
    }
    // Handle source/target changes for edges
    else if (args.key === 'source') {
      changes.source = args.current;
    } else if (args.key === 'target') {
      changes.target = args.current;
    }
    // Handle vertices changes for edges
    else if (args.key === 'vertices') {
      changes.vertices = args.current;
    }
    // Handle other semantic attribute changes
    else if (args.key.startsWith('attrs/') && !this._isVisualAttribute(args.key)) {
      // Include non-visual attribute changes
      changes[args.key] = args.current;
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Check if an attribute is visual-only (should be excluded)
   */
  private _isVisualAttribute(attributePath: string): boolean {
    return this.historyCoordinator.shouldExcludeAttribute(attributePath.replace('attrs/', ''));
  }

  /**
   * Send a single operation immediately
   */
  private _sendSingleOperation(operation: CellOperation): void {
    this.logger.debug('Broadcasting single operation', {
      operation: operation.operation,
      cellId: operation.id,
    });

    this.collaborativeOperationService.sendDiagramOperation([operation]).subscribe({
      next: () => {
        this.logger.debug('Single operation broadcast successful');
      },
      error: error => {
        this.logger.error('Failed to broadcast single operation', error);
      },
    });
  }
}
