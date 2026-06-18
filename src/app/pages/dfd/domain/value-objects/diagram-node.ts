/**
 * Diagram Node Domain Model
 *
 * This file defines the DiagramNode entity which represents a node in the DFD domain layer.
 * It encapsulates node data, state, and behavior following domain-driven design principles.
 *
 * Key functionality:
 * - Encapsulates NodeInfo data with additional domain behavior
 * - Manages node selection and highlighting states
 * - Tracks connected edge relationships for graph integrity
 * - Provides node validation and business rule enforcement
 * - Supports node positioning and sizing operations
 * - Implements serialization for persistence and API communication
 * - Provides node cloning and copying capabilities
 * - Manages node metadata and custom properties
 * - Integrates with X6 graph library through shape property
 * - Supports node lifecycle events and state transitions
 * - Maintains immutability where appropriate for data integrity
 */

import { NodeInfo } from './node-info';
import { Point } from './point';

/**
 * DiagramNode entity representing a node in the diagram domain
 * Uses the 'shape' property for node type determination, following X6 standards.
 */
// SEM@a31ab2e4c978de326750079b6beb589924901b63: domain entity wrapping a node with selection, highlight, and connected-edge state (mutates shared state)
export class DiagramNode {
  private _data: NodeInfo;
  private _isSelected: boolean = false;
  private _isHighlighted: boolean = false;
  private _connectedEdgeIds: Set<string> = new Set();

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: initialize a diagram node entity from a NodeInfo value object (pure)
  constructor(data: NodeInfo) {
    this._data = data;
  }

  /**
   * Gets the node info
   */
  get data(): NodeInfo {
    return this._data;
  }

  /**
   * Gets the node ID
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Gets the node type from the shape property
   */
  get type(): string {
    return this._data.shape;
  }

  /**
   * Gets the node label
   */
  get label(): string {
    return this._data.attrs?.text?.text || '';
  }

  /**
   * Gets the node position
   */
  get position(): Point {
    return new Point(this._data.x, this._data.y);
  }

  /**
   * Gets the node width
   */
  get width(): number {
    return this._data.width;
  }

  /**
   * Gets the node height
   */
  get height(): number {
    return this._data.height;
  }

  /**
   * Gets the node metadata
   */
  get metadata(): Record<string, string> {
    return this._data.getMetadataAsRecord();
  }

  /**
   * Gets whether the node is selected
   */
  get isSelected(): boolean {
    return this._isSelected;
  }

  /**
   * Gets whether the node is highlighted
   */
  get isHighlighted(): boolean {
    return this._isHighlighted;
  }

  /**
   * Gets the IDs of connected edges
   */
  get connectedEdgeIds(): string[] {
    return Array.from(this._connectedEdgeIds);
  }

  /**
   * Creates a DiagramNode from a plain object
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: deserialize a diagram node from a plain object, restoring selection and edge links (pure)
  static fromJSON(data: {
    data: Parameters<typeof NodeInfo.fromJSON>[0];
    isSelected?: boolean;
    isHighlighted?: boolean;
    connectedEdgeIds?: string[];
  }): DiagramNode {
    const node = new DiagramNode(NodeInfo.fromJSON(data.data));

    if (data.isSelected) {
      node.select();
    }

    if (data.isHighlighted) {
      node.highlight();
    }

    if (data.connectedEdgeIds) {
      data.connectedEdgeIds.forEach(edgeId => node.addConnectedEdge(edgeId));
    }

    return node;
  }

  /**
   * Updates the node info
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update node info, rejecting attempts to change the node ID (mutates shared state)
  updateData(data: NodeInfo): void {
    if (data.id !== this._data.id) {
      throw new Error('Cannot change node ID');
    }
    this._data = data;
  }

  /**
   * Moves the node to a new position
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the node's position to a new point (mutates shared state)
  moveTo(position: Point): void {
    this._data = this._data.withPosition(position);
  }

  /**
   * Updates the node label
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the node's display label (mutates shared state)
  updateLabel(label: string): void {
    this._data = this._data.withLabel(label);
  }

  /**
   * Resizes the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the node's width and height dimensions (mutates shared state)
  resize(width: number, height: number): void {
    this._data = this._data.withWidth(width).withHeight(height);
  }

  /**
   * Updates the node metadata
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the node's business metadata record (mutates shared state)
  updateMetadata(metadata: Record<string, string>): void {
    this._data = this._data.withMetadata(metadata);
  }

  /**
   * Selects the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: mark the node as selected (mutates shared state)
  select(): void {
    this._isSelected = true;
  }

  /**
   * Deselects the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: clear the node's selected state (mutates shared state)
  deselect(): void {
    this._isSelected = false;
  }

  /**
   * Highlights the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: mark the node as highlighted (mutates shared state)
  highlight(): void {
    this._isHighlighted = true;
  }

  /**
   * Removes highlight from the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: clear the node's highlighted state (mutates shared state)
  unhighlight(): void {
    this._isHighlighted = false;
  }

  /**
   * Adds a connected edge ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: register an edge ID as connected to this node (mutates shared state)
  addConnectedEdge(edgeId: string): void {
    this._connectedEdgeIds.add(edgeId);
  }

  /**
   * Removes a connected edge ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: deregister a connected edge ID from this node (mutates shared state)
  removeConnectedEdge(edgeId: string): void {
    this._connectedEdgeIds.delete(edgeId);
  }

  /**
   * Checks if the node is connected to the specified edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a given edge ID is connected to this node (pure)
  isConnectedToEdge(edgeId: string): boolean {
    return this._connectedEdgeIds.has(edgeId);
  }

  /**
   * Gets the center point of the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the center point of the node's bounding box (pure)
  getCenter(): Point {
    return this._data.getCenter();
  }

  /**
   * Gets the bounding box of the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the node's top-left and bottom-right bounding box corners (pure)
  getBounds(): { topLeft: Point; bottomRight: Point } {
    return this._data.getBounds();
  }

  /**
   * Checks if a point is within the node bounds
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a point falls within the node's bounding box (pure)
  containsPoint(point: Point): boolean {
    const bounds = this.getBounds();
    return (
      point.x >= bounds.topLeft.x &&
      point.x <= bounds.bottomRight.x &&
      point.y >= bounds.topLeft.y &&
      point.y <= bounds.bottomRight.y
    );
  }

  /**
   * Checks if this node overlaps with another node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether this node's bounding box intersects another node's (pure)
  overlapsWith(other: DiagramNode): boolean {
    const thisBounds = this.getBounds();
    const otherBounds = other.getBounds();

    return !(
      thisBounds.bottomRight.x < otherBounds.topLeft.x ||
      thisBounds.topLeft.x > otherBounds.bottomRight.x ||
      thisBounds.bottomRight.y < otherBounds.topLeft.y ||
      thisBounds.topLeft.y > otherBounds.bottomRight.y
    );
  }

  /**
   * Calculates the distance to another node (center to center)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute center-to-center distance between this node and another (pure)
  distanceTo(other: DiagramNode): number {
    return this.getCenter().distanceTo(other.getCenter());
  }

  /**
   * Creates a copy of this node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a deep copy of the node including selection and edge state (pure)
  clone(): DiagramNode {
    const cloned = new DiagramNode(this._data);
    cloned._isSelected = this._isSelected;
    cloned._isHighlighted = this._isHighlighted;
    cloned._connectedEdgeIds = new Set(this._connectedEdgeIds);
    return cloned;
  }

  /**
   * Converts the node to a plain object for serialization
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: serialize the node to a plain object for storage or transport (pure)
  toJSON(): {
    data: ReturnType<NodeInfo['toJSON']>;
    isSelected: boolean;
    isHighlighted: boolean;
    connectedEdgeIds: string[];
  } {
    return {
      data: this._data.toJSON(),
      isSelected: this._isSelected,
      isHighlighted: this._isHighlighted,
      connectedEdgeIds: this.connectedEdgeIds,
    };
  }

  /**
   * Returns a string representation of the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: format the node as a human-readable debug string (pure)
  toString(): string {
    return `DiagramNode(${this.id}, ${this.type}, "${this.label}")`;
  }
}
