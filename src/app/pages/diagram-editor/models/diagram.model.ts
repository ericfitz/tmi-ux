/**
 * Models for diagram data structures based on the API schemas
 */

/**
 * Authorization model defining access permissions
 */
export interface DiagramAuthorization {
  subject: string;
  role: 'reader' | 'writer' | 'owner';
}

/**
 * Key-value pair for extensible metadata
 */
export interface DiagramMetadata {
  key: string;
  value: string;
}

/**
 * Anchor point positions for vertices
 */
export type AnchorPointPosition = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C';

/**
 * Anchor point interface
 */
export interface AnchorPoint {
  id: string;
  position: AnchorPointPosition;
  x: number; // Relative to vertex bounds (0-1)
  y: number; // Relative to vertex bounds (0-1)
}

/**
 * Element types for diagram cells
 */
export type DiagramElementType = 'vertex' | 'edge';

/**
 * Cell model for maxGraph cells
 */
export interface Cell {
  id: string;
  value?: string;
  geometry?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: string;
  vertex: boolean;
  edge: boolean;
  parent?: string;
  source?: string;
  target?: string;
}

/**
 * Main diagram model
 */
export interface Diagram {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  metadata?: DiagramMetadata[];
  graphData: Cell[];
  version?: number; // For tracking diagram versions
}

/**
 * Operation types for diagram changes
 */
export enum DiagramOperationType {
  ADD_CELL = 'ADD_CELL',
  UPDATE_CELL = 'UPDATE_CELL',
  DELETE_CELL = 'DELETE_CELL',
  UPDATE_DIAGRAM_PROPERTIES = 'UPDATE_DIAGRAM_PROPERTIES',
  BATCH_OPERATION = 'BATCH_OPERATION',
}

/**
 * Base interface for diagram operations
 */
export interface DiagramOperation {
  id: string; // Unique operation ID
  type: DiagramOperationType;
  timestamp: number;
  userId: string;
  diagramId: string;
  version?: number; // Target diagram version
}

/**
 * Operation for adding a cell
 */
export interface AddCellOperation extends DiagramOperation {
  type: DiagramOperationType.ADD_CELL;
  cell: Cell;
}

/**
 * Operation for updating a cell
 */
export interface UpdateCellOperation extends DiagramOperation {
  type: DiagramOperationType.UPDATE_CELL;
  cellId: string;
  changes: Partial<Cell>;
}

/**
 * Operation for deleting a cell
 */
export interface DeleteCellOperation extends DiagramOperation {
  type: DiagramOperationType.DELETE_CELL;
  cellId: string;
}

/**
 * Operation for updating diagram properties
 */
export interface UpdateDiagramPropertiesOperation extends DiagramOperation {
  type: DiagramOperationType.UPDATE_DIAGRAM_PROPERTIES;
  changes: Partial<Omit<Diagram, 'graphData'>>;
}

/**
 * Operation for batching multiple operations
 */
export interface BatchOperation extends DiagramOperation {
  type: DiagramOperationType.BATCH_OPERATION;
  operations: DiagramOperation[];
}

/**
 * Union type for all diagram operations
 */
export type DiagramOperationUnion =
  | AddCellOperation
  | UpdateCellOperation
  | DeleteCellOperation
  | UpdateDiagramPropertiesOperation
  | BatchOperation;
