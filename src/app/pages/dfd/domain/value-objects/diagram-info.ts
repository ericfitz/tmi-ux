import { NodeInfo } from './node-info';
import { EdgeInfo } from './edge-info';
import { Metadata } from './metadata';

/**
 * Diagram type supported by the DFD component
 * Matches the OpenAPI specification diagram type enum
 */
export type DiagramType = 'DFD-1.0.0';

/**
 * Cell union type representing nodes or edges in the diagram
 * Matches the OpenAPI cells oneOf schema
 */
export type DiagramCell = NodeInfo | EdgeInfo;

/**
 * Diagram info value object representing the domain model for diagrams
 * This stores all properties and metadata for diagrams
 * Matches the OpenAPI Diagram schema structure
 */
export class DiagramInfo {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: DiagramType,
    public readonly createdAt: Date,
    public readonly modifiedAt: Date,
    public readonly description?: string,
    public readonly metadata: Metadata[] = [],
    public readonly cells: DiagramCell[] = [],
  ) {
    this._validate();
  }

  /**
   * Gets all nodes from the cells
   */
  get nodes(): NodeInfo[] {
    return this.cells.filter((cell): cell is NodeInfo => cell instanceof NodeInfo);
  }

  /**
   * Gets all edges from the cells
   */
  get edges(): EdgeInfo[] {
    return this.cells.filter((cell): cell is EdgeInfo => cell instanceof EdgeInfo);
  }

  /**
   * Creates DiagramInfo from a plain object (supports both new and legacy formats)
   */
  static fromJSON(data: {
    id: string;
    name: string;
    type: DiagramType;
    created_at?: string | Date;
    createdAt?: string | Date;
    modified_at?: string | Date;
    modifiedAt?: string | Date;
    description?: string;
    metadata?: Metadata[] | Record<string, string>;
    cells?: any[];
    nodes?: any[];
    edges?: any[];
  }): DiagramInfo {
    // Handle date parsing
    const createdAt = DiagramInfo.parseDate(data.created_at || data.createdAt);
    const modifiedAt = DiagramInfo.parseDate(data.modified_at || data.modifiedAt);

    // Handle metadata conversion
    let metadata: Metadata[] = [];
    if (data.metadata) {
      if (Array.isArray(data.metadata)) {
        metadata = data.metadata;
      } else {
        metadata = Object.entries(data.metadata).map(([key, value]) => ({ key, value }));
      }
    }

    // Handle cells conversion
    let cells: DiagramCell[] = [];
    if (data.cells) {
      cells = data.cells.map(cellData => {
        // Check if it's a node or edge based on structure
        if (cellData.source && cellData.target) {
          // It's an edge
          return EdgeInfo.fromJSON(cellData);
        } else if (cellData.shape && cellData.x !== undefined && cellData.y !== undefined) {
          // It's a node
          return NodeInfo.fromJSON(cellData);
        } else {
          throw new Error(`Invalid cell data: ${JSON.stringify(cellData)}`);
        }
      });
    } else if (data.nodes || data.edges) {
      // Legacy format with separate nodes and edges arrays
      const nodes = (data.nodes || []).map(nodeData => NodeInfo.fromJSON(nodeData));
      const edges = (data.edges || []).map(edgeData => EdgeInfo.fromJSON(edgeData));
      cells = [...nodes, ...edges];
    }

    return new DiagramInfo(
      data.id,
      data.name,
      data.type,
      createdAt,
      modifiedAt,
      data.description,
      metadata,
      cells,
    );
  }

  /**
   * Creates DiagramInfo from legacy format for backward compatibility
   */
  static fromLegacyJSON(data: {
    id: string;
    name: string;
    description?: string;
    nodes: any[];
    edges: any[];
    metadata?: Record<string, string>;
  }): DiagramInfo {
    const now = new Date();
    const nodes = data.nodes.map(nodeData => NodeInfo.fromLegacyJSON(nodeData));
    const edges = data.edges.map(edgeData => EdgeInfo.fromLegacyJSON(edgeData));
    const cells: DiagramCell[] = [...nodes, ...edges];

    const metadata: Metadata[] = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
      : [];

    return new DiagramInfo(
      data.id,
      data.name,
      'DFD-1.0.0',
      now,
      now,
      data.description,
      metadata,
      cells,
    );
  }

  /**
   * Creates a default DiagramInfo
   */
  static createDefault(
    id: string,
    name: string,
    description?: string,
  ): DiagramInfo {
    const now = new Date();
    return new DiagramInfo(
      id,
      name,
      'DFD-1.0.0',
      now,
      now,
      description,
      [],
      [],
    );
  }

  /**
   * Helper method to parse date from string or Date object
   */
  private static parseDate(dateInput: string | Date | undefined): Date {
    if (!dateInput) {
      return new Date();
    }

    if (dateInput instanceof Date) {
      return dateInput;
    }

    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${dateInput}`);
    }

    return parsed;
  }

  /**
   * Creates a new DiagramInfo with updated name
   */
  withName(name: string): DiagramInfo {
    return new DiagramInfo(
      this.id,
      name,
      this.type,
      this.createdAt,
      new Date(),
      this.description,
      this.metadata,
      this.cells,
    );
  }

  /**
   * Creates a new DiagramInfo with updated description
   */
  withDescription(description: string): DiagramInfo {
    return new DiagramInfo(
      this.id,
      this.name,
      this.type,
      this.createdAt,
      new Date(),
      description,
      this.metadata,
      this.cells,
    );
  }

  /**
   * Creates a new DiagramInfo with updated metadata
   */
  withMetadata(metadata: Metadata[] | Record<string, string>): DiagramInfo {
    let newMetadata: Metadata[];

    if (Array.isArray(metadata)) {
      newMetadata = metadata;
    } else {
      newMetadata = Object.entries(metadata).map(([key, value]) => ({ key, value }));
    }

    return new DiagramInfo(
      this.id,
      this.name,
      this.type,
      this.createdAt,
      new Date(),
      this.description,
      newMetadata,
      this.cells,
    );
  }

  /**
   * Creates a new DiagramInfo with updated cells
   */
  withCells(cells: DiagramCell[]): DiagramInfo {
    return new DiagramInfo(
      this.id,
      this.name,
      this.type,
      this.createdAt,
      new Date(),
      this.description,
      this.metadata,
      cells,
    );
  }

  /**
   * Creates a new DiagramInfo with an added node
   */
  withAddedNode(node: NodeInfo): DiagramInfo {
    const newCells = [...this.cells, node];
    return this.withCells(newCells);
  }

  /**
   * Creates a new DiagramInfo with an added edge
   */
  withAddedEdge(edge: EdgeInfo): DiagramInfo {
    const newCells = [...this.cells, edge];
    return this.withCells(newCells);
  }

  /**
   * Creates a new DiagramInfo with a removed cell (node or edge)
   */
  withRemovedCell(cellId: string): DiagramInfo {
    const newCells = this.cells.filter(cell => cell.id !== cellId);
    return this.withCells(newCells);
  }

  /**
   * Creates a new DiagramInfo with an updated cell (node or edge)
   */
  withUpdatedCell(updatedCell: DiagramCell): DiagramInfo {
    const newCells = this.cells.map(cell => 
      cell.id === updatedCell.id ? updatedCell : cell
    );
    return this.withCells(newCells);
  }

  /**
   * Gets a specific node by ID
   */
  getNode(nodeId: string): NodeInfo | undefined {
    return this.nodes.find(node => node.id === nodeId);
  }

  /**
   * Gets a specific edge by ID
   */
  getEdge(edgeId: string): EdgeInfo | undefined {
    return this.edges.find(edge => edge.id === edgeId);
  }

  /**
   * Gets a specific cell (node or edge) by ID
   */
  getCell(cellId: string): DiagramCell | undefined {
    return this.cells.find(cell => cell.id === cellId);
  }

  /**
   * Gets all edges connected to a specific node
   */
  getEdgesConnectedToNode(nodeId: string): EdgeInfo[] {
    return this.edges.filter(edge => edge.connectsToNode(nodeId));
  }

  /**
   * Gets metadata as Record for backward compatibility
   */
  getMetadataAsRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    this.metadata.forEach(entry => {
      record[entry.key] = entry.value;
    });
    return record;
  }

  /**
   * Gets diagram statistics
   */
  getStatistics(): {
    nodeCount: number;
    edgeCount: number;
    totalCells: number;
    nodeTypes: Record<string, number>;
  } {
    const nodeTypes: Record<string, number> = {};
    this.nodes.forEach(node => {
      nodeTypes[node.shape] = (nodeTypes[node.shape] || 0) + 1;
    });

    return {
      nodeCount: this.nodes.length,
      edgeCount: this.edges.length,
      totalCells: this.cells.length,
      nodeTypes,
    };
  }

  /**
   * Checks if this diagram equals another diagram
   */
  equals(other: DiagramInfo): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.type === other.type &&
      this.description === other.description &&
      this.createdAt.getTime() === other.createdAt.getTime() &&
      this.modifiedAt.getTime() === other.modifiedAt.getTime() &&
      this.metadataEquals(other.metadata) &&
      this.cellsEquals(other.cells)
    );
  }

  /**
   * Returns a string representation of the diagram
   */
  toString(): string {
    const stats = this.getStatistics();
    return `DiagramInfo(${this.id}, "${this.name}", ${String(stats.nodeCount)} nodes, ${String(stats.edgeCount)} edges)`;
  }

  /**
   * Converts to OpenAPI-compliant JSON format
   */
  toJSON(): {
    id: string;
    name: string;
    type: DiagramType;
    created_at: string;
    modified_at: string;
    description?: string;
    metadata: Metadata[];
    cells: any[];
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      created_at: this.createdAt.toISOString(),
      modified_at: this.modifiedAt.toISOString(),
      description: this.description,
      metadata: this.metadata,
      cells: this.cells.map(cell => cell.toJSON()),
    };
  }

  /**
   * Converts to legacy JSON format for backward compatibility
   */
  toLegacyJSON(): {
    id: string;
    name: string;
    description?: string;
    nodes: any[];
    edges: any[];
    metadata: Record<string, string>;
  } {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nodes: this.nodes.map(node => node.toLegacyJSON()),
      edges: this.edges.map(edge => edge.toLegacyJSON()),
      metadata: this.getMetadataAsRecord(),
    };
  }

  /**
   * Validates the diagram info
   */
  private _validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Diagram ID cannot be empty');
    }

    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Diagram name cannot be empty');
    }

    if (!this.type) {
      throw new Error('Diagram type is required');
    }

    if (this.type !== 'DFD-1.0.0') {
      throw new Error(`Invalid diagram type: ${String(this.type)}`);
    }


    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      throw new Error('Created date must be a valid Date object');
    }

    if (!(this.modifiedAt instanceof Date) || isNaN(this.modifiedAt.getTime())) {
      throw new Error('Modified date must be a valid Date object');
    }

    if (this.modifiedAt < this.createdAt) {
      throw new Error('Modified date cannot be before created date');
    }

    // Validate no duplicate cell IDs
    const cellIds = new Set<string>();
    this.cells.forEach(cell => {
      if (cellIds.has(cell.id)) {
        throw new Error(`Duplicate cell ID found: ${cell.id}`);
      }
      cellIds.add(cell.id);
    });

    // Validate edge references exist
    this.edges.forEach(edge => {
      const sourceExists = this.nodes.some(node => node.id === edge.sourceNodeId);
      const targetExists = this.nodes.some(node => node.id === edge.targetNodeId);

      if (!sourceExists) {
        throw new Error(`Edge ${edge.id} references non-existent source node: ${edge.sourceNodeId}`);
      }
      if (!targetExists) {
        throw new Error(`Edge ${edge.id} references non-existent target node: ${edge.targetNodeId}`);
      }
    });
  }


  /**
   * Checks if metadata arrays are equal
   */
  private metadataEquals(other: Metadata[]): boolean {
    if (this.metadata.length !== other.length) {
      return false;
    }

    // Sort both arrays by key for comparison
    const thisSorted = [...this.metadata].sort((a, b) => a.key.localeCompare(b.key));
    const otherSorted = [...other].sort((a, b) => a.key.localeCompare(b.key));

    return thisSorted.every((entry, index) => {
      const otherEntry = otherSorted[index];
      return entry.key === otherEntry.key && entry.value === otherEntry.value;
    });
  }

  /**
   * Checks if cells arrays are equal
   */
  private cellsEquals(other: DiagramCell[]): boolean {
    if (this.cells.length !== other.length) {
      return false;
    }

    // Sort both arrays by ID for comparison
    const thisSorted = [...this.cells].sort((a, b) => a.id.localeCompare(b.id));
    const otherSorted = [...other].sort((a, b) => a.id.localeCompare(b.id));

    return thisSorted.every((cell, index) => {
      const otherCell = otherSorted[index];
      return cell.equals(otherCell);
    });
  }
}