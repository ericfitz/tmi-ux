import { Point } from './point';

/**
 * Edge data value object containing all properties of a diagram edge
 */
export class EdgeData {
  constructor(
    public readonly id: string,
    public readonly sourceNodeId: string,
    public readonly targetNodeId: string,
    public readonly sourcePortId?: string,
    public readonly targetPortId?: string,
    public readonly label?: string,
    public readonly vertices: Point[] = [],
    public readonly metadata: Record<string, string> = {},
  ) {
    this.validate();
  }

  /**
   * Creates EdgeData from a plain object
   */
  static fromJSON(data: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    vertices?: Array<{ x: number; y: number }>;
    metadata?: Record<string, string>;
  }): EdgeData {
    return new EdgeData(
      data.id,
      data.sourceNodeId,
      data.targetNodeId,
      data.sourcePortId,
      data.targetPortId,
      data.label,
      (data.vertices || []).map(vertex => Point.fromJSON(vertex)),
      data.metadata || {},
    );
  }

  /**
   * Creates a simple edge between two nodes
   */
  static createSimple(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    label?: string,
  ): EdgeData {
    return new EdgeData(id, sourceNodeId, targetNodeId, undefined, undefined, label);
  }

  /**
   * Creates an edge with port connections
   */
  static createWithPorts(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId: string,
    targetPortId: string,
    label?: string,
  ): EdgeData {
    return new EdgeData(id, sourceNodeId, targetNodeId, sourcePortId, targetPortId, label);
  }

  /**
   * Creates a new EdgeData with updated label
   */
  withLabel(label: string): EdgeData {
    return new EdgeData(
      this.id,
      this.sourceNodeId,
      this.targetNodeId,
      this.sourcePortId,
      this.targetPortId,
      label,
      this.vertices,
      this.metadata,
    );
  }

  /**
   * Creates a new EdgeData with updated vertices
   */
  withVertices(vertices: Point[]): EdgeData {
    return new EdgeData(
      this.id,
      this.sourceNodeId,
      this.targetNodeId,
      this.sourcePortId,
      this.targetPortId,
      this.label,
      vertices,
      this.metadata,
    );
  }

  /**
   * Creates a new EdgeData with an added vertex
   */
  withAddedVertex(vertex: Point, index?: number): EdgeData {
    const newVertices = [...this.vertices];
    if (index !== undefined) {
      newVertices.splice(index, 0, vertex);
    } else {
      newVertices.push(vertex);
    }

    return this.withVertices(newVertices);
  }

  /**
   * Creates a new EdgeData with a removed vertex
   */
  withRemovedVertex(index: number): EdgeData {
    if (index < 0 || index >= this.vertices.length) {
      throw new Error('Vertex index out of bounds');
    }

    const newVertices = [...this.vertices];
    newVertices.splice(index, 1);

    return this.withVertices(newVertices);
  }

  /**
   * Creates a new EdgeData with updated metadata
   */
  withMetadata(metadata: Record<string, string>): EdgeData {
    return new EdgeData(
      this.id,
      this.sourceNodeId,
      this.targetNodeId,
      this.sourcePortId,
      this.targetPortId,
      this.label,
      this.vertices,
      { ...this.metadata, ...metadata },
    );
  }

  /**
   * Creates a new EdgeData with updated source
   */
  withSource(nodeId: string, portId?: string): EdgeData {
    return new EdgeData(
      this.id,
      nodeId,
      this.targetNodeId,
      portId,
      this.targetPortId,
      this.label,
      this.vertices,
      this.metadata,
    );
  }

  /**
   * Creates a new EdgeData with updated target
   */
  withTarget(nodeId: string, portId?: string): EdgeData {
    return new EdgeData(
      this.id,
      this.sourceNodeId,
      nodeId,
      this.sourcePortId,
      portId,
      this.label,
      this.vertices,
      this.metadata,
    );
  }

  /**
   * Checks if this edge connects to the specified node
   */
  connectsToNode(nodeId: string): boolean {
    return this.sourceNodeId === nodeId || this.targetNodeId === nodeId;
  }

  /**
   * Checks if this edge uses the specified port
   */
  usesPort(nodeId: string, portId: string): boolean {
    return (
      (this.sourceNodeId === nodeId && this.sourcePortId === portId) ||
      (this.targetNodeId === nodeId && this.targetPortId === portId)
    );
  }

  /**
   * Gets the total length of the edge path
   */
  getPathLength(): number {
    if (this.vertices.length === 0) {
      return 0;
    }

    let totalLength = 0;
    for (let i = 0; i < this.vertices.length - 1; i++) {
      totalLength += this.vertices[i].distanceTo(this.vertices[i + 1]);
    }

    return totalLength;
  }

  /**
   * Checks if this edge data equals another edge data
   */
  equals(other: EdgeData): boolean {
    return (
      this.id === other.id &&
      this.sourceNodeId === other.sourceNodeId &&
      this.targetNodeId === other.targetNodeId &&
      this.sourcePortId === other.sourcePortId &&
      this.targetPortId === other.targetPortId &&
      this.label === other.label &&
      this.verticesEqual(other.vertices) &&
      this.metadataEquals(other.metadata)
    );
  }

  /**
   * Returns a string representation of the edge data
   */
  toString(): string {
    return `EdgeData(${this.id}, ${this.sourceNodeId} -> ${this.targetNodeId})`;
  }

  /**
   * Converts the edge data to a plain object
   */
  toJSON(): {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    vertices: Array<{ x: number; y: number }>;
    metadata: Record<string, string>;
  } {
    return {
      id: this.id,
      sourceNodeId: this.sourceNodeId,
      targetNodeId: this.targetNodeId,
      sourcePortId: this.sourcePortId,
      targetPortId: this.targetPortId,
      label: this.label,
      vertices: this.vertices.map(vertex => vertex.toJSON()),
      metadata: { ...this.metadata },
    };
  }

  /**
   * Validates the edge data
   */
  private validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Edge ID cannot be empty');
    }

    if (!this.sourceNodeId || this.sourceNodeId.trim().length === 0) {
      throw new Error('Source node ID cannot be empty');
    }

    if (!this.targetNodeId || this.targetNodeId.trim().length === 0) {
      throw new Error('Target node ID cannot be empty');
    }

    if (this.sourceNodeId === this.targetNodeId) {
      throw new Error('Self-loops are not allowed');
    }

    // Validate vertices are valid points
    this.vertices.forEach((vertex, index) => {
      if (!(vertex instanceof Point)) {
        throw new Error(`Vertex at index ${index} must be a Point instance`);
      }
    });
  }

  /**
   * Checks if vertices arrays are equal
   */
  private verticesEqual(other: Point[]): boolean {
    if (this.vertices.length !== other.length) {
      return false;
    }

    return this.vertices.every((vertex, index) => vertex.equals(other[index]));
  }

  /**
   * Checks if metadata objects are equal
   */
  private metadataEquals(other: Record<string, string>): boolean {
    const thisKeys = Object.keys(this.metadata).sort();
    const otherKeys = Object.keys(other).sort();

    if (thisKeys.length !== otherKeys.length) {
      return false;
    }

    return thisKeys.every(key => this.metadata[key] === other[key]);
  }
}
