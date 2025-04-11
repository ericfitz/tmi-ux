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
 * Diagram component types
 */
export type DiagramComponentType = 'vertex' | 'edge';

/**
 * Diagram component model (node, edge, etc.)
 */
export interface DiagramComponent {
  id: string;
  type: DiagramComponentType;
  data: Record<string, unknown>;
  metadata?: DiagramMetadata[];
  cellId?: string; // Reference to maxGraph cell ID
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
  owner: string;
  authorization: DiagramAuthorization[];
  metadata?: DiagramMetadata[];
  components: DiagramComponent[];
  version?: number; // For tracking diagram versions
}

/**
 * Operation types for diagram changes
 */
export enum DiagramOperationType {
  ADD_COMPONENT = 'ADD_COMPONENT',
  UPDATE_COMPONENT = 'UPDATE_COMPONENT',
  DELETE_COMPONENT = 'DELETE_COMPONENT',
  UPDATE_DIAGRAM_PROPERTIES = 'UPDATE_DIAGRAM_PROPERTIES',
  BATCH_OPERATION = 'BATCH_OPERATION'
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
 * Operation for adding a component
 */
export interface AddComponentOperation extends DiagramOperation {
  type: DiagramOperationType.ADD_COMPONENT;
  component: DiagramComponent;
}

/**
 * Operation for updating a component
 */
export interface UpdateComponentOperation extends DiagramOperation {
  type: DiagramOperationType.UPDATE_COMPONENT;
  componentId: string;
  changes: Partial<DiagramComponent>;
}

/**
 * Operation for deleting a component
 */
export interface DeleteComponentOperation extends DiagramOperation {
  type: DiagramOperationType.DELETE_COMPONENT;
  componentId: string;
}

/**
 * Operation for updating diagram properties
 */
export interface UpdateDiagramPropertiesOperation extends DiagramOperation {
  type: DiagramOperationType.UPDATE_DIAGRAM_PROPERTIES;
  changes: Partial<Omit<Diagram, 'components'>>;
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
  | AddComponentOperation
  | UpdateComponentOperation
  | DeleteComponentOperation
  | UpdateDiagramPropertiesOperation
  | BatchOperation;
