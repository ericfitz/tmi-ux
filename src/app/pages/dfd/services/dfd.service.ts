import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { BehaviorSubject, Observable } from 'rxjs';
import { History } from '@antv/x6-plugin-history';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdGraphService } from './dfd-graph.service';
import { DfdNodeService } from './dfd-node.service';
import { DfdPortService } from './dfd-port.service';
import { DfdEventService } from './dfd-event.service';
import { DfdHighlighterService } from './dfd-highlighter.service';
import { DfdLabelEditorService } from './dfd-label-editor.service';
import { ShapeType } from './dfd-node.service';
import { DfdEventBusService, DfdEventType } from './dfd-event-bus.service';
import { DfdErrorService } from './dfd-error.service';
import { DfdAccessibilityService } from './dfd-accessibility.service';
import { dataUriToBlob, generateTimestamp, saveBlob } from '../utils/dfd-utils';

/**
 * Type for exportable formats
 */
export type ExportFormat = 'svg' | 'png' | 'jpeg';

/**
 * Comprehensive service that orchestrates all DFD functionality
 * Acts as a facade for other services while managing application state
 */
@Injectable({
  providedIn: 'root',
})
export class DfdService {
  // Graph instance
  private _graph: Graph | null = null;

  // History state as observables
  private _canUndo = new BehaviorSubject<boolean>(false);
  private _canRedo = new BehaviorSubject<boolean>(false);

  // Selected node state as observable
  private _selectedNode = new BehaviorSubject<Node | null>(null);

  // Graph initialization state
  private _isInitialized = new BehaviorSubject<boolean>(false);

  constructor(
    private logger: LoggerService,
    private graphService: DfdGraphService,
    private nodeService: DfdNodeService,
    private portService: DfdPortService,
    private eventService: DfdEventService,
    private highlighterService: DfdHighlighterService,
    private labelEditorService: DfdLabelEditorService,
    private eventBus: DfdEventBusService,
    private errorService: DfdErrorService,
    private accessibilityService: DfdAccessibilityService,
  ) {
    this.logger.info('DfdService initialized');

    // Subscribe to event bus events
    this.eventBus.onEventType(DfdEventType.CanUndoChanged).subscribe(event => {
      if ('canUndo' in event && 'canRedo' in event) {
        this._canUndo.next(event.canUndo);
        this._canRedo.next(event.canRedo);
      }
    });

    this.eventBus.selectedNode$.subscribe(node => {
      this._selectedNode.next(node);
    });
  }

  /**
   * Initializes the DFD graph
   * @param containerElement The container element
   * @returns A boolean indicating success/failure
   */
  initialize(containerElement: HTMLElement): boolean {
    this.logger.info('Initializing DFD graph');

    try {
      // Prepare the container
      const validContainer = this.graphService.validateAndSetupContainer(
        containerElement,
        this.logger,
      );

      if (!validContainer) {
        this.logger.error('Failed to get valid container element');
        return false;
      }

      // Configure highlighters
      const magnetAvailabilityHighlighter =
        this.highlighterService.createMagnetAvailabilityHighlighter();

      // Create and configure the graph
      this._graph = this.graphService.createGraph(validContainer, magnetAvailabilityHighlighter);

      if (!this._graph) {
        this.logger.error('Failed to create graph');
        return false;
      }

      // Set up event handlers
      this.eventService.setupEventHandlers(this._graph);

      // Set up label editing handlers
      this.graphService.setupLabelEditing(this._graph);

      // Clean history before adding nodes
      const history = this._graph.getPlugin<History>('history');
      if (history) {
        this.logger.info('Cleaning history before adding initial nodes');
        history.clean();
      }

      // Now add initial nodes (with fresh history)
      this.nodeService.createInitialNodes(this._graph);

      // Set up history state change listener after creating nodes
      this.setupHistoryStateListener();

      // Set subscription for selected node changes
      this.setupSelectedNodeListener();

      // Mark as initialized
      this._isInitialized.next(true);

      this.logger.info('DFD graph initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Error initializing DFD graph:', error);
      this._isInitialized.next(false);
      return false;
    }
  }

  /**
   * Creates a node of the specified type at a random position
   * @param shapeType The type of shape to create
   * @param containerElement The container element
   * @returns The created node or null if creation failed
   */
  createNode(shapeType: ShapeType, containerElement: HTMLElement): Node | null {
    if (!this._graph) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return null;
    }

    return this.nodeService.createRandomNode(this._graph, shapeType, containerElement);
  }

  /**
   * Performs an undo operation if available
   * @returns Whether the operation was successful
   */
  undo(): boolean {
    if (!this._graph) {
      this.logger.warn('Cannot undo: Graph is not initialized');
      return false;
    }

    const history = this._graph.getPlugin<History>('history');
    if (!history) {
      this.logger.warn('History plugin not found');
      return false;
    }

    // Get all cells before undo to compare changes
    const cellsBefore = this._graph.getCells().map(cell => ({
      id: cell.id,
      type: cell.constructor.name,
      position: cell.isNode() ? cell.getPosition() : undefined,
      size: cell.isNode() ? cell.getSize() : undefined,
      attrs: cell.getAttrs(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: cell.getData(),
      points: cell.isEdge() ? cell.getVertices() : undefined,
    }));

    // Remember the currently selected node before undo
    const selectedNodeBefore = this.eventService.getSelectedNode();

    if (history.canUndo()) {
      this.logger.debug('Before undo operation - capturing state');

      // Execute undo
      history.undo();

      // Get all cells after undo
      const cellsAfter = this._graph.getCells().map(cell => ({
        id: cell.id,
        type: cell.constructor.name,
        position: cell.isNode() ? cell.getPosition() : undefined,
        size: cell.isNode() ? cell.getSize() : undefined,
        attrs: cell.getAttrs(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: cell.getData(),
        points: cell.isEdge() ? cell.getVertices() : undefined,
      }));

      // Look for nodes that were added by the undo operation
      const newNodeIds = cellsAfter
        .filter(afterCell => !cellsBefore.some(beforeCell => beforeCell.id === afterCell.id))
        .map(cell => cell.id);

      // Process restored nodes
      if (newNodeIds.length > 0) {
        this.logger.debug('Restoring labels and deselecting nodes added by undo', { newNodeIds });

        // Process each restored node
        newNodeIds.forEach(nodeId => {
          const node = this._graph?.getCellById(nodeId);
          if (node && node.isNode()) {
            // Fix label display
            if (this._graph) {
              this.graphService.setupLabelForRestoredNode(node, this._graph);
            }

            // Remove any tools that might have been added automatically
            node.removeTools();

            // Remove selection styling
            node.attr('selected', false);

            // Force a complete refresh of the node view
            if (this._graph) {
              const view = this._graph.findViewByCell(node);
              if (view) {
                // Use the highest flag value to force complete redraw
                view.confirmUpdate(511); // Binary 111111111
                this.logger.debug('Forced complete view refresh for restored node', { nodeId });
              }
            }
          }
        });

        // Re-select the original selected node if it still exists
        if (selectedNodeBefore) {
          const currentSelectedNode = this._graph.getCellById(selectedNodeBefore.id);
          if (currentSelectedNode && currentSelectedNode.isNode()) {
            // Deselect all nodes first
            this.eventService.deselectAll(this._graph);

            // Select the originally selected node
            this.eventService.selectNode(currentSelectedNode);
          }
        }

        // Force the graph to refresh in case CSS styles need to be reapplied
        this._graph.centerContent();
      }

      // Log detailed changes
      this.logHistoryChanges('undo', cellsBefore, cellsAfter);

      this.logger.info('Undo action performed');
      return true;
    } else {
      this.logger.info('Cannot undo: No more actions to undo');
      return false;
    }
  }

  /**
   * Performs a redo operation if available
   * @returns Whether the operation was successful
   */
  redo(): boolean {
    if (!this._graph) {
      this.logger.warn('Cannot redo: Graph is not initialized');
      return false;
    }

    const history = this._graph.getPlugin<History>('history');
    if (!history) {
      this.logger.warn('History plugin not found');
      return false;
    }

    // Get all cells before redo to compare changes
    const cellsBefore = this._graph.getCells().map(cell => ({
      id: cell.id,
      type: cell.constructor.name,
      position: cell.isNode() ? cell.getPosition() : undefined,
      size: cell.isNode() ? cell.getSize() : undefined,
      attrs: cell.getAttrs(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: cell.getData(),
      points: cell.isEdge() ? cell.getVertices() : undefined,
    }));

    // Remember the currently selected node before redo
    const selectedNodeBefore = this.eventService.getSelectedNode();

    if (history.canRedo()) {
      this.logger.debug('Before redo operation - capturing state');

      // Execute redo
      history.redo();

      // Get all cells after redo
      const cellsAfter = this._graph.getCells().map(cell => ({
        id: cell.id,
        type: cell.constructor.name,
        position: cell.isNode() ? cell.getPosition() : undefined,
        size: cell.isNode() ? cell.getSize() : undefined,
        attrs: cell.getAttrs(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: cell.getData(),
        points: cell.isEdge() ? cell.getVertices() : undefined,
      }));

      // Look for nodes that were added by the redo operation
      const newNodeIds = cellsAfter
        .filter(afterCell => !cellsBefore.some(beforeCell => beforeCell.id === afterCell.id))
        .map(cell => cell.id);

      // Process restored nodes
      if (newNodeIds.length > 0) {
        this.logger.debug('Restoring labels and deselecting nodes added by redo', { newNodeIds });

        // Process each restored node
        newNodeIds.forEach(nodeId => {
          const node = this._graph?.getCellById(nodeId);
          if (node && node.isNode()) {
            // Fix label display
            if (this._graph) {
              this.graphService.setupLabelForRestoredNode(node, this._graph);
            }

            // Remove any tools that might have been added automatically
            node.removeTools();

            // Remove selection styling
            node.attr('selected', false);

            // Force a complete refresh of the node view
            if (this._graph) {
              const view = this._graph.findViewByCell(node);
              if (view) {
                // Use the highest flag value to force complete redraw
                view.confirmUpdate(511); // Binary 111111111
                this.logger.debug('Forced complete view refresh for restored node', { nodeId });
              }
            }
          }
        });

        // Re-select the original selected node if it still exists
        if (selectedNodeBefore) {
          const currentSelectedNode = this._graph.getCellById(selectedNodeBefore.id);
          if (currentSelectedNode && currentSelectedNode.isNode()) {
            // Deselect all nodes first
            this.eventService.deselectAll(this._graph);

            // Select the originally selected node
            this.eventService.selectNode(currentSelectedNode);
          }
        }

        // Force the graph to refresh in case CSS styles need to be reapplied
        this._graph.centerContent();
      }

      // Log detailed changes
      this.logHistoryChanges('redo', cellsBefore, cellsAfter);

      this.logger.info('Redo action performed');
      return true;
    } else {
      this.logger.info('Cannot redo: No more actions to redo');
      return false;
    }
  }

  /**
   * Logs detailed changes during undo/redo operations
   * @param operation The operation being performed ('undo' or 'redo')
   * @param before Collection of cells before the operation
   * @param after Collection of cells after the operation
   */
  private logHistoryChanges(
    operation: 'undo' | 'redo',
    before: Array<{
      id: string;
      type: string;
      position?: { x: number; y: number };
      size?: { width: number; height: number };
      attrs: Record<string, unknown>;
      data: unknown;
      points?: Array<{ x: number; y: number }>;
    }>,
    after: Array<{
      id: string;
      type: string;
      position?: { x: number; y: number };
      size?: { width: number; height: number };
      attrs: Record<string, unknown>;
      data: unknown;
      points?: Array<{ x: number; y: number }>;
    }>,
  ): void {
    // Map cells by ID for easier access
    const beforeMap = new Map(before.map(cell => [cell.id, cell]));
    const afterMap = new Map(after.map(cell => [cell.id, cell]));

    // Track all changes
    const changes: Array<{
      id: string;
      type: string;
      changeType: 'added' | 'removed' | 'modified';
      changes?: Array<{
        property: string;
        before: unknown;
        after: unknown;
      }>;
    }> = [];

    // Find removed cells (exist in before but not in after)
    before.forEach(cell => {
      if (!afterMap.has(cell.id)) {
        changes.push({
          id: cell.id,
          type: cell.type,
          changeType: 'removed',
        });
      }
    });

    // Find added cells (exist in after but not in before)
    after.forEach(cell => {
      if (!beforeMap.has(cell.id)) {
        changes.push({
          id: cell.id,
          type: cell.type,
          changeType: 'added',
        });
      }
    });

    // Find modified cells (exist in both before and after)
    after.forEach(afterCell => {
      const beforeCell = beforeMap.get(afterCell.id);
      if (beforeCell) {
        const cellChanges: Array<{ property: string; before: unknown; after: unknown }> = [];

        // Check position changes
        if (
          afterCell.position &&
          beforeCell.position &&
          (afterCell.position.x !== beforeCell.position.x ||
            afterCell.position.y !== beforeCell.position.y)
        ) {
          cellChanges.push({
            property: 'position',
            before: beforeCell.position,
            after: afterCell.position,
          });
        }

        // Check size changes
        if (
          afterCell.size &&
          beforeCell.size &&
          (afterCell.size.width !== beforeCell.size.width ||
            afterCell.size.height !== beforeCell.size.height)
        ) {
          cellChanges.push({
            property: 'size',
            before: beforeCell.size,
            after: afterCell.size,
          });
        }

        // Check attribute changes - focus on key attributes like 'text' or 'label'
        const beforeAttrs = beforeCell.attrs || {};
        const afterAttrs = afterCell.attrs || {};

        // Look for changes in text/label attributes specifically
        const beforeLabel =
          beforeAttrs && 'label' in beforeAttrs ? beforeAttrs['label'] : undefined;
        const afterLabel = afterAttrs && 'label' in afterAttrs ? afterAttrs['label'] : undefined;

        if (
          beforeLabel &&
          afterLabel &&
          typeof beforeLabel === 'object' &&
          typeof afterLabel === 'object' &&
          'text' in beforeLabel &&
          'text' in afterLabel &&
          beforeLabel['text'] !== afterLabel['text']
        ) {
          cellChanges.push({
            property: 'attrs.label.text',
            before: beforeLabel['text'],
            after: afterLabel['text'],
          });
        }

        // Check for changes in data
        if (JSON.stringify(beforeCell.data) !== JSON.stringify(afterCell.data)) {
          // Try to identify specific data changes
          if (
            typeof beforeCell.data === 'object' &&
            typeof afterCell.data === 'object' &&
            beforeCell.data !== null &&
            afterCell.data !== null
          ) {
            const beforeData = beforeCell.data as Record<string, unknown>;
            const afterData = afterCell.data as Record<string, unknown>;

            // Check for label changes in data
            if (
              'label' in beforeData &&
              'label' in afterData &&
              beforeData['label'] !== afterData['label']
            ) {
              cellChanges.push({
                property: 'data.label',
                before: beforeData['label'],
                after: afterData['label'],
              });
            }
          } else {
            cellChanges.push({
              property: 'data',
              before: beforeCell.data,
              after: afterCell.data,
            });
          }
        }

        // Check for changes in points for edges
        if (
          afterCell.points &&
          beforeCell.points &&
          JSON.stringify(afterCell.points) !== JSON.stringify(beforeCell.points)
        ) {
          cellChanges.push({
            property: 'points',
            before: beforeCell.points,
            after: afterCell.points,
          });
        }

        // Only add to changes if there were any detected changes
        if (cellChanges.length > 0) {
          changes.push({
            id: afterCell.id,
            type: afterCell.type,
            changeType: 'modified',
            changes: cellChanges,
          });
        }
      }
    });

    // Log changes with different detail levels
    if (changes.length === 0) {
      this.logger.debug(`${operation.toUpperCase()}: No detectable changes`);
    } else {
      // Log summary
      this.logger.debug(`${operation.toUpperCase()}: ${changes.length} cell(s) changed`, {
        added: changes.filter(c => c.changeType === 'added').length,
        removed: changes.filter(c => c.changeType === 'removed').length,
        modified: changes.filter(c => c.changeType === 'modified').length,
      });

      // Log details of each change
      changes.forEach(change => {
        if (change.changeType === 'added') {
          this.logger.debug(`${operation.toUpperCase()}: Added ${change.type} (${change.id})`);
        } else if (change.changeType === 'removed') {
          this.logger.debug(`${operation.toUpperCase()}: Removed ${change.type} (${change.id})`);
        } else if (change.changeType === 'modified') {
          this.logger.debug(`${operation.toUpperCase()}: Modified ${change.type} (${change.id})`, {
            changes: change.changes,
          });
        }
      });
    }
  }

  /**
   * Exports the diagram in the specified format
   * @param format The format to export to (svg, png, jpeg)
   * @param callback Optional callback to handle the exported data
   */
  exportDiagram(format: ExportFormat, callback?: (blob: Blob, filename: string) => void): void {
    if (!this._graph) {
      this.errorService.logWarning('Cannot export: Graph is not initialized');
      return;
    }

    try {
      // Generate a filename with timestamp
      const timestamp = generateTimestamp();
      const filename = `dfd-diagram-${timestamp}.${format}`;

      // Default callback if not provided
      const defaultCallback = (blob: Blob, name: string): void => {
        saveBlob(blob, name);
      };

      const finalCallback = callback || defaultCallback;

      // Publish event that export started
      this.eventBus.publish({
        type: DfdEventType.GraphChanged,
        timestamp: Date.now(),
        cells: this._graph.getCells(),
      });

      if (format === 'svg') {
        // For SVG export
        this._graph.toSVG((svgString: string) => {
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          finalCallback(blob, filename);
          this.logger.info(`Diagram exported as SVG: ${filename}`);
        });
      } else {
        // Common options for raster exports
        const exportOptions = {
          backgroundColor: 'white',
          padding: 20,
          quality: format === 'jpeg' ? 0.8 : 1,
        };

        if (format === 'png') {
          this._graph.toPNG((dataUri: string) => {
            const blob = dataUriToBlob(dataUri, 'image/png');
            finalCallback(blob, filename);
            this.logger.info(`Diagram exported as PNG: ${filename}`);
          }, exportOptions);
        } else {
          // JPEG export
          this._graph.toJPEG((dataUri: string) => {
            const blob = dataUriToBlob(dataUri, 'image/jpeg');
            finalCallback(blob, filename);
            this.logger.info(`Diagram exported as JPEG: ${filename}`);
          }, exportOptions);
        }
      }
    } catch (error: unknown) {
      const errorMessage = `Error exporting diagram as ${format}`;
      this.errorService.logError(error as Error, errorMessage);
    }
  }

  /**
   * Adds passive event listeners to the graph container
   * @param container The graph container element
   */
  addPassiveEventListeners(container: HTMLElement): void {
    if (!this._graph) {
      this.logger.warn('Cannot add event listeners: Graph is not initialized');
      return;
    }

    // Get all the elements that might have event listeners
    const canvasElements = container.querySelectorAll('canvas');
    const svgElements = container.querySelectorAll('svg');

    // Add passive event listeners to all relevant elements
    const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];

    // Function to safely add passive event listener
    const addPassiveListener = (element: Element): void => {
      passiveEvents.forEach(eventType => {
        // Create a passive event listener that captures events before X6 processes them
        element.addEventListener(
          eventType,
          (_e: Event) => {
            // Empty handler with passive: true to prevent browser warnings
            // The event will still propagate to X6's handlers
          },
          { passive: true, capture: false },
        );
      });
    };

    // Add listeners to canvas elements (X6 rendering surface)
    canvasElements.forEach(addPassiveListener);

    // Add listeners to SVG elements (X6 also uses SVG)
    svgElements.forEach(addPassiveListener);

    // Add listeners to the container itself
    addPassiveListener(container);

    this.logger.info('Added passive event listeners to graph elements');
  }

  /**
   * Sets up listener for history state changes
   */
  private setupHistoryStateListener(): void {
    if (!this._graph) {
      return;
    }

    const history = this._graph.getPlugin<History>('history');
    if (!history) {
      this.logger.warn('History plugin not found');
      return;
    }

    // Update history state whenever it changes
    history.on('change', () => {
      const canUndoValue = history.canUndo();
      const canRedoValue = history.canRedo();
      this._canUndo.next(canUndoValue);
      this._canRedo.next(canRedoValue);

      // Publish to event bus for coordination
      this.eventBus.publishHistoryChange(canUndoValue, canRedoValue);

      this.logger.debug(`History state changed: canUndo=${canUndoValue}, canRedo=${canRedoValue}`);
    });

    // Get the current history state for undo/redo buttons
    const canUndo = history.canUndo();
    const canRedo = history.canRedo();

    // If we want to allow undoing initial node creation, use the actual values
    this._canUndo.next(canUndo);
    this._canRedo.next(canRedo);
    this.eventBus.publishHistoryChange(canUndo, canRedo);

    // Log the updated state after clearing
    this.logger.debug(
      `Initial history state (after reset): canUndo=${history.canUndo()}, canRedo=${history.canRedo()}`,
    );
  }

  /**
   * Sets up listener for selected node changes
   */
  private setupSelectedNodeListener(): void {
    // Subscribe to selected node changes from event service
    this._selectedNode.next(this.eventService.getSelectedNode());
  }

  /**
   * Disposes the graph and cleans up resources
   */
  dispose(): void {
    if (this._graph) {
      this._graph.dispose();
      this._graph = null;
    }

    // Reset all state
    this._canUndo.next(false);
    this._canRedo.next(false);
    this._selectedNode.next(null);
    this._isInitialized.next(false);

    this.logger.info('DFD service disposed');
  }

  // Public getters for observables
  get canUndo$(): Observable<boolean> {
    return this._canUndo.asObservable();
  }

  get canRedo$(): Observable<boolean> {
    return this._canRedo.asObservable();
  }

  get selectedNode$(): Observable<Node | null> {
    return this._selectedNode.asObservable();
  }

  get isInitialized$(): Observable<boolean> {
    return this._isInitialized.asObservable();
  }

  // Current value getters
  get canUndo(): boolean {
    return this._canUndo.value;
  }

  get canRedo(): boolean {
    return this._canRedo.value;
  }

  get graph(): Graph | null {
    return this._graph;
  }

  get isInitialized(): boolean {
    return this._isInitialized.value;
  }

  get selectedNode(): Node | null {
    return this._selectedNode.value;
  }
}
