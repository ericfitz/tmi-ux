/**
 * Core types for the new unified graph operation system
 */

import { Graph } from '@antv/x6';
import { Observable } from 'rxjs';
import { NodeInfo } from '../domain/value-objects/node-info';
import { EdgeInfo } from '../domain/value-objects/edge-info';

/**
 * Types of operations that can be performed on the graph
 */
export type GraphOperationType = 
  | 'create-node'
  | 'update-node' 
  | 'delete-node'
  | 'create-edge'
  | 'update-edge'
  | 'delete-edge'
  | 'batch-operation'
  | 'load-diagram';

/**
 * Source/context of the operation
 */
export type OperationSource = 
  | 'user-action'        // Direct user interaction
  | 'remote-collaboration' // WebSocket from other user
  | 'diagram-load'       // Loading saved diagram
  | 'undo-redo'         // History operation
  | 'auto-correction';   // System correction

/**
 * Priority level for operations
 */
export type OperationPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Base interface for all graph operations
 */
export interface GraphOperation {
  readonly id: string;
  readonly type: GraphOperationType;
  readonly source: OperationSource;
  readonly priority: OperationPriority;
  readonly timestamp: number;
  readonly userId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Node creation operation
 */
export interface CreateNodeOperation extends GraphOperation {
  readonly type: 'create-node';
  readonly nodeInfo: NodeInfo;
  readonly position?: { x: number; y: number };
  readonly parentNodeId?: string;
}

/**
 * Node update operation
 */
export interface UpdateNodeOperation extends GraphOperation {
  readonly type: 'update-node';
  readonly nodeId: string;
  readonly updates: Partial<NodeInfo>;
  readonly previousState?: Partial<NodeInfo>;
}

/**
 * Node deletion operation
 */
export interface DeleteNodeOperation extends GraphOperation {
  readonly type: 'delete-node';
  readonly nodeId: string;
  readonly nodeInfo?: NodeInfo; // For undo purposes
  readonly cascadeDeletes?: string[]; // IDs of edges that will be deleted
}

/**
 * Edge creation operation
 */
export interface CreateEdgeOperation extends GraphOperation {
  readonly type: 'create-edge';
  readonly edgeInfo: EdgeInfo;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourcePortId?: string;
  readonly targetPortId?: string;
}

/**
 * Edge update operation
 */
export interface UpdateEdgeOperation extends GraphOperation {
  readonly type: 'update-edge';
  readonly edgeId: string;
  readonly updates: Partial<EdgeInfo>;
  readonly previousState?: Partial<EdgeInfo>;
}

/**
 * Edge deletion operation
 */
export interface DeleteEdgeOperation extends GraphOperation {
  readonly type: 'delete-edge';
  readonly edgeId: string;
  readonly edgeInfo?: EdgeInfo; // For undo purposes
}

/**
 * Batch operation containing multiple sub-operations
 */
export interface BatchOperation extends GraphOperation {
  readonly type: 'batch-operation';
  readonly operations: GraphOperation[];
  readonly description?: string;
}

/**
 * Diagram loading operation
 */
export interface LoadDiagramOperation extends GraphOperation {
  readonly type: 'load-diagram';
  readonly diagramId: string;
  readonly diagramData: any;
  readonly clearExisting: boolean;
}

/**
 * Union type of all specific operation types
 */
export type SpecificGraphOperation = 
  | CreateNodeOperation
  | UpdateNodeOperation  
  | DeleteNodeOperation
  | CreateEdgeOperation
  | UpdateEdgeOperation
  | DeleteEdgeOperation
  | BatchOperation
  | LoadDiagramOperation;

/**
 * Result of executing a graph operation
 */
export interface OperationResult {
  readonly success: boolean;
  readonly operationId: string;
  readonly affectedCellIds: string[];
  readonly error?: string;
  readonly warnings?: string[];
  readonly undoOperation?: GraphOperation;
}

/**
 * Context for operation execution
 */
export interface OperationContext {
  readonly graph: Graph;
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly isCollaborating: boolean;
  readonly suppressHistory?: boolean;
  readonly suppressAutoSave?: boolean;
  readonly suppressVisualEffects?: boolean;
  readonly suppressValidation?: boolean;
}

/**
 * Validation result for operations
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly suggestions?: string[];
}

/**
 * Interface for operation validators
 */
export interface OperationValidator {
  validate(operation: GraphOperation, context: OperationContext): ValidationResult;
  canValidate(operation: GraphOperation): boolean;
}

/**
 * Interface for operation executors
 */
export interface OperationExecutor {
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;
  canExecute(operation: GraphOperation): boolean;
  readonly priority: number; // Higher priority executors run first
}

/**
 * Interface for operation interceptors (middleware)
 */
export interface OperationInterceptor {
  intercept(operation: GraphOperation, context: OperationContext): Observable<GraphOperation>;
  readonly priority: number; // Higher priority interceptors run first
}

/**
 * Configuration for operation processing
 */
export interface OperationConfig {
  readonly enableValidation: boolean;
  readonly enableHistory: boolean;
  readonly enableAutoSave: boolean;
  readonly enableVisualEffects: boolean;
  readonly enableCollaboration: boolean;
  readonly batchingEnabled: boolean;
  readonly batchingWindowMs: number;
  readonly maxBatchSize: number;
  readonly operationTimeoutMs: number;
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
}

/**
 * Default operation configuration
 */
export const DEFAULT_OPERATION_CONFIG: OperationConfig = {
  enableValidation: true,
  enableHistory: true,
  enableAutoSave: true,
  enableVisualEffects: true,
  enableCollaboration: true,
  batchingEnabled: true,
  batchingWindowMs: 100,
  maxBatchSize: 20,
  operationTimeoutMs: 30000,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Statistics about operation processing
 */
export interface OperationStats {
  readonly totalOperations: number;
  readonly successfulOperations: number;
  readonly failedOperations: number;
  readonly averageExecutionTimeMs: number;
  readonly operationsByType: Record<GraphOperationType, number>;
  readonly operationsBySource: Record<OperationSource, number>;
  readonly lastResetTime: Date;
}

/**
 * Event emitted when operation processing completes
 */
export interface OperationCompletedEvent {
  readonly operation: GraphOperation;
  readonly result: OperationResult;
  readonly context: OperationContext;
  readonly executionTimeMs: number;
}