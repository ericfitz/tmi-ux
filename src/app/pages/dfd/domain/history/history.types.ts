import { Observable } from 'rxjs';
import { AnyDiagramCommand } from '../commands/diagram-commands';
import { Point } from '../value-objects/point';

/**
 * Represents an entry in the history stack
 */
export interface HistoryEntry {
  readonly id: string;
  readonly command: AnyDiagramCommand;
  readonly inverse: AnyDiagramCommand;
  readonly timestamp: number;
  readonly operationId: string;
  readonly author?: {
    readonly id: string;
    readonly name: string;
  };
}

/**
 * History stack interface
 */
export interface HistoryStack {
  readonly entries: ReadonlyArray<HistoryEntry>;
  readonly maxSize: number;
  readonly currentIndex: number;
}

/**
 * Operation types for tracking operation lifecycle
 */
export enum OperationType {
  DRAG = 'drag',
  RESIZE = 'resize',
  EDIT_LABEL = 'edit_label',
  EDIT_VERTICES = 'edit_vertices',
  ADD_NODE = 'add_node',
  ADD_EDGE = 'add_edge',
  DELETE = 'delete',
  BATCH = 'batch',
  UPDATE_DATA = 'update_data',
  UPDATE_POSITION = 'update_position',
}

/**
 * Operation state for tracking operation lifecycle
 */
export interface OperationState {
  readonly id: string;
  readonly type: OperationType;
  readonly startTime: number;
  readonly isActive: boolean;
  readonly isFinal: boolean;
  readonly data: OperationData;
}

/**
 * Operation data for tracking operation details
 */
export interface OperationData {
  readonly entityId?: string;
  readonly entityType?: 'node' | 'edge' | 'diagram';
  readonly startPosition?: { x: number; y: number };
  readonly currentPosition?: { x: number; y: number };
  readonly originalData?: unknown;
  readonly currentData?: unknown;
  readonly metadata?: Record<string, unknown>;
}

/**
 * History configuration options
 */
export interface HistoryConfig {
  readonly maxHistorySize: number;
  readonly cleanupThreshold: number;
  readonly enableCollaboration: boolean;
  readonly operationTimeout: number;
}

/**
 * History service interface
 */
export interface IHistoryService {
  // State queries
  readonly canUndo$: Observable<boolean>;
  readonly canRedo$: Observable<boolean>;
  readonly historySize$: Observable<number>;

  // Core operations
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;

  // History management
  clear(): void;
  getHistory(): ReadonlyArray<HistoryEntry>;

  // Internal operations (used by middleware)
  recordCommand(command: AnyDiagramCommand, inverse: AnyDiagramCommand, operationId: string): void;
  clearRedoStack(): void;

  // Collaboration support
  enableCollaborativeMode(): void;
  enableLocalOnlyMode(): void;
}

/**
 * Operation state tracker interface
 */
export interface IOperationStateTracker {
  // Operation lifecycle
  startOperation(operationId: string, type: OperationType, data?: OperationData): void;
  updateOperation(operationId: string, data: Partial<OperationData>): void;
  completeOperation(operationId: string): void;
  cancelOperation(operationId: string): void;

  // State queries
  isOperationActive(operationId: string): boolean;
  getOperationState(operationId: string): OperationState | null;

  // Final state detection
  isFinalState(operationId: string): boolean;

  // Cleanup
  cleanupExpiredOperations(): void;
}

/**
 * Inverse command factory interface
 */
export interface IInverseCommandFactory {
  createInverse<T extends AnyDiagramCommand>(
    command: T,
    beforeState: DiagramState,
  ): AnyDiagramCommand;

  canCreateInverse(command: AnyDiagramCommand): boolean;
  validateInverse(command: AnyDiagramCommand, inverse: AnyDiagramCommand): boolean;
}

/**
 * Diagram state interface for capturing state before command execution
 */
export interface DiagramState {
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly position: Point;
    readonly data: unknown;
  }>;
  readonly edges: ReadonlyArray<{
    readonly id: string;
    readonly sourceNodeId: string;
    readonly targetNodeId: string;
    readonly data: unknown;
  }>;
  readonly metadata: Record<string, unknown>;
}
