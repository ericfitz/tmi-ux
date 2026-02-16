import { Point } from './point';
import { EdgeTerminal } from './edge-terminal';
import { EdgeAttrs } from './edge-attrs';
import { EdgeLabel } from './edge-label';
import { Metadata, safeMetadataEntry } from './metadata';
import { MarkupElement, CellTool, EdgeRouter, EdgeConnector } from './x6-types';
import {
  validateMarkupElements,
  validateCellTools,
  hybridDataEquals,
} from '../utils/x6-validation.util';

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
    public readonly data: { [key: string]: unknown; _metadata: Metadata[] } = { _metadata: [] },
    public readonly markup?: MarkupElement[],
    public readonly tools?: CellTool[],
    public readonly router?: EdgeRouter,
    public readonly connector?: EdgeConnector,
    public readonly defaultLabel?: EdgeLabel,
  ) {
    this._validate();
  }

  /**
   * Gets the structured business metadata array
   */
  get metadata(): Metadata[] {
    return this.data._metadata || [];
  }

  /**
   * Gets custom data (excluding reserved metadata namespace)
   */
  getCustomData(): Record<string, unknown> {
    const { _metadata: _, ...customData } = this.data;
    return customData;
  }

  /**
   * Creates EdgeInfo from a plain object in X6 native format
   */
  static fromJSON(data: {
    id: string;
    shape?: string;
    source?: EdgeTerminal;
    target?: EdgeTerminal;
    sourceNodeId?: string; // Legacy field
    targetNodeId?: string; // Legacy field
    sourcePortId?: string; // Legacy field
    targetPortId?: string; // Legacy field
    attrs?: EdgeAttrs;
    labels?: EdgeLabel[];
    vertices?: Point[] | Array<{ x: number; y: number }>;
    zIndex?: number;
    visible?: boolean;
    data?: { [key: string]: any; _metadata: Metadata[] };
    metadata?: Record<string, string>; // Legacy field
    markup?: MarkupElement[];
    tools?: CellTool[];
    router?: EdgeRouter;
    connector?: EdgeConnector;
    defaultLabel?: EdgeLabel;
  }): EdgeInfo {
    // Handle source terminal (new vs legacy format)
    let source: EdgeTerminal;
    if (data.source) {
      source = data.source;
    } else if (data.sourceNodeId) {
      source = {
        cell: data.sourceNodeId,
        port: data.sourcePortId || 'right',
      };
    } else {
      throw new Error('Source information is required');
    }

    // Handle target terminal (new vs legacy format)
    let target: EdgeTerminal;
    if (data.target) {
      target = data.target;
    } else if (data.targetNodeId) {
      target = {
        cell: data.targetNodeId,
        port: data.targetPortId || 'left',
      };
    } else {
      throw new Error('Target information is required');
    }

    const attrs: EdgeAttrs = data.attrs || {};
    const labels: EdgeLabel[] = data.labels || [];

    // Handle vertices
    const vertices: Point[] = (data.vertices || []).map(v =>
      v instanceof Point ? v : new Point(v.x, v.y),
    );

    // Handle hybrid data format or legacy metadata
    let hybridData = data.data || { _metadata: [] };
    if (!data.data && data.metadata) {
      // Convert legacy metadata to hybrid format
      const metadataArray = Object.entries(data.metadata).map(([key, value]) =>
        safeMetadataEntry(key, value, 'EdgeInfo.fromJSON'),
      );
      hybridData = { _metadata: metadataArray };
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
      hybridData,
      data.markup,
      data.tools,
      data.router,
      data.connector,
      data.defaultLabel,
    );
  }

  /**
   * Creates a new EdgeInfo instance from a plain object.
   * This is a factory method for creating new instances.
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
    customData?: Record<string, any>;
    connector?: EdgeConnector;
    router?: EdgeRouter;
  }): EdgeInfo {
    // Assign default ports if not specified
    const sourcePortId = data.sourcePortId || 'right';
    const targetPortId = data.targetPortId || 'left';

    const source: EdgeTerminal = {
      cell: data.sourceNodeId,
      port: sourcePortId,
    };

    const target: EdgeTerminal = {
      cell: data.targetNodeId,
      port: targetPortId,
    };

    // Use labels array for edge labels (X6 native format)
    const labels: EdgeLabel[] = data.label ? [EdgeInfo.createDefaultLabel(data.label)] : [];

    const vertices = (data.vertices || []).map(v => new Point(v.x, v.y));

    const metadataEntries: Metadata[] = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) =>
          safeMetadataEntry(key, value, 'EdgeInfo.create'),
        )
      : [];

    const hybridData = {
      _metadata: metadataEntries,
      ...(data.customData || {}),
    };

    return new EdgeInfo(
      data.id,
      'edge',
      source,
      target,
      1,
      true,
      {}, // attrs - keep empty, labels are in labels array
      labels,
      vertices,
      hybridData,
      undefined,
      undefined,
      data.router,
      data.connector,
    );
  }

  /**
   * Creates a default edge label with standard styling (X6 native format)
   * @param text - The label text
   * @param position - Position along the edge (0-1), defaults to 0.5 (middle)
   */
  static createDefaultLabel(text: string, position: number = 0.5): EdgeLabel {
    return {
      position,
      attrs: {
        text: {
          text,
          fontSize: 12, // DFD_STYLING.DEFAULT_FONT_SIZE
          fill: '#333',
          fontFamily: "'Roboto Condensed', Arial, sans-serif", // DFD_STYLING.TEXT_FONT_FAMILY
          textAnchor: 'middle',
        },
      },
    };
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
    // Use labels array for edge labels (X6 native format)
    const labels: EdgeLabel[] = label ? [EdgeInfo.createDefaultLabel(label)] : [];
    // Assign default ports for simple edges
    const source: EdgeTerminal = { cell: sourceNodeId, port: 'right' };
    const target: EdgeTerminal = { cell: targetNodeId, port: 'left' };
    return new EdgeInfo(id, 'edge', source, target, 1, true, {}, labels);
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
    // Use labels array for edge labels (X6 native format)
    const labels: EdgeLabel[] = label ? [EdgeInfo.createDefaultLabel(label)] : [];
    return new EdgeInfo(id, 'edge', source, target, 1, true, {}, labels);
  }

  /**
   * Creates a new EdgeInfo with updated label (uses labels array - X6 native format)
   */
  withLabel(label: string): EdgeInfo {
    // Update labels array (X6 native format for edge labels)
    let newLabels: EdgeLabel[];
    if (this.labels && this.labels.length > 0) {
      // Update the first label, preserving position and other styling
      const existingLabel = this.labels[0];
      const updatedLabel: EdgeLabel = {
        ...existingLabel,
        attrs: {
          ...existingLabel.attrs,
          text: {
            ...existingLabel.attrs?.text,
            text: label,
          },
        },
      };
      newLabels = [updatedLabel, ...this.labels.slice(1)];
    } else {
      // No existing labels, create a new one
      newLabels = [EdgeInfo.createDefaultLabel(label)];
    }

    return new EdgeInfo(
      this.id,
      this.shape,
      this.source,
      this.target,
      this.zIndex,
      this.visible,
      this.attrs, // Keep attrs unchanged (for line styling, etc.)
      newLabels,
      this.vertices,
      this.data,
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
    );
  }

  /**
   * Creates a new EdgeInfo with updated vertices
   */
  withVertices(vertices: Point[] | Array<{ x: number; y: number }>): EdgeInfo {
    const pointVertices = vertices.map(v => (v instanceof Point ? v : new Point(v.x, v.y)));
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
      newMetadata = metadata;
    } else {
      newMetadata = Object.entries(metadata).map(([key, value]) =>
        safeMetadataEntry(key, value, 'EdgeInfo.withMetadata'),
      );
    }

    const newData = {
      ...this.data,
      _metadata: newMetadata,
    };

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
      newData,
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
    );
  }

  /**
   * Creates a new EdgeInfo with updated custom data
   */
  withCustomData(key: string, value: any): EdgeInfo {
    const newData = {
      ...this.data,
      [key]: value,
    };

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
      newData,
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
    );
  }

  /**
   * Creates a new EdgeInfo with multiple custom data updates
   */
  withCustomDataBatch(customData: Record<string, any>): EdgeInfo {
    const newData = {
      ...this.data,
      ...customData,
    };

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
      newData,
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
    customData?: Record<string, any>;
  }): EdgeInfo {
    const newAttrs = updates.attrs ? { ...this.attrs, ...updates.attrs } : this.attrs;

    // Handle hybrid data updates
    let newData = this.data;
    if (updates.metadata !== undefined || updates.customData !== undefined) {
      let newMetadata = this.metadata;
      if (updates.metadata !== undefined) {
        if (Array.isArray(updates.metadata)) {
          newMetadata = updates.metadata;
        } else {
          newMetadata = Object.entries(updates.metadata).map(([key, value]) =>
            safeMetadataEntry(key, value, 'EdgeInfo.update'),
          );
        }
      }

      newData = {
        ...this.data,
        ...(updates.customData || {}),
        _metadata: newMetadata,
      };
    }

    // Handle vertices conversion
    const newVertices = updates.vertices
      ? updates.vertices.map(v => (v instanceof Point ? v : new Point(v.x, v.y)))
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
      newData,
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
    );
  }

  /**
   * Checks if this edge connects to the specified node
   */
  connectsToNode(nodeId: string): boolean {
    return this.source.cell === nodeId || this.target.cell === nodeId;
  }

  /**
   * Checks if this edge uses the specified port
   */
  usesPort(nodeId: string, portId: string): boolean {
    return (
      (this.source.cell === nodeId && this.source.port === portId) ||
      (this.target.cell === nodeId && this.target.port === portId)
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
    return `EdgeInfo(${this.id}, ${this.source.cell} -> ${this.target.cell})`;
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
    data: { [key: string]: any; _metadata: Metadata[] };
    markup?: MarkupElement[];
    tools?: CellTool[];
    router?: EdgeRouter;
    connector?: EdgeConnector;
    defaultLabel?: EdgeLabel;
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
      markup: this.markup,
      tools: this.tools,
      router: this.router,
      connector: this.connector,
      defaultLabel: this.defaultLabel,
    };
  }

  /**
   * Converts metadata array to Record format
   */
  getMetadataAsRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    this.metadata.forEach(entry => {
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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
      this.markup,
      this.tools,
      this.router,
      this.connector,
      this.defaultLabel,
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

    if (!this.source.cell || this.source.cell.trim().length === 0) {
      throw new Error('Source node ID cannot be empty');
    }

    if (!this.target.cell || this.target.cell.trim().length === 0) {
      throw new Error('Target node ID cannot be empty');
    }

    if (this.source.cell === this.target.cell && this.source.port === this.target.port) {
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

    // Validate X6-specific properties
    this._validateX6Properties();
  }

  /**
   * Validates X6-specific properties
   */
  private _validateX6Properties(): void {
    validateMarkupElements(this.markup, 'Edge markup element');
    validateCellTools(this.tools, 'Edge tool');

    // Validate router configuration
    if (this.router) {
      if (typeof this.router === 'string') {
        const validRouters = ['normal', 'orth', 'oneSide', 'manhattan', 'metro', 'er'];
        if (!validRouters.includes(this.router)) {
          throw new Error(
            `Invalid router type: ${this.router}. Must be one of: ${validRouters.join(', ')}`,
          );
        }
      } else if (typeof this.router === 'object') {
        const validRouters = ['normal', 'orth', 'oneSide', 'manhattan', 'metro', 'er'];
        if (!this.router.name || !validRouters.includes(this.router.name)) {
          throw new Error(
            `Invalid router name: ${this.router.name}. Must be one of: ${validRouters.join(', ')}`,
          );
        }
        if (this.router.args && typeof this.router.args !== 'object') {
          throw new Error('Router args must be an object');
        }
      } else {
        throw new Error('Router must be a string or object with name property');
      }
    }

    // Validate connector configuration
    if (this.connector) {
      if (typeof this.connector === 'string') {
        const validConnectors = ['normal', 'rounded', 'smooth', 'jumpover'];
        if (!validConnectors.includes(this.connector)) {
          throw new Error(
            `Invalid connector type: ${this.connector}. Must be one of: ${validConnectors.join(', ')}`,
          );
        }
      } else if (typeof this.connector === 'object') {
        const validConnectors = ['normal', 'rounded', 'smooth', 'jumpover'];
        if (!this.connector.name || !validConnectors.includes(this.connector.name)) {
          throw new Error(
            `Invalid connector name: ${this.connector.name}. Must be one of: ${validConnectors.join(', ')}`,
          );
        }
        if (this.connector.args && typeof this.connector.args !== 'object') {
          throw new Error('Connector args must be an object');
        }
      } else {
        throw new Error('Connector must be a string or object with name property');
      }
    }

    // Validate defaultLabel structure
    if (this.defaultLabel) {
      if (typeof this.defaultLabel !== 'object') {
        throw new Error('Default label must be an object');
      }
      if (this.defaultLabel.position !== undefined) {
        if (
          typeof this.defaultLabel.position !== 'number' ||
          this.defaultLabel.position < 0 ||
          this.defaultLabel.position > 1
        ) {
          throw new Error('Default label position must be a number between 0 and 1');
        }
      }
      if (this.defaultLabel.attrs && typeof this.defaultLabel.attrs !== 'object') {
        throw new Error('Default label attrs must be an object');
      }
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
  private metadataEquals(other: { [key: string]: any; _metadata: Metadata[] }): boolean {
    const otherMetadata = other._metadata || [];
    const otherCustomData = { ...other };
    delete (otherCustomData as any)._metadata;

    return hybridDataEquals(this.metadata, otherMetadata, this.getCustomData(), otherCustomData);
  }
}
