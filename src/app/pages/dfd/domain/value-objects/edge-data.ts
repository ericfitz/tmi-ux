import { Edge } from '@antv/x6';
import { X6EdgeSnapshot } from '../../types/x6-cell.types';

/**
 * Metadata entry structure aligned with X6EdgeSnapshot
 */
export interface MetadataEntry {
  key: string;
  value: string;
}

/**
 * Edge data value object aligned with X6EdgeSnapshot structure
 * This represents the domain model for diagram edges with X6-compatible structure
 */
export class EdgeData {
  constructor(
    public readonly id: string,
    public readonly shape: string, // X6 shape identifier
    public readonly source: Edge.Properties['source'],
    public readonly target: Edge.Properties['target'],
    public readonly attrs: Edge.Properties['attrs'] = {},
    public readonly labels: Edge.Properties['labels'] = [],
    public readonly vertices: Array<{ x: number; y: number }> = [],
    public readonly zIndex: number = 1, // Temporary default, actual z-index set by ZOrderService
    public readonly visible: boolean = true,
    public readonly data: MetadataEntry[] = [],
  ) {
    this.validate();
  }

  /**
   * Gets the source node ID for backward compatibility
   */
  get sourceNodeId(): string {
    if (typeof this.source === 'string') {
      return this.source;
    }
    return this.source?.cell || '';
  }

  /**
   * Gets the target node ID for backward compatibility
   */
  get targetNodeId(): string {
    if (typeof this.target === 'string') {
      return this.target;
    }
    return this.target?.cell || '';
  }

  /**
   * Gets the source port ID for backward compatibility
   */
  get sourcePortId(): string | undefined {
    if (typeof this.source === 'object' && this.source?.port) {
      return this.source.port;
    }
    return undefined;
  }

  /**
   * Gets the target port ID for backward compatibility
   */
  get targetPortId(): string | undefined {
    if (typeof this.target === 'object' && this.target?.port) {
      return this.target.port;
    }
    return undefined;
  }

  /**
   * Gets the label from attrs.text.text or labels for backward compatibility
   */
  get label(): string | undefined {
    // First try to get from attrs.text.text
    const textAttr = this.attrs?.['text'];
    if (textAttr && typeof textAttr === 'object' && 'text' in textAttr) {
      const text = (textAttr as { text?: unknown }).text;
      if (typeof text === 'string') {
        return text;
      }
    }

    // Fallback to first label
    if (this.labels && this.labels.length > 0) {
      const firstLabel = this.labels[0];
      if (firstLabel && typeof firstLabel === 'object' && 'attrs' in firstLabel) {
        const labelAttrs = firstLabel.attrs;
        if (labelAttrs?.text?.text) {
          return labelAttrs.text.text;
        }
      }
    }

    return undefined;
  }

  /**
   * Creates EdgeData from a plain object (supports both new and legacy formats)
   */
  static fromJSON(data: {
    id: string;
    shape?: string;
    source?: Edge.Properties['source'];
    target?: Edge.Properties['target'];
    sourceNodeId?: string;
    targetNodeId?: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    attrs?: Edge.Properties['attrs'];
    labels?: Edge.Properties['labels'];
    vertices?: Array<{ x: number; y: number }>;
    zIndex?: number;
    visible?: boolean;
    metadata?: MetadataEntry[] | Record<string, string>;
  }): EdgeData {
    // Handle legacy format
    let source: Edge.Properties['source'];
    let target: Edge.Properties['target'];

    if (data.source) {
      source = data.source;
    } else if (data.sourceNodeId) {
      source = data.sourcePortId
        ? { cell: data.sourceNodeId, port: data.sourcePortId }
        : data.sourceNodeId;
    } else {
      throw new Error('Either source or sourceNodeId must be provided');
    }

    if (data.target) {
      target = data.target;
    } else if (data.targetNodeId) {
      target = data.targetPortId
        ? { cell: data.targetNodeId, port: data.targetPortId }
        : data.targetNodeId;
    } else {
      throw new Error('Either target or targetNodeId must be provided');
    }

    // Handle attrs and labels
    let attrs = data.attrs || {};
    const labels = data.labels || [];

    // If legacy label is provided, add it to attrs
    if (data.label && !attrs['text']) {
      attrs = { ...attrs, text: { text: data.label } };
    }

    // Convert metadata if it's in legacy Record format
    let metadata: MetadataEntry[] = [];
    if (data.metadata) {
      if (Array.isArray(data.metadata)) {
        metadata = data.metadata;
      } else {
        metadata = Object.entries(data.metadata).map(([key, value]) => ({ key, value }));
      }
    }

    return new EdgeData(
      data.id,
      data.shape || 'edge',
      source,
      target,
      attrs,
      labels,
      data.vertices || [],
      data.zIndex || 1,
      data.visible !== false,
      metadata,
    );
  }

  /**
   * Creates EdgeData from legacy format for backward compatibility
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
  }): EdgeData {
    const source = data.sourcePortId
      ? { cell: data.sourceNodeId, port: data.sourcePortId }
      : data.sourceNodeId;

    const target = data.targetPortId
      ? { cell: data.targetNodeId, port: data.targetPortId }
      : data.targetNodeId;

    const attrs = data.label ? { text: { text: data.label } } : undefined;

    const metadataEntries = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
      : [];

    return new EdgeData(
      data.id,
      'edge',
      source,
      target,
      attrs,
      [],
      data.vertices || [],
      1,
      true,
      metadataEntries,
    );
  }

  /**
   * Creates a new EdgeData instance from a plain object.
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
  }): EdgeData {
    // Assign default ports if not specified
    const sourcePortId = data.sourcePortId || 'right';
    const targetPortId = data.targetPortId || 'left';

    return EdgeData.fromLegacyJSON({
      ...data,
      sourcePortId,
      targetPortId,
    });
  }

  /**
   * Creates a simple edge between two nodes
   * @deprecated Use EdgeDataFactory.createFromNodes() instead for centralized edge creation
   */
  static createSimple(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    label?: string,
  ): EdgeData {
    const attrs = label ? { text: { text: label } } : undefined;
    // Assign default ports for simple edges
    const source = { cell: sourceNodeId, port: 'right' };
    const target = { cell: targetNodeId, port: 'left' };
    return new EdgeData(id, 'edge', source, target, attrs);
  }

  /**
   * Creates an edge with port connections
   * @deprecated Use EdgeDataFactory.createFromNodes() instead for centralized edge creation
   */
  static createWithPorts(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId: string,
    targetPortId: string,
    label?: string,
  ): EdgeData {
    const source = { cell: sourceNodeId, port: sourcePortId };
    const target = { cell: targetNodeId, port: targetPortId };
    const attrs = label ? { text: { text: label } } : undefined;
    return new EdgeData(id, 'edge', source, target, attrs);
  }

  /**
   * Creates a new EdgeData with updated label
   */
  withLabel(label: string): EdgeData {
    const newAttrs = {
      ...this.attrs,
      text: { text: label },
    };
    return new EdgeData(
      this.id,
      this.shape,
      this.source,
      this.target,
      newAttrs,
      this.labels,
      this.vertices,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new EdgeData with updated vertices
   */
  withVertices(vertices: Array<{ x: number; y: number }>): EdgeData {
    return new EdgeData(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.attrs,
      this.labels,
      vertices,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new EdgeData with an added vertex
   */
  withAddedVertex(vertex: { x: number; y: number }, index?: number): EdgeData {
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
   * Creates a new EdgeData with updated metadata (accepts both formats)
   */
  withMetadata(metadata: Record<string, string> | MetadataEntry[]): EdgeData {
    let newMetadata: MetadataEntry[];

    if (Array.isArray(metadata)) {
      // Already in correct format
      newMetadata = [...this.data, ...metadata];
    } else {
      // Convert from legacy Record format
      const additionalEntries = Object.entries(metadata).map(([key, value]) => ({ key, value }));
      newMetadata = [...this.data, ...additionalEntries];
    }

    return new EdgeData(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.attrs,
      this.labels,
      this.vertices,
      this.zIndex,
      this.visible,
      newMetadata,
    );
  }

  /**
   * Creates a new EdgeData with updated source
   */
  withSource(nodeId: string, portId?: string): EdgeData {
    const newSource = portId ? { cell: nodeId, port: portId } : nodeId;
    return new EdgeData(
      this.id,
      this.shape,
      newSource,
      this.target,
      this.attrs,
      this.labels,
      this.vertices,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new EdgeData with updated target
   */
  withTarget(nodeId: string, portId?: string): EdgeData {
    const newTarget = portId ? { cell: nodeId, port: portId } : nodeId;
    return new EdgeData(
      this.id,
      this.shape,
      this.source,
      newTarget,
      this.attrs,
      this.labels,
      this.vertices,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new EdgeData with updated attrs
   */
  withAttrs(attrs: Edge.Properties['attrs']): EdgeData {
    return new EdgeData(
      this.id,
      this.shape,
      this.source,
      this.target,
      { ...this.attrs, ...attrs },
      this.labels,
      this.vertices,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new EdgeData with updated properties (partial update)
   * This is the consolidated method for all edge updates
   */
  update(updates: {
    source?: Edge.Properties['source'];
    target?: Edge.Properties['target'];
    attrs?: Edge.Properties['attrs'];
    labels?: Edge.Properties['labels'];
    vertices?: Array<{ x: number; y: number }>;
    zIndex?: number;
    visible?: boolean;
    metadata?: MetadataEntry[] | Record<string, string>;
    label?: string; // Convenience property that updates attrs.text.text
  }): EdgeData {
    // Handle label convenience property
    let newAttrs = updates.attrs ? { ...this.attrs, ...updates.attrs } : this.attrs;
    if (updates.label !== undefined) {
      newAttrs = { ...newAttrs, text: { text: updates.label } };
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

    return new EdgeData(
      this.id,
      this.shape,
      updates.source ?? this.source,
      updates.target ?? this.target,
      newAttrs,
      updates.labels ?? this.labels,
      updates.vertices ?? this.vertices,
      updates.zIndex ?? this.zIndex,
      updates.visible ?? this.visible,
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
   * Checks if this edge data equals another edge data
   */
  equals(other: EdgeData): boolean {
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
      vertices: this.vertices,
      metadata: this.getMetadataAsRecord(),
    };
  }

  /**
   * Converts the edge to X6 snapshot format
   */
  toX6Snapshot(): X6EdgeSnapshot {
    return {
      id: this.id,
      shape: this.shape,
      source: this.source,
      target: this.target,
      attrs: this.attrs,
      labels: this.labels,
      vertices: this.vertices,
      zIndex: this.zIndex,
      visible: this.visible,
      data: this.data,
    };
  }

  /**
   * Converts metadata array to Record format for backward compatibility
   * @deprecated Use the metadata property directly instead of converting to Record format.
   * Normal edge properties should be stored in their dedicated properties (labels, vertices, etc.)
   * rather than in metadata.
   */
  getMetadataAsRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    this.data.forEach(entry => {
      record[entry.key] = entry.value;
    });
    return record;
  }

  /**
   * Helper method to compare source objects
   */
  private sourceEqual(other: Edge.Properties['source']): boolean {
    if (typeof this.source === 'string' && typeof other === 'string') {
      return this.source === other;
    }
    if (typeof this.source === 'object' && typeof other === 'object') {
      return this.source.cell === other.cell && this.source.port === other.port;
    }
    return false;
  }

  /**
   * Helper method to compare target objects
   */
  private targetEqual(other: Edge.Properties['target']): boolean {
    if (typeof this.target === 'string' && typeof other === 'string') {
      return this.target === other;
    }
    if (typeof this.target === 'object' && typeof other === 'object') {
      return this.target.cell === other.cell && this.target.port === other.port;
    }
    return false;
  }

  /**
   * Helper method to compare attrs objects
   */
  private attrsEqual(other: Edge.Properties['attrs']): boolean {
    return JSON.stringify(this.attrs) === JSON.stringify(other);
  }

  /**
   * Helper method to compare labels arrays
   */
  private labelsEqual(other: Edge.Properties['labels']): boolean {
    return JSON.stringify(this.labels) === JSON.stringify(other);
  }

  /**
   * Validates the edge data
   */
  private validate(): void {
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

    // Validate vertices are valid coordinate objects
    this.vertices.forEach((vertex, index) => {
      if (typeof vertex.x !== 'number' || typeof vertex.y !== 'number') {
        throw new Error(`Vertex at index ${index} must have numeric x and y coordinates`);
      }
    });
  }

  /**
   * Checks if vertices arrays are equal
   */
  private verticesEqual(other: Array<{ x: number; y: number }>): boolean {
    if (this.vertices.length !== other.length) {
      return false;
    }

    return this.vertices.every(
      (vertex, index) => vertex.x === other[index].x && vertex.y === other[index].y,
    );
  }

  /**
   * Checks if metadata objects are equal
   */
  private metadataEquals(other: MetadataEntry[]): boolean {
    if (this.data.length !== other.length) {
      return false;
    }

    return this.data.every(
      (entry, index) => entry.key === other[index].key && entry.value === other[index].value,
    );
  }
}
