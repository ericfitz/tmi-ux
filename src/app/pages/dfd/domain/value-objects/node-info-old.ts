import { Point } from './point';
import { Node } from '@antv/x6';

/**
 * Node types supported in the DFD diagram
 */
export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'text-box';

/**
 * Metadata entry structure for node data
 */
export interface MetadataEntry {
  key: string;
  value: string;
}

/**
 * Node info value object representing the domain model for diagram nodes
 * This stores all properties and metadata for diagram nodes
 */
export class NodeInfo {
  constructor(
    public readonly id: string,
    public readonly shape: string, // X6 shape identifier (now serves as both shape and type)
    public readonly position: { x: number; y: number },
    public readonly size: { width: number; height: number },
    public readonly attrs: Node.Properties['attrs'] = { text: { text: '' } },
    public readonly ports: Node.Properties['ports'] = {},
    public readonly zIndex: number = 1, // Temporary default, actual z-index set by ZOrderService
    public readonly visible: boolean = true,
    public readonly data: MetadataEntry[] = [],
  ) {
    this._validate();
  }

  /**
   * Gets the node type (same as shape since X6 shapes now match domain types)
   */
  get type(): NodeType {
    return this.shape as NodeType;
  }

  /**
   * Gets the label from attrs.text.text for backward compatibility
   */
  get label(): string {
    const textAttr = this.attrs?.['text'];
    if (textAttr && typeof textAttr === 'object' && 'text' in textAttr) {
      const text = (textAttr as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    }
    return '';
  }

  /**
   * Gets width from size for backward compatibility
   */
  get width(): number {
    return this.size.width;
  }

  /**
   * Gets height from size for backward compatibility
   */
  get height(): number {
    return this.size.height;
  }

  /**
   * Creates NodeInfo from a plain object (supports both new and legacy formats)
   */
  static fromJSON(data: {
    id: string;
    shape?: string;
    type: NodeType;
    position: { x: number; y: number };
    size?: { width: number; height: number };
    width?: number;
    height?: number;
    label?: string;
    attrs?: Node.Properties['attrs'];
    ports?: Node.Properties['ports'];
    zIndex?: number;
    visible?: boolean;
    metadata?: MetadataEntry[] | Record<string, string>;
  }): NodeInfo {
    // Handle legacy format
    // TODO: ensure that we are not storing non-business-stuff in cells' data propery
    const size = data.size || { width: data.width || 120, height: data.height || 60 };
    const attrs = data.attrs || { text: { text: data.label || '' } };

    // Convert metadata if it's in legacy Record format
    let metadata: MetadataEntry[] = [];
    if (data.metadata) {
      if (Array.isArray(data.metadata)) {
        metadata = data.metadata;
      } else {
        metadata = Object.entries(data.metadata).map(([key, value]) => ({ key, value }));
      }
    }

    return new NodeInfo(
      data.id,
      data.shape || data.type, // Use shape if provided, fallback to type (now they should be the same)
      data.position,
      size,
      attrs,
      data.ports || {},
      data.zIndex || 1,
      data.visible !== false, // Default to true
      metadata,
    );
  }

  /**
   * Creates NodeInfo from legacy format for backward compatibility
   */
  static fromLegacyJSON(data: {
    id: string;
    type: NodeType;
    label: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata?: Record<string, string>;
  }): NodeInfo {
    const metadataEntries = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
      : [];

    return new NodeInfo(
      data.id,
      data.type, // Shape and type are now the same (X6 shapes renamed to match domain types)
      data.position,
      { width: data.width, height: data.height },
      { text: { text: data.label } },
      {},
      1,
      true,
      metadataEntries,
    );
  }

  /**
   * Creates a new NodeInfo instance from a plain object.
   * This is a factory method for creating new instances, similar to fromJSON but for new data.
   */
  static create(data: {
    id: string;
    type: NodeType;
    label: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata?: Record<string, string>;
  }): NodeInfo {
    return NodeInfo.fromLegacyJSON(data);
  }

  /**
   * Creates a default NodeInfo for the given type
   */
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
      type, // Shape and type are now the same (X6 shapes renamed to match domain types)
      { x: position.x, y: position.y },
      { width: defaultDimensions.width, height: defaultDimensions.height },
      { text: { text: defaultLabel } },
      {},
      1,
      true,
      [],
    );
  }

  /**
   * Gets default dimensions for a node type
   */
  private static getDefaultDimensions(type: NodeType): { width: number; height: number } {
    switch (type) {
      case 'actor':
        return { width: 120, height: 60 };
      case 'process':
        return { width: 140, height: 80 };
      case 'store':
        return { width: 160, height: 60 };
      case 'security-boundary':
        return { width: 200, height: 150 };
      case 'text-box':
        return { width: 100, height: 40 };
      default:
        return { width: 120, height: 60 };
    }
  }

  /**
   * Gets default label for a node type
   */
  private static getDefaultLabel(type: NodeType, translateFn?: (key: string) => string): string {
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
  withPosition(position: Point | { x: number; y: number }): NodeInfo {
    const pos = position instanceof Point ? { x: position.x, y: position.y } : position;
    return new NodeInfo(
      this.id,
      this.shape,
      pos,
      this.size,
      this.attrs,
      this.ports,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new NodeInfo with updated label
   */
  withLabel(label: string): NodeInfo {
    const currentTextAttr = this.attrs?.['text'];
    const newAttrs = {
      ...this.attrs,
      text: {
        ...(currentTextAttr && typeof currentTextAttr === 'object' ? currentTextAttr : {}),
        text: label,
      },
    };
    return new NodeInfo(
      this.id,
      this.shape,
      this.position,
      this.size,
      newAttrs,
      this.ports,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new NodeInfo with updated width
   */
  withWidth(width: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.position,
      { ...this.size, width },
      this.attrs,
      this.ports,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new NodeInfo with updated height
   */
  withHeight(height: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.position,
      { ...this.size, height },
      this.attrs,
      this.ports,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new NodeInfo with updated dimensions (width and height)
   */
  withDimensions(width: number, height: number): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.position,
      { width, height },
      this.attrs,
      this.ports,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Creates a new NodeInfo with updated metadata (accepts both formats)
   */
  withMetadata(metadata: Record<string, string> | MetadataEntry[]): NodeInfo {
    let newMetadata: MetadataEntry[];

    if (Array.isArray(metadata)) {
      // Already in correct format
      newMetadata = [...this.data, ...metadata];
    } else {
      // Convert from legacy Record format
      const additionalEntries = Object.entries(metadata).map(([key, value]) => ({ key, value }));
      newMetadata = [...this.data, ...additionalEntries];
    }

    return new NodeInfo(
      this.id,
      this.shape,
      this.position,
      this.size,
      this.attrs,
      this.ports,
      this.zIndex,
      this.visible,
      newMetadata,
    );
  }

  /**
   * Creates a new NodeInfo with updated attrs
   */
  withAttrs(attrs: Node.Properties['attrs']): NodeInfo {
    return new NodeInfo(
      this.id,
      this.shape,
      this.position,
      this.size,
      { ...this.attrs, ...attrs },
      this.ports,
      this.zIndex,
      this.visible,
      this.data,
    );
  }

  /**
   * Gets the center point of the node
   */
  getCenter(): Point {
    return new Point(this.position.x + this.size.width / 2, this.position.y + this.size.height / 2);
  }

  /**
   * Gets the bounding box of the node
   */
  getBounds(): { topLeft: Point; bottomRight: Point } {
    return {
      topLeft: new Point(this.position.x, this.position.y),
      bottomRight: new Point(this.position.x + this.size.width, this.position.y + this.size.height),
    };
  }

  /**
   * Gets metadata as Record for backward compatibility
   */
  getMetadataAsRecord(): Record<string, string> {
    return this.data.reduce(
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
  equals(other: NodeInfo): boolean {
    return (
      this.id === other.id &&
      this.shape === other.shape &&
      this.label === other.label &&
      this.position.x === other.position.x &&
      this.position.y === other.position.y &&
      this.size.width === other.size.width &&
      this.size.height === other.size.height &&
      this.zIndex === other.zIndex &&
      this.visible === other.visible &&
      this.metadataEquals(other.data)
    );
  }

  /**
   * Returns a string representation of the node info
   */
  toString(): string {
    return `NodeInfo(${this.id}, ${this.shape}, "${this.label}")`;
  }

  /**
   * Converts the node info to legacy JSON format for backward compatibility
   */
  toJSON(): {
    id: string;
    type: NodeType;
    label: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata: Record<string, string>;
  } {
    return {
      id: this.id,
      type: this.shape as NodeType, // shape and type are now the same
      label: this.label,
      position: this.position,
      width: this.size.width,
      height: this.size.height,
      metadata: this.getMetadataAsRecord(),
    };
  }

  /**
   * Validates the node info
   */
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

    if (!this.label || this.label.trim().length === 0) {
      throw new Error('Node label cannot be empty');
    }

    if (this.size.width <= 0 || this.size.height <= 0) {
      throw new Error('Node dimensions must be positive');
    }

    if (!Number.isFinite(this.size.width) || !Number.isFinite(this.size.height)) {
      throw new Error('Node dimensions must be finite numbers');
    }
  }

  /**
   * Checks if the given shape is a valid node type
   */
  private isValidNodeType(shape: string): shape is NodeType {
    return ['actor', 'process', 'store', 'security-boundary', 'text-box'].includes(shape);
  }

  /**
   * Checks if metadata arrays are equal
   */
  private metadataEquals(other: MetadataEntry[]): boolean {
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