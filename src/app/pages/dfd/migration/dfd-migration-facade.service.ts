import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { MigrationFlagsService } from './migration-flags.service';
import { LegacyGraphAdapter } from './legacy-graph.adapter';
import { LegacyCommandAdapter, CommandResult } from './legacy-command.adapter';

// Legacy ExportFormat type for migration compatibility
export type ExportFormat = 'png' | 'jpeg' | 'svg';
import { NodeType } from '../domain/value-objects/node-data';

// Type alias for backward compatibility during migration
type ShapeType = NodeType;

/**
 * Migration facade service that provides the same interface as legacy services
 * but delegates to either legacy or new architecture based on feature flags
 */
@Injectable()
export class DfdMigrationFacadeService {
  private _isInitialized = new BehaviorSubject<boolean>(false);
  private _selectedNode = new BehaviorSubject<Node | null>(null);
  private _canUndo = new BehaviorSubject<boolean>(false);
  private _canRedo = new BehaviorSubject<boolean>(false);

  constructor(
    private logger: LoggerService,
    private migrationFlags: MigrationFlagsService,
    private legacyGraphAdapter: LegacyGraphAdapter,
    private legacyCommandAdapter: LegacyCommandAdapter,
  ) {
    this.logger.info('DfdMigrationFacadeService initialized');
    this.setupStateSync();
  }

  /**
   * Get the X6 graph instance (legacy interface)
   */
  get graph(): Graph | null {
    return this.legacyGraphAdapter.graph;
  }

  /**
   * Check if the graph is initialized (legacy interface)
   */
  get isInitialized(): boolean {
    return this.legacyGraphAdapter.isInitialized;
  }

  /**
   * Get initialization state as observable (legacy interface)
   */
  get isInitialized$(): Observable<boolean> {
    return this.legacyGraphAdapter.isInitialized$;
  }

  /**
   * Get selected node (legacy interface)
   */
  get selectedNode(): Node | null {
    return this._selectedNode.value;
  }

  /**
   * Get selected node as observable (legacy interface)
   */
  get selectedNode$(): Observable<Node | null> {
    return this._selectedNode.asObservable();
  }

  /**
   * Get undo capability as observable (legacy interface)
   */
  get canUndo$(): Observable<boolean> {
    return this._canUndo.asObservable();
  }

  /**
   * Get redo capability as observable (legacy interface)
   */
  get canRedo$(): Observable<boolean> {
    return this._canRedo.asObservable();
  }

  /**
   * Get current undo capability (legacy interface)
   */
  get canUndo(): boolean {
    return this._canUndo.value;
  }

  /**
   * Get current redo capability (legacy interface)
   */
  get canRedo(): boolean {
    return this._canRedo.value;
  }

  /**
   * Initialize the graph (legacy interface)
   * @param containerElement The container element for the graph
   * @returns True if initialization was successful
   */
  initialize(containerElement: HTMLElement): boolean {
    this.logger.info('DfdMigrationFacadeService: Initializing graph', {
      useNewGraphAdapter: this.migrationFlags.isEnabled('useNewGraphAdapter'),
    });

    const success = this.legacyGraphAdapter.initialize(containerElement);

    this._isInitialized.next(success);
    return success;
  }

  /**
   * Dispose the graph and clean up resources (legacy interface)
   */
  dispose(): void {
    this.logger.info('DfdMigrationFacadeService: Disposing graph');

    this.legacyGraphAdapter.dispose();

    // Reset facade state
    this._isInitialized.next(false);
    this._selectedNode.next(null);
    this._canUndo.next(false);
    this._canRedo.next(false);
  }

  /**
   * Add passive event listeners (legacy interface)
   * @param container The container element
   */
  addPassiveEventListeners(container: HTMLElement): void {
    this.logger.info('DfdMigrationFacadeService: Adding passive event listeners');

    this.legacyGraphAdapter.addPassiveEventListeners(container);
  }

  /**
   * Export diagram in specified format (legacy interface)
   * @param format The export format
   * @param callback Optional callback for handling the exported data
   */
  exportDiagram(format: ExportFormat, callback?: (blob: Blob, filename: string) => void): void {
    this.logger.info('DfdMigrationFacadeService: Exporting diagram', { format });

    this.legacyGraphAdapter.exportDiagram(format, callback);
  }

  /**
   * Create a new node with the specified shape type (legacy interface)
   * @param shapeType The type of shape to create
   * @param position The position for the new node
   * @param containerElement Optional container element for sizing calculations
   * @returns Observable that emits the command result
   */
  createNode(
    shapeType: ShapeType,
    position: { x: number; y: number },
    containerElement?: HTMLElement,
  ): Observable<CommandResult<Node>> {
    this.logger.info('DfdMigrationFacadeService: Creating node', { shapeType, position });

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.createNode(shapeType, position, containerElement);
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.createNode(shapeType, position, containerElement);
    }
  }

  /**
   * Creates a node at a random position (legacy interface)
   * @param shapeType The type of shape to create
   * @param containerElement The container element for sizing calculations
   * @returns Observable that emits the command result
   */
  createRandomNode(
    shapeType: ShapeType,
    containerElement?: HTMLElement,
  ): Observable<CommandResult<Node>> {
    this.logger.info('DfdMigrationFacadeService: Creating random node', { shapeType });

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.createRandomNode(shapeType, containerElement);
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.createRandomNode(shapeType, containerElement);
    }
  }

  /**
   * Delete a node (legacy interface)
   * @param nodeId The ID of the node to delete
   * @returns Observable that emits the command result
   */
  deleteNode(nodeId: string): Observable<CommandResult<void>> {
    this.logger.info('DfdMigrationFacadeService: Deleting node', { nodeId });

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.deleteNode(nodeId);
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.deleteNode(nodeId);
    }
  }

  /**
   * Move a node to a new position (legacy interface)
   * @param nodeId The ID of the node to move
   * @param newPosition The new position for the node
   * @returns Observable that emits the command result
   */
  moveNode(nodeId: string, newPosition: { x: number; y: number }): Observable<CommandResult<void>> {
    this.logger.info('DfdMigrationFacadeService: Moving node', { nodeId, newPosition });

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.moveNode(nodeId, newPosition);
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.moveNode(nodeId, newPosition);
    }
  }

  /**
   * Edit a node's label (legacy interface)
   * @param nodeId The ID of the node to edit
   * @param newLabel The new label for the node
   * @returns Observable that emits the command result
   */
  editNodeLabel(nodeId: string, newLabel: string): Observable<CommandResult<string>> {
    this.logger.info('DfdMigrationFacadeService: Editing node label', { nodeId, newLabel });

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.editNodeLabel(nodeId, newLabel);
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.editNodeLabel(nodeId, newLabel);
    }
  }

  /**
   * Performs an undo operation if available (legacy interface)
   * @returns Observable that emits the command result
   */
  undo(): Observable<CommandResult> {
    this.logger.info('DfdMigrationFacadeService: Undo operation');

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.undo();
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.undo();
    }
  }

  /**
   * Performs a redo operation if available (legacy interface)
   * @returns Observable that emits the command result
   */
  redo(): Observable<CommandResult> {
    this.logger.info('DfdMigrationFacadeService: Redo operation');

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      return this.legacyCommandAdapter.redo();
    } else {
      // Legacy command service not available - always use new architecture
      return this.legacyCommandAdapter.redo();
    }
  }

  /**
   * Clears all command history (legacy interface)
   */
  clearHistory(): void {
    this.logger.info('DfdMigrationFacadeService: Clear history');

    if (this.migrationFlags.isEnabled('useNewCommandBus')) {
      this.legacyCommandAdapter.clearHistory();
    } else {
      // Legacy command service not available - always use new architecture
      this.legacyCommandAdapter.clearHistory();
    }
  }

  /**
   * Get migration progress summary
   */
  getMigrationStatus(): {
    progress: number;
    isComplete: boolean;
    enabledFlags: string[];
    disabledFlags: string[];
  } {
    return this.migrationFlags.getMigrationSummary();
  }

  /**
   * Enable a specific migration flag for testing
   * @param flag The flag to enable
   */
  enableMigrationFlag(flag: keyof import('./migration-flags.service').MigrationFlags): void {
    this.logger.info('DfdMigrationFacadeService: Enabling migration flag', { flag });
    this.migrationFlags.enableFlag(flag);
  }

  /**
   * Disable a specific migration flag for rollback
   * @param flag The flag to disable
   */
  disableMigrationFlag(flag: keyof import('./migration-flags.service').MigrationFlags): void {
    this.logger.info('DfdMigrationFacadeService: Disabling migration flag', { flag });
    this.migrationFlags.disableFlag(flag);
  }

  /**
   * Set up synchronization between different state sources
   */
  private setupStateSync(): void {
    // Subscribe to migration flag changes to log transitions
    this.migrationFlags.flags$.subscribe(flags => {
      this.logger.debug('DfdMigrationFacadeService: Migration flags changed', flags);
    });

    // Legacy service state sync removed - new architecture manages state directly

    this.logger.debug('DfdMigrationFacadeService: State synchronization set up');
  }
}
