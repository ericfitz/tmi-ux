import { BaseDomainEvent } from './domain-event';
import { NodeInfo } from '../value-objects/node-info';
import { EdgeInfo } from '../value-objects/edge-info';
import { Point } from '../value-objects/point';

/**
 * Event fired when a node is added to the diagram
 */
export class NodeAddedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly nodeInfo: NodeInfo,
    metadata?: Record<string, unknown>,
  ) {
    super('NodeAdded', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    nodeInfo: ReturnType<NodeInfo['toJSON']>;
    metadata?: Record<string, unknown>;
  }): NodeAddedEvent {
    const event = new NodeAddedEvent(
      data.aggregateId,
      data.aggregateVersion,
      NodeInfo.fromJSON(data.nodeInfo),
      data.metadata,
    );
    // Override the generated ID with the serialized one
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    nodeInfo: ReturnType<NodeInfo['toJSON']>;
  } {
    return {
      ...super.toJSON(),
      nodeInfo: this.nodeInfo.toJSON(),
    };
  }
}

/**
 * Event fired when a node is moved in the diagram
 */
export class NodeMovedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly nodeId: string,
    public readonly oldPosition: Point,
    public readonly newPosition: Point,
    metadata?: Record<string, unknown>,
  ) {
    super('NodeMoved', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    nodeId: string;
    oldPosition: { x: number; y: number };
    newPosition: { x: number; y: number };
    metadata?: Record<string, unknown>;
  }): NodeMovedEvent {
    const event = new NodeMovedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.nodeId,
      Point.fromJSON(data.oldPosition),
      Point.fromJSON(data.newPosition),
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    nodeId: string;
    oldPosition: { x: number; y: number };
    newPosition: { x: number; y: number };
  } {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      oldPosition: this.oldPosition.toJSON(),
      newPosition: this.newPosition.toJSON(),
    };
  }
}

/**
 * Event fired when a node is removed from the diagram
 */
export class NodeRemovedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly nodeId: string,
    public readonly nodeInfo: NodeInfo,
    metadata?: Record<string, unknown>,
  ) {
    super('NodeRemoved', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    nodeId: string;
    nodeInfo: ReturnType<NodeInfo['toJSON']>;
    metadata?: Record<string, unknown>;
  }): NodeRemovedEvent {
    const event = new NodeRemovedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.nodeId,
      NodeInfo.fromJSON(data.nodeInfo),
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    nodeId: string;
    nodeInfo: ReturnType<NodeInfo['toJSON']>;
  } {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      nodeInfo: this.nodeInfo.toJSON(),
    };
  }
}

/**
 * Event fired when a node's label is updated
 */
export class NodeLabelUpdatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly nodeId: string,
    public readonly oldLabel: string,
    public readonly newLabel: string,
    metadata?: Record<string, unknown>,
  ) {
    super('NodeLabelUpdated', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    nodeId: string;
    oldLabel: string;
    newLabel: string;
    metadata?: Record<string, unknown>;
  }): NodeLabelUpdatedEvent {
    const event = new NodeLabelUpdatedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.nodeId,
      data.oldLabel,
      data.newLabel,
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    nodeId: string;
    oldLabel: string;
    newLabel: string;
  } {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      oldLabel: this.oldLabel,
      newLabel: this.newLabel,
    };
  }
}

/**
 * Event fired when a node is resized
 */
export class NodeResizedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly nodeId: string,
    public readonly oldWidth: number,
    public readonly oldHeight: number,
    public readonly newWidth: number,
    public readonly newHeight: number,
    metadata?: Record<string, unknown>,
  ) {
    super('NodeResized', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    nodeId: string;
    oldWidth: number;
    oldHeight: number;
    newWidth: number;
    newHeight: number;
    metadata?: Record<string, unknown>;
  }): NodeResizedEvent {
    const event = new NodeResizedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.nodeId,
      data.oldWidth,
      data.oldHeight,
      data.newWidth,
      data.newHeight,
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    nodeId: string;
    oldWidth: number;
    oldHeight: number;
    newWidth: number;
    newHeight: number;
  } {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      oldWidth: this.oldWidth,
      oldHeight: this.oldHeight,
      newWidth: this.newWidth,
      newHeight: this.newHeight,
    };
  }
}

/**
 * Event fired when an edge is added to the diagram
 */
export class EdgeAddedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly edgeInfo: EdgeInfo,
    metadata?: Record<string, unknown>,
  ) {
    super('EdgeAdded', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    edgeInfo: ReturnType<EdgeInfo['toJSON']>;
    metadata?: Record<string, unknown>;
  }): EdgeAddedEvent {
    const event = new EdgeAddedEvent(
      data.aggregateId,
      data.aggregateVersion,
      EdgeInfo.fromJSON(data.edgeInfo),
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    edgeInfo: ReturnType<EdgeInfo['toJSON']>;
  } {
    return {
      ...super.toJSON(),
      edgeInfo: this.edgeInfo.toJSON(),
    };
  }
}

/**
 * Event fired when an edge is removed from the diagram
 */
export class EdgeRemovedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly edgeId: string,
    public readonly edgeInfo: EdgeInfo,
    metadata?: Record<string, unknown>,
  ) {
    super('EdgeRemoved', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    edgeId: string;
    edgeInfo: ReturnType<EdgeInfo['toJSON']>;
    metadata?: Record<string, unknown>;
  }): EdgeRemovedEvent {
    const event = new EdgeRemovedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.edgeId,
      EdgeInfo.fromJSON(data.edgeInfo),
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    edgeId: string;
    edgeInfo: ReturnType<EdgeInfo['toJSON']>;
  } {
    return {
      ...super.toJSON(),
      edgeId: this.edgeId,
      edgeInfo: this.edgeInfo.toJSON(),
    };
  }
}

/**
 * Event fired when an edge's vertices are updated
 */
export class EdgeVerticesUpdatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly edgeId: string,
    public readonly oldVertices: Point[],
    public readonly newVertices: Point[],
    metadata?: Record<string, unknown>,
  ) {
    super('EdgeVerticesUpdated', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    edgeId: string;
    oldVertices: Array<{ x: number; y: number }>;
    newVertices: Array<{ x: number; y: number }>;
    metadata?: Record<string, unknown>;
  }): EdgeVerticesUpdatedEvent {
    const event = new EdgeVerticesUpdatedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.edgeId,
      data.oldVertices.map(v => Point.fromJSON(v)),
      data.newVertices.map(v => Point.fromJSON(v)),
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    edgeId: string;
    oldVertices: Array<{ x: number; y: number }>;
    newVertices: Array<{ x: number; y: number }>;
  } {
    return {
      ...super.toJSON(),
      edgeId: this.edgeId,
      oldVertices: this.oldVertices.map(v => v.toJSON()),
      newVertices: this.newVertices.map(v => v.toJSON()),
    };
  }
}

/**
 * Event fired when the entire diagram state changes
 */
export class DiagramChangedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly changeType: 'node' | 'edge' | 'bulk',
    public readonly affectedIds: string[],
    metadata?: Record<string, unknown>,
  ) {
    super('DiagramChanged', aggregateId, aggregateVersion, metadata);
  }

  static fromJSON(data: {
    id: string;
    aggregateId: string;
    aggregateVersion: number;
    changeType: 'node' | 'edge' | 'bulk';
    affectedIds: string[];
    metadata?: Record<string, unknown>;
  }): DiagramChangedEvent {
    const event = new DiagramChangedEvent(
      data.aggregateId,
      data.aggregateVersion,
      data.changeType,
      data.affectedIds,
      data.metadata,
    );
    (event as { id: string }).id = data.id;
    return event;
  }

  override toJSON(): ReturnType<BaseDomainEvent['toJSON']> & {
    changeType: 'node' | 'edge' | 'bulk';
    affectedIds: string[];
  } {
    return {
      ...super.toJSON(),
      changeType: this.changeType,
      affectedIds: this.affectedIds,
    };
  }
}

/**
 * Union type of all diagram events
 */
export type DiagramEvent =
  | NodeAddedEvent
  | NodeMovedEvent
  | NodeRemovedEvent
  | NodeLabelUpdatedEvent
  | NodeResizedEvent
  | EdgeAddedEvent
  | EdgeRemovedEvent
  | EdgeVerticesUpdatedEvent
  | DiagramChangedEvent;
