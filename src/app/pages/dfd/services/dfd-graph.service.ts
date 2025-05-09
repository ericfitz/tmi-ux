import { Injectable } from '@angular/core';
import { Graph, Shape, Cell, Node, Model } from '@antv/x6';
import { Transform } from '@antv/x6-plugin-transform';
import { Snapline } from '@antv/x6-plugin-snapline';
import { History } from '@antv/x6-plugin-history';
import { Export } from '@antv/x6-plugin-export';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdEventService } from './dfd-event.service';
import { DfdLabelEditorService } from './dfd-label-editor.service';
import { HighlighterConfig } from '../models/highlighter-config.interface';
// Import NodeData interface for type checking - used in type assertions
import { NodeData } from '../models/node-data.interface';
import { TextboxShape } from '../models/textbox-shape.model';

// Type guard function to check if an object is a NodeData
function isNodeData(data: unknown): data is NodeData {
  return data !== null && typeof data === 'object' && data !== undefined;
}

/**
 * Service for managing the X6 graph in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdGraphService {
  constructor(
    private logger: LoggerService,
    private dfdEventService: DfdEventService,
    private labelEditorService: DfdLabelEditorService,
  ) {}

  /**
   * Creates and configures the X6 graph
   * @param containerElement The container element
   * @param magnetAvailabilityHighlighter The highlighter configuration
   * @returns The configured graph instance
   */
  createGraph(
    containerElement: HTMLElement,
    magnetAvailabilityHighlighter: HighlighterConfig,
  ): Graph | null {
    try {
      const containerWidth = containerElement.clientWidth || 800;
      const containerHeight = containerElement.clientHeight || 600;

      this.logger.info(`Creating graph with dimensions: ${containerWidth}x${containerHeight}`);
      
      // Add a debug entry to ensure history events are getting recorded
      this.logger.debug('DFD-DEBUG: Setting up graph history listener');

      const graph: Graph = new Graph({
        container: containerElement,
        background: {
          color: '#F2F7FA',
        },
        grid: {
          visible: true,
          type: 'doubleMesh',
          args: [
            {
              color: '#eee',
              thickness: 1,
            },
            {
              color: '#ddd',
              thickness: 1,
              factor: 4,
            },
          ],
        },
        width: containerWidth,
        height: containerHeight,
        panning: true,
        mousewheel: {
          enabled: true,
          modifiers: ['ctrl', 'meta'],
          minScale: 0.5,
          maxScale: 2,
        },
        // Note: onCellAdded/onCellRemoved are not available in this version of X6
        // Enable node embedding
        embedding: {
          enabled: true,
          findParent({ node }) {
            const bbox = node.getBBox();
            return (
              graph.getNodes().filter(parent => {
                // Skip if the parent is the same as the node
                if (parent.id === node.id) return false;

                // Skip textbox shapes as potential parents
                if (parent instanceof TextboxShape) {
                  return false;
                }

                // Use proper type assertion to avoid unsafe assignment
                // Get the parent data and explicitly type it
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const rawData = parent.getData();
                // Use type guard to check if data is a valid NodeData object
                if (isNodeData(rawData) && rawData.parent === true) {
                  const parentBBox = parent.getBBox();
                  // Check if the node's center is inside the parent
                  const nodeCenter = bbox.getCenter();
                  return parentBBox.containsPoint(nodeCenter.x, nodeCenter.y);
                }
                return false;
              }) || []
            );
          },
        },
        highlighting: {
          magnetAvailable: magnetAvailabilityHighlighter,
          magnetAdsorbed: {
            name: 'stroke',
            args: {
              attrs: {
                fill: '#fff',
                stroke: '#31d0c6',
              },
            },
          },
          // Add highlighting for embedding
          embedding: {
            name: 'stroke',
            args: {
              padding: -1,
              attrs: {
                stroke: '#73d13d',
              },
            },
          },
        },
        connecting: {
          snap: true,
          allowBlank: false,
          allowLoop: false, // Prevent self-loops
          highlight: true,
          connector: 'smooth',
          // Use anchor instead of connectionPoint for compatibility
          connectionPoint: 'boundary',
          anchor: {
            name: 'center', // Center anchor for all connections
            args: {
              offset: 0 // No offset
            }
          },
          sourceAnchor: 'center', // Source anchor
          targetAnchor: 'center', // Target anchor
          router: {
            name: 'normal',
          },
          // Enable edge creation from ports
          validateMagnet(args) {
             
            const magnet = args.magnet;
            if (!magnet) return false;
             
            return magnet.getAttribute('magnet') === 'active';
          },
          // Prevent edge creation until mouse is released on a valid target
          validateConnection(args) {
             
            const { sourceView, targetView, sourceMagnet, targetMagnet } = args;
            // Prevent creating an edge if source and target are the same
            if (sourceView === targetView && sourceMagnet === targetMagnet) {
              return false;
            }

            if (!targetMagnet || !sourceMagnet) {
              return false;
            }

            // Allow connections to any port
            const sourcePortGroup = sourceMagnet.getAttribute('port-group') as
              | 'top'
              | 'right'
              | 'bottom'
              | 'left'
              | null;
            const targetPortGroup = targetMagnet.getAttribute('port-group') as
              | 'top'
              | 'right'
              | 'bottom'
              | 'left'
              | null;

            if (!sourcePortGroup || !targetPortGroup) {
              return false;
            }

            // Get the source and target cells
            const sourceCell = sourceView?.cell;
            const targetCell = targetView?.cell;

            // Prevent connecting to self
            if (sourceCell === targetCell) {
              return false;
            }

            // Allow connections between any node types
            return true;
          },
          createEdge() {
            return new Shape.Edge({
              attrs: {
                line: {
                  stroke: '#333333', // Match node stroke color
                  strokeWidth: 2, // Match node stroke width
                  targetMarker: {
                    name: 'classic',
                    size: 7,
                  },
                },
                label: {
                  text: 'Flow',
                  class: 'dfd-label',
                  fill: '#333333',
                  textAnchor: 'middle',
                  textVerticalAnchor: 'middle',
                  pointerEvents: 'none',
                },
              },
              // Add default vertices for better routing
              vertices: [
                // Default vertices will be adjusted by the router
              ],
              // Add label position
              labels: [
                {
                  position: 0.5,
                  attrs: {
                    text: {
                      text: 'Flow',
                      class: 'dfd-label',
                      fill: '#333333',
                      textAnchor: 'middle',
                      textVerticalAnchor: 'middle',
                      pointerEvents: 'none',
                    },
                  },
                },
              ],
            });
          },
        },
      });
      
      // Set up event listeners for cell addition/removal
      graph.on('cell:added', ({ cell }) => {
        const cellType = cell.isNode() ? 'Node' : 'Edge';
        this.logger.info(`${cellType} added to graph`, {
          cellId: cell.id,
          type: cell.constructor.name
        });
      });
      
      graph.on('cell:removed', ({ cell }) => {
        const cellType = cell.isNode() ? 'Node' : 'Edge';
        this.logger.info(`${cellType} removed from graph`, {
          cellId: cell.id,
          type: cell.constructor.name
        });
      });

      // Register the Transform plugin for node resizing
      graph.use(
        new Transform({
          resizing: {
            enabled: true,
            minWidth: 60,
            minHeight: 30,
            // Preserve aspect ratio for ProcessShape (circle)
            preserveAspectRatio: false,
            orthogonal: false,
          },
          rotating: false, // Disable rotation
        }),
      );

      // Register the Snapline plugin for alignment guides
      graph.use(
        new Snapline({
          enabled: true,
          tolerance: 15, // Increased tolerance for easier snapping
          sharp: true, // Show sharp snaplines
          resizing: true, // Enable snaplines during resizing
          clean: 1500, // Increased time to keep snaplines visible
          className: 'x6-snapline', // CSS class for styling
        }),
      );

      // Track if we're currently in a drag operation
      let isDragging = false;
      let lastLabelUpdateTime = 0;
      const labelUpdateThreshold = 500; // ms

      // Set up mouse events to track dragging state globally
      graph.on('node:mousedown', () => {
        this.logger.debug('Node mousedown - potential drag starting');
        isDragging = true;
      });
      
      graph.on('node:mouseup', ({node}) => {
        this.logger.debug('Node mouseup - drag ended', {nodeId: node.id});
        
        // Reset dragging state after a short delay to catch trailing events
        setTimeout(() => {
          // Store current position for logging
          const currentPosition = node.getPosition();
          
          // Force a history entry by making a small movement and then restoring position
          const originalPosition = { ...currentPosition };
          
          // Log what we're doing
          this.logger.info('Creating history entry for final node position', {
            nodeId: node.id,
            position: originalPosition
          });
          
          // Create a "snapshot" by explicitly setting position (creates history entry)
          // Use silent: false to ensure history entry is created
          node.setPosition(originalPosition.x, originalPosition.y, { silent: false });
          
          // Reset dragging flag now that we've recorded the position
          isDragging = false;
          this.logger.debug('Drag flag reset after forcing position snapshot');
        }, 50);
      });
      
      // Same for edges
      graph.on('edge:mousedown', () => {
        this.logger.debug('Edge mousedown - potential drag starting');
        isDragging = true;
      });
      
      graph.on('edge:mouseup', ({edge}) => {
        this.logger.debug('Edge mouseup - drag ended', {edgeId: edge.id});
        
        // Reset dragging state after a short delay to catch trailing events
        setTimeout(() => {
          // Get current vertices for logging
          const vertices = edge.getVertices();
          
          // Clone the vertices array to create a new reference
          // Use Array.from to safely spread vertices with proper typing
          const originalVertices = Array.from(vertices);
          
          // Log what we're doing
          this.logger.info('Creating history entry for final edge position', {
            edgeId: edge.id,
            vertices: originalVertices
          });
          
          // Force a history entry by explicitly setting vertices
          // This will trigger a history entry with the final edge position
          edge.setVertices(originalVertices, { silent: false });
          
          // Reset dragging flag now that we've recorded the position
          isDragging = false;
          this.logger.debug('Drag flag reset after forcing edge position snapshot');
        }, 50);
      });

      // Register the History plugin for undo/redo functionality
      graph.use(
        new History({
          enabled: true,
          // Note: batchDelayTimer is not available in this version of the X6 history plugin 
          beforeAddCommand: <T extends History.ModelEvents>(event: T, args: Model.EventArgs[T]) => {
            this.logger.debug(`DFD-DEBUG: History considering event: ${String(event)}`);
            // Convert event to string for comparison
            const eventName = String(event);

            // Filter out selection/deselection events, history state events, and event bus events
            if (
              eventName === 'node:selected' ||
              eventName === 'node:unselected' ||
              eventName === 'selection:changed' ||
              eventName === 'cell:selected' ||
              eventName === 'cell:unselected' ||
              eventName === 'cell:highlight' ||
              eventName === 'cell:unhighlight' ||
              eventName.includes('select') ||
              eventName.includes('highlight') ||
              eventName === 'canUndoChanged' ||
              eventName === 'canRedoChanged' ||
              eventName.includes('Event')
            ) {
              return false;
            }

            // For node movement, only record the final position after dragging
            if (eventName === 'node:moved') {
              // Check if this is an intermediate drag event
              if (args && 'options' in args && args.options && args.options['dragging'] === true) {
                isDragging = true;
                this.logger.debug('Skipping intermediate drag event', { event: eventName });
                return false; // Skip intermediate drag events
              }
              // Only record the final position (when dragging is complete)
              this.logger.debug('Drag completed, recording final position', { event: eventName });
              isDragging = false;
              return true;
            }

            // For edge movement, only record the final position
            if (eventName === 'edge:moved' && args && 'options' in args && args.options && args.options['dragging']) {
              isDragging = true;
              this.logger.debug('Skipping intermediate edge drag event', { event: eventName });
              return false;
            }
            
            // Explicitly filter out position changes during dragging (these should only be recorded at the end of a drag)
            if (eventName === 'cell:change:position' || (eventName.startsWith('cell:change:') && args && 'key' in args && args.key === 'position')) {
              if (isDragging) {
                this.logger.debug('Skipping position change during drag', { event: eventName });
                return false;
              }
              this.logger.debug('Recording position change (not during drag)', { event: eventName });
            }
            
            // For label changes, always record them to history
            if (eventName === 'cell:change:attrs' && args && 'current' in args && 
                args.current && typeof args.current === 'object' && 
                'label' in args.current) {
              this.logger.info('Adding label change to history', {
                event: eventName, 
                cellId: args && 'cell' in args ? args.cell.id : 'unknown'
              });
              return true;
            }

            // Filter out cell:change:* events during dragging
            if (eventName.startsWith('cell:change:')) {
              // If we're in a dragging operation, don't record these changes
              if (isDragging) {
                this.logger.debug('Skipping change event during drag', { event: eventName, key: args && 'key' in args ? args.key : 'unknown' });
                return false;
              }

              // Filter out tools-related changes
              if (args && 'key' in args && args.key === 'tools') {
                this.logger.debug('Filtering out tools-related change from history', {
                  event: eventName,
                  key: args.key,
                });
                return false;
              }

              // Filter out selection-related attribute changes
              if (
                args && 'key' in args && args.key === 'attrs' &&
                (('current' in args && args.current && typeof args.current === 'object' && 'selected' in args.current) ||
                 ('previous' in args && args.previous && typeof args.previous === 'object' && 'selected' in args.previous))
              ) {
                this.logger.debug('Filtering out selection-related attribute change from history', {
                  event: eventName,
                  key: args.key,
                  current: 'current' in args ? (args.current as Record<string, unknown>) : undefined,
                  previous: 'previous' in args ? (args.previous as Record<string, unknown>) : undefined,
                });
                return false;
              }

              // For label position updates, only record significant changes
              if (args && 'key' in args && (args.key === 'attrs' || args.key === 'data')) {
                const now = Date.now();
                // If this is a rapid update (less than threshold ms since last update), skip it
                if (now - lastLabelUpdateTime < labelUpdateThreshold) {
                  return false;
                }
                lastLabelUpdateTime = now;
              }
            }

            // Filter out mouse events that shouldn't be in history
            const eventsToIgnore = [
              // Mouse enter/leave events
              'node:mouseenter',
              'node:mouseleave',
              'edge:mouseenter',
              'edge:mouseleave',
              'node:port:mouseenter',
              'node:port:mouseleave',

              // Mouse move events
              'node:mousemove',
              'edge:mousemove',
              'blank:mousemove',

              // Mouse down/up events on blank areas
              'blank:mousedown',
              'blank:mouseup',

              // Additional events to ignore
              'cell:mousedown',
              'cell:mousemove',
              'cell:mouseup',
              'cell:click',
              'cell:dblclick',
              'cell:contextmenu',
              'cell:mouseover',
              'cell:mouseout',
              'blank:click',
              'blank:dblclick',
              'tool:remove',
              'scale',
              'resize',
              'rotate',
              'viewport:change',
            ];

            if (eventsToIgnore.includes(eventName)) {
              return false;
            }

            // Log the event that's being added to history with detailed information
            this.logger.info(`Adding event to history: ${eventName}`, {
              event: eventName,
              key: args && 'key' in args ? args.key : undefined,
              cell: args && 'cell' in args && args.cell ? args.cell.constructor.name : 'Unknown',
              // Include the current and previous values if it's a cell:change event
              currentValue: eventName.startsWith('cell:change:') && args && 'current' in args ? (args.current as Record<string, unknown>) : undefined,
              previousValue: eventName.startsWith('cell:change:') && args && 'previous' in args ? (args.previous as Record<string, unknown>) : undefined,
            });

            // Immediately notify of history status change
            const history = graph.getPlugin<History>('history');
            if (history) {
              setTimeout(() => {
                if (this.dfdEventService) {
                  this.dfdEventService.notifyHistoryChange(history);
                }
              }, 50);
            }

            // Add all other events to history
            return true;
          },
        }),
      );

      // Register the Export plugin for exporting diagrams
      graph.use(new Export());

      // Register the Keyboard plugin for keyboard shortcuts
      graph.use(
        new Keyboard({
          enabled: true,
          global: true,
        }),
      );

      // Selection is now handled by the custom selection mechanism in dfd-event.service.ts

      // Add custom CSS for snaplines
      this.addSnaplineStyles();

      // Configure resize handles to be square-shaped
      this.configureResizeHandles(graph);

      return graph;
    } catch (error) {
      this.logger.error('Error creating graph:', error);
      return null;
    }
  }

  /**
   * Adds custom CSS for snaplines and selection boxes
   */
  private addSnaplineStyles(): void {
    // No longer needed - styles are now in _graph-styles.scss
    // This method is kept for backward compatibility
    this.logger.debug('Using external CSS for snapline styles');
  }

  /**
   * Configures resize handles to be square-shaped
   * @param graph The X6 graph instance
   */
  private configureResizeHandles(graph: Graph): void {
    const transformPlugin = graph.getPlugin<Transform>('transform');
    if (transformPlugin) {
      // No longer needed to add inline styles - styles are now in _graph-styles.scss
      this.logger.debug('Using external CSS for resize handle styles');
    }
  }

  /**
   * Validates the graph container and sets up dimensions
   * @param containerElement The container element
   * @param logger The logger service
   * @returns The container element with proper dimensions
   */
  validateAndSetupContainer(
    containerElement: HTMLElement,
    logger: LoggerService,
  ): HTMLElement | null {
    if (!containerElement) {
      logger.error('Graph container reference is not available');
      return null;
    }

    const initialContainerHeight = containerElement.clientHeight;
    const initialContainerWidth = containerElement.clientWidth;

    logger.info(`Initial container dimensions: ${initialContainerWidth}x${initialContainerHeight}`);

    // Check if the container has a valid height
    if (initialContainerHeight <= 0) {
      logger.warn(
        `Graph container has invalid height: ${initialContainerHeight}px. Using fallback height.`,
      );
      // Set a fallback height
      containerElement.style.height = '600px';
      containerElement.style.minHeight = '600px';
      // Use the fallback height
      const fallbackHeight = 600;
      logger.info(`Using fallback height: ${fallbackHeight}px`);

      // Force a layout recalculation
      containerElement.getBoundingClientRect();
    }

    // Log container dimensions
    const containerWidth = containerElement.clientWidth;
    let containerHeight = containerElement.clientHeight;

    // If height is still 0 after our fallback attempt, use the fallback value
    if (containerHeight <= 0) {
      containerHeight = 600;
    }

    if (containerWidth <= 0) {
      logger.warn('Container width is invalid, using fallback width of 800px');
      containerElement.style.width = '800px';
      containerElement.style.minWidth = '800px';
      containerElement.getBoundingClientRect();
    }

    logger.info(`Graph container dimensions: ${containerWidth}x${containerHeight}`);

    // Set explicit dimensions on the container element
    containerElement.style.width = `${containerWidth || 800}px`;
    containerElement.style.height = `${containerHeight}px`;

    return containerElement;
  }

  /**
   * Sets up label editing functionality using the keyboard plugin
   * @param graph The X6 graph instance
   */
  setupLabelEditing(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Get the keyboard plugin
    const keyboard = graph.getPlugin<Keyboard>('keyboard');
    if (!keyboard) {
      this.logger.warn('Keyboard plugin not found, label editing shortcuts will not work');
      return;
    }

    // Set up keyboard shortcuts for editing labels
    keyboard.bindKey(['f2', 'enter'], () => {
      // Use the custom selection mechanism instead of the Selection plugin
      const selectedNode = this.dfdEventService.getSelectedNode();
      if (selectedNode) {
        this.editCellLabel(selectedNode, graph);
      }
    });

    // Double-click on node or edge to edit label
    graph.on('node:dblclick', ({ node, e }) => {
      e.stopPropagation();
      this.editCellLabel(node, graph);
    });

    graph.on('edge:dblclick', ({ edge, e }) => {
      e.stopPropagation();
      this.editCellLabel(edge, graph);
    });
  }

  /**
   * Edits the label of a cell (node or edge)
   * @param cell The cell to edit
   * @param graph The X6 graph instance
   */
  private editCellLabel(cell: Cell, _graph: Graph): void {
    // Get the current label text
    let labelText = '';
    if (cell.isNode()) {
      // For nodes, get the label from the node data or attrs
      const nodeData = cell.getData<Record<string, unknown>>();
      const safeNodeData = typeof nodeData === 'object' && nodeData !== null ? nodeData : {};

      if (safeNodeData && typeof safeNodeData['label'] === 'string') {
        labelText = safeNodeData['label'];
      } else {
        // If no label in data, get it from the attrs
        const attrLabel = cell.attr('label/text');
        labelText = typeof attrLabel === 'string' ? attrLabel : '';
      }
    } else if (cell.isEdge()) {
      // For edges, get the label from the edge attrs
      const attrLabel = cell.attr('label/text');
      labelText = typeof attrLabel === 'string' ? attrLabel : '';
    }

    // Create a prompt to edit the label
    const newText = window.prompt('Edit label:', labelText);
    if (newText !== null) {
      this.saveCellLabel(cell, newText);
    }
  }

  /**
   * Saves the label text to the cell
   * @param cell The cell to save the label to
   * @param newText The new label text
   */
  private saveCellLabel(cell: Cell, newText: string): void {
    try {
      if (cell.isNode()) {
        const node = cell;

        // Check if the node is a TextboxShape
        if (node.constructor.name === 'TextboxShape') {
          // Update the HTML content for TextboxShape
          // Cast to TextboxShape to access the updateHtml method
          (node as unknown as TextboxShape).updateHtml(newText);

          // Also update the label in the node data
          const nodeData = node.getData<Record<string, unknown>>();
          const safeNodeData = typeof nodeData === 'object' && nodeData !== null ? nodeData : {};

          const updatedData = { ...safeNodeData, ['label']: newText };
          node.setData(updatedData);
        } else {
          // Update node label for other shape types
          node.attr('label/text', newText);

          // Add the dfd-label class to ensure proper styling
          node.attr('label/class', 'dfd-label');

          // Also update the label in the node data
          const nodeData = node.getData<Record<string, unknown>>();
          const safeNodeData = typeof nodeData === 'object' && nodeData !== null ? nodeData : {};

          const updatedData = { ...safeNodeData, ['label']: newText };
          node.setData(updatedData);
        }
      } else if (cell.isEdge()) {
        const edge = cell;

        // Update edge label in both attr and labels array
        edge.attr('label/text', newText);
        edge.attr('label/class', 'dfd-label');

        // Update the label in the labels array
        const labels = edge.getLabels();
        if (labels && labels.length > 0) {
          // Define a proper type for the edge label
          interface EdgeLabel {
            attrs?: {
              text?: {
                text?: string;
                [key: string]: unknown;
              };
              [key: string]: unknown;
            };
            [key: string]: unknown;
          }

          edge.setLabels(
            labels.map((label: EdgeLabel) => ({
              ...label,
              attrs: {
                ...label.attrs,
                text: {
                  ...(label.attrs?.text || {}),
                  text: newText,
                  class: 'dfd-label',
                },
              },
            })),
          );
        }
      }
    } catch (error) {
      this.logger.error('Error saving label:', error);
    }
  }

  /**
   * Sets up the label for a node that has been restored via redo operation
   * @param node The node that was restored
   * @param graph The X6 graph instance
   */
  setupLabelForRestoredNode(node: Node, graph: Graph): void {
    try {
      // Skip if node is not valid
      if (!node || !node.isNode || !node.isNode()) {
        return;
      }

      const nodeId = node.id;
      const nodeType = node.constructor ? node.constructor.name : 'Unknown';

      this.logger.debug('Setting up label for restored node', {
        nodeId,
        nodeType,
        hasGetData: typeof node.getData === 'function',
        hasAttr: typeof node.attr === 'function',
      });

      // Get the node data to retrieve the label
      const nodeData = node.getData<NodeData>();
      if (!nodeData) {
        this.logger.debug('No node data found for restored node', { nodeId });
        return;
      }

      // Get the label from node data
      const label = nodeData.label;
      this.logger.debug('Node data retrieved', {
        nodeId,
        hasLabel: typeof label === 'string',
        label: typeof label === 'string' ? label : 'undefined',
        nodeData: JSON.stringify(nodeData),
      });

      if (typeof label === 'string') {
        // Apply consistent label styling from our stylesheet
        node.attr({
          label: {
            text: label,
            class: 'dfd-label',
            display: 'block',
            opacity: 1,
            fontFamily: 'Roboto Condensed, Arial, sans-serif',
            fontSize: 12,
            fill: '#333',
            textAnchor: 'middle',
            dominantBaseline: 'middle',
            pointerEvents: 'all'
          }
        });
        
        // Try to recreate the original node type - this is helpful to fix undo/redo
        // Determine real node type from its data
        if (nodeData) {
          // Try to determine the original shape type
          let shapeType: string | undefined;
          
          // Check if type is explicitly stored in the data
          if ('type' in nodeData) {
            shapeType = String(nodeData['type']);
          } 
          // Otherwise, try to infer from the label
          else if (typeof label === 'string') {
            // Look for clues in the label first
            const labelLower = label.toLowerCase();
            if (labelLower === 'actor' || labelLower.includes('actor')) {
              shapeType = 'actor';
            } else if (labelLower === 'process' || labelLower.includes('process')) {
              shapeType = 'process';
            } else if (labelLower === 'store' || labelLower.includes('store')) {
              shapeType = 'store';
            } else if (labelLower.includes('security') || labelLower.includes('boundary')) {
              shapeType = 'securityBoundary';
            } else if (labelLower.includes('text') || labelLower === 'text') {
              shapeType = 'textbox';
            }
          }
          
          // Apply data attributes for CSS styling based on the detected shape type
          if (nodeType === 'Rect' || nodeType === 'Circle' || (shapeType && nodeType !== shapeType)) {
            this.logger.debug('Node restored with generic type, applying appropriate data attributes', {
              nodeId,
              currentType: nodeType,
              detectedType: shapeType,
              label
            });
            
            // Set a data attribute to help identify the node type
            if (shapeType) {
              // Set the data-shape-type attribute for CSS targeting
              node.attr('data-shape-type', shapeType);
              
              // Store specific setup (with two horizontal lines and no overall border)
              if (shapeType === 'store') {
                // For store shapes, we need to make sure the node has the correct structure
                // and attributes to match the original StoreShape definition
                
                // Update the markup to include the correct elements
                // This is critical because the restored node might not have the right markup elements
                const storeMarkup = [
                  {
                    tagName: 'rect',
                    selector: 'body',
                  },
                  {
                    tagName: 'path',
                    selector: 'topLine',
                  },
                  {
                    tagName: 'path',
                    selector: 'bottomLine',
                  },
                  {
                    tagName: 'text',
                    selector: 'label',
                  },
                ];
                
                try {
                  // First apply the store markup
                  node.setMarkup(storeMarkup);
                  
                  // Then apply the attributes exactly as they are in the StoreShape definition
                  node.attr({
                    root: {
                      magnet: false,
                    },
                    body: {
                      fill: '#FFFFFF',
                      stroke: 'transparent',
                      opacity: 1,
                    },
                    topLine: {
                      stroke: '#333333',
                      strokeWidth: 2,
                      refD: 'M 0 0 l 200 0',
                    },
                    bottomLine: {
                      stroke: '#333333',
                      strokeWidth: 2,
                      refY: '100%',
                      refD: 'M 0 0 l 200 0',
                    }
                  });
                  
                  // Force an update to ensure markup changes take effect
                  const view = graph.findViewByCell(node);
                  if (view) {
                    view.confirmUpdate(511);
                  }
                } catch (error) {
                  this.logger.warn('Could not fully restore store shape markup and attributes', {
                    nodeId,
                    error
                  });
                }
                
                // Ensure dimensions match the store shape (wider than tall)
                const { width, height } = node.size();
                if (height > width || height > 50) {
                  node.resize(Math.max(width, 120), 40);
                }
              } else if (shapeType === 'process') {
                // For process shapes, ensure square aspect ratio
                const { width, height } = node.size();
                if (Math.abs(width - height) > 10) {
                  const size = Math.max(width, height, 80);
                  node.resize(size, size);
                }
                
                // Set appropriate attributes for process circles
                node.attr({
                  body: {
                    fill: '#FFFFFF',
                    stroke: '#333333',
                    strokeWidth: 2,
                  }
                });
              } else if (shapeType === 'securityBoundary') {
                // Security boundaries should be behind other elements
                node.setZIndex(-1);
                
                // Ensure proper sizing for security boundaries
                const { width, height } = node.size();
                if (width < 180 || height < 100) {
                  node.resize(Math.max(width, 180), Math.max(height, 100));
                }
                
                // Set the parent flag to true to allow embedding
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const existingData = node.getData() || {};
                node.setData({
                  ...existingData,
                  parent: true
                });
                
                // Add appropriate styling from original SecurityBoundaryShape
                node.attr({
                  body: {
                    fill: '#F5F5F5',
                    fillOpacity: 0.5,
                    stroke: '#666666',
                    strokeWidth: 1.5,
                    strokeDasharray: '5,2'
                  }
                });
              }
            }
          }
        }

        this.logger.debug('Restored label text and style for node', { nodeId, label });

        // Apply the label position using the injected labelEditorService
        if (this.labelEditorService) {
          // Apply the label position
          this.labelEditorService.applyLabelPosition(node, graph);
          this.logger.info('Applied label position for restored node', { nodeId, nodeType });

          // Force a redraw of the node
          const view = graph.findViewByCell(node);
          if (view) {
            view.confirmUpdate(31); // Use flag 31 (11111 in binary) to force full update
            this.logger.debug('Forced full view update for node', { nodeId });
          }
        } else {
          this.logger.warn('Label editor service not available for restored node', { nodeId });
        }
      } else {
        this.logger.debug('No label found in node data for restored node', { nodeId });
      }
    } catch (error) {
      this.logger.error('Error setting up label for restored node:', error);
    }
  }
}
