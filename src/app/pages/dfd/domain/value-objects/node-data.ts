import { Point } from './point';

/**
 * Node types supported in the DFD diagram
 */
export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'textbox';

/**
 * Node data value object containing all properties of a diagram node
 */
export class NodeData {
  constructor(
    public readonly id: string,
    public readonly type: NodeType,
    public readonly label: string,
    public readonly position: Point,
    public readonly width: number,
    public readonly height: number,
    public readonly metadata: Record<string, string> = {},
  ) {
    this.validate();
  }

  /**
   * Creates NodeData from a plain object
   */
  static fromJSON(data: {
    id: string;
    type: NodeType;
    label: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata?: Record<string, string>;
  }): NodeData {
    return new NodeData(
      data.id,
      data.type,
      data.label,
      Point.fromJSON(data.position),
      data.width,
      data.height,
      data.metadata || {},
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
    return new NodeData(
      data.id,
      data.type,
      data.label,
      Point.fromJSON(data.position),
      data.width,
      data.height,
      data.metadata || {},
    );
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
      type,
      defaultLabel,
      position,
      defaultDimensions.width,
      defaultDimensions.height,
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
  withPosition(position: Point): NodeData {
    return new NodeData(
      this.id,
      this.type,
      this.label,
      position,
      this.width,
      this.height,
      this.metadata,
    );
  }

  /**
   * Creates a new NodeData with updated label
   */
  withLabel(label: string): NodeData {
    return new NodeData(
      this.id,
      this.type,
      label,
      this.position,
      this.width,
      this.height,
      this.metadata,
    );
  }

  /**
   * Creates a new NodeData with updated width
   */
  withWidth(width: number): NodeData {
    return new NodeData(
      this.id,
      this.type,
      this.label,
      this.position,
      width,
      this.height,
      this.metadata,
    );
  }

  /**
   * Creates a new NodeData with updated height
   */
  withHeight(height: number): NodeData {
    return new NodeData(
      this.id,
      this.type,
      this.label,
      this.position,
      this.width,
      height,
      this.metadata,
    );
  }

  /**
   * Creates a new NodeData with updated metadata
   */
  withMetadata(metadata: Record<string, string>): NodeData {
    return new NodeData(this.id, this.type, this.label, this.position, this.width, this.height, {
      ...this.metadata,
      ...metadata,
    });
  }

  /**
   * Gets the center point of the node
   */
  getCenter(): Point {
    return new Point(this.position.x + this.width / 2, this.position.y + this.height / 2);
  }

  /**
   * Gets the bounding box of the node
   */
  getBounds(): { topLeft: Point; bottomRight: Point } {
    return {
      topLeft: this.position,
      bottomRight: new Point(this.position.x + this.width, this.position.y + this.height),
    };
  }

  /**
   * Checks if this node data equals another node data
   */
  equals(other: NodeData): boolean {
    return (
      this.id === other.id &&
      this.type === other.type &&
      this.label === other.label &&
      this.position.equals(other.position) &&
      this.width === other.width &&
      this.height === other.height &&
      this.metadataEquals(other.metadata)
    );
  }

  /**
   * Returns a string representation of the node data
   */
  toString(): string {
    return `NodeData(${this.id}, ${this.type}, "${this.label}")`;
  }

  /**
   * Converts the node data to a plain object
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
      type: this.type,
      label: this.label,
      position: this.position.toJSON(),
      width: this.width,
      height: this.height,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Validates the node data
   */
  private validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Node ID cannot be empty');
    }

    if (!this.type) {
      throw new Error('Node type is required');
    }

    if (!this.isValidNodeType(this.type)) {
      throw new Error(`Invalid node type: ${String(this.type)}`);
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
  }

  /**
   * Checks if the given type is a valid node type
   */
  private isValidNodeType(type: string): type is NodeType {
    return ['actor', 'process', 'store', 'security-boundary', 'textbox'].includes(type);
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
