import { EdgeInfo } from './edge-info';
import { Point } from './point';

/**
 * DiagramEdge entity representing an edge in the diagram domain
 */
// SEM@6e5efd2b0a392451cdb3e9dd56023617e967c3e3: domain entity wrapping an edge with selection, highlight, and mutation methods
export class DiagramEdge {
  private _data: EdgeInfo;
  private _isSelected: boolean = false;
  private _isHighlighted: boolean = false;

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: initialize a diagram edge from an EdgeInfo object or raw JSON (pure)
  constructor(data: EdgeInfo | Parameters<typeof EdgeInfo.fromJSON>[0]) {
    if (data instanceof EdgeInfo) {
      this._data = data;
    } else {
      this._data = EdgeInfo.fromJSON(data);
    }
  }

  /**
   * Gets the edge info
   */
  get data(): EdgeInfo {
    return this._data;
  }

  /**
   * Gets the edge ID
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Gets the source node ID
   */
  get sourceNodeId(): string {
    return this._data.source.cell;
  }

  /**
   * Gets the target node ID
   */
  get targetNodeId(): string {
    return this._data.target.cell;
  }

  /**
   * Gets the source port ID
   */
  get sourcePortId(): string | undefined {
    return this._data.source.port;
  }

  /**
   * Gets the target port ID
   */
  get targetPortId(): string | undefined {
    return this._data.target.port;
  }

  /**
   * Gets the edge label from the labels array (X6 native format)
   * Falls back to attrs.text.text for backward compatibility with legacy data
   */
  get label(): string | undefined {
    // Primary: Check labels array (X6 native edge format)
    if (this._data.labels && this._data.labels.length > 0) {
      const firstLabel = this._data.labels[0];
      const labelText = firstLabel?.attrs?.text?.text;
      if (labelText) {
        return labelText;
      }
    }
    // Fallback: Check attrs.text.text (legacy format, for backward compatibility)
    return this._data.attrs?.text?.text;
  }

  /**
   * Gets the edge vertices (converted to Point objects)
   */
  get vertices(): Point[] {
    return this._data.vertices.map(v => new Point(v.x, v.y));
  }

  /**
   * Gets the edge metadata (converted to Record format)
   */
  get metadata(): Record<string, string> {
    return this._data.getMetadataAsRecord();
  }

  /**
   * Gets whether the edge is selected
   */
  get isSelected(): boolean {
    return this._isSelected;
  }

  /**
   * Gets whether the edge is highlighted
   */
  get isHighlighted(): boolean {
    return this._isHighlighted;
  }

  /**
   * Creates a DiagramEdge from a plain object
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: deserialize a diagram edge including selection and highlight state (pure)
  static fromJSON(data: {
    data: Parameters<typeof EdgeInfo.fromJSON>[0];
    isSelected?: boolean;
    isHighlighted?: boolean;
  }): DiagramEdge {
    const edge = new DiagramEdge(data.data);

    if (data.isSelected) {
      edge.select();
    }

    if (data.isHighlighted) {
      edge.highlight();
    }

    return edge;
  }

  /**
   * Updates the edge data
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: replace the edge's EdgeInfo, rejecting any ID change (mutates shared state)
  updateData(data: EdgeInfo): void {
    if (data.id !== this._data.id) {
      throw new Error('Cannot change edge ID');
    }
    this._data = data;
  }

  /**
   * Updates the edge label
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the edge label text immutably via EdgeInfo (mutates shared state)
  updateLabel(label: string): void {
    this._data = this._data.withLabel(label);
  }

  /**
   * Updates the edge vertices
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: replace the edge routing vertices from a Point array (mutates shared state)
  updateVertices(vertices: Point[]): void {
    const vertexCoords = vertices.map(v => ({ x: v.x, y: v.y }));
    this._data = this._data.withVertices(vertexCoords);
  }

  /**
   * Adds a vertex to the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: insert a waypoint into the edge path at an optional index (mutates shared state)
  addVertex(vertex: Point, index?: number): void {
    const vertexCoord = { x: vertex.x, y: vertex.y };
    this._data = this._data.withAddedVertex(vertexCoord, index);
  }

  /**
   * Removes a vertex from the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: delete a waypoint from the edge path by index (mutates shared state)
  removeVertex(index: number): void {
    this._data = this._data.withRemovedVertex(index);
  }

  /**
   * Updates the edge metadata
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: replace the edge metadata key-value map (mutates shared state)
  updateMetadata(metadata: Record<string, string>): void {
    this._data = this._data.withMetadata(metadata);
  }

  /**
   * Updates the source connection
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the edge source node and optional port connection (mutates shared state)
  updateSource(nodeId: string, portId?: string): void {
    this._data = this._data.withSource(nodeId, portId);
  }

  /**
   * Updates the target connection
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: update the edge target node and optional port connection (mutates shared state)
  updateTarget(nodeId: string, portId?: string): void {
    this._data = this._data.withTarget(nodeId, portId);
  }

  /**
   * Selects the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: mark the edge as selected (mutates shared state)
  select(): void {
    this._isSelected = true;
  }

  /**
   * Deselects the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: clear the edge selected state (mutates shared state)
  deselect(): void {
    this._isSelected = false;
  }

  /**
   * Highlights the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: mark the edge as highlighted (mutates shared state)
  highlight(): void {
    this._isHighlighted = true;
  }

  /**
   * Removes highlight from the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: clear the edge highlighted state (mutates shared state)
  unhighlight(): void {
    this._isHighlighted = false;
  }

  /**
   * Checks if this edge connects to the specified node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether the edge connects to a given node as source or target (pure)
  connectsToNode(nodeId: string): boolean {
    return this._data.connectsToNode(nodeId);
  }

  /**
   * Checks if this edge uses the specified port
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether the edge connects through a specific node port (pure)
  usesPort(nodeId: string, portId: string): boolean {
    return this._data.usesPort(nodeId, portId);
  }

  /**
   * Gets the total length of the edge path
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute total Euclidean length of the edge path through all waypoints (pure)
  getPathLength(): number {
    return this._data.getPathLength();
  }

  /**
   * Checks if the edge has any vertices
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return whether the edge path has any intermediate waypoints (pure)
  hasVertices(): boolean {
    return this.vertices.length > 0;
  }

  /**
   * Gets the number of vertices
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the number of waypoints in the edge path (pure)
  getVertexCount(): number {
    return this.vertices.length;
  }

  /**
   * Gets a vertex at the specified index
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a waypoint by index, returning undefined if out of bounds (pure)
  getVertex(index: number): Point | undefined {
    return this.vertices[index];
  }

  /**
   * Checks if a point is near the edge path (within tolerance)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a point falls within tolerance distance of the edge path (pure)
  isPointNearPath(point: Point, tolerance: number = 5): boolean {
    if (this.vertices.length < 2) {
      return false;
    }

    // Check distance to each segment of the path
    for (let i = 0; i < this.vertices.length - 1; i++) {
      const segmentStart = this.vertices[i];
      const segmentEnd = this.vertices[i + 1];

      if (this.distanceToLineSegment(point, segmentStart, segmentEnd) <= tolerance) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets the midpoint of the edge path
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the geometric midpoint along the edge path (pure)
  getMidpoint(): Point | undefined {
    if (this.vertices.length < 2) {
      return undefined;
    }

    const totalLength = this.getPathLength();
    const halfLength = totalLength / 2;

    let currentLength = 0;

    for (let i = 0; i < this.vertices.length - 1; i++) {
      const segmentStart = this.vertices[i];
      const segmentEnd = this.vertices[i + 1];
      const segmentLength = segmentStart.distanceTo(segmentEnd);

      if (currentLength + segmentLength >= halfLength) {
        // The midpoint is on this segment
        const ratio = (halfLength - currentLength) / segmentLength;
        return new Point(
          segmentStart.x + ratio * (segmentEnd.x - segmentStart.x),
          segmentStart.y + ratio * (segmentEnd.y - segmentStart.y),
        );
      }

      currentLength += segmentLength;
    }

    // Fallback to the last vertex if calculation fails
    return this.vertices[this.vertices.length - 1];
  }

  /**
   * Creates a copy of this edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a deep copy of the edge preserving selection and highlight state (pure)
  clone(): DiagramEdge {
    const cloned = new DiagramEdge(this._data);
    cloned._isSelected = this._isSelected;
    cloned._isHighlighted = this._isHighlighted;
    return cloned;
  }

  /**
   * Converts the edge to a plain object for serialization
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: serialize the edge to a plain object for persistence (pure)
  toJSON(): {
    data: ReturnType<EdgeInfo['toJSON']>;
    isSelected: boolean;
    isHighlighted: boolean;
  } {
    return {
      data: this._data.toJSON(),
      isSelected: this._isSelected,
      isHighlighted: this._isHighlighted,
    };
  }

  /**
   * Returns a string representation of the edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: format a human-readable edge identifier with source and target node IDs (pure)
  toString(): string {
    return `DiagramEdge(${this.id}, ${this.sourceNodeId} -> ${this.targetNodeId})`;
  }

  /**
   * Calculates the distance from a point to a line segment
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute shortest distance from a point to a line segment (pure)
  private distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      // Line segment is actually a point
      return point.distanceTo(lineStart);
    }

    const param = dot / lenSq;

    let xx: number;
    let yy: number;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
