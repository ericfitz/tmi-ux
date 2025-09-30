import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { Subject } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { InfraX6CoreOperationsService } from '../services/infra-x6-core-operations.service';
import { InfraEdgeService } from '../services/infra-edge.service';

/**
 * Event types for X6 graph operations
 */
export interface X6GraphEvents {
  nodeAdded: { node: Node };
  nodeRemoved: { node: Node };
  nodeChanged: { node: Node; changes: any };
  edgeAdded: { edge: Edge };
  edgeRemoved: { edge: Edge };
  edgeChanged: { edge: Edge; changes: any };
  selectionChanged: { selected: Cell[]; deselected: Cell[] };
  graphCleared: Record<string, never>;
  connectionAttempt: { sourceNode: Node; targetNode: Node; valid: boolean };
  validationError: { cell: Cell; errors: string[] };
}

/**
 * X6 Event Handlers
 * Centralized event management and coordination for X6 graph operations
 */
@Injectable()
export class X6EventHandlers {
  private eventSubjects: { [K in keyof X6GraphEvents]: Subject<X6GraphEvents[K]> } = {
    nodeAdded: new Subject(),
    nodeRemoved: new Subject(),
    nodeChanged: new Subject(),
    edgeAdded: new Subject(),
    edgeRemoved: new Subject(),
    edgeChanged: new Subject(),
    selectionChanged: new Subject(),
    graphCleared: new Subject(),
    connectionAttempt: new Subject(),
    validationError: new Subject(),
  };

  constructor(
    private logger: LoggerService,
    private x6CoreOps: InfraX6CoreOperationsService,
    private infraEdgeService: InfraEdgeService,
  ) {}

  /**
   * Get observable for specific event type
   */
  getEvent<K extends keyof X6GraphEvents>(eventType: K) {
    return this.eventSubjects[eventType].asObservable();
  }

  /**
   * Emit an event
   */
  emitEvent<K extends keyof X6GraphEvents>(eventType: K, data: X6GraphEvents[K]): void {
    this.eventSubjects[eventType].next(data);
    this.logger.info(`Event emitted: ${eventType}`, data);
  }

  /**
   * Setup core graph event listeners
   */
  setupGraphEvents(graph: Graph): void {
    // Node events
    graph.on('node:added', ({ node }) => {
      this.logger.info('Node added to graph', { nodeId: node.id, shape: node.shape });
      this.emitEvent('nodeAdded', { node });
    });

    graph.on('node:removed', ({ node }) => {
      this.logger.info('Node removed from graph', { nodeId: node.id, shape: node.shape });
      this.emitEvent('nodeRemoved', { node });
    });

    graph.on('node:changed', ({ node, options }) => {
      this.logger.info('Node changed', { nodeId: node.id, options });
      this.emitEvent('nodeChanged', { node, changes: options });
    });

    // Edge events
    graph.on('edge:added', ({ edge }) => {
      this.logger.info('Edge added to graph', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });
      this.emitEvent('edgeAdded', { edge });
    });

    graph.on('edge:removed', ({ edge }) => {
      this.logger.info('Edge removed from graph', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });
      this.emitEvent('edgeRemoved', { edge });
    });

    graph.on('edge:changed', ({ edge, options }) => {
      this.logger.info('Edge changed', { edgeId: edge.id, options });
      this.emitEvent('edgeChanged', { edge, changes: options });
    });

    // Selection events
    graph.on('selection:changed', ({ added, removed }) => {
      this.logger.info('Selection changed - event handler', {
        addedCount: added.length,
        removedCount: removed.length,
        totalSelected: graph.getSelectedCells().length,
      });
      this.emitEvent('selectionChanged', { selected: added, deselected: removed });
    });

    // Graph events
    graph.on('graph:cleared', () => {
      this.logger.info('Graph cleared');
      this.emitEvent('graphCleared', {});
    });

    this.logger.info('Core graph events setup completed');
  }

  /**
   * Setup connection validation events
   */
  setupConnectionEvents(graph: Graph): void {
    // Connection validation
    graph.on('edge:connecting', ({ edge }: { edge: Edge }) => {
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      if (sourceId && targetId) {
        const sourceNode = graph.getCellById(sourceId) as Node;
        const targetNode = graph.getCellById(targetId) as Node;

        if (sourceNode && targetNode) {
          // Validate connection (this would typically use X6EdgeOperations)
          const valid = this.validateConnection(sourceNode, targetNode);

          this.emitEvent('connectionAttempt', {
            sourceNode,
            targetNode,
            valid,
          });

          if (!valid) {
            // Remove invalid connection using InfraEdgeService for business logic
            this.infraEdgeService.removeEdge(graph, edge.id);
            this.logger.warn('Invalid connection attempt blocked', {
              sourceShape: sourceNode.shape,
              targetShape: targetNode.shape,
            });
          }
        }
      }
    });

    // Connection completed
    graph.on('edge:connected', ({ edge }) => {
      this.logger.info('Edge connection completed', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
      });
    });

    // Connection removed
    graph.on('edge:disconnected', ({ edge }: { edge: Edge }) => {
      this.logger.info('Edge disconnected', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });
    });

    this.logger.info('Connection events setup completed');
  }

  /**
   * Setup interaction events
   */
  setupInteractionEvents(graph: Graph): void {
    // Mouse events
    graph.on('blank:click', ({ e: _e }) => {
      this.logger.info('Blank area clicked', {
        x: _e.clientX,
        y: _e.clientY,
      });
    });

    graph.on('blank:dblclick', ({ e }) => {
      this.logger.info('Blank area double-clicked', {
        x: e.clientX,
        y: e.clientY,
      });
    });

    // Cell interaction events
    graph.on('cell:click', ({ cell, e: _e }) => {
      this.logger.info('Cell clicked', {
        cellId: cell.id,
        cellType: cell.isNode() ? 'node' : 'edge',
        shape: cell.shape,
      });
    });

    graph.on('cell:dblclick', ({ cell, e: _e }) => {
      this.logger.info('Cell double-clicked', {
        cellId: cell.id,
        cellType: cell.isNode() ? 'node' : 'edge',
        shape: cell.shape,
      });
    });

    graph.on('cell:contextmenu', ({ cell, e }) => {
      this.logger.info('Cell context menu', {
        cellId: cell.id,
        cellType: cell.isNode() ? 'node' : 'edge',
        shape: cell.shape,
      });
      e.preventDefault(); // Prevent default context menu
    });

    // Drag events
    graph.on('node:move', ({ node, e: _e }) => {
      const position = node.getPosition();
      this.logger.debugComponent('X6EventHandlers', 'Node moving', {
        nodeId: node.id,
        x: position.x,
        y: position.y,
      });
    });

    graph.on('node:moved', ({ node, e: _e }) => {
      const position = node.getPosition();
      this.logger.info('Node moved', {
        nodeId: node.id,
        x: position.x,
        y: position.y,
      });
    });

    // Resize events
    graph.on('node:resize', ({ node, e: _e }) => {
      const size = node.getSize();
      this.logger.debugComponent('X6EventHandlers', 'Node resizing', {
        nodeId: node.id,
        width: size.width,
        height: size.height,
      });
    });

    graph.on('node:resized', ({ node, e: _e }) => {
      const size = node.getSize();
      this.logger.info('Node resized', {
        nodeId: node.id,
        width: size.width,
        height: size.height,
      });
    });

    this.logger.info('Interaction events setup completed');
  }

  /**
   * Setup error handling events
   */
  setupErrorEvents(graph: Graph): void {
    // Handle graph errors
    graph.on('graph:error', ({ error }: { error: unknown }) => {
      this.logger.error('Graph error occurred', { error });
    });

    // Handle cell validation errors
    graph.on(
      'cell:validate',
      ({ cell, valid, errors }: { cell: Cell; valid: boolean; errors: string[] }) => {
        if (!valid) {
          this.logger.warn('Cell validation failed', {
            cellId: cell.id,
            errors,
          });
          this.emitEvent('validationError', { cell, errors });
        }
      },
    );

    this.logger.info('Error events setup completed');
  }

  /**
   * Setup performance monitoring events
   */
  setupPerformanceEvents(graph: Graph): void {
    graph.on('render:start', () => {
      this.logger.debugComponent('X6EventHandlers', 'Render started');
    });

    graph.on('render:done', () => {
      this.logger.info('Render completed');
    });

    // Monitor large operations
    graph.on('batch:start', () => {
      this.logger.debugComponent('X6EventHandlers', 'Batch operation started');
    });

    graph.on('batch:stop', () => {
      this.logger.debugComponent('X6EventHandlers', 'Batch operation completed');
    });

    this.logger.info('Performance events setup completed');
  }

  /**
   * Setup all event handlers
   */
  setupAllEvents(graph: Graph): void {
    this.setupGraphEvents(graph);
    this.setupConnectionEvents(graph);
    this.setupInteractionEvents(graph);
    this.setupErrorEvents(graph);
    this.setupPerformanceEvents(graph);

    this.logger.info('All X6 event handlers setup completed');
  }

  /**
   * Cleanup event listeners
   */
  cleanup(): void {
    Object.values(this.eventSubjects).forEach(subject => {
      subject.complete();
    });
    this.logger.info('Event handlers cleaned up');
  }

  /**
   * Get event statistics
   */
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    Object.keys(this.eventSubjects).forEach(eventType => {
      const subject = this.eventSubjects[eventType as keyof X6GraphEvents];
      stats[eventType] = subject.observers.length;
    });

    return stats;
  }

  /**
   * Enable/disable event logging
   */
  setEventLogging(enabled: boolean): void {
    if (enabled) {
      this.logger.info('Event logging enabled');
    } else {
      this.logger.info('Event logging disabled');
    }
    // Implementation would control logging level for events
  }

  /**
   * Basic connection validation (simplified version)
   * This would typically delegate to X6EdgeOperations
   */
  private validateConnection(sourceNode: Node, targetNode: Node): boolean {
    const sourceShape = sourceNode.shape;
    const targetShape = targetNode.shape;

    // Basic DFD connection rules
    const connectionRules: Record<string, string[]> = {
      'dfd-process': ['dfd-datastore', 'dfd-external-entity', 'dfd-process'],
      'dfd-datastore': ['dfd-process'],
      'dfd-external-entity': ['dfd-process'],
    };

    const allowedTargets = connectionRules[sourceShape];
    return allowedTargets ? allowedTargets.includes(targetShape) : false;
  }
}
