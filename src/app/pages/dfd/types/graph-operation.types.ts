/**
 * Core types for the new unified graph operation system
 */

import { Graph } from '@antv/x6';
import { Observable } from 'rxjs';
import { EdgeInfo } from '../domain/value-objects/edge-info';
import { EdgeLabel } from '../domain/value-objects/edge-label';
import { EdgeTerminal } from '../domain/value-objects/edge-terminal';
import { EdgeAttrs } from '../domain/value-objects/edge-attrs';
import { Point } from '../domain/value-objects/point';

/**
 * Types of operations that can be performed on the graph
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate all graph mutation operation types (pure)
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
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate originating contexts for a graph operation (pure)
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
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate scheduling priority levels for a graph operation (pure)
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
  readonly providerId?: string;
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
 * Update payload accepted by an {@link UpdateEdgeOperation}.
 *
 * This is intentionally NOT `Partial<EdgeInfo>`. The real contract is a flat,
 * facade-shaped payload spanning three consumers:
 *
 *  - `EdgeOperationExecutor._applyEdgeUpdates` applies every field below to
 *    the live X6 edge.
 *  - `EdgeOperationValidator.validateUpdateEdge` validates `source`, `target`,
 *    `labels`, and `attrs`.
 *  - `AppDfdOrchestratorService` inspects `labels`, `vertices`, `source`, and
 *    `target` to derive a history description / operation type.
 *
 * Endpoint reassignment accepts two mutually-exclusive forms: the flat
 * `sourceNodeId`/`sourcePort` (+ `targetNodeId`/`targetPort`) facade form, and
 * the `EdgeInfo`-shaped `source`/`target` terminal form. When both are present
 * the flat form wins.
 */
export interface EdgeUpdates {
  /** Singular label string (facade label changes). Replaces all edge labels. */
  readonly label?: string;
  /** Labels array (remote operations / history replay). */
  readonly labels?: EdgeLabel[];
  /** Line styling applied via `setAttrByPath`. */
  readonly style?: {
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly strokeDasharray?: string;
  };
  /** New source node id (flat endpoint reassignment). */
  readonly sourceNodeId?: string;
  /** New source port id; falls back to the edge's current source port. */
  readonly sourcePort?: string;
  /** New target node id (flat endpoint reassignment). */
  readonly targetNodeId?: string;
  /** New target port id; falls back to the edge's current target port. */
  readonly targetPort?: string;
  /** Edge `data` properties to shallow-merge onto the existing data. */
  readonly properties?: Record<string, unknown>;
  /** New edge path vertices, applied via `setVertices`. */
  readonly vertices?: Array<Point | { x: number; y: number }>;
  /** Source terminal (`EdgeInfo`-shaped endpoint reassignment). */
  readonly source?: EdgeTerminal;
  /** Target terminal (`EdgeInfo`-shaped endpoint reassignment). */
  readonly target?: EdgeTerminal;
  /** Edge attributes (X6 native), shallow-merged onto the existing attrs. */
  readonly attrs?: EdgeAttrs;
}

/**
 * Edge update operation
 */
export interface UpdateEdgeOperation extends GraphOperation {
  readonly type: 'update-edge';
  readonly edgeId: string;
  readonly updates: EdgeUpdates;
  // NOTE: `previousState` is not consumed by EdgeOperationExecutor (it captures
  // previous state from the live graph). Left as `Partial<EdgeInfo>` — see #707.
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
  readonly providerId: string;
  readonly isCollaborating: boolean;
  readonly permissions: string[];
  readonly lastOperationTime?: number;
  readonly sessionId?: string;
  readonly originProviderId?: string;
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
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a graph operation against the current execution context (pure)
  validate(operation: GraphOperation, context: OperationContext): ValidationResult;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether this validator handles the given operation type (pure)
  canValidate(operation: GraphOperation): boolean;
}

/**
 * Interface for operation executors
 */
export interface OperationExecutor {
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: execute a graph operation and return its result observable (mutates shared state)
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether this executor handles the given operation type (pure)
  canExecute(operation: GraphOperation): boolean;
  readonly priority: number; // Higher priority executors run first
}

/**
 * Interface for operation interceptors (middleware)
 */
export interface OperationInterceptor {
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: intercept and transform a graph operation before execution (pure)
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
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch the current operation manager configuration (pure)
  getConfiguration(): Partial<OperationConfig>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: update operation manager configuration settings (mutates shared state)
  configure(config: Partial<OperationConfig>): void;

  // Operation execution
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: execute a single graph operation via the manager (mutates shared state)
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: execute multiple graph operations as a batch (mutates shared state)
  executeBatch(
    operations: GraphOperation[],
    context: OperationContext,
  ): Observable<OperationResult[]>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a graph operation and return a boolean result observable (pure)
  validate(operation: GraphOperation, context: OperationContext): Observable<boolean>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether the manager can execute the given operation (pure)
  canExecute(operation: GraphOperation, context: OperationContext): boolean;

  // Executor management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register an operation executor with the manager (mutates shared state)
  addExecutor(executor: OperationExecutor): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: unregister an operation executor from the manager (mutates shared state)
  removeExecutor(executor: OperationExecutor): void;

  // Statistics and monitoring
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch accumulated operation processing statistics (pure)
  getStats(): OperationStats;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: clear accumulated operation processing statistics (mutates shared state)
  resetStats(): void;
  readonly operationCompleted$: Observable<OperationCompletedEvent>;

  // Pending operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether a given operation ID is currently pending (pure)
  isPending(operationId: string): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: list all currently pending graph operations (pure)
  getPendingOperations(): GraphOperation[];
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: cancel a pending graph operation by ID (mutates shared state)
  cancelOperation(operationId: string): boolean;

  // Cleanup
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: release all manager resources and cancel pending operations (mutates shared state)
  dispose(): void;
}
