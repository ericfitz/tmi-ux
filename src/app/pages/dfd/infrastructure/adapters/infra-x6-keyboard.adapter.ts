import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { Point } from '../../domain/value-objects/point';
import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * X6 Keyboard Handler
 * Handles keyboard events for snap to grid control, cursor changes, and other keyboard interactions
 */
@Injectable()
export class InfraX6KeyboardAdapter {
  // Shift key and drag state tracking for snap to grid control
  private _isShiftPressed = false;
  private _isDragging = false;
  private _originalGridSize = 10;
  private _currentGridSize = 10;

  // Track if we're in pan mode to avoid interfering with X6's pan/zoom
  private _isPanningBackground = false;

  // Store initial position of node when drag starts
  private _initialNodePositions = new Map<string, Point>();

  // Graph reference for grid updates and cursor management
  private _graph: Graph | null = null;
  private _graphContainer: HTMLElement | null = null;

  constructor(private logger: LoggerService) {}

  /**
   * Setup shift key handling for temporary snap to grid disable and cursor changes
   */
  setupKeyboardHandling(graph: Graph, orchestrator?: any): void {
    this._graph = graph;
    this._graphContainer = graph.container;

    // Listen for shift key events on the document, but be careful not to interfere with X6's pan/zoom
    document.addEventListener('keydown', this._handleKeyDown);
    document.addEventListener('keyup', this._handleKeyUp);

    // Listen for drag start/end events on nodes
    graph.on('node:mousedown', this._handleNodeMouseDown);
    graph.on('node:mousemove', this._handleNodeMouseMove);
    graph.on('node:mouseup', this._handleNodeMouseUp);

    // Listen for blank (background) mouse events to detect panning
    graph.on('blank:mousedown', () => {
      this._isPanningBackground = true;
    });
    graph.on('blank:mouseup', () => {
      this._isPanningBackground = false;
    });

    // Handle window blur to reset state if user switches windows while dragging
    window.addEventListener('blur', this._handleWindowBlur);

    // Setup undo/redo keyboard shortcuts if orchestrator is provided
    if (orchestrator) {
      const handleUndoRedo = (event: KeyboardEvent): void => {
        // Cmd+Z (Mac) or Ctrl+Z (Windows/Linux) for undo
        if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          orchestrator.undo().subscribe();
        }
        // Cmd+Shift+Z (Mac) or Ctrl+Y (Windows/Linux) for redo
        else if (
          ((event.metaKey || event.ctrlKey) && event.key === 'z' && event.shiftKey) ||
          (event.ctrlKey && event.key === 'y')
        ) {
          event.preventDefault();
          orchestrator.redo().subscribe();
        }
      };

      document.addEventListener('keydown', handleUndoRedo);
      this.logger.info('Undo/redo keyboard shortcuts initialized (Cmd+Z/Cmd+Shift+Z)');
    }

    // Set initial cursor state (default when not pressing shift)
    this._updateCursor();

    // this.logger.info('Shift key handling for snap to grid control and cursor changes initialized');
  }

  /**
   * Clean up keyboard event listeners
   */
  cleanup(): void {
    document.removeEventListener('keydown', this._handleKeyDown);
    document.removeEventListener('keyup', this._handleKeyUp);
    window.removeEventListener('blur', this._handleWindowBlur);

    // Reset all state when cleaning up
    this._isShiftPressed = false;
    this._isPanningBackground = false;
    this._isDragging = false;
    this._clearCursorStyles();
  }

  /**
   * Get the initial position of a node when drag started (for history tracking)
   */
  getInitialNodePosition(nodeId: string): Point | null {
    return this._initialNodePositions.get(nodeId) || null;
  }

  /**
   * Set the graph reference for grid updates
   */
  setGraph(graph: Graph): void {
    this._graph = graph;
  }

  /**
   * Handle keydown events to track shift key state
   * Avoid interfering with X6's pan/zoom when user is interacting with background
   */
  private _handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Shift' && !this._isShiftPressed) {
      this._isShiftPressed = true;

      // Don't interfere with X6's pan/zoom if user is panning background
      if (!this._isPanningBackground) {
        // Only update snap-to-grid if we're actively dragging a node
        if (this._isDragging) {
          this._updateSnapToGrid();
        }
        this._updateCursor();
      }
    }
  };

  /**
   * Handle keyup events to track shift key state
   * Avoid interfering with X6's pan/zoom when user is interacting with background
   */
  private _handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Shift' && this._isShiftPressed) {
      this._isShiftPressed = false;

      // Don't interfere with X6's pan/zoom if user was panning background
      if (!this._isPanningBackground) {
        // Only update snap-to-grid if we're actively dragging a node
        if (this._isDragging) {
          this._updateSnapToGrid();
        }
        this._updateCursor();
      }
    }
  };

  /**
   * Handle node mouse down to track drag start and store initial position
   */
  private _handleNodeMouseDown = ({ node }: { node: Node }): void => {
    if (!node) {
      this.logger.warn('Node mouse down event received with missing node data');
      return;
    }

    this.logger.debugComponent('X6Keyboard', 'Node drag started (handleNodeMouseDown)', {
      nodeId: node.id,
    });
    this._isDragging = true;
    this._updateSnapToGrid();

    // Add global mouseup listener only when dragging starts
    document.addEventListener('mouseup', this._handleDocumentMouseUp);

    // Get the initial position of the node when the drag starts
    const initialPosition = new Point(node.position().x, node.position().y);

    // Store the initial position for drag completion tracking
    this._initialNodePositions.set(node.id, initialPosition);

    this.logger.debugComponent('X6Keyboard', 'Node drag started', {
      nodeId: node.id,
      initialPosition: { x: initialPosition.x, y: initialPosition.y },
    });
  };

  /**
   * Handle node mouse move during drag
   */
  private _handleNodeMouseMove = (): void => {
    // Update snap to grid in case shift state changed during drag
    if (this._isDragging) {
      this._updateSnapToGrid();
    }
  };

  /**
   * Handle node mouse up to track drag end
   */
  private _handleNodeMouseUp = ({ node }: { node: Node }): void => {
    if (!node) {
      this.logger.warn('Node mouse up event received with missing node data');
      return;
    }

    this.logger.debugComponent('X6Keyboard', 'Node drag ended (handleNodeMouseUp)', {
      nodeId: node.id,
    });
    if (this._isDragging) {
      this._isDragging = false;
      this._updateSnapToGrid();

      // Remove global mouseup listener when dragging ends
      document.removeEventListener('mouseup', this._handleDocumentMouseUp);

      // Clear the initial position for backward compatibility
      this._initialNodePositions.delete(node.id);
    }
  };

  /**
   * Handle document mouse up to ensure drag state is reset
   */
  private _handleDocumentMouseUp = (): void => {
    if (this._isDragging) {
      this._isDragging = false;
      this._updateSnapToGrid();
      // Clear all initial positions if mouse up happens outside a node
      this._initialNodePositions.clear();

      // Remove global mouseup listener when dragging ends
      document.removeEventListener('mouseup', this._handleDocumentMouseUp);
    }
  };

  /**
   * Handle window blur to reset state
   */
  private _handleWindowBlur = (): void => {
    this._isShiftPressed = false;
    this._isPanningBackground = false; // Reset panning state on window blur
    if (this._isDragging) {
      // Remove global mouseup listener if dragging when window loses focus
      document.removeEventListener('mouseup', this._handleDocumentMouseUp);
    }
    this._isDragging = false;
    this._updateSnapToGrid();
    this._updateCursor();
    this._initialNodePositions.clear();
  };

  /**
   * Update snap to grid based on current shift and drag state
   */
  private _updateSnapToGrid(): void {
    if (!this._graph) return;

    // Disable snap to grid (set to 1) if shift is pressed during drag
    const shouldDisableSnap = this._isShiftPressed && this._isDragging;
    const newGridSize = shouldDisableSnap ? 1 : this._originalGridSize;

    // Only redraw grid if the size actually changed
    if (newGridSize === this._currentGridSize) {
      return;
    }

    this._currentGridSize = newGridSize;

    // Update the grid size by modifying the graph options
    // We need to access the internal grid configuration and update it

    const graphOptions = (this._graph as any).options as {
      grid?: { size: number; visible: boolean; type: string; args: any[] };
    };
    if (graphOptions?.grid) {
      // Update only the grid size while preserving all other grid configuration including colors
      graphOptions.grid.size = newGridSize;
      // Ensure visibility is maintained (don't override other grid properties)
      if (graphOptions.grid.visible !== false) {
        graphOptions.grid.visible = true;
      }
      // Ensure grid args (colors) are preserved - they should already be there from initialization
      // but verify they exist to prevent loss of styling
      if (!graphOptions.grid.args || graphOptions.grid.args.length === 0) {
        this.logger.debugComponent('X6Keyboard', 'Grid args missing, restoring defaults');
        graphOptions.grid.args = [
          { color: DFD_STYLING.GRID.PRIMARY_COLOR, thickness: 1 },
          { color: DFD_STYLING.GRID.SECONDARY_COLOR, thickness: 1, factor: 4 },
        ];
      }
      this.logger.debugComponent('X6Keyboard', 'Drawing grid with config', {
        size: graphOptions.grid.size,
        visible: graphOptions.grid.visible,
        argsCount: graphOptions.grid.args?.length,
        primaryColor: graphOptions.grid.args?.[0]?.color,
      });
      // Redraw the grid with the updated configuration
      this._graph.drawGrid();
    }
  }

  /**
   * Update cursor based on shift key state
   */
  private _updateCursor(): void {
    if (!this._graphContainer) return;

    if (this._isShiftPressed) {
      // Show grab cursor when shift is held - apply to container and X6 elements
      this._applyCursorToGraphElements('grab');
    } else {
      // Show default pointer cursor when shift is not held - apply to container and X6 elements
      this._applyCursorToGraphElements('default');
    }
  }

  /**
   * Apply cursor style to the graph container and all X6 child elements
   */
  private _applyCursorToGraphElements(cursor: string): void {
    if (!this._graphContainer) return;

    // Apply to the main container
    this._graphContainer.style.setProperty('cursor', cursor, 'important');

    // Apply to all X6 graph elements that might override the cursor
    const x6Elements = this._graphContainer.querySelectorAll(
      '.x6-graph, .x6-graph-view, .x6-graph-scroller, .x6-graph-svg, .x6-graph-svg-container, svg',
    );

    x6Elements.forEach(element => {
      (element as HTMLElement).style.setProperty('cursor', cursor, 'important');
    });
  }

  /**
   * Clear all cursor styles from graph elements
   */
  private _clearCursorStyles(): void {
    if (!this._graphContainer) return;

    // Remove cursor style from the main container
    this._graphContainer.style.removeProperty('cursor');

    // Remove cursor styles from all X6 graph elements
    const x6Elements = this._graphContainer.querySelectorAll(
      '.x6-graph, .x6-graph-view, .x6-graph-scroller, .x6-graph-svg, .x6-graph-svg-container, svg',
    );

    x6Elements.forEach(element => {
      (element as HTMLElement).style.removeProperty('cursor');
    });
  }
}
