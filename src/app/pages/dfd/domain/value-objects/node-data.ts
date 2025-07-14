import { Point } from './point';
import { Node } from '@antv/x6';
import { X6NodeSnapshot } from '../../types/x6-cell.types';

/**
 * Node types supported in the DFD diagram
 */
export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'textbox';

/**
 * Metadata entry structure aligned with X6NodeSnapshot
 */
export interface MetadataEntry {
  key: string;
  value: string;
}

/**
 * Node data value object aligned with X6NodeSnapshot structure
 * This represents the domain model for diagram nodes with X6-compatible structure
 */
export class NodeData {
  constructor(
    public readonly id: string,
    public readonly shape: string, // X6 shape identifier (now serves as both shape and type)
    public readonly position: { x: number; y: number },
    public readonly size: { width: number; height: number },
    public readonly attrs: Node.Properties['attrs'] = { text: { text: '' } },
    public readonly ports: Node.Properties['ports'] = {},
    public readonly zIndex: number = 1,
    public readonly visible: boolean = true,
    public readonly data: MetadataEntry[] = [],
  ) {
    this.validate();
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
   * Creates NodeData from a plain object (supports both new and legacy formats)
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
  }): NodeData {
    // Handle legacy format
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

    return new NodeData(
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
   * Creates NodeData from legacy format for backward compatibility
   */
  static fromLegacyJSON(data: {
    id: string;
    type: NodeType;
    label: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata?: Record<string, string>;
  }): NodeData {
    const metadataEntries = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
      : [];

    return new NodeData(
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
   * Creates a new NodeData instance from a plain object.
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
  }): NodeData {
    return NodeData.fromLegacyJSON(data);
  }

  /**
   * Creates a default NodeData for the given type
   */
  static createDefault(
    id: string,
    type: NodeType,
    position: Point,
    translateFn?: (key: string) => string,
  ): NodeData {
    const defaultDimensions = this.getDefaultDimensions(type);
    const defaultLabel = this.getDefaultLabel(type, translateFn);

    return new NodeData(
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
      case 'textbox':
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
        case 'textbox':
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
      case 'textbox':
        return translateFn('editor.nodeLabels.textbox');
      default:
        return translateFn('editor.nodeLabels.node');
    }
  }

  /**
   * Creates a new NodeData with updated position
   */
  withPosition(position: Point | { x: number; y: number }): NodeData {
    const pos = position instanceof Point ? { x: position.x, y: position.y } : position;
    return new NodeData(
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
   * Creates a new NodeData with updated label
   */
  withLabel(label: string): NodeData {
    const currentTextAttr = this.attrs?.['text'];
    const newAttrs = {
      ...this.attrs,
      text: {
        ...(currentTextAttr && typeof currentTextAttr === 'object' ? currentTextAttr : {}),
        text: label,
      },
    };
    return new NodeData(
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
   * Creates a new NodeData with updated width
   */
  withWidth(width: number): NodeData {
    return new NodeData(
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
   * Creates a new NodeData with updated height
   */
  withHeight(height: number): NodeData {
    return new NodeData(
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
   * Creates a new NodeData with updated dimensions (width and height)
   */
  withDimensions(width: number, height: number): NodeData {
    return new NodeData(
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
   * Creates a new NodeData with updated metadata (accepts both formats)
   */
  withMetadata(metadata: Record<string, string> | MetadataEntry[]): NodeData {
    let newMetadata: MetadataEntry[];

    if (Array.isArray(metadata)) {
      // Already in correct format
      newMetadata = [...this.data, ...metadata];
    } else {
      // Convert from legacy Record format
      const additionalEntries = Object.entries(metadata).map(([key, value]) => ({ key, value }));
      newMetadata = [...this.data, ...additionalEntries];
    }

    return new NodeData(
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
   * Creates a new NodeData with updated attrs
   */
  withAttrs(attrs: Node.Properties['attrs']): NodeData {
    return new NodeData(
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
   * Checks if this node data equals another node data
   */
  equals(other: NodeData): boolean {
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
   * Returns a string representation of the node data
   */
  toString(): string {
    return `NodeData(${this.id}, ${this.shape}, "${this.label}")`;
  }

  /**
   * Converts the node data to X6NodeSnapshot format
   */
  toX6Snapshot(): X6NodeSnapshot {
    return {
      id: this.id,
      shape: this.shape,
      position: this.position,
      size: this.size,
      attrs: this.attrs,
      ports: this.ports,
      zIndex: this.zIndex,
      visible: this.visible,
      data: this.data,
    };
  }

  /**
   * Converts the node data to legacy JSON format for backward compatibility
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
   * Validates the node data
   */
  private validate(): void {
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
    return ['actor', 'process', 'store', 'security-boundary', 'textbox'].includes(shape);
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
