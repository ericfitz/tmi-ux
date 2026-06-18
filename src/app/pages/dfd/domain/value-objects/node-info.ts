import { Point } from './point';
import { NodeAttrs, createDefaultNodeAttrs } from './node-attrs';
import { PortConfiguration, createDefaultPortConfiguration } from './port-configuration';
import { Metadata, safeMetadataEntry } from './metadata';
import { MarkupElement, CellTool } from './x6-types';
import { DFD_STYLING_HELPERS } from '../../constants/styling-constants';
import {
  validateMarkupElements,
  validateCellTools,
  hybridDataEquals,
} from '../utils/x6-validation.util';

/**
 * Node types supported in the DFD diagram
 * Matches the OpenAPI specification node shape enum
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: union type of valid DFD node shape identifiers (pure)
export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'text-box';

/**
 * Node info value object representing the domain model for diagram nodes
 * This stores all properties and metadata for diagram nodes
 * Matches the OpenAPI Node schema structure
 */
// SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: immutable domain value object representing a DFD diagram node (pure)
export class NodeInfo {
  // SEM@24260d6f2fbe25f47978ac154f6bfd67319aee07: construct a validated immutable node info from all node properties (pure)
  constructor(
    public readonly id: string,
    public readonly shape: NodeType,
    public readonly x: number,
    public readonly y: number,
    public readonly width: number,
    public readonly height: number,
    public readonly zIndex: number = 1,
    public readonly visible: boolean = true,
    public readonly attrs: NodeAttrs = createDefaultNodeAttrs('process'),
    public readonly ports: PortConfiguration = createDefaultPortConfiguration('process'),
    public readonly data: { [key: string]: any; _metadata: Metadata[] } = { _metadata: [] },
    public readonly angle: number = 0,
    public readonly parent?: string | null,
    public readonly markup?: MarkupElement[],
    public readonly tools?: CellTool[],
  ) {
    this._validate();
  }

  /**
   * Gets the node type (same as shape)
   */
  get type(): NodeType {
    return this.shape;
  }

  /**
   * Gets the node position as a Point object
   */
  get position(): Point {
    return new Point(this.x, this.y);
  }

  /**
   * Gets the node label from attrs
   */
  get label(): string {
    return this.attrs?.text?.text || '';
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
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: return node data excluding the reserved metadata namespace (pure)
  getCustomData(): Record<string, any> {
    const { _metadata: _, ...customData } = this.data;
    return customData;
  }

  /**
   * Creates NodeInfo from a plain object in X6 v2 native nested format
   * Also accepts X6 v1 legacy flat format for backward compatibility
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: deserialize a NodeInfo from X6 v2 nested or v1 legacy flat JSON (pure)
  static fromJSON(data: {
    id: string;
    shape?: NodeType;
    type?: NodeType; // Legacy field
    position?: { x: number; y: number }; // X6 v2 native nested format
    size?: { width: number; height: number }; // X6 v2 native nested format
    x?: number; // X6 v1 legacy flat format
    y?: number; // X6 v1 legacy flat format
    width?: number; // X6 v1 legacy flat format
    height?: number; // X6 v1 legacy flat format
    attrs?: NodeAttrs;
    ports?: PortConfiguration;
    zIndex?: number;
    visible?: boolean;
    angle?: number;
    parent?: string | null;
    data?: { [key: string]: any; _metadata: Metadata[] };
    metadata?: Record<string, string>; // Legacy field
    markup?: MarkupElement[];
    tools?: CellTool[];
  }): NodeInfo {
    const shape = data.shape || data.type || 'process';
    const { x, y, width, height } = NodeInfo._resolveGeometry(data);
    const attrs = data.attrs || createDefaultNodeAttrs(shape);
    const ports = data.ports || createDefaultPortConfiguration(shape);
    const hybridData = NodeInfo._resolveHybridData(data);

    return new NodeInfo(
      data.id,
      shape,
      x,
      y,
      width,
      height,
      data.zIndex ?? NodeInfo.getDefaultZIndex(shape),
      data.visible ?? true,
      attrs,
      ports,
      hybridData,
      data.angle ?? 0,
      data.parent,
      data.markup,
      data.tools,
    );
  }

  /**
   * Resolves geometry from X6 v2 nested or v1 flat format
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: resolve node position and size from nested or flat format (pure)
  private static _resolveGeometry(data: {
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): { x: number; y: number; width: number; height: number } {
    return {
      x: data.position?.x ?? data.x ?? 0,
      y: data.position?.y ?? data.y ?? 0,
      width: data.size?.width ?? data.width ?? 120,
      height: data.size?.height ?? data.height ?? 60,
    };
  }

  /**
   * Resolves hybrid data from data field or legacy metadata
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: resolve node hybrid data from structured data field or legacy metadata record (pure)
  private static _resolveHybridData(data: {
    data?: { [key: string]: any; _metadata: Metadata[] };
    metadata?: Record<string, string>;
  }): { [key: string]: any; _metadata: Metadata[] } {
    if (data.data) return data.data;
    if (data.metadata) {
      const metadataArray = Object.entries(data.metadata).map(([key, value]) =>
        safeMetadataEntry(key, value, 'NodeInfo.fromJSON'),
      );
      return { _metadata: metadataArray };
    }
    return { _metadata: [] };
  }

  /**
   * Creates a new NodeInfo instance from a plain object.
   * This is a factory method for creating new instances.
   */
  // SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: build a new NodeInfo from a typed creation payload with defaults applied (pure)
  static create(data: {
    id: string;
    type: NodeType;
    label: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata?: Record<string, string>;
    customData?: Record<string, any>;
  }): NodeInfo {
    const metadataEntries = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) =>
          safeMetadataEntry(key, value, 'NodeInfo.create'),
        )
      : [];

    const hybridData = {
      _metadata: metadataEntries,
      ...(data.customData || {}),
    };

    return new NodeInfo(
      data.id,
      data.type,
      data.position.x,
      data.position.y,
      data.width,
      data.height,
      NodeInfo.getDefaultZIndex(data.type),
      true,
      createDefaultNodeAttrs(data.type, data.label),
      createDefaultPortConfiguration(data.type),
      hybridData,
    );
  }

  /**
   * Creates a default NodeInfo for the given type
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: build a NodeInfo with type-appropriate defaults at a given position (pure)
  static createDefault(
    id: string,
    type: NodeType,
    position: Point,
    translateFn?: (key: string) => string,
  ): NodeInfo {
    const defaultDimensions = this.getDefaultDimensions(type);
    const defaultLabel = this.getDefaultLabel(type, translateFn);

    return new NodeInfo(
      id,
      type,
      position.x,
      position.y,
      defaultDimensions.width,
      defaultDimensions.height,
      NodeInfo.getDefaultZIndex(type),
      true,
      createDefaultNodeAttrs(type, defaultLabel),
      createDefaultPortConfiguration(type),
      { _metadata: [] },
    );
  }

  /**
   * Gets default dimensions for a node type
   */
  // SEM@752e6f045fbd196342e35c47ffee2398495149be: fetch the default width and height for a node type (pure)
  private static getDefaultDimensions(type: NodeType): { width: number; height: number } {
    return DFD_STYLING_HELPERS.getDefaultDimensions(type);
  }

  /**
   * Gets default zIndex for a node type
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: fetch the default z-index for a node type (pure)
  private static getDefaultZIndex(type: NodeType): number {
    return DFD_STYLING_HELPERS.getDefaultZIndex(type);
  }

  /**
   * Gets default label for a node type
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: resolve the default display label for a node type, optionally translated (pure)
  static getDefaultLabel(type: string, translateFn?: (key: string) => string): string {
    if (!translateFn) {
      // Fallback to English labels if no translation function provided
      switch (type) {
        case 'actor':
          return 'Actor';
        case 'process':
          return 'Process';
        case 'store':
          return 'Data Store';
        case 'security-boundary':
          return 'Security Boundary';
        case 'text-box':
          return 'Text';
        default:
          return 'Node';
      }
    }

    // Use translation function with appropriate keys
    switch (type) {
      case 'actor':
        return translateFn('editor.nodeLabels.actor');
      case 'process':
        return translateFn('editor.nodeLabels.process');
      case 'store':
        return translateFn('editor.nodeLabels.store');
      case 'security-boundary':
        return translateFn('editor.nodeLabels.securityBoundary');
      case 'text-box':
        return translateFn('editor.nodeLabels.textbox');
      default:
        return translateFn('editor.nodeLabels.node');
    }
  }

  /**
   * Creates a new NodeInfo with updated position
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return a new NodeInfo with the position updated (pure)
  withPosition(position: Point | { x: number; y: number }): NodeInfo {
    const pos = position instanceof Point ? { x: position.x, y: position.y } : position;
    return new NodeInfo(
      this.id,
      this.shape,
      pos.x,
      pos.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      this.data,
      this.angle,
      this.parent,
    );
  }

  /**
   * Creates a new NodeInfo with updated label
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: return a new NodeInfo with the display label updated (pure)
  withLabel(label: string): NodeInfo {
    const newAttrs: NodeAttrs = {
      ...this.attrs,
      text: {
        ...this.attrs.text,
        text: label,
      },
    };
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      newAttrs,
      this.ports,
      this.data,
      this.angle,
      this.parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Creates a new NodeInfo with updated width
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return a new NodeInfo with the width updated (pure)
  withWidth(width: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      this.data,
      this.angle,
      this.parent,
    );
  }

  /**
   * Creates a new NodeInfo with updated height
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return a new NodeInfo with the height updated (pure)
  withHeight(height: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      this.data,
      this.angle,
      this.parent,
    );
  }

  /**
   * Creates a new NodeInfo with updated dimensions (width and height)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return a new NodeInfo with both width and height updated (pure)
  withDimensions(width: number, height: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      width,
      height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      this.data,
      this.angle,
      this.parent,
    );
  }

  /**
   * Creates a new NodeInfo with updated metadata (accepts both formats)
   */
  // SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: return a new NodeInfo with the metadata collection replaced (pure)
  withMetadata(metadata: Record<string, string> | Metadata[]): NodeInfo {
    let newMetadata: Metadata[];

    if (Array.isArray(metadata)) {
      newMetadata = metadata;
    } else {
      newMetadata = Object.entries(metadata).map(([key, value]) =>
        safeMetadataEntry(key, value, 'NodeInfo.withMetadata'),
      );
    }

    const newData = {
      ...this.data,
      _metadata: newMetadata,
    };

    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      newData,
      this.angle,
      this.parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Creates a new NodeInfo with updated custom data
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: return a new NodeInfo with a single custom data key-value set (pure)
  withCustomData(key: string, value: any): NodeInfo {
    const newData = {
      ...this.data,
      [key]: value,
    };

    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      newData,
      this.angle,
      this.parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Creates a new NodeInfo with multiple custom data updates
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: return a new NodeInfo with multiple custom data entries merged (pure)
  withCustomDataBatch(customData: Record<string, any>): NodeInfo {
    const newData = {
      ...this.data,
      ...customData,
    };

    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      newData,
      this.angle,
      this.parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Creates a new NodeInfo with updated attrs
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: return a new NodeInfo with visual attributes merged (pure)
  withAttrs(attrs: NodeAttrs): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      { ...this.attrs, ...attrs },
      this.ports,
      this.data,
      this.angle,
      this.parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Creates a new NodeInfo with updated angle
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: return a new NodeInfo with the rotation angle updated (pure)
  withAngle(angle: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      this.data,
      angle,
      this.parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Creates a new NodeInfo with updated parent
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: return a new NodeInfo with the parent node ID updated (pure)
  withParent(parent: string | null): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      this.data,
      this.angle,
      parent,
      this.markup,
      this.tools,
    );
  }

  /**
   * Gets the center point of the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the center point of the node bounding box (pure)
  getCenter(): Point {
    return new Point(this.x + this.width / 2, this.y + this.height / 2);
  }

  /**
   * Gets the bounding box of the node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the top-left and bottom-right corner points of the node (pure)
  getBounds(): { topLeft: Point; bottomRight: Point } {
    return {
      topLeft: new Point(this.x, this.y),
      bottomRight: new Point(this.x + this.width, this.y + this.height),
    };
  }

  /**
   * Gets metadata as Record for backward compatibility
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: convert the metadata array to a flat key-value record (pure)
  getMetadataAsRecord(): Record<string, string> {
    return this.metadata.reduce(
      (acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * Checks if this node info equals another node info
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: compare two NodeInfo instances for structural equality (pure)
  equals(other: NodeInfo): boolean {
    return (
      this.id === other.id &&
      this.shape === other.shape &&
      (this.attrs?.text?.text || '') === (other.attrs?.text?.text || '') &&
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height &&
      this.zIndex === other.zIndex &&
      this.visible === other.visible &&
      this.angle === other.angle &&
      this.parent === other.parent &&
      this.metadataEquals(other.data)
    );
  }

  /**
   * Returns a string representation of the node info
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: format the node as a human-readable summary string (pure)
  toString(): string {
    return `NodeInfo(${this.id}, ${this.shape}, "${this.attrs?.text?.text || ''}")`;
  }

  /**
   * Converts to X6 v2 native nested format for API serialization
   */
  // SEM@5c922ad031ad0fadb4090646ec76cc0897270890: serialize the node info to the X6 API wire format (pure)
  toJSON(): {
    id: string;
    shape: NodeType;
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
    visible: boolean;
    attrs: NodeAttrs;
    ports: PortConfiguration;
    data: { [key: string]: any; _metadata: Metadata[] };
    angle: number;
    parent?: string | null;
    markup?: MarkupElement[];
    tools?: CellTool[];
  } {
    return {
      id: this.id,
      shape: this.shape,
      position: { x: this.x, y: this.y },
      size: { width: this.width, height: this.height },
      zIndex: this.zIndex,
      visible: this.visible,
      attrs: this.attrs,
      ports: this.ports,
      data: this.data,
      angle: this.angle,
      parent: this.parent,
      markup: this.markup,
      tools: this.tools,
    };
  }

  /**
   * Validates the node info
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: validate node id, shape, label, dimensions, and coordinates; throw on violation (pure)
  private _validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Node ID cannot be empty');
    }

    if (!this.shape) {
      throw new Error('Node shape is required');
    }

    if (!this.isValidNodeType(this.shape)) {
      throw new Error(`Invalid node shape: ${String(this.shape)}`);
    }

    const label = this.attrs?.text?.text || '';
    if (!label || label.trim().length === 0) {
      throw new Error('Node label cannot be empty');
    }

    if (this.width <= 0 || this.height <= 0) {
      throw new Error('Node dimensions must be positive');
    }

    if (!Number.isFinite(this.width) || !Number.isFinite(this.height)) {
      throw new Error('Node dimensions must be finite numbers');
    }

    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      throw new Error('Node coordinates must be finite numbers');
    }

    if (!Number.isFinite(this.angle)) {
      throw new Error('Node angle must be a finite number');
    }

    // Validate X6-specific properties
    this._validateX6Properties();
  }

  /**
   * Validates X6-specific properties
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: validate X6-specific markup and tool properties; throw on violation (pure)
  private _validateX6Properties(): void {
    validateMarkupElements(this.markup);
    validateCellTools(this.tools);
  }

  /**
   * Checks if the given shape is a valid node type
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that a shape string is a recognized node type (pure)
  private isValidNodeType(shape: string): shape is NodeType {
    return ['actor', 'process', 'store', 'security-boundary', 'text-box'].includes(shape);
  }

  /**
   * Checks if metadata arrays are equal
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: compare metadata and custom data of two nodes for equality (pure)
  private metadataEquals(other: { [key: string]: any; _metadata: Metadata[] }): boolean {
    const otherMetadata = other._metadata || [];
    const otherCustomData = { ...other };
    delete (otherCustomData as any)._metadata;

    return hybridDataEquals(this.metadata, otherMetadata, this.getCustomData(), otherCustomData);
  }
}
