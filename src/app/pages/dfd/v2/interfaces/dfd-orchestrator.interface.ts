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
 * DFD operation context
 */
export interface DfdOperationContext {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly userId: string;
  readonly isCollaborating: boolean;
  readonly permissions: string[];
}

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
  initialize(params: DfdInitializationParams): Observable<boolean>;
  destroy(): Observable<void>;
  reset(): Observable<void>;
  
  // Core operations - unified interface for all graph operations
  executeOperation(operation: GraphOperation): Observable<OperationResult>;
  executeBatch(operations: GraphOperation[]): Observable<OperationResult[]>;
  
  // High-level user actions
  addNode(nodeType: string, position?: { x: number; y: number }): Observable<OperationResult>;
  deleteSelectedCells(): Observable<OperationResult>;
  duplicateSelectedCells(): Observable<OperationResult>;
  
  // Persistence operations
  saveManually(): Observable<SaveResult>;
  loadDiagram(force?: boolean): Observable<LoadResult>;
  exportDiagram(format: 'png' | 'jpeg' | 'svg'): Observable<Blob>;
  
  // History operations
  undo(): Observable<OperationResult>;
  redo(): Observable<OperationResult>;
  canUndo(): boolean;
  canRedo(): boolean;
  
  // Selection operations
  selectAll(): void;
  clearSelection(): void;
  getSelectedCells(): string[];
  
  // Collaboration operations
  startCollaboration(): Observable<boolean>;
  stopCollaboration(): Observable<boolean>;
  requestPresenterRole(): Observable<boolean>;
  
  // State management
  getState(): DfdState;
  readonly state$: Observable<DfdState>;
  
  // Auto-save management  
  getAutoSaveState(): AutoSaveState;
  enableAutoSave(): void;
  disableAutoSave(): void;
  
  // Configuration
  setReadOnly(readOnly: boolean): void;
  setCollaborationEnabled(enabled: boolean): Observable<void>;
  
  // Observables for monitoring
  readonly operationCompleted$: Observable<OperationResult>;
  readonly saveCompleted$: Observable<SaveResult>;
  readonly loadCompleted$: Observable<LoadResult>;
  readonly collaborationStateChanged$: Observable<boolean>;
  readonly selectionChanged$: Observable<string[]>;
  readonly error$: Observable<string>;
  
  // Statistics and monitoring
  getStats(): DfdOperationStats;
  resetStats(): void;
  
  // Graph access (for advanced use cases)
  getGraph(): Graph | null;
  
  // Event handling
  onWindowResize(): void;
  onKeyDown(event: KeyboardEvent): void;
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

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: DfdOrchestratorConfig = {
  enableAutoSave: true,
  autoSaveMode: 'normal',
  enableCollaboration: true,
  enableHistory: true,
  enableVisualEffects: true,
  maxHistorySize: 50,
  operationTimeoutMs: 30000,
  debugMode: false,
};

/**
 * Factory interface for creating DFD orchestrators
 */
export interface IDfdOrchestratorFactory {
  create(config?: Partial<DfdOrchestratorConfig>): IDfdOrchestrator;
}