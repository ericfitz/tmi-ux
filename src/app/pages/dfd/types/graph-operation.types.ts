/**
 * Core types for the new unified graph operation system
 */

import { Graph } from '@antv/x6';
import { Observable } from 'rxjs';
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
  | 'user-interaction' // Direct user interaction
  | 'remote-collaboration' // WebSocket from other user
  | 'diagram-load' // Loading saved diagram
  | 'undo-redo' // History operation
  | 'auto-correction' // System correction
  | 'test'; // Test operations

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
  readonly includeInHistory?: boolean;
}

/**
 * Node data for creation operations
 */
export interface NodeData {
  readonly id?: string;
  readonly nodeType: string;
  readonly position?: { x: number; y: number };
  readonly size?: { width: number; height: number };
  readonly label?: string;
  readonly style?: Record<string, any>;
  readonly properties?: Record<string, any>;
}

/**
 * Node creation operation
 */
export interface CreateNodeOperation extends GraphOperation {
  readonly type: 'create-node';
  readonly nodeData: NodeData;
}

/**
 * Node update operation
 */
export interface UpdateNodeOperation extends GraphOperation {
  readonly type: 'update-node';
  readonly nodeId: string;
  readonly updates: Partial<NodeData>;
  readonly previousState?: Partial<NodeData>;
}

/**
 * Node deletion operation
 */
export interface DeleteNodeOperation extends GraphOperation {
  readonly type: 'delete-node';
  readonly nodeId: string;
  readonly nodeData?: NodeData; // For undo purposes
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
  readonly operationId?: string;
  readonly operationType: GraphOperationType;
  readonly affectedCellIds: string[];
  readonly timestamp: number;
  readonly error?: string;
  readonly warnings?: string[];
  readonly metadata?: Record<string, any>;
  readonly undoOperation?: GraphOperation;
  readonly previousState?: import('../../../core/types/websocket-message.types').Cell[]; // State before operation
  readonly currentState?: import('../../../core/types/websocket-message.types').Cell[]; // State after operation
}

/**
 * Context for operation execution
 */
export interface OperationContext {
  readonly graph: Graph;
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly userId: string;
  readonly isCollaborating: boolean;
  readonly permissions: string[];
  readonly lastOperationTime?: number;
  readonly sessionId?: string;
  readonly originUserId?: string;
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

/**
 * Graph operation manager interface
 */
export interface IGraphOperationManager {
  // Configuration
  getConfiguration(): Partial<OperationConfig>;
  configure(config: Partial<OperationConfig>): void;

  // Operation execution
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;
  executeBatch(
    operations: GraphOperation[],
    context: OperationContext,
  ): Observable<OperationResult[]>;
  validate(operation: GraphOperation, context: OperationContext): Observable<boolean>;
  canExecute(operation: GraphOperation, context: OperationContext): boolean;

  // Executor management
  addExecutor(executor: OperationExecutor): void;
  removeExecutor(executor: OperationExecutor): void;

  // Statistics and monitoring
  getStats(): OperationStats;
  resetStats(): void;
  readonly operationCompleted$: Observable<OperationCompletedEvent>;

  // Pending operations
  isPending(operationId: string): boolean;
  getPendingOperations(): GraphOperation[];
  cancelOperation(operationId: string): boolean;

  // Cleanup
  dispose(): void;
}
