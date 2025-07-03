import { DiagramNode } from '../value-objects/diagram-node';
import { DiagramEdge } from '../value-objects/diagram-edge';
import { NodeData } from '../value-objects/node-data';
import { BaseDomainEvent } from '../events/domain-event';
import {
  NodeAddedEvent,
  NodeMovedEvent,
  NodeRemovedEvent,
  NodeLabelUpdatedEvent,
  EdgeAddedEvent,
  EdgeRemovedEvent,
  DiagramChangedEvent,
} from '../events/diagram-events';
import {
  AnyDiagramCommand,
  CreateDiagramCommand,
  AddNodeCommand,
  UpdateNodePositionCommand,
  UpdateNodeDataCommand,
  RemoveNodeCommand,
  AddEdgeCommand,
  UpdateEdgeDataCommand,
  RemoveEdgeCommand,
  UpdateDiagramMetadataCommand,
} from '../commands/diagram-commands';

/**
 * Domain errors for diagram operations
 */
export class DiagramDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DiagramDomainError';
  }
}

/**
 * Diagram aggregate root that manages the complete diagram state
 * and enforces business rules
 */
export class DiagramAggregate {
  private _uncommittedEvents: BaseDomainEvent[] = [];
  private _nodes: Map<string, DiagramNode> = new Map();
  private _edges: Map<string, DiagramEdge> = new Map();
  private _version: number = 0;

  constructor(
    private readonly _id: string,
    private _name: string,
    private _description: string = '',
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date(),
    private readonly _createdBy: string = '',
  ) {}

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get version(): number {
    return this._version;
  }

  get nodes(): ReadonlyMap<string, DiagramNode> {
    return this._nodes;
  }

  get edges(): ReadonlyMap<string, DiagramEdge> {
    return this._edges;
  }

  /**
   * Creates a new diagram aggregate
   */
  static create(command: CreateDiagramCommand): DiagramAggregate {
    const aggregate = new DiagramAggregate(
      command.diagramId,
      command.name,
      command.description || '',
      command.timestamp,
      command.timestamp,
      command.userId,
    );

    // Add a diagram changed event to indicate creation
    aggregate.addEvent(
      new DiagramChangedEvent(command.diagramId, aggregate._version, 'bulk', [], {
        action: 'created',
        name: command.name,
      }),
    );

    return aggregate;
  }

  /**
   * Processes a command and updates the aggregate state
   */
  processCommand(command: AnyDiagramCommand): void {
    this.validateCommand(command);

    switch (command.type) {
      case 'ADD_NODE':
        this.handleAddNode(command);
        break;
      case 'UPDATE_NODE_POSITION':
        this.handleUpdateNodePosition(command);
        break;
      case 'UPDATE_NODE_DATA':
        this.handleUpdateNodeData(command);
        break;
      case 'REMOVE_NODE':
        this.handleRemoveNode(command);
        break;
      case 'ADD_EDGE':
        this.handleAddEdge(command);
        break;
      case 'UPDATE_EDGE_DATA':
        this.handleUpdateEdgeData(command);
        break;
      case 'REMOVE_EDGE':
        this.handleRemoveEdge(command);
        break;
      case 'UPDATE_DIAGRAM_METADATA':
        this.handleUpdateDiagramMetadata(command);
        break;
      default:
        throw new DiagramDomainError(
          `Unknown command type: ${(command as { type: string }).type}`,
          'UNKNOWN_COMMAND',
        );
    }

    this._updatedAt = command.timestamp;
    this._version++;
  }

  /**
   * Gets and clears uncommitted events
   */
  getUncommittedEvents(): BaseDomainEvent[] {
    const events = [...this._uncommittedEvents];
    this._uncommittedEvents = [];
    return events;
  }

  /**
   * Marks events as committed
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Gets a node by ID
   */
  getNode(nodeId: string): DiagramNode | undefined {
    return this._nodes.get(nodeId);
  }

  /**
   * Gets an edge by ID
   */
  getEdge(edgeId: string): DiagramEdge | undefined {
    return this._edges.get(edgeId);
  }

  /**
   * Gets all edges connected to a node
   */
  getConnectedEdges(nodeId: string): DiagramEdge[] {
    return Array.from(this._edges.values()).filter(
      edge => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
    );
  }

  /**
   * Validates the current diagram state
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate that all edges have valid source and target nodes
    for (const edge of this._edges.values()) {
      if (!this._nodes.has(edge.sourceNodeId)) {
        errors.push(`Edge ${edge.id} has invalid source node ${edge.sourceNodeId}`);
      }
      if (!this._nodes.has(edge.targetNodeId)) {
        errors.push(`Edge ${edge.id} has invalid target node ${edge.targetNodeId}`);
      }
    }

    // Validate diagram name
    if (!this._name || this._name.trim().length === 0) {
      errors.push('Diagram name cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Creates a snapshot of the current diagram state
   */
  toSnapshot(): DiagramSnapshot {
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      createdBy: this._createdBy,
      version: this._version,
      nodes: Array.from(this._nodes.values()).map(node => node.toJSON()),
      edges: Array.from(this._edges.values()).map(edge => edge.toJSON()),
    };
  }

  /**
   * Adds a node to the diagram
   */
  private handleAddNode(command: AddNodeCommand): void {
    if (this._nodes.has(command.nodeId)) {
      throw new DiagramDomainError(
        `Node with ID ${command.nodeId} already exists`,
        'NODE_ALREADY_EXISTS',
      );
    }

    // Create NodeData with the position and other data
    const nodeData = new NodeData(
      command.nodeId,
      command.data.type,
      command.data.label,
      command.position,
      command.data.width,
      command.data.height,
      command.data.metadata,
    );

    const node = new DiagramNode(nodeData);
    this._nodes.set(command.nodeId, node);

    this.addEvent(new NodeAddedEvent(this._id, this._version, nodeData));
  }

  /**
   * Validates a command before processing
   */
  private validateCommand(command: AnyDiagramCommand): void {
    if (!command.diagramId || command.diagramId !== this._id) {
      throw new DiagramDomainError(
        `Invalid diagram ID in command: ${command.diagramId}`,
        'INVALID_DIAGRAM_ID',
      );
    }
  }

  /**
   * Updates node position
   */
  private handleUpdateNodePosition(command: UpdateNodePositionCommand): void {
    const node = this._nodes.get(command.nodeId);
    if (!node) {
      throw new DiagramDomainError(`Node with ID ${command.nodeId} not found`, 'NODE_NOT_FOUND');
    }

    const updatedNodeData = node.data.withPosition(command.newPosition);
    const updatedNode = new DiagramNode(updatedNodeData);
    this._nodes.set(command.nodeId, updatedNode);

    this.addEvent(
      new NodeMovedEvent(
        this._id,
        this._version,
        command.nodeId,
        command.oldPosition,
        command.newPosition,
      ),
    );
  }

  /**
   * Updates node data
   */
  private handleUpdateNodeData(command: UpdateNodeDataCommand): void {
    const node = this._nodes.get(command.nodeId);
    if (!node) {
      throw new DiagramDomainError(`Node with ID ${command.nodeId} not found`, 'NODE_NOT_FOUND');
    }

    const updatedNode = new DiagramNode(command.newData);
    this._nodes.set(command.nodeId, updatedNode);

    if (command.newData.label !== command.oldData.label) {
      this.addEvent(
        new NodeLabelUpdatedEvent(
          this._id,
          this._version,
          command.nodeId,
          command.oldData.label,
          command.newData.label,
        ),
      );
    }
  }

  /**
   * Removes a node from the diagram
   */
  private handleRemoveNode(command: RemoveNodeCommand): void {
    if (!this._nodes.has(command.nodeId)) {
      // If the node is not found, it might have already been removed by another operation
      // or this is a redundant inverse command. Log a warning and proceed.
      // This makes the operation idempotent for undo/redo purposes.
      console.warn(
        `Node with ID ${command.nodeId} not found during REMOVE_NODE. Assuming already removed.`,
      );
      return;
    }

    // Get the node before deleting it
    const node = this._nodes.get(command.nodeId)!;

    // Remove all connected edges
    const connectedEdges = this.getConnectedEdges(command.nodeId);
    for (const edge of connectedEdges) {
      this._edges.delete(edge.id);
    }

    this._nodes.delete(command.nodeId);
    this.addEvent(new NodeRemovedEvent(this._id, this._version, command.nodeId, node.data));
  }

  /**
   * Adds an edge to the diagram
   */
  private handleAddEdge(command: AddEdgeCommand): void {
    if (this._edges.has(command.edgeId)) {
      throw new DiagramDomainError(
        `Edge with ID ${command.edgeId} already exists`,
        'EDGE_ALREADY_EXISTS',
      );
    }

    // Validate source and target nodes exist
    if (!this._nodes.has(command.sourceNodeId)) {
      throw new DiagramDomainError(
        `Source node ${command.sourceNodeId} not found`,
        'SOURCE_NODE_NOT_FOUND',
      );
    }
    if (!this._nodes.has(command.targetNodeId)) {
      throw new DiagramDomainError(
        `Target node ${command.targetNodeId} not found`,
        'TARGET_NODE_NOT_FOUND',
      );
    }

    const edge = new DiagramEdge(command.data);
    this._edges.set(command.edgeId, edge);

    this.addEvent(new EdgeAddedEvent(this._id, this._version, command.data));
  }

  /**
   * Updates edge data
   */
  private handleUpdateEdgeData(command: UpdateEdgeDataCommand): void {
    const edge = this._edges.get(command.edgeId);
    if (!edge) {
      throw new DiagramDomainError(`Edge with ID ${command.edgeId} not found`, 'EDGE_NOT_FOUND');
    }

    const updatedEdge = new DiagramEdge(command.newData);
    this._edges.set(command.edgeId, updatedEdge);

    // Emit appropriate events based on what changed
    this.addEvent(
      new DiagramChangedEvent(this._id, this._version, 'edge', [command.edgeId], {
        action: 'updated',
      }),
    );
  }

  /**
   * Removes an edge from the diagram
   */
  private handleRemoveEdge(command: RemoveEdgeCommand): void {
    if (!this._edges.has(command.edgeId)) {
      throw new DiagramDomainError(`Edge with ID ${command.edgeId} not found`, 'EDGE_NOT_FOUND');
    }

    // Get the edge before deleting it
    const edge = this._edges.get(command.edgeId)!;
    this._edges.delete(command.edgeId);
    this.addEvent(new EdgeRemovedEvent(this._id, this._version, command.edgeId, edge.data));
  }

  /**
   * Updates diagram metadata
   */
  private handleUpdateDiagramMetadata(command: UpdateDiagramMetadataCommand): void {
    if (command.name !== undefined) {
      this._name = command.name;
    }
    if (command.description !== undefined) {
      this._description = command.description;
    }

    this.addEvent(
      new DiagramChangedEvent(this._id, this._version, 'bulk', [], {
        action: 'updated',
        name: command.name,
        description: command.description,
      }),
    );
  }

  /**
   * Adds an event to the uncommitted events list
   */
  private addEvent(event: BaseDomainEvent): void {
    this._uncommittedEvents.push(event);
  }
}

/**
 * Snapshot interface for serializing diagram state
 */
export interface DiagramSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly version: number;
  readonly nodes: ReturnType<DiagramNode['toJSON']>[];
  readonly edges: ReturnType<DiagramEdge['toJSON']>[];
}
