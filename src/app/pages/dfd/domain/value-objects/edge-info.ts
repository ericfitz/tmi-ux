import { Point } from './point';
import { EdgeTerminal } from './edge-terminal';
import { EdgeAttrs } from './edge-attrs';
import { EdgeLabel } from './edge-label';
import { Metadata, metadataToRecord, safeMetadataEntry } from './metadata';
import { MarkupElement, CellTool, EdgeRouter, EdgeConnector } from './x6-types';
import {
  validateMarkupElements,
  validateCellTools,
  hybridDataEquals,
} from '../utils/x6-validation.util';
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';

/**
 * Edge info value object representing the domain model for diagram edges
 * This stores all properties and metadata for diagram edges
 * Matches the OpenAPI Edge schema structure
 */
// SEM@b543ab1383d78680d661e0dbb798e85a61258e1d: immutable value object holding all domain properties of a diagram edge
export class EdgeInfo {
  // SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: construct and validate an edge info value object from its domain fields (pure)
  constructor(
    public readonly id: string,
    public readonly shape: string = CANONICAL_EDGE_SHAPE,
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
  // SEM@59d014b875b85af28377dda6bfef40ba3531dcef: return edge data excluding the reserved metadata namespace (pure)
  getCustomData(): Record<string, unknown> {
    const { _metadata: _, ...customData } = this.data;
    return customData;
  }

  /**
   * Creates EdgeInfo from a plain object in X6 native format
   */
  // SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: deserialize an edge info from a plain object, handling legacy terminal formats (pure)
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
      data.shape || CANONICAL_EDGE_SHAPE,
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
  // SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: build an EdgeInfo from raw data fields with default ports and labels (pure)
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
      CANONICAL_EDGE_SHAPE,
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
  // SEM@6e5efd2b0a392451cdb3e9dd56023617e967c3e3: build a styled edge label with default position and font attrs (pure)
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
  // SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: build a minimal edge between two nodes with default ports (pure)
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
    return new EdgeInfo(id, CANONICAL_EDGE_SHAPE, source, target, 1, true, {}, labels);
  }

  /**
   * Creates an edge with port connections
   */
  // SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: build an edge connecting two nodes via explicit ports (pure)
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
    return new EdgeInfo(id, CANONICAL_EDGE_SHAPE, source, target, 1, true, {}, labels);
  }

  /**
   * Creates a new EdgeInfo with updated label (uses labels array - X6 native format)
   */
  // SEM@6e5efd2b0a392451cdb3e9dd56023617e967c3e3: update the edge label text, preserving existing label styling (pure)
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
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: update the edge routing waypoints, replacing all vertices (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: insert a waypoint into the edge route at an optional index (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove a waypoint from the edge route by index (pure)
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
  // SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: update the edge metadata key-value pairs, replacing all entries (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: update the edge source node and optional port (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: update the edge target node and optional port (pure)
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
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: update a single custom data entry on the edge by key (pure)
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
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: update multiple custom data entries on the edge at once (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: merge visual attribute overrides into the edge attrs (pure)
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
  // SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: apply a partial set of property updates to the edge value object (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: validate whether the edge has the given node as source or target (pure)
  connectsToNode(nodeId: string): boolean {
    return this.source.cell === nodeId || this.target.cell === nodeId;
  }

  /**
   * Checks if this edge uses the specified port
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: validate whether the edge uses a specific node port (pure)
  usesPort(nodeId: string, portId: string): boolean {
    return (
      (this.source.cell === nodeId && this.source.port === portId) ||
      (this.target.cell === nodeId && this.target.port === portId)
    );
  }

  /**
   * Gets the total length of the edge path
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute total Euclidean path length across all edge waypoints (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate structural equality between two edge value objects (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: format the edge as a human-readable source-to-target string (pure)
  toString(): string {
    return `EdgeInfo(${this.id}, ${this.source.cell} -> ${this.target.cell})`;
  }

  /**
   * Converts to OpenAPI-compliant JSON format
   */
  // SEM@24260d6f2fbe25f47978ac154f6bfd67319aee07: serialize the edge value object to an OpenAPI-compliant JSON shape (pure)
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
  // SEM@b543ab1383d78680d661e0dbb798e85a61258e1d: convert the edge metadata array to a flat key-value record (pure)
  getMetadataAsRecord(): Record<string, string> {
    return metadataToRecord(this.metadata);
  }

  /**
   * Creates a new EdgeInfo with updated source terminal
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: update the edge source terminal with a full EdgeTerminal value (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: update the edge target terminal with a full EdgeTerminal value (pure)
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: update the edge labels array, replacing all labels (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare edge source cell and port for equality (pure)
  private sourceEqual(other: EdgeTerminal): boolean {
    return this.source.cell === other.cell && this.source.port === other.port;
  }

  /**
   * Helper method to compare target objects
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare edge target cell and port for equality (pure)
  private targetEqual(other: EdgeTerminal): boolean {
    return this.target.cell === other.cell && this.target.port === other.port;
  }

  /**
   * Helper method to compare attrs objects
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare edge attribute objects for deep equality (pure)
  private attrsEqual(other: EdgeAttrs): boolean {
    return JSON.stringify(this.attrs) === JSON.stringify(other);
  }

  /**
   * Helper method to compare labels arrays
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare edge label arrays for deep equality (pure)
  private labelsEqual(other: EdgeLabel[]): boolean {
    return JSON.stringify(this.labels) === JSON.stringify(other);
  }

  /**
   * Validates the edge info
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: validate edge id, shape, endpoints, vertices, and X6 properties; throw if invalid (pure)
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
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: validate edge markup, tools, router, connector, and default label (pure)
  private _validateX6Properties(): void {
    validateMarkupElements(this.markup, 'Edge markup element');
    validateCellTools(this.tools, 'Edge tool');

    if (this.router) {
      this._validateNamedConfig(
        this.router,
        ['normal', 'orth', 'oneSide', 'manhattan', 'metro', 'er'],
        'router',
      );
    }

    if (this.connector) {
      this._validateNamedConfig(
        this.connector,
        ['normal', 'rounded', 'smooth', 'jumpover'],
        'connector',
      );
    }

    this._validateDefaultLabel();
  }

  /**
   * Validates a string-or-object config (router or connector)
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: validate a named router or connector config against allowed names (pure)
  private _validateNamedConfig(
    config: string | { name: string; args?: any },
    validNames: string[],
    label: string,
  ): void {
    if (typeof config === 'string') {
      if (!validNames.includes(config)) {
        throw new Error(
          `Invalid ${label} type: ${config}. Must be one of: ${validNames.join(', ')}`,
        );
      }
    } else if (typeof config === 'object') {
      if (!config.name || !validNames.includes(config.name)) {
        throw new Error(
          `Invalid ${label} name: ${config.name}. Must be one of: ${validNames.join(', ')}`,
        );
      }
      if (config.args && typeof config.args !== 'object') {
        throw new Error(`${label.charAt(0).toUpperCase() + label.slice(1)} args must be an object`);
      }
    } else {
      throw new Error(
        `${label.charAt(0).toUpperCase() + label.slice(1)} must be a string or object with name property`,
      );
    }
  }

  /**
   * Validates the defaultLabel structure
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: validate edge default label position and attrs structure (pure)
  private _validateDefaultLabel(): void {
    if (!this.defaultLabel) return;

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

  /**
   * Checks if vertices arrays are equal
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare vertex point arrays for coordinate equality (pure)
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
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: compare hybrid metadata and custom data for equality (pure)
  private metadataEquals(other: { [key: string]: any; _metadata: Metadata[] }): boolean {
    const otherMetadata = other._metadata || [];
    const otherCustomData = { ...other };
    delete (otherCustomData as any)._metadata;

    return hybridDataEquals(this.metadata, otherMetadata, this.getCustomData(), otherCustomData);
  }
}
