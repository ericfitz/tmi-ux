import { Injectable } from '@angular/core';
import { Graph, Shape } from '@antv/x6';
import { Transform } from '@antv/x6-plugin-transform';
import { Snapline } from '@antv/x6-plugin-snapline';
import { History } from '@antv/x6-plugin-history';
import { Export } from '@antv/x6-plugin-export';
import { LoggerService } from '../../../core/services/logger.service';
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
  constructor(private logger: LoggerService) {}

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
          connectionPoint: 'boundary',
          anchor: 'center', // Ensure proper anchor point
          sourceAnchor: 'center', // Source anchor
          targetAnchor: 'center', // Target anchor
          router: {
            name: 'normal',
          },
          // Enable edge creation from ports
          validateMagnet({ magnet }) {
            return magnet.getAttribute('magnet') === 'active';
          },
          // Prevent edge creation until mouse is released on a valid target
          validateConnection({ sourceView, targetView, sourceMagnet, targetMagnet }) {
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
                  fill: '#333333',
                  fontSize: 12,
                  fontFamily: '"Roboto Condensed", Arial, sans-serif',
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
                      fill: '#333333',
                      fontSize: 12,
                      fontFamily: '"Roboto Condensed", Arial, sans-serif',
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

      // Register the History plugin for undo/redo functionality
      graph.use(
        new History({
          enabled: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          beforeAddCommand: (event, args: any) => {
            this.logger.debug('History: before add command', event, args);

            // Convert event to string for comparison
            const eventName = String(event);

            // Filter out selection/deselection events
            if (
              eventName === 'node:selected' ||
              eventName === 'node:unselected' ||
              eventName === 'selection:changed'
            ) {
              return false;
            }

            // For node movement, only record the final position after dragging
            if (eventName === 'node:moved') {
              // Check if this is an intermediate drag event
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (args && args.options && args.options.dragging === true) {
                isDragging = true;
                return false; // Skip intermediate drag events
              }
              // Only record the final position (when dragging is complete)
              isDragging = false;
              return true;
            }

            // For edge movement, only record the final position
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (eventName === 'edge:moved' && args && args.options && args.options.dragging) {
              isDragging = true;
              return false;
            }

            // Filter out cell:change:* events during dragging or rapid label updates
            if (eventName.startsWith('cell:change:')) {
              // If we're in a dragging operation, don't record these changes
              if (isDragging) {
                return false;
              }

              // Check if this is a label position update
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (args && (args.key === 'attrs' || args.key === 'data')) {
                const now = Date.now();
                // If this is a rapid update (less than threshold ms since last update), skip it
                if (now - lastLabelUpdateTime < labelUpdateThreshold) {
                  return false;
                }
                lastLabelUpdateTime = now;
              }
            }

            // Filter out other events that shouldn't be in history
            const eventsToIgnore = [
              'node:mouseenter',
              'node:mouseleave',
              'edge:mouseenter',
              'edge:mouseleave',
              'node:port:mouseenter',
              'node:port:mouseleave',
            ];

            if (eventsToIgnore.includes(eventName)) {
              return false;
            }

            // Add all other events to history
            return true;
          },
        }),
      );

      // Register the Export plugin for exporting diagrams
      graph.use(new Export());

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
   * Adds custom CSS for snaplines
   */
  private addSnaplineStyles(): void {
    const snaplineStyle = document.createElement('style');
    snaplineStyle.textContent = `
      .x6-snapline {
        stroke: #ff3366;
        stroke-width: 2;
        stroke-dasharray: 5, 5;
        z-index: 9999;
        pointer-events: none;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(snaplineStyle);
  }

  /**
   * Configures resize handles to be square-shaped
   * @param graph The X6 graph instance
   */
  private configureResizeHandles(graph: Graph): void {
    const transformPlugin = graph.getPlugin<Transform>('transform');
    if (transformPlugin) {
      // Apply custom styles to resize handles
      // Note: We're using CSS to style the handles as squares
      const style = document.createElement('style');
      style.textContent = `
        /* Base style for all resize handles */
        .x6-node-selected .x6-widget-transform-resize {
          width: 8px !important;
          height: 8px !important;
          border-radius: 0 !important;
          background-color: #000000 !important;
          border: none !important;
          outline: none !important;
          margin: 2px !important;
        }
        
        /* Top handles - move up */
        .x6-widget-transform-resize-nw,
        .x6-widget-transform-resize-n,
        .x6-widget-transform-resize-ne {
          margin-top: 4px !important;
        }
        
        /* Bottom handles - move down */
        .x6-widget-transform-resize-sw,
        .x6-widget-transform-resize-s,
        .x6-widget-transform-resize-se {
          margin-bottom: 4px !important;
        }
        
        /* Left handles - move left */
        .x6-widget-transform-resize-nw,
        .x6-widget-transform-resize-w,
        .x6-widget-transform-resize-sw {
          margin-left: 4px !important;
        }
        
        /* Right handles - move right */
        .x6-widget-transform-resize-ne,
        .x6-widget-transform-resize-e,
        .x6-widget-transform-resize-se {
          margin-right: 4px !important;
        }
      `;
      document.head.appendChild(style);
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
}
