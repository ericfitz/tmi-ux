/**
 * Interface for the DFD orchestrator
 * Coordinates all high-level DFD operations and component interactions
 */

import { Observable } from 'rxjs';
import { Graph } from '@antv/x6';
import { GraphOperation, OperationResult } from '../types/graph-operation.types';
import { SaveResult, LoadResult } from '../types/persistence.types';
import { AutoSaveState } from '../types/auto-save.types';

/**
 * DFD initialization parameters
 */
export interface DfdInitializationParams {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly containerElement: HTMLElement;
  readonly collaborationEnabled?: boolean;
  readonly readOnly?: boolean;
  readonly autoSaveMode?: string;
}

/**
 * DFD state information
 */
export interface DfdState {
  readonly initialized: boolean;
  readonly loading: boolean;
  readonly collaborating: boolean;
  readonly readOnly: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly lastSaved: Date | null;
  readonly error: string | null;
}

/**
 * DFD operation statistics
 */
export interface DfdOperationStats {
  readonly totalOperations: number;
  readonly operationsPerMinute: number;
  readonly averageResponseTime: number;
  readonly errorRate: number;
  readonly collaborativeOperations: number;
  readonly autoSaves: number;
}

/**
 * Main interface for the DFD orchestrator
 * Provides high-level coordination of all DFD functionality
 */
export interface IDfdOrchestrator {
  // Lifecycle management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build and wire the DFD graph into the given container element
  initialize(params: DfdInitializationParams): Observable<boolean>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: tear down the DFD orchestrator and release all resources
  destroy(): Observable<void>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: clear the diagram and return orchestrator to post-init state
  reset(): Observable<void>;

  // Core operations - unified interface for all graph operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch a single graph operation and return its result
  executeOperation(operation: GraphOperation): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch multiple graph operations atomically and return results
  executeBatch(operations: GraphOperation[]): Observable<OperationResult[]>;

  // High-level user actions
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a node of the given type at an optional position on the diagram
  addNode(nodeType: string, position?: { x: number; y: number }): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: delete all currently selected diagram cells
  deleteSelectedCells(): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: duplicate all currently selected diagram cells
  duplicateSelectedCells(): Observable<OperationResult>;

  // Persistence operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: persist the diagram immediately on user request
  saveManually(): Observable<SaveResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch the diagram from persistence and render it into the graph
  loadDiagram(force?: boolean): Observable<LoadResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: export the diagram as an image blob in the requested format
  exportDiagram(format: 'png' | 'jpeg' | 'svg'): Observable<Blob>;

  // History operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: reverse the most recent diagram operation via history
  undo(): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: reapply the most recently undone diagram operation via history
  redo(): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return whether an undo operation is available (pure)
  canUndo(): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return whether a redo operation is available (pure)
  canRedo(): boolean;

  // Selection operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: select all cells in the diagram (mutates shared state)
  selectAll(): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: deselect all currently selected diagram cells (mutates shared state)
  clearSelection(): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the IDs of all currently selected diagram cells (pure)
  getSelectedCells(): string[];

  // Collaboration operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: disconnect from the collaborative session and release its resources
  stopCollaboration(): Observable<boolean>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: request the presenter role in the active collaboration session
  requestPresenterRole(): Observable<boolean>;

  // State management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the current DFD orchestrator state snapshot (pure)
  getState(): DfdState;
  readonly state$: Observable<DfdState>;

  // Auto-save management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the current auto-save state snapshot (pure)
  getAutoSaveState(): AutoSaveState;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: activate periodic auto-save on the diagram orchestrator (mutates shared state)
  enableAutoSave(): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: deactivate periodic auto-save on the diagram orchestrator (mutates shared state)
  disableAutoSave(): void;

  // Configuration
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: toggle the diagram's read-only editing mode (mutates shared state)
  setReadOnly(readOnly: boolean): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: enable or disable real-time collaboration for the diagram (mutates shared state)
  setCollaborationEnabled(enabled: boolean): Observable<void>;

  // Observables for monitoring
  readonly operationCompleted$: Observable<OperationResult>;
  readonly saveCompleted$: Observable<SaveResult>;
  readonly loadCompleted$: Observable<LoadResult>;
  readonly collaborationStateChanged$: Observable<boolean>;
  readonly selectionChanged$: Observable<string[]>;
  readonly error$: Observable<string>;

  // Statistics and monitoring
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch accumulated operation statistics for the diagram orchestrator (pure)
  getStats(): DfdOperationStats;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: clear accumulated operation statistics on the diagram orchestrator (mutates shared state)
  resetStats(): void;

  // Graph access (for advanced use cases)
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the underlying graph instance, or null if uninitialized (pure)
  getGraph(): Graph | null;

  // Event handling
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: handle a window resize event to re-fit the diagram canvas (mutates shared state)
  onWindowResize(): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch a keyboard event to the diagram orchestrator for handling (mutates shared state)
  onKeyDown(event: KeyboardEvent): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: handle a context-menu mouse event on the diagram canvas (mutates shared state)
  onContextMenu(event: MouseEvent): void;
}

/**
 * DFD orchestrator configuration
 */
export interface DfdOrchestratorConfig {
  readonly enableAutoSave: boolean;
  readonly autoSaveMode: string;
  readonly enableCollaboration: boolean;
  readonly enableHistory: boolean;
  readonly enableVisualEffects: boolean;
  readonly maxHistorySize: number;
  readonly operationTimeoutMs: number;
  readonly debugMode: boolean;
}
