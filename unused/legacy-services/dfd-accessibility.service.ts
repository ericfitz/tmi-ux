import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
import { LoggerService } from '../../../core/services/logger.service';
// These shapes are used in the getShapeType function, which is imported
// import { ActorShape } from '../models/actor-shape.model';
// import { ProcessShape } from '../models/process-shape.model';
// import { StoreShape } from '../models/store-shape.model';
// import { SecurityBoundaryShape } from '../models/security-boundary-shape.model';
import { DfdErrorService } from './dfd-error.service';
import { DfdEventBusService } from './dfd-event-bus.service';
import { getShapeType } from '../utils/dfd-utils';

/**
 * Keyboard actions that can be performed
 */
export enum KeyboardAction {
  SelectNext = 'selectNext',
  SelectPrevious = 'selectPrevious',
  Delete = 'delete',
  MoveUp = 'moveUp',
  MoveDown = 'moveDown',
  MoveLeft = 'moveLeft',
  MoveRight = 'moveRight',
  EditLabel = 'editLabel',
  Escape = 'escape',
  Undo = 'undo',
  Redo = 'redo',
}

/**
 * Service for managing accessibility features
 * Implements keyboard navigation, ARIA labels, and other accessibility features
 */
@Injectable({
  providedIn: 'root',
})
export class DfdAccessibilityService {
  // The graph instance
  private _graph: Graph | null = null;

  // Current focused node index for keyboard navigation
  private _focusedNodeIndex = -1;

  // Movement increment for keyboard navigation (in pixels)
  private readonly MOVEMENT_INCREMENT = 10;

  constructor(
    private logger: LoggerService,
    private errorService: DfdErrorService,
    private eventBus: DfdEventBusService,
  ) {}

  /**
   * Initialize the accessibility service with a graph instance
   * @param graph The graph to make accessible
   */
  initialize(graph: Graph): void {
    this._graph = graph;
    this.setupAriaAttributes();
    this.logger.info('Accessibility service initialized');
  }

  /**
   * Setup ARIA attributes on the graph container
   */
  private setupAriaAttributes(): void {
    if (!this._graph) return;

    const container = this._graph.container;

    // Add ARIA attributes to the container
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', 'Data Flow Diagram Editor');
    container.setAttribute(
      'aria-description',
      'Interactive diagram editor for creating data flow diagrams',
    );
    container.setAttribute('tabindex', '0');

    // Make the container focusable and add keyboard event listener
    container.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  /**
   * Handle keyboard events
   * @param event The keyboard event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this._graph) return;

    // Get the action from the key
    const action = this.getActionFromKey(event);
    if (!action) return;

    // Prevent default behavior for handled keys
    event.preventDefault();

    // Execute the action
    this.executeAction(action);
  }

  /**
   * Map a keyboard event to an action
   * @param event The keyboard event
   * @returns The corresponding action, or null if no action
   */
  private getActionFromKey(event: KeyboardEvent): KeyboardAction | null {
    // Tab navigation
    if (event.key === 'Tab') {
      return event.shiftKey ? KeyboardAction.SelectPrevious : KeyboardAction.SelectNext;
    }

    // Arrow keys for movement
    if (event.key === 'ArrowUp') return KeyboardAction.MoveUp;
    if (event.key === 'ArrowDown') return KeyboardAction.MoveDown;
    if (event.key === 'ArrowLeft') return KeyboardAction.MoveLeft;
    if (event.key === 'ArrowRight') return KeyboardAction.MoveRight;

    // Delete key
    if (event.key === 'Delete' || event.key === 'Backspace') return KeyboardAction.Delete;

    // Edit label
    if (event.key === 'Enter' || event.key === 'F2') return KeyboardAction.EditLabel;

    // Escape
    if (event.key === 'Escape') return KeyboardAction.Escape;

    // Undo/Redo
    if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      return event.shiftKey ? KeyboardAction.Redo : KeyboardAction.Undo;
    }
    if (event.key === 'y' && (event.ctrlKey || event.metaKey)) {
      return KeyboardAction.Redo;
    }

    return null;
  }

  /**
   * Execute a keyboard action
   * @param action The action to execute
   */
  private executeAction(action: KeyboardAction): void {
    if (!this._graph) return;

    const nodes = this._graph.getNodes();
    if (nodes.length === 0) return;

    // Get the currently selected node
    const selectedNode = this.eventBus.selectedNode;

    switch (action) {
      case KeyboardAction.SelectNext:
        this.selectNextNode();
        break;

      case KeyboardAction.SelectPrevious:
        this.selectPreviousNode();
        break;

      case KeyboardAction.Delete:
        if (selectedNode) {
          this._graph.removeNode(selectedNode);
        }
        break;

      case KeyboardAction.MoveUp:
        if (selectedNode) {
          this.moveNode(selectedNode, 0, -this.MOVEMENT_INCREMENT);
        }
        break;

      case KeyboardAction.MoveDown:
        if (selectedNode) {
          this.moveNode(selectedNode, 0, this.MOVEMENT_INCREMENT);
        }
        break;

      case KeyboardAction.MoveLeft:
        if (selectedNode) {
          this.moveNode(selectedNode, -this.MOVEMENT_INCREMENT, 0);
        }
        break;

      case KeyboardAction.MoveRight:
        if (selectedNode) {
          this.moveNode(selectedNode, this.MOVEMENT_INCREMENT, 0);
        }
        break;

      case KeyboardAction.EditLabel:
        if (selectedNode) {
          this.editNodeLabel(selectedNode);
        }
        break;

      case KeyboardAction.Escape:
        // Deselect the current node
        if (selectedNode) {
          this.eventBus.publishNodeDeselected();
        }
        break;

      case KeyboardAction.Undo:
        {
          // Let the event bus handle undo/redo
          const history = this._graph.getPlugin<History>('history');
          if (history && history.canUndo()) {
            history.undo();
          }
        }
        break;

      case KeyboardAction.Redo:
        {
          const historyPlugin = this._graph.getPlugin<History>('history');
          if (historyPlugin && historyPlugin.canRedo()) {
            historyPlugin.redo();
          }
        }
        break;
    }
  }

  /**
   * Select the next node in the graph
   */
  private selectNextNode(): void {
    if (!this._graph) return;

    const nodes = this._graph.getNodes();
    if (nodes.length === 0) return;

    this._focusedNodeIndex = (this._focusedNodeIndex + 1) % nodes.length;
    this.selectNode(nodes[this._focusedNodeIndex]);
  }

  /**
   * Select the previous node in the graph
   */
  private selectPreviousNode(): void {
    if (!this._graph) return;

    const nodes = this._graph.getNodes();
    if (nodes.length === 0) return;

    this._focusedNodeIndex = (this._focusedNodeIndex - 1 + nodes.length) % nodes.length;
    this.selectNode(nodes[this._focusedNodeIndex]);
  }

  /**
   * Select a specific node
   * @param node The node to select
   */
  private selectNode(node: Node): void {
    if (!this._graph) return;

    // Update ARIA attributes
    this.updateNodeAriaAttributes(node);

    // Publish node selected event
    this.eventBus.publishNodeSelected(node);

    // Announce to screen readers
    this.announceNode(node);
  }

  /**
   * Move a node by the specified delta
   * @param node The node to move
   * @param dx X delta
   * @param dy Y delta
   */
  private moveNode(node: Node, dx: number, dy: number): void {
    if (!this._graph) return;

    const position = node.getPosition();
    node.setPosition(position.x + dx, position.y + dy);

    // Announce the movement to screen readers
    const direction = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';

    this.announce(`Moved ${this.getNodeName(node)} ${direction}`);
  }

  /**
   * Edit a node's label
   * @param node The node to edit
   */
  private editNodeLabel(node: Node): void {
    if (!this._graph) return;

    // Get the current label
    let labelText = '';

    // Use constructor name to determine if it's a TextboxShape
    const isTextbox = node.constructor.name === 'TextboxShape';

    if (isTextbox) {
      // For TextboxShape, the label is in the HTML content
      // This would need custom handling
      this.errorService.logWarning('Label editing not implemented for textbox nodes');
      return;
    } else {
      // For other shapes, get label from attributes
      labelText = node.attr('label/text') || '';
    }

    // Show a prompt for editing
    const newText = window.prompt('Edit label:', labelText);
    if (newText !== null && newText !== labelText) {
      // Update the label
      if (isTextbox) {
        // Use type assertion with a more specific type
        if (
          typeof (node as unknown as { updateHtml: (text: string) => void }).updateHtml ===
          'function'
        ) {
          (node as unknown as { updateHtml: (text: string) => void }).updateHtml(newText);
        }
      } else {
        node.attr('label/text', newText);
      }

      // Get the node data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const nodeData = node.getData();
      if (nodeData) {
        // Update the label in the data
        node.setData({
          ...nodeData,
          label: newText,
        });
      }

      // Announce the change
      this.announce(`Changed label to ${newText}`);
    }
  }

  /**
   * Update ARIA attributes for a node
   * @param node The node to update
   */
  private updateNodeAriaAttributes(node: Node): void {
    if (!this._graph) return;

    // Set aria-activedescendant on the container
    this._graph.container.setAttribute('aria-activedescendant', node.id);

    // Find the node's SVG element
    const nodeEl = this._graph.findViewByCell(node)?.container;
    if (nodeEl) {
      // Add ARIA attributes to the node element
      nodeEl.setAttribute('role', 'button');
      nodeEl.setAttribute('aria-label', this.getNodeName(node));
      nodeEl.setAttribute('tabindex', '0');
      nodeEl.setAttribute('aria-selected', 'true');
    }
  }

  /**
   * Get a human-readable name for a node
   * @param node The node
   * @returns Node name
   */
  private getNodeName(node: Node): string {
    // Get the label
    // Get label with default value for type safety
    const label = typeof node.attr('label/text') === 'string' ? node.attr('label/text') : 'Unnamed';

    // Get the shape type
    const shapeType = getShapeType(node);

    return `${shapeType || 'Unknown'} ${String(label)}`;
  }

  /**
   * Announce a message to screen readers
   * @param message The message to announce
   */
  private announce(message: string): void {
    // Create or reuse the live region
    let liveRegion = document.getElementById('dfd-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'dfd-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      liveRegion.style.clip = 'rect(0 0 0 0)';
      document.body.appendChild(liveRegion);
    }

    // Update the live region
    liveRegion.textContent = message;
  }

  /**
   * Announce information about a specific node
   * @param node The node to announce
   */
  private announceNode(node: Node): void {
    const name = this.getNodeName(node);
    const position = node.getPosition();

    this.announce(
      `Selected ${name} at position ${Math.round(position.x)}, ${Math.round(position.y)}`,
    );
  }

  /**
   * Dispose of the accessibility service
   */
  dispose(): void {
    if (this._graph) {
      // Remove event listeners
      this._graph.container.removeEventListener('keydown', this.handleKeyDown.bind(this));
      this._graph = null;
    }
  }
}
