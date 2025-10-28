/**
 * Custom History System Types
 *
 * Defines the data structures for our custom undo/redo history management.
 * History entries track changes at the cell level using the same format as
 * diagram operations (WebSocket Cell format).
 */

import { Cell } from '../../../core/types/websocket-message.types';

/**
 * Types of operations that can be tracked in history
 */
export type HistoryOperationType =
  | 'add-node' // User adds a new node
  | 'add-edge' // User creates a new edge
  | 'move-node' // User moves node(s) via drag
  | 'resize-node' // User resizes a node
  | 'change-vertices' // User adds/moves edge bend points
  | 'change-label' // User edits cell label text
  | 'change-properties' // User changes node/edge properties
  | 'change-edge-endpoint' // User reconnects edge source/target
  | 'embed-node' // User embeds node in security boundary
  | 'unembed-node' // User removes node from security boundary
  | 'delete' // User deletes cell(s)
  | 'batch' // Multiple operations grouped together
  | 'remote-operation'; // Remote change from collaboration (special case)

/**
 * History entry representing a single user action
 *
 * Each entry contains:
 * - The new state of affected cells (for redo)
 * - The previous state of affected cells (for undo)
 * - Metadata about the operation
 */
export interface HistoryEntry {
  /**
   * Unique identifier for this history entry
   */
  id: string;

  /**
   * Timestamp when the operation occurred
   */
  timestamp: number;

  /**
   * Type of operation that was performed
   */
  operationType: HistoryOperationType;

  /**
   * Human-readable description of the operation
   * Examples: "Add Process Node", "Move 3 Nodes", "Delete Actor"
   */
  description: string;

  /**
   * The new state of affected cells (for redo)
   * Uses WebSocket Cell format - same as diagram operations
   */
  cells: Cell[];

  /**
   * The previous state of affected cells (for undo)
   * Uses WebSocket Cell format - same as diagram operations
   */
  previousCells: Cell[];

  /**
   * User who performed the operation (if in collaboration mode)
   */
  userId?: string;

  /**
   * Operation ID from the graph operation system
   */
  operationId?: string;

  /**
   * Additional metadata about the operation
   */
  metadata?: {
    /**
     * Number of cells affected by this operation
     */
    affectedCellCount?: number;

    /**
     * Whether this operation was part of a batch
     */
    isBatchOperation?: boolean;

    /**
     * IDs of cells affected (for quick lookup)
     */
    affectedCellIds?: string[];

    /**
     * Any additional context-specific data
     */
    [key: string]: unknown;
  };
}

/**
 * Complete state of the history system
 */
export interface HistoryState {
  /**
   * Stack of operations that can be undone
   * Most recent operation is at the end of the array
   */
  undoStack: HistoryEntry[];

  /**
   * Stack of operations that can be redone
   * Most recently undone operation is at the end of the array
   */
  redoStack: HistoryEntry[];

  /**
   * Maximum number of entries to keep in each stack
   * Older entries are removed when limit is reached
   */
  maxStackSize: number;

  /**
   * Current position in the history
   * Used for tracking where we are in the undo/redo sequence
   */
  currentIndex: number;
}

/**
 * Configuration for the history service
 */
export interface HistoryConfig {
  /**
   * Maximum number of history entries to keep
   * Default: 50
   */
  maxHistorySize?: number;

  /**
   * Whether to enable history tracking
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Event emitted when history state changes
 */
export interface HistoryStateChangeEvent {
  /**
   * Whether undo is currently available
   */
  canUndo: boolean;

  /**
   * Whether redo is currently available
   */
  canRedo: boolean;

  /**
   * Number of entries in undo stack
   */
  undoStackSize: number;

  /**
   * Number of entries in redo stack
   */
  redoStackSize: number;

  /**
   * Timestamp of the state change
   */
  timestamp: number;
}

/**
 * Event emitted when a history operation completes
 */
export interface HistoryOperationEvent {
  /**
   * Type of operation (undo or redo)
   */
  operationType: 'undo' | 'redo' | 'add';

  /**
   * The history entry involved
   */
  entry: HistoryEntry;

  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Error message if operation failed
   */
  error?: string;

  /**
   * Timestamp of the operation
   */
  timestamp: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_HISTORY_CONFIG: Required<HistoryConfig> = {
  maxHistorySize: 50,
  enabled: true,
};

/**
 * Helper function to create an empty history state
 */
export function createEmptyHistoryState(maxStackSize: number = 50): HistoryState {
  return {
    undoStack: [],
    redoStack: [],
    maxStackSize,
    currentIndex: -1,
  };
}

/**
 * Helper function to generate a human-readable description from operation type and cell count
 */
export function generateHistoryDescription(
  operationType: HistoryOperationType,
  cellCount: number,
): string {
  const descriptions: Record<HistoryOperationType, (count: number) => string> = {
    'add-node': count => (count === 1 ? 'Add Node' : `Add ${count} Nodes`),
    'add-edge': count => (count === 1 ? 'Add Edge' : `Add ${count} Edges`),
    'move-node': count => (count === 1 ? 'Move Node' : `Move ${count} Nodes`),
    'resize-node': () => 'Resize Node',
    'change-vertices': () => 'Change Edge Vertices',
    'change-label': () => 'Change Label',
    'change-properties': count => (count === 1 ? 'Change Properties' : `Change ${count} Cells`),
    'change-edge-endpoint': () => 'Reconnect Edge',
    'embed-node': () => 'Embed Node',
    'unembed-node': () => 'Remove Node from Boundary',
    delete: count => (count === 1 ? 'Delete Cell' : `Delete ${count} Cells`),
    batch: count => `Batch Operation (${count} cells)`,
    'remote-operation': count =>
      count === 1 ? 'Remote Change' : `Remote Changes (${count} cells)`,
  };

  const generator = descriptions[operationType];
  return generator ? generator(cellCount) : 'Unknown Operation';
}
