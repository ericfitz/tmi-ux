import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Cell, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdEventBusService, DfdEventType } from './dfd-event-bus.service';
import { NodeData } from '../models/node-data.interface';

/**
 * Origin of a change - local or remote
 */
export type ChangeOrigin = 'local' | 'remote' | 'system';

/**
 * Change event interface
 */
export interface ChangeEvent {
  type: string;
  origin: ChangeOrigin;
  timestamp: number;
  data: unknown;
}

/**
 * Node change event
 */
export interface NodeChangeEvent extends ChangeEvent {
  type: 'node-change';
  data: {
    nodeId: string;
    changes: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
      label?: string;
      attrs?: Record<string, unknown>;
    };
  };
}

/**
 * Edge change event
 */
export interface EdgeChangeEvent extends ChangeEvent {
  type: 'edge-change';
  data: {
    edgeId: string;
    changes: {
      source?: { id: string; port?: string };
      target?: { id: string; port?: string };
      vertices?: Array<{ x: number; y: number }>;
      label?: string;
    };
  };
}

/**
 * Node add event
 */
export interface NodeAddEvent extends ChangeEvent {
  type: 'node-add';
  data: {
    nodeId: string;
    nodeType: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    label?: string;
    attrs?: Record<string, unknown>;
  };
}

/**
 * Node delete event
 */
export interface NodeDeleteEvent extends ChangeEvent {
  type: 'node-delete';
  data: {
    nodeId: string;
  };
}

/**
 * Edge add event
 */
export interface EdgeAddEvent extends ChangeEvent {
  type: 'edge-add';
  data: {
    edgeId: string;
    source: { id: string; port?: string };
    target: { id: string; port?: string };
    vertices?: Array<{ x: number; y: number }>;
    label?: string;
  };
}

/**
 * Edge delete event
 */
export interface EdgeDeleteEvent extends ChangeEvent {
  type: 'edge-delete';
  data: {
    edgeId: string;
  };
}

/**
 * Union type for all change events
 */
export type SyncChangeEvent =
  | NodeChangeEvent
  | EdgeChangeEvent
  | NodeAddEvent
  | NodeDeleteEvent
  | EdgeAddEvent
  | EdgeDeleteEvent;

/**
 * Service for tracking changes and determining which ones should be synchronized
 */
@Injectable({
  providedIn: 'root',
})
export class DfdChangeTrackerService {
  // Explicitly use NodeData type to avoid unused import warning
  private _nodeDataType: NodeData | null = null;
  private _changes = new Subject<SyncChangeEvent>();
  private _previousNodeStates = new Map<string, Node.Properties>();
  private _previousEdgeStates = new Map<string, Edge.Properties>();

  constructor(
    private logger: LoggerService,
    private eventBus: DfdEventBusService,
  ) {
    this.logger.info('DfdChangeTrackerService initialized');
    this.subscribeToEvents();
  }

  /**
   * Subscribe to DFD events and track changes
   */
  private subscribeToEvents(): void {
    // Subscribe to graph changes
    this.eventBus.onEventType(DfdEventType.GraphChanged).subscribe(event => {
      if ('added' in event && event.added && event.added.length > 0) {
        this.handleAddedCells(event.added);
      }

      if ('removed' in event && event.removed && event.removed.length > 0) {
        this.handleRemovedCells(event.removed);
      }

      // Track changes to existing cells
      if ('cells' in event && event.cells) {
        this.trackCellChanges(event.cells);
      }
    });

    // Subscribe to node moved events
    this.eventBus.onEventType(DfdEventType.NodeMoved).subscribe(event => {
      if ('node' in event && event.node) {
        this.trackNodeMove(event.node);
      }
    });

    // Subscribe to node resized events
    this.eventBus.onEventType(DfdEventType.NodeResized).subscribe(event => {
      if ('node' in event && event.node) {
        this.trackNodeResize(event.node);
      }
    });
  }

  /**
   * Handle added cells
   * @param cells The cells that were added
   */
  private handleAddedCells(cells: Cell[]): void {
    cells.forEach(cell => {
      if (cell.isNode()) {
        const node = cell;
        this.trackNodeAddition(node);
      } else if (cell.isEdge()) {
        const edge = cell;
        this.trackEdgeAddition(edge);
      }
    });
  }

  /**
   * Handle removed cells
   * @param cells The cells that were removed
   */
  private handleRemovedCells(cells: Cell[]): void {
    cells.forEach(cell => {
      if (cell.isNode()) {
        const node = cell;
        this.trackNodeDeletion(node);
      } else if (cell.isEdge()) {
        const edge = cell;
        this.trackEdgeDeletion(edge);
      }
    });
  }

  /**
   * Track changes to cells
   * @param cells The cells to track
   */
  private trackCellChanges(cells: Cell[]): void {
    cells.forEach(cell => {
      if (cell.isNode()) {
        const node = cell;
        this.trackNodeChanges(node);
      } else if (cell.isEdge()) {
        const edge = cell;
        this.trackEdgeChanges(edge);
      }
    });
  }

  /**
   * Track node addition
   * @param node The node that was added
   */
  private trackNodeAddition(node: Node): void {
    // Store the initial state
    this._previousNodeStates.set(node.id, this.getNodeProperties(node));

    // Publish a node add event
    const event: NodeAddEvent = {
      type: 'node-add',
      origin: 'local',
      timestamp: Date.now(),
      data: {
        nodeId: node.id,
        nodeType: this.getNodeDataProperty<string>(node, 'type') || 'unknown',
        position: node.getPosition(),
        size: node.getSize(),
        label: this.getNodeDataProperty<string>(node, 'label'),
        attrs: node.getAttrs(),
      },
    };

    this._changes.next(event);
    this.logger.debug('Node added', event);
  }

  /**
   * Track node deletion
   * @param node The node that was deleted
   */
  private trackNodeDeletion(node: Node): void {
    // Remove the node from the previous states
    this._previousNodeStates.delete(node.id);

    // Publish a node delete event
    const event: NodeDeleteEvent = {
      type: 'node-delete',
      origin: 'local',
      timestamp: Date.now(),
      data: {
        nodeId: node.id,
      },
    };

    this._changes.next(event);
    this.logger.debug('Node deleted', event);
  }

  /**
   * Track edge addition
   * @param edge The edge that was added
   */
  private trackEdgeAddition(edge: Edge): void {
    // Store the initial state
    this._previousEdgeStates.set(edge.id, this.getEdgeProperties(edge));

    // Publish an edge add event
    const event: EdgeAddEvent = {
      type: 'edge-add',
      origin: 'local',
      timestamp: Date.now(),
      data: {
        edgeId: edge.id,
        source: {
          id: edge.getSourceCellId() || '',
          port: edge.getSourcePortId(),
        },
        target: {
          id: edge.getTargetCellId() || '',
          port: edge.getTargetPortId(),
        },
        vertices: edge.getVertices(),
        label: edge.attr('label/text'),
      },
    };

    this._changes.next(event);
    this.logger.debug('Edge added', event);
  }

  /**
   * Track edge deletion
   * @param edge The edge that was deleted
   */
  private trackEdgeDeletion(edge: Edge): void {
    // Remove the edge from the previous states
    this._previousEdgeStates.delete(edge.id);

    // Publish an edge delete event
    const event: EdgeDeleteEvent = {
      type: 'edge-delete',
      origin: 'local',
      timestamp: Date.now(),
      data: {
        edgeId: edge.id,
      },
    };

    this._changes.next(event);
    this.logger.debug('Edge deleted', event);
  }

  /**
   * Track node changes
   * @param node The node to track
   */
  private trackNodeChanges(node: Node): void {
    const previousState = this._previousNodeStates.get(node.id);
    if (!previousState) {
      // This is a new node, store its state
      this._previousNodeStates.set(node.id, this.getNodeProperties(node));
      return;
    }

    // Check for changes
    const currentState = this.getNodeProperties(node);
    const changes = this.getNodeChanges(previousState, currentState);

    if (Object.keys(changes).length > 0) {
      // Update the previous state
      this._previousNodeStates.set(node.id, currentState);

      // Publish a node change event
      const event: NodeChangeEvent = {
        type: 'node-change',
        origin: 'local',
        timestamp: Date.now(),
        data: {
          nodeId: node.id,
          changes,
        },
      };

      this._changes.next(event);
      this.logger.debug('Node changed', event);
    }
  }

  /**
   * Track node move
   * @param node The node that was moved
   */
  private trackNodeMove(node: Node): void {
    const previousState = this._previousNodeStates.get(node.id);
    if (!previousState) {
      // This is a new node, store its state
      this._previousNodeStates.set(node.id, this.getNodeProperties(node));
      return;
    }

    const currentPosition = node.getPosition();
    if (
      previousState.position &&
      (previousState.position.x !== currentPosition.x ||
        previousState.position.y !== currentPosition.y)
    ) {
      // Update the previous state
      const currentState = this.getNodeProperties(node);
      this._previousNodeStates.set(node.id, currentState);

      // Publish a node change event
      const event: NodeChangeEvent = {
        type: 'node-change',
        origin: 'local',
        timestamp: Date.now(),
        data: {
          nodeId: node.id,
          changes: {
            position: currentPosition,
          },
        },
      };

      this._changes.next(event);
      this.logger.debug('Node moved', event);
    }
  }

  /**
   * Track node resize
   * @param node The node that was resized
   */
  private trackNodeResize(node: Node): void {
    const previousState = this._previousNodeStates.get(node.id);
    if (!previousState) {
      // This is a new node, store its state
      this._previousNodeStates.set(node.id, this.getNodeProperties(node));
      return;
    }

    const currentSize = node.getSize();
    if (
      previousState.size &&
      (previousState.size.width !== currentSize.width ||
        previousState.size.height !== currentSize.height)
    ) {
      // Update the previous state
      const currentState = this.getNodeProperties(node);
      this._previousNodeStates.set(node.id, currentState);

      // Publish a node change event
      const event: NodeChangeEvent = {
        type: 'node-change',
        origin: 'local',
        timestamp: Date.now(),
        data: {
          nodeId: node.id,
          changes: {
            size: currentSize,
          },
        },
      };

      this._changes.next(event);
      this.logger.debug('Node resized', event);
    }
  }

  /**
   * Track edge changes
   * @param edge The edge to track
   */
  private trackEdgeChanges(edge: Edge): void {
    const previousState = this._previousEdgeStates.get(edge.id);
    if (!previousState) {
      // This is a new edge, store its state
      this._previousEdgeStates.set(edge.id, this.getEdgeProperties(edge));
      return;
    }

    // Check for changes
    const currentState = this.getEdgeProperties(edge);
    const changes = this.getEdgeChanges(previousState, currentState);

    if (Object.keys(changes).length > 0) {
      // Update the previous state
      this._previousEdgeStates.set(edge.id, currentState);

      // Publish an edge change event
      const event: EdgeChangeEvent = {
        type: 'edge-change',
        origin: 'local',
        timestamp: Date.now(),
        data: {
          edgeId: edge.id,
          changes,
        },
      };

      this._changes.next(event);
      this.logger.debug('Edge changed', event);
    }
  }

  /**
   * Get node properties
   * @param node The node to get properties for
   * @returns The node properties
   */
  private getNodeProperties(node: Node): Node.Properties {
    return {
      id: node.id,
      position: node.getPosition(),
      size: node.getSize(),
      attrs: node.getAttrs(),
      data: this.getSafeNodeData(node),
    };
  }

  /**
   * Get edge properties
   * @param edge The edge to get properties for
   * @returns The edge properties
   */
  private getEdgeProperties(edge: Edge): Edge.Properties {
    return {
      id: edge.id,
      source: {
        cell: edge.getSourceCellId() || '',
        port: edge.getSourcePortId(),
      },
      target: {
        cell: edge.getTargetCellId() || '',
        port: edge.getTargetPortId(),
      },
      vertices: edge.getVertices(),
      attrs: edge.getAttrs(),
      data: this.getSafeEdgeData(edge),
    };
  }

  /**
   * Get node changes
   * @param previous The previous node state
   * @param current The current node state
   * @returns The changes
   */
  private getNodeChanges(
    previous: Node.Properties,
    current: Node.Properties,
  ): NodeChangeEvent['data']['changes'] {
    const changes: NodeChangeEvent['data']['changes'] = {};

    // Check position
    if (
      previous.position &&
      current.position &&
      (previous.position.x !== current.position.x || previous.position.y !== current.position.y)
    ) {
      changes.position = current.position;
    }

    // Check size
    if (
      previous.size &&
      current.size &&
      (previous.size.width !== current.size.width || previous.size.height !== current.size.height)
    ) {
      changes.size = current.size;
    }

    // Check label
    const previousLabel = (previous.data as { label?: string })?.label;
    const currentLabel = (current.data as { label?: string })?.label;
    if (previousLabel !== currentLabel) {
      changes.label = currentLabel;
    }

    // Check attrs (simplified - only check for existence of changes)
    if (JSON.stringify(previous.attrs) !== JSON.stringify(current.attrs)) {
      changes.attrs = current.attrs;
    }

    return changes;
  }

  /**
   * Get edge changes
   * @param previous The previous edge state
   * @param current The current edge state
   * @returns The changes
   */
  private getEdgeChanges(
    previous: Edge.Properties,
    current: Edge.Properties,
  ): EdgeChangeEvent['data']['changes'] {
    const changes: EdgeChangeEvent['data']['changes'] = {};

    // Check source
    const prevSource = previous['source'] as Record<string, unknown> | undefined;
    const currSource = current['source'] as Record<string, unknown> | undefined;

    if (
      prevSource &&
      currSource &&
      (prevSource['cell'] !== currSource['cell'] || prevSource['port'] !== currSource['port'])
    ) {
      // Safely access and type the source cell and port
      const sourceCell = currSource ? currSource['cell'] : undefined;
      const sourcePort = currSource ? currSource['port'] : undefined;
      changes.source = {
        id:
          typeof sourceCell === 'string'
            ? sourceCell
            : sourceCell === undefined || sourceCell === null
              ? ''
              : typeof sourceCell === 'number' || typeof sourceCell === 'boolean'
                ? String(sourceCell)
                : '',
        port: typeof sourcePort === 'string' ? sourcePort : undefined,
      };
    }

    // Check target
    const prevTarget = previous['target'] as Record<string, unknown> | undefined;
    const currTarget = current['target'] as Record<string, unknown> | undefined;

    if (
      prevTarget &&
      currTarget &&
      (prevTarget['cell'] !== currTarget['cell'] || prevTarget['port'] !== currTarget['port'])
    ) {
      // Safely access and type the target cell and port
      const targetCell = currTarget ? currTarget['cell'] : undefined;
      const targetPort = currTarget ? currTarget['port'] : undefined;
      changes.target = {
        id:
          typeof targetCell === 'string'
            ? targetCell
            : targetCell === undefined || targetCell === null
              ? ''
              : typeof targetCell === 'number' || typeof targetCell === 'boolean'
                ? String(targetCell)
                : '',
        port: typeof targetPort === 'string' ? targetPort : undefined,
      };
    }

    // Check vertices
    const prevVertices = previous['vertices'] as Array<{ x: number; y: number }> | undefined;
    const currVertices = current['vertices'] as Array<{ x: number; y: number }> | undefined;

    if (JSON.stringify(prevVertices) !== JSON.stringify(currVertices)) {
      if (Array.isArray(currVertices)) {
        changes['vertices'] = currVertices as Array<{ x: number; y: number }>;
      }
    }

    // Check label
    const previousLabel = previous.attrs?.['label/text'];
    const currentLabel = current.attrs?.['label/text'];
    if (previousLabel !== currentLabel) {
      // Only use the label if it's a string or can be safely converted to one
      if (typeof currentLabel === 'string') {
        changes.label = currentLabel;
      } else if (typeof currentLabel === 'number' || typeof currentLabel === 'boolean') {
        changes.label = String(currentLabel);
      } else {
        // If it's an object or something else, use an empty string
        changes.label = '';
      }
    }

    return changes;
  }

  /**
   * Safely get a property from node data
   * @param node The node to get data from
   * @param property The property to get
   * @returns The property value or undefined
   */
  private getNodeDataProperty<T>(node: Node, property: string): T | undefined {
    const data: unknown = node.getData();
    if (data && typeof data === 'object' && property in (data as Record<string, unknown>)) {
      return (data as Record<string, unknown>)[property] as T;
    }
    return undefined;
  }

  /**
   * Safely get node data
   * @param node The node to get data from
   * @returns The node data as a record
   */
  private getSafeNodeData(node: Node): Record<string, unknown> {
    const data: unknown = node.getData();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }

  /**
   * Safely get edge data
   * @param edge The edge to get data from
   * @returns The edge data as a record
   */
  private getSafeEdgeData(edge: Edge): Record<string, unknown> {
    const data: unknown = edge.getData();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }

  /**
   * Set the origin of a change event
   * @param event The event to set the origin for
   * @param origin The origin to set
   */
  setOrigin(event: SyncChangeEvent, origin: ChangeOrigin): void {
    event.origin = origin;
  }

  /**
   * Get all changes
   * @returns An observable of all changes
   */
  getChanges(): Observable<SyncChangeEvent> {
    return this._changes.asObservable();
  }

  /**
   * Get local changes only
   * @returns An observable of local changes
   */
  getLocalChanges(): Observable<SyncChangeEvent> {
    return this._changes.pipe(filter(event => event.origin === 'local'));
  }

  /**
   * Get remote changes only
   * @returns An observable of remote changes
   */
  getRemoteChanges(): Observable<SyncChangeEvent> {
    return this._changes.pipe(filter(event => event.origin === 'remote'));
  }

  /**
   * Publish a change event
   * @param event The event to publish
   */
  publishChange(event: SyncChangeEvent): void {
    this._changes.next(event);
  }
}
