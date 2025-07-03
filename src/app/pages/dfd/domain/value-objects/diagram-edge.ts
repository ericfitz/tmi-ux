import { EdgeData } from './edge-data';
import { Point } from './point';

/**
 * DiagramEdge entity representing an edge in the diagram domain
 */
export class DiagramEdge {
  private _data: EdgeData;
  private _isSelected: boolean = false;
  private _isHighlighted: boolean = false;

  constructor(data: EdgeData | Parameters<typeof EdgeData.fromJSON>[0]) {
    if (data instanceof EdgeData) {
      this._data = data;
    } else {
      this._data = EdgeData.fromJSON(data);
    }
  }

  /**
   * Gets the edge data
   */
  get data(): EdgeData {
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
    return this._data.sourceNodeId;
  }

  /**
   * Gets the target node ID
   */
  get targetNodeId(): string {
    return this._data.targetNodeId;
  }

  /**
   * Gets the source port ID
   */
  get sourcePortId(): string | undefined {
    return this._data.sourcePortId;
  }

  /**
   * Gets the target port ID
   */
  get targetPortId(): string | undefined {
    return this._data.targetPortId;
  }

  /**
   * Gets the edge label
   */
  get label(): string | undefined {
    return this._data.label;
  }

  /**
   * Gets the edge vertices
   */
  get vertices(): Point[] {
    return this._data.vertices;
  }

  /**
   * Gets the edge metadata
   */
  get metadata(): Record<string, string> {
    return this._data.metadata;
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
  static fromJSON(data: {
    data: Parameters<typeof EdgeData.fromJSON>[0];
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
  updateData(data: EdgeData): void {
    if (data.id !== this._data.id) {
      throw new Error('Cannot change edge ID');
    }
    this._data = data;
  }

  /**
   * Updates the edge label
   */
  updateLabel(label: string): void {
    this._data = this._data.withLabel(label);
  }

  /**
   * Updates the edge vertices
   */
  updateVertices(vertices: Point[]): void {
    this._data = this._data.withVertices(vertices);
  }

  /**
   * Adds a vertex to the edge
   */
  addVertex(vertex: Point, index?: number): void {
    this._data = this._data.withAddedVertex(vertex, index);
  }

  /**
   * Removes a vertex from the edge
   */
  removeVertex(index: number): void {
    this._data = this._data.withRemovedVertex(index);
  }

  /**
   * Updates the edge metadata
   */
  updateMetadata(metadata: Record<string, string>): void {
    this._data = this._data.withMetadata(metadata);
  }

  /**
   * Updates the source connection
   */
  updateSource(nodeId: string, portId?: string): void {
    this._data = this._data.withSource(nodeId, portId);
  }

  /**
   * Updates the target connection
   */
  updateTarget(nodeId: string, portId?: string): void {
    this._data = this._data.withTarget(nodeId, portId);
  }

  /**
   * Selects the edge
   */
  select(): void {
    this._isSelected = true;
  }

  /**
   * Deselects the edge
   */
  deselect(): void {
    this._isSelected = false;
  }

  /**
   * Highlights the edge
   */
  highlight(): void {
    this._isHighlighted = true;
  }

  /**
   * Removes highlight from the edge
   */
  unhighlight(): void {
    this._isHighlighted = false;
  }

  /**
   * Checks if this edge connects to the specified node
   */
  connectsToNode(nodeId: string): boolean {
    return this._data.connectsToNode(nodeId);
  }

  /**
   * Checks if this edge uses the specified port
   */
  usesPort(nodeId: string, portId: string): boolean {
    return this._data.usesPort(nodeId, portId);
  }

  /**
   * Gets the total length of the edge path
   */
  getPathLength(): number {
    return this._data.getPathLength();
  }

  /**
   * Checks if the edge has any vertices
   */
  hasVertices(): boolean {
    return this.vertices.length > 0;
  }

  /**
   * Gets the number of vertices
   */
  getVertexCount(): number {
    return this.vertices.length;
  }

  /**
   * Gets a vertex at the specified index
   */
  getVertex(index: number): Point | undefined {
    return this.vertices[index];
  }

  /**
   * Checks if a point is near the edge path (within tolerance)
   */
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
  clone(): DiagramEdge {
    const cloned = new DiagramEdge(this._data);
    cloned._isSelected = this._isSelected;
    cloned._isHighlighted = this._isHighlighted;
    return cloned;
  }

  /**
   * Converts the edge to a plain object for serialization
   */
  toJSON(): {
    data: ReturnType<EdgeData['toJSON']>;
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
  toString(): string {
    return `DiagramEdge(${this.id}, ${this.sourceNodeId} -> ${this.targetNodeId})`;
  }

  /**
   * Calculates the distance from a point to a line segment
   */
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
