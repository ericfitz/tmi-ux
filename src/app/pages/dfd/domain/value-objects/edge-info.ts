import { Point } from './point';
import { EdgeTerminal } from './edge-terminal';
import { EdgeAttrs } from './edge-attrs';
import { EdgeLabel } from './edge-label';
import { Metadata } from './metadata';

/**
 * Edge info value object representing the domain model for diagram edges
 * This stores all properties and metadata for diagram edges
 * Matches the OpenAPI Edge schema structure
 */
export class EdgeInfo {
  constructor(
    public readonly id: string,
    public readonly shape: string = 'edge',
    public readonly source: EdgeTerminal,
    public readonly target: EdgeTerminal,
    public readonly zIndex: number = 1,
    public readonly visible: boolean = true,
    public readonly attrs: EdgeAttrs = {},
    public readonly labels: EdgeLabel[] = [],
    public readonly vertices: Point[] = [],
    public readonly data: Metadata[] = [],
  ) {
    this._validate();
  }

  /**
   * Gets the source node ID for backward compatibility
   */
  get sourceNodeId(): string {
    return this.source.cell;
  }

  /**
   * Gets the target node ID for backward compatibility
   */
  get targetNodeId(): string {
    return this.target.cell;
  }

  /**
   * Gets the source port ID for backward compatibility
   */
  get sourcePortId(): string | undefined {
    return this.source.port;
  }

  /**
   * Gets the target port ID for backward compatibility
   */
  get targetPortId(): string | undefined {
    return this.target.port;
  }

  /**
   * Gets the label from attrs.text.text or labels for backward compatibility
   */
  get label(): string | undefined {
    // First try to get from attrs.text.text
    const textAttr = this.attrs?.text;
    if (textAttr?.text) {
      return textAttr.text;
    }

    // Fallback to first label
    if (this.labels && this.labels.length > 0) {
      const firstLabel = this.labels[0];
      if (firstLabel.attrs?.text?.text) {
        return firstLabel.attrs.text.text;
      }
    }

    return undefined;
  }

  /**
   * Creates EdgeInfo from a plain object (supports both new and legacy formats)
   */
  static fromJSON(data: {
    id: string;
    shape?: string;
    source?: EdgeTerminal | string;
    target?: EdgeTerminal | string;
    sourceNodeId?: string;
    targetNodeId?: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    attrs?: EdgeAttrs;
    labels?: EdgeLabel[];
    vertices?: Point[] | Array<{ x: number; y: number }>;
    zIndex?: number;
    visible?: boolean;
    data?: Metadata[];
    metadata?: Metadata[] | Record<string, string>;
  }): EdgeInfo {
    // Handle format conversion for source
    let source: EdgeTerminal;
    if (data.source) {
      if (typeof data.source === 'string') {
        // Legacy format: source was a string (cell ID)
        source = { cell: data.source };
      } else {
        // New format: source is EdgeTerminal
        source = data.source;
      }
    } else if (data.sourceNodeId) {
      // Legacy format: separate sourceNodeId/sourcePortId
      source = {
        cell: data.sourceNodeId,
        port: data.sourcePortId,
      };
    } else {
      throw new Error('Either source or sourceNodeId must be provided');
    }

    // Handle format conversion for target
    let target: EdgeTerminal;
    if (data.target) {
      if (typeof data.target === 'string') {
        // Legacy format: target was a string (cell ID)
        target = { cell: data.target };
      } else {
        // New format: target is EdgeTerminal
        target = data.target;
      }
    } else if (data.targetNodeId) {
      // Legacy format: separate targetNodeId/targetPortId
      target = {
        cell: data.targetNodeId,
        port: data.targetPortId,
      };
    } else {
      throw new Error('Either target or targetNodeId must be provided');
    }

    // Handle attrs
    let attrs: EdgeAttrs = data.attrs || {};
    if (data.label && !attrs.text?.text) {
      attrs = {
        ...attrs,
        text: { ...attrs.text, text: data.label },
      };
    }

    // Handle labels
    const labels: EdgeLabel[] = data.labels || [];

    // Handle vertices - convert from legacy format if needed
    const vertices: Point[] = (data.vertices || []).map(v => 
      v instanceof Point ? v : new Point(v.x, v.y)
    );

    // Convert metadata if needed
    let metadata: Metadata[] = [];
    const metadataSource = data.data || data.metadata;
    if (metadataSource) {
      if (Array.isArray(metadataSource)) {
        metadata = metadataSource;
      } else {
        metadata = Object.entries(metadataSource).map(([key, value]) => ({ key, value }));
      }
    }

    return new EdgeInfo(
      data.id,
      data.shape || 'edge',
      source,
      target,
      data.zIndex || 1,
      data.visible !== false,
      attrs,
      labels,
      vertices,
      metadata,
    );
  }

  /**
   * Creates EdgeInfo from legacy format for backward compatibility
   */
  static fromLegacyJSON(data: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    vertices?: Array<{ x: number; y: number }>;
    metadata?: Record<string, string>;
  }): EdgeInfo {
    const source: EdgeTerminal = {
      cell: data.sourceNodeId,
      port: data.sourcePortId,
    };

    const target: EdgeTerminal = {
      cell: data.targetNodeId,
      port: data.targetPortId,
    };

    const attrs: EdgeAttrs = data.label ? { text: { text: data.label } } : {};

    const vertices = (data.vertices || []).map(v => new Point(v.x, v.y));

    const metadataEntries: Metadata[] = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
      : [];

    return new EdgeInfo(
      data.id,
      'edge',
      source,
      target,
      1,
      true,
      attrs,
      [],
      vertices,
      metadataEntries,
    );
  }

  /**
   * Creates a new EdgeInfo instance from a plain object.
   * This is a factory method for creating new instances, similar to fromJSON but for new data.
   */
  static create(data: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    vertices?: Array<{ x: number; y: number }>;
    metadata?: Record<string, string>;
  }): EdgeInfo {
    // Assign default ports if not specified
    const sourcePortId = data.sourcePortId || 'right';
    const targetPortId = data.targetPortId || 'left';

    return EdgeInfo.fromLegacyJSON({
      ...data,
      sourcePortId,
      targetPortId,
    });
  }

  /**
   * Creates a simple edge between two nodes
   */
  static createSimple(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    label?: string,
  ): EdgeInfo {
    const attrs: EdgeAttrs = label ? { text: { text: label } } : {};
    // Assign default ports for simple edges
    const source: EdgeTerminal = { cell: sourceNodeId, port: 'right' };
    const target: EdgeTerminal = { cell: targetNodeId, port: 'left' };
    return new EdgeInfo(id, 'edge', source, target, 1, true, attrs);
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
  ): EdgeInfo {
    const source: EdgeTerminal = { cell: sourceNodeId, port: sourcePortId };
    const target: EdgeTerminal = { cell: targetNodeId, port: targetPortId };
    const attrs: EdgeAttrs = label ? { text: { text: label } } : {};
    return new EdgeInfo(id, 'edge', source, target, 1, true, attrs);
  }

  /**
   * Creates a new EdgeInfo with updated label
   */
  withLabel(label: string): EdgeInfo {
    const newAttrs: EdgeAttrs = {
      ...this.attrs,
      text: { ...this.attrs.text, text: label },
    };
    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.zIndex,
      this.visible,
      newAttrs,
      this.labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with updated vertices
   */
  withVertices(vertices: Point[] | Array<{ x: number; y: number }>): EdgeInfo {
    const pointVertices = vertices.map(v => 
      v instanceof Point ? v : new Point(v.x, v.y)
    );
    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.zIndex,
      this.visible,
      this.attrs,
      this.labels,
      pointVertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with an added vertex
   */
  withAddedVertex(vertex: Point | { x: number; y: number }, index?: number): EdgeInfo {
    const newVertices = [...this.vertices];
    const pointVertex = vertex instanceof Point ? vertex : new Point(vertex.x, vertex.y);
    if (index !== undefined) {
      newVertices.splice(index, 0, pointVertex);
    } else {
      newVertices.push(pointVertex);
    }

    return this.withVertices(newVertices);
  }

  /**
   * Creates a new EdgeInfo with a removed vertex
   */
  withRemovedVertex(index: number): EdgeInfo {
    if (index < 0 || index >= this.vertices.length) {
      throw new Error('Vertex index out of bounds');
    }

    const newVertices = [...this.vertices];
    newVertices.splice(index, 1);

    return this.withVertices(newVertices);
  }

  /**
   * Creates a new EdgeInfo with updated metadata (accepts both formats)
   */
  withMetadata(metadata: Record<string, string> | Metadata[]): EdgeInfo {
    let newMetadata: Metadata[];

    if (Array.isArray(metadata)) {
      // Already in correct format
      newMetadata = [...this.data, ...metadata];
    } else {
      // Convert from Record format
      const additionalEntries = Object.entries(metadata).map(([key, value]) => ({ key, value }));
      newMetadata = [...this.data, ...additionalEntries];
    }

    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.zIndex,
      this.visible,
      this.attrs,
      this.labels,
      this.vertices,
      newMetadata,
    );
  }

  /**
   * Creates a new EdgeInfo with updated source
   */
  withSource(nodeId: string, portId?: string): EdgeInfo {
    const newSource: EdgeTerminal = { cell: nodeId, port: portId };
    return new EdgeInfo(
      this.id,
      this.shape,
      newSource,
      this.target,
      this.zIndex,
      this.visible,
      this.attrs,
      this.labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with updated target
   */
  withTarget(nodeId: string, portId?: string): EdgeInfo {
    const newTarget: EdgeTerminal = { cell: nodeId, port: portId };
    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      newTarget,
      this.zIndex,
      this.visible,
      this.attrs,
      this.labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with updated attrs
   */
  withAttrs(attrs: EdgeAttrs): EdgeInfo {
    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.zIndex,
      this.visible,
      { ...this.attrs, ...attrs },
      this.labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with updated properties (partial update)
   * This is the consolidated method for all edge updates
   */
  update(updates: {
    source?: EdgeTerminal;
    target?: EdgeTerminal;
    attrs?: EdgeAttrs;
    labels?: EdgeLabel[];
    vertices?: Point[] | Array<{ x: number; y: number }>;
    zIndex?: number;
    visible?: boolean;
    metadata?: Metadata[] | Record<string, string>;
    label?: string; // Convenience property that updates attrs.text.text
  }): EdgeInfo {
    // Handle label convenience property
    let newAttrs = updates.attrs ? { ...this.attrs, ...updates.attrs } : this.attrs;
    if (updates.label !== undefined) {
      newAttrs = { ...newAttrs, text: { ...newAttrs.text, text: updates.label } };
    }

    // Handle metadata format conversion
    let newMetadata = this.data;
    if (updates.metadata !== undefined) {
      if (Array.isArray(updates.metadata)) {
        newMetadata = updates.metadata;
      } else {
        newMetadata = Object.entries(updates.metadata).map(([key, value]) => ({ key, value }));
      }
    }

    // Handle vertices conversion
    const newVertices = updates.vertices
      ? updates.vertices.map(v => v instanceof Point ? v : new Point(v.x, v.y))
      : this.vertices;

    return new EdgeInfo(
      this.id,
      this.shape,
      updates.source ?? this.source,
      updates.target ?? this.target,
      updates.zIndex ?? this.zIndex,
      updates.visible ?? this.visible,
      newAttrs,
      updates.labels ?? this.labels,
      newVertices,
      newMetadata,
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
      const v1 = this.vertices[i];
      const v2 = this.vertices[i + 1];
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return totalLength;
  }

  /**
   * Checks if this edge info equals another edge info
   */
  equals(other: EdgeInfo): boolean {
    return (
      this.id === other.id &&
      this.shape === other.shape &&
      this.sourceEqual(other.source) &&
      this.targetEqual(other.target) &&
      this.attrsEqual(other.attrs) &&
      this.labelsEqual(other.labels) &&
      this.verticesEqual(other.vertices) &&
      this.zIndex === other.zIndex &&
      this.visible === other.visible &&
      this.metadataEquals(other.data)
    );
  }

  /**
   * Returns a string representation of the edge info
   */
  toString(): string {
    return `EdgeInfo(${this.id}, ${this.sourceNodeId} -> ${this.targetNodeId})`;
  }

  /**
   * Converts to OpenAPI-compliant JSON format
   */
  toJSON(): {
    id: string;
    shape: string;
    source: EdgeTerminal;
    target: EdgeTerminal;
    zIndex: number;
    visible: boolean;
    attrs: EdgeAttrs;
    labels: EdgeLabel[];
    vertices: Point[];
    data: Metadata[];
  } {
    return {
      id: this.id,
      shape: this.shape,
      source: this.source,
      target: this.target,
      zIndex: this.zIndex,
      visible: this.visible,
      attrs: this.attrs,
      labels: this.labels,
      vertices: this.vertices,
      data: this.data,
    };
  }

  /**
   * Converts to legacy JSON format for backward compatibility
   */
  toLegacyJSON(): {
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
      vertices: this.vertices.map(v => ({ x: v.x, y: v.y })),
      metadata: this.getMetadataAsRecord(),
    };
  }


  /**
   * Converts metadata array to Record format
   */
  getMetadataAsRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    this.data.forEach(entry => {
      record[entry.key] = entry.value;
    });
    return record;
  }

  /**
   * Creates a new EdgeInfo with updated source terminal
   */
  withSourceTerminal(source: EdgeTerminal): EdgeInfo {
    return new EdgeInfo(
      this.id,
      this.shape,
      source,
      this.target,
      this.zIndex,
      this.visible,
      this.attrs,
      this.labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with updated target terminal
   */
  withTargetTerminal(target: EdgeTerminal): EdgeInfo {
    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      target,
      this.zIndex,
      this.visible,
      this.attrs,
      this.labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Creates a new EdgeInfo with updated labels
   */
  withLabels(labels: EdgeLabel[]): EdgeInfo {
    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.zIndex,
      this.visible,
      this.attrs,
      labels,
      this.vertices,
      this.data,
    );
  }

  /**
   * Helper method to compare source objects
   */
  private sourceEqual(other: EdgeTerminal): boolean {
    return this.source.cell === other.cell && this.source.port === other.port;
  }

  /**
   * Helper method to compare target objects
   */
  private targetEqual(other: EdgeTerminal): boolean {
    return this.target.cell === other.cell && this.target.port === other.port;
  }

  /**
   * Helper method to compare attrs objects
   */
  private attrsEqual(other: EdgeAttrs): boolean {
    return JSON.stringify(this.attrs) === JSON.stringify(other);
  }

  /**
   * Helper method to compare labels arrays
   */
  private labelsEqual(other: EdgeLabel[]): boolean {
    return JSON.stringify(this.labels) === JSON.stringify(other);
  }

  /**
   * Validates the edge info
   */
  private _validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Edge ID cannot be empty');
    }

    if (!this.shape || this.shape.trim().length === 0) {
      throw new Error('Edge shape cannot be empty');
    }

    if (!this.sourceNodeId || this.sourceNodeId.trim().length === 0) {
      throw new Error('Source node ID cannot be empty');
    }

    if (!this.targetNodeId || this.targetNodeId.trim().length === 0) {
      throw new Error('Target node ID cannot be empty');
    }

    if (this.sourceNodeId === this.targetNodeId && this.sourcePortId === this.targetPortId) {
      throw new Error('Self-loops to the same port are not allowed');
    }

    // Validate vertices are valid Point objects
    this.vertices.forEach((vertex, index) => {
      if (!(vertex instanceof Point)) {
        throw new Error(`Vertex at index ${index} must be a Point object`);
      }
      if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
        throw new Error(`Vertex at index ${index} must have finite x and y coordinates`);
      }
    });

    // Validate source and target
    if (!this.source.cell || this.source.cell.trim().length === 0) {
      throw new Error('Source cell ID cannot be empty');
    }

    if (!this.target.cell || this.target.cell.trim().length === 0) {
      throw new Error('Target cell ID cannot be empty');
    }
  }

  /**
   * Checks if vertices arrays are equal
   */
  private verticesEqual(other: Point[]): boolean {
    if (this.vertices.length !== other.length) {
      return false;
    }

    return this.vertices.every(
      (vertex, index) => vertex.x === other[index].x && vertex.y === other[index].y,
    );
  }

  /**
   * Checks if metadata arrays are equal
   */
  private metadataEquals(other: Metadata[]): boolean {
    if (this.data.length !== other.length) {
      return false;
    }

    // Sort both arrays by key for comparison
    const thisSorted = [...this.data].sort((a, b) => a.key.localeCompare(b.key));
    const otherSorted = [...other].sort((a, b) => a.key.localeCompare(b.key));

    return thisSorted.every((entry, index) => {
      const otherEntry = otherSorted[index];
      return entry.key === otherEntry.key && entry.value === otherEntry.value;
    });
  }
}