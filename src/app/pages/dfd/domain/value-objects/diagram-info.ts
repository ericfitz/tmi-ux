import { NodeInfo } from './node-info';
import { EdgeInfo } from './edge-info';
import { Metadata, metadataToRecord, safeMetadataEntry } from './metadata';

/**
 * Diagram type supported by the DFD component
 * Matches the OpenAPI specification diagram type enum
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: type alias constraining diagram type to the supported DFD version string (pure)
export type DiagramType = 'DFD-1.0.0';

/**
 * Cell union type representing nodes or edges in the diagram
 * Matches the OpenAPI cells oneOf schema
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: union type representing any diagram cell as a node or edge (pure)
export type DiagramCell = NodeInfo | EdgeInfo;

/**
 * Diagram info value object representing the domain model for diagrams
 * This stores all properties and metadata for diagrams
 * Matches the OpenAPI Diagram schema structure
 */
// SEM@b543ab1383d78680d661e0dbb798e85a61258e1d: value object holding all metadata and cells for a DFD diagram (pure)
export class DiagramInfo {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a validated diagram info from id, name, type, timestamps, and cells (pure)
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
  // SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: deserialize a diagram from a plain object, supporting legacy field names (pure)
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
        metadata = Object.entries(data.metadata).map(([key, value]) =>
          safeMetadataEntry(key, value, 'DiagramInfo.fromJSON'),
        );
      }
    }

    // Handle cells conversion
    const cells: DiagramCell[] = (data.cells || []).map(cellData => {
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
   * Creates a default DiagramInfo
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: build a new empty diagram with default type and current timestamps (pure)
  static createDefault(id: string, name: string, description?: string): DiagramInfo {
    const now = new Date();
    return new DiagramInfo(id, name, 'DFD-1.0.0', now, now, description, [], []);
  }

  /**
   * Helper method to parse date from string or Date object
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: convert a date string or Date to a validated Date object (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a new diagram with a replaced name and updated modified timestamp (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a new diagram with a replaced description and updated modified timestamp (pure)
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
  // SEM@3da38c2fadc977d37ce81cd8ad2a39fca34c9b91: build a new diagram with replaced metadata, accepting array or record form (pure)
  withMetadata(metadata: Metadata[] | Record<string, string>): DiagramInfo {
    let newMetadata: Metadata[];

    if (Array.isArray(metadata)) {
      newMetadata = metadata;
    } else {
      newMetadata = Object.entries(metadata).map(([key, value]) =>
        safeMetadataEntry(key, value, 'DiagramInfo.withMetadata'),
      );
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a new diagram with a replaced cells collection and updated modified timestamp (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a new diagram with the given node appended to cells (pure)
  withAddedNode(node: NodeInfo): DiagramInfo {
    const newCells = [...this.cells, node];
    return this.withCells(newCells);
  }

  /**
   * Creates a new DiagramInfo with an added edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a new diagram with the given edge appended to cells (pure)
  withAddedEdge(edge: EdgeInfo): DiagramInfo {
    const newCells = [...this.cells, edge];
    return this.withCells(newCells);
  }

  /**
   * Creates a new DiagramInfo with a removed cell (node or edge)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a new diagram with the identified cell removed from cells (pure)
  withRemovedCell(cellId: string): DiagramInfo {
    const newCells = this.cells.filter(cell => cell.id !== cellId);
    return this.withCells(newCells);
  }

  /**
   * Creates a new DiagramInfo with an updated cell (node or edge)
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: build a new diagram with a matching cell replaced by the updated cell (pure)
  withUpdatedCell(updatedCell: DiagramCell): DiagramInfo {
    const newCells = this.cells.map(cell => (cell.id === updatedCell.id ? updatedCell : cell));
    return this.withCells(newCells);
  }

  /**
   * Gets a specific node by ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a node by ID from the diagram's node collection (pure)
  getNode(nodeId: string): NodeInfo | undefined {
    return this.nodes.find(node => node.id === nodeId);
  }

  /**
   * Gets a specific edge by ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch an edge by ID from the diagram's edge collection (pure)
  getEdge(edgeId: string): EdgeInfo | undefined {
    return this.edges.find(edge => edge.id === edgeId);
  }

  /**
   * Gets a specific cell (node or edge) by ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a cell by ID from the diagram's cells collection (pure)
  getCell(cellId: string): DiagramCell | undefined {
    return this.cells.find(cell => cell.id === cellId);
  }

  /**
   * Gets all edges connected to a specific node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: filter edges whose source or target connects to the given node (pure)
  getEdgesConnectedToNode(nodeId: string): EdgeInfo[] {
    return this.edges.filter(edge => edge.connectsToNode(nodeId));
  }

  /**
   * Gets metadata as Record for backward compatibility
   */
  // SEM@b543ab1383d78680d661e0dbb798e85a61258e1d: convert diagram metadata array to a key-value record for backward compatibility (pure)
  getMetadataAsRecord(): Record<string, string> {
    return metadataToRecord(this.metadata);
  }

  /**
   * Gets diagram statistics
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute node count, edge count, and shape-type breakdown for the diagram (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare two diagrams for deep value equality across all fields (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: format a concise human-readable summary of the diagram (pure)
  toString(): string {
    const stats = this.getStatistics();
    return `DiagramInfo(${this.id}, "${this.name}", ${String(stats.nodeCount)} nodes, ${String(stats.edgeCount)} edges)`;
  }

  /**
   * Converts to OpenAPI-compliant JSON format
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: serialize diagram to an OpenAPI-compliant plain object with ISO date strings (pure)
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
   * Validates the diagram info
   */
  // SEM@a31ab2e4c978de326750079b6beb589924901b63: validate diagram fields, cell ID uniqueness, and edge node references; throw on violation (pure)
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
      const sourceExists = this.nodes.some(node => node.id === edge.source.cell);
      const targetExists = this.nodes.some(node => node.id === edge.target.cell);

      if (!sourceExists) {
        throw new Error(`Edge ${edge.id} references non-existent source node: ${edge.source.cell}`);
      }
      if (!targetExists) {
        throw new Error(`Edge ${edge.id} references non-existent target node: ${edge.target.cell}`);
      }
    });
  }

  /**
   * Checks if metadata arrays are equal
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare two metadata arrays for key-value equality regardless of order (pure)
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
  // SEM@4f53f09335e39c83f6b6fd99484ff29dfe1bdeab: compare two cell collections for deep equality by ID-sorted pair matching (pure)
  private cellsEquals(other: DiagramCell[]): boolean {
    if (this.cells.length !== other.length) {
      return false;
    }

    // Sort both arrays by ID for comparison
    const thisSorted = [...this.cells].sort((a, b) => a.id.localeCompare(b.id));
    const otherSorted = [...other].sort((a, b) => a.id.localeCompare(b.id));

    return thisSorted.every((cell, index) => {
      const otherCell = otherSorted[index];
      // Ensure both cells are of the same type before comparing
      if (cell.shape !== otherCell.shape) {
        return false;
      }
      return cell.equals(otherCell as any);
    });
  }
}
