import { Point } from './point';
import { NodeAttrs, createDefaultNodeAttrs } from './node-attrs';
import { PortConfiguration, createDefaultPortConfiguration } from './port-configuration';
import { Metadata } from './metadata';
import { MarkupElement, CellTool } from './x6-types';

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
  getCustomData(): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _metadata: _, ...customData } = this.data;
    return customData;
  }

  /**
   * Creates NodeInfo from a plain object
   */
  static fromJSON(data: {
    id: string;
    shape?: NodeType;
    type?: NodeType; // Legacy field
    x?: number;
    y?: number;
    position?: { x: number; y: number }; // Legacy field
    width?: number;
    height?: number;
    size?: { width: number; height: number }; // Legacy field
    label?: string; // Legacy field
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
    style?: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      fontSize?: number;
      fontColor?: string;
    };
  }): NodeInfo {
    const shape = data.shape || data.type || 'process';
    const x = data.x ?? data.position?.x ?? 0;
    const y = data.y ?? data.position?.y ?? 0;
    const width = data.width ?? data.size?.width ?? 120;
    const height = data.height ?? data.size?.height ?? 60;

    // Handle legacy label parameter and style convenience property
    let attrs = data.attrs;
    if (!attrs && data.label) {
      attrs = createDefaultNodeAttrs(shape, data.label);
    } else if (!attrs) {
      attrs = createDefaultNodeAttrs(shape);
    }

    // Apply style convenience properties if provided
    if (data.style && attrs) {
      attrs = {
        ...attrs,
        body: {
          ...attrs.body,
          ...(data.style.fill && { fill: data.style.fill }),
          ...(data.style.stroke && { stroke: data.style.stroke }),
          ...(data.style.strokeWidth !== undefined && { strokeWidth: data.style.strokeWidth }),
        },
        text: {
          ...attrs.text,
          ...(data.style.fontSize !== undefined && { fontSize: data.style.fontSize }),
          ...(data.style.fontColor && { fill: data.style.fontColor }),
        },
      };
    }

    const ports = data.ports || createDefaultPortConfiguration(shape);

    // Handle hybrid data format or legacy metadata
    let hybridData = data.data || { _metadata: [] };
    if (!data.data && data.metadata) {
      // Convert legacy metadata to hybrid format
      const metadataArray = Object.entries(data.metadata).map(([key, value]) => ({ key, value }));
      hybridData = { _metadata: metadataArray };
    }

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
   * Creates a new NodeInfo instance from a plain object.
   * This is a factory method for creating new instances.
   */
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
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
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
   * Gets default zIndex for a node type
   */
  private static getDefaultZIndex(type: NodeType): number {
    switch (type) {
      case 'security-boundary':
        return 1; // Security boundaries stay behind other nodes
      case 'text-box':
        return 20; // text-boxes appear above all other shapes
      default:
        return 10; // Default z-index for regular nodes (process, store, actor)
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
      this.markup,
      this.tools,
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
      newMetadata = metadata;
    } else {
      newMetadata = Object.entries(metadata).map(([key, value]) => ({ key, value }));
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
  toString(): string {
    return `NodeInfo(${this.id}, ${this.shape}, "${this.attrs?.text?.text || ''}")`;
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
    data: { [key: string]: any; _metadata: Metadata[] };
    angle: number;
    parent?: string | null;
    markup?: MarkupElement[];
    tools?: CellTool[];
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
      markup: this.markup,
      tools: this.tools,
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
  private _validateX6Properties(): void {
    // Validate markup structure
    if (this.markup) {
      this.markup.forEach((element, index) => {
        if (!element.tagName || typeof element.tagName !== 'string') {
          throw new Error(`Markup element at index ${index} must have a valid tagName`);
        }
        if (element.selector && typeof element.selector !== 'string') {
          throw new Error(`Markup element at index ${index} selector must be a string`);
        }
        if (element.attrs && typeof element.attrs !== 'object') {
          throw new Error(`Markup element at index ${index} attrs must be an object`);
        }
        if (element.children) {
          if (!Array.isArray(element.children)) {
            throw new Error(`Markup element at index ${index} children must be an array`);
          }
        }
      });
    }

    // Validate tools structure
    if (this.tools) {
      this.tools.forEach((tool, index) => {
        if (!tool.name || typeof tool.name !== 'string') {
          throw new Error(`Tool at index ${index} must have a valid name`);
        }
        if (tool.args && typeof tool.args !== 'object') {
          throw new Error(`Tool at index ${index} args must be an object`);
        }
      });
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
  private metadataEquals(other: { [key: string]: any; _metadata: Metadata[] }): boolean {
    const thisMetadata = this.metadata;
    const otherMetadata = other._metadata || [];

    if (thisMetadata.length !== otherMetadata.length) {
      return false;
    }

    // Sort both arrays by key for comparison
    const thisSorted = [...thisMetadata].sort((a, b) => a.key.localeCompare(b.key));
    const otherSorted = [...otherMetadata].sort((a, b) => a.key.localeCompare(b.key));

    // Check metadata equality
    const metadataEqual = thisSorted.every((entry, index) => {
      const otherEntry = otherSorted[index];
      return entry.key === otherEntry.key && entry.value === otherEntry.value;
    });

    // Check custom data equality (excluding _metadata)
    const thisCustomData = this.getCustomData();
    const otherCustomData = { ...other };
    delete (otherCustomData as any)._metadata;

    return metadataEqual && JSON.stringify(thisCustomData) === JSON.stringify(otherCustomData);
  }
}
