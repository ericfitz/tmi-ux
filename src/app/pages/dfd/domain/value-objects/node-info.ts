import { Point } from './point';
import { NodeAttrs, createDefaultNodeAttrs } from './node-attrs';
import { PortConfiguration, createDefaultPortConfiguration } from './port-configuration';
import { Metadata } from './metadata';

/**
 * Node types supported in the DFD diagram
 * Matches the OpenAPI specification node shape enum
 */
export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'text-box';

/**
 * Node info value object representing the domain model for diagram nodes
 * This stores all properties and metadata for diagram nodes
 * Matches the OpenAPI Node schema structure
 */
export class NodeInfo {
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
    public readonly data: Metadata[] = [],
    public readonly angle: number = 0,
    public readonly parent?: string | null,
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
   * Gets the position as a Point object for backward compatibility
   */
  get position(): Point {
    return new Point(this.x, this.y);
  }

  /**
   * Gets the size as an object for backward compatibility
   */
  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Gets the label from attrs.text.text for backward compatibility
   */
  get label(): string {
    const textAttr = this.attrs?.text;
    return textAttr?.text || '';
  }

  /**
   * Creates NodeInfo from a plain object (supports both new and legacy formats)
   */
  static fromJSON(data: {
    id: string;
    shape?: NodeType;
    type?: NodeType;
    x?: number;
    y?: number;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    size?: { width: number; height: number };
    label?: string;
    attrs?: NodeAttrs;
    ports?: PortConfiguration;
    zIndex?: number;
    visible?: boolean;
    angle?: number;
    parent?: string | null;
    data?: Metadata[];
    metadata?: Metadata[] | Record<string, string>;
  }): NodeInfo {
    // Handle both new OpenAPI format and legacy format
    const shape = (data.shape || data.type || 'process');
    const x = data.x ?? data.position?.x ?? 0;
    const y = data.y ?? data.position?.y ?? 0;
    const width = data.width ?? data.size?.width ?? 120;
    const height = data.height ?? data.size?.height ?? 60;
    
    // Handle attrs - if label provided, use it; otherwise use existing attrs or create default
    let attrs: NodeAttrs;
    if (data.attrs) {
      attrs = data.attrs;
      if (data.label && attrs.text) {
        attrs = { ...attrs, text: { ...attrs.text, text: data.label } };
      }
    } else {
      attrs = createDefaultNodeAttrs(shape, data.label);
    }

    // Handle ports
    const ports = data.ports || createDefaultPortConfiguration(shape);

    // Convert metadata if it's in legacy Record format
    let metadata: Metadata[] = [];
    const metadataSource = data.data || data.metadata;
    if (metadataSource) {
      if (Array.isArray(metadataSource)) {
        metadata = metadataSource;
      } else {
        metadata = Object.entries(metadataSource).map(([key, value]) => ({ key, value }));
      }
    }

    return new NodeInfo(
      data.id,
      shape,
      x,
      y,
      width,
      height,
      data.zIndex ?? 1,
      data.visible ?? true,
      attrs,
      ports,
      metadata,
      data.angle ?? 0,
      data.parent,
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
      data.type,
      data.position.x,
      data.position.y,
      data.width,
      data.height,
      1,
      true,
      createDefaultNodeAttrs(data.type, data.label),
      createDefaultPortConfiguration(data.type),
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
      type,
      position.x,
      position.y,
      defaultDimensions.width,
      defaultDimensions.height,
      1,
      true,
      createDefaultNodeAttrs(type, defaultLabel),
      createDefaultPortConfiguration(type),
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
    );
  }

  /**
   * Creates a new NodeInfo with updated width
   */
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
  withMetadata(metadata: Record<string, string> | Metadata[]): NodeInfo {
    let newMetadata: Metadata[];

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
      this.x,
      this.y,
      this.width,
      this.height,
      this.zIndex,
      this.visible,
      this.attrs,
      this.ports,
      newMetadata,
      this.angle,
      this.parent,
    );
  }

  /**
   * Creates a new NodeInfo with updated attrs
   */
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
    );
  }

  /**
   * Creates a new NodeInfo with updated angle
   */
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
    );
  }

  /**
   * Creates a new NodeInfo with updated parent
   */
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
    );
  }

  /**
   * Gets the center point of the node
   */
  getCenter(): Point {
    return new Point(this.x + this.width / 2, this.y + this.height / 2);
  }

  /**
   * Gets the bounding box of the node
   */
  getBounds(): { topLeft: Point; bottomRight: Point } {
    return {
      topLeft: new Point(this.x, this.y),
      bottomRight: new Point(this.x + this.width, this.y + this.height),
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
  toString(): string {
    return `NodeInfo(${this.id}, ${this.shape}, "${this.label}")`;
  }

  /**
   * Converts to OpenAPI-compliant JSON format
   */
  toJSON(): {
    id: string;
    shape: NodeType;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    visible: boolean;
    attrs: NodeAttrs;
    ports: PortConfiguration;
    data: Metadata[];
    angle: number;
    parent?: string | null;
  } {
    return {
      id: this.id,
      shape: this.shape,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      zIndex: this.zIndex,
      visible: this.visible,
      attrs: this.attrs,
      ports: this.ports,
      data: this.data,
      angle: this.angle,
      parent: this.parent,
    };
  }

  /**
   * Converts to legacy JSON format for backward compatibility
   */
  toLegacyJSON(): {
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
      type: this.shape,
      label: this.label,
      position: { x: this.x, y: this.y },
      width: this.width,
      height: this.height,
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