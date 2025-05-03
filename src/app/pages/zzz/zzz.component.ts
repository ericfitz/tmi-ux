import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Graph, Shape, NodeView } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';
import { LoggerService } from '../../core/services/logger.service';
import { PassiveEventHandler } from '../diagram-editor/services/x6/passive-event-handler';

/**
 * Interface for highlighter configuration
 */
interface HighlighterConfig {
  name: string;
  args: {
    attrs: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    };
  };
}

// Define ActorShape class outside of the component
class ActorShape extends Shape.Rect {
  // Get ports by direction
  getPortsByDirection(direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[] {
    const ports = this.getPortsByGroup(direction);
    return ports.map(port => ({
      ...port,
      id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: direction },
    })) as PortManager.Port[];
  }

  // Get all ports from all directions
  getAllPorts(): PortManager.Port[] {
    return [
      ...this.getPortsByDirection('top'),
      ...this.getPortsByDirection('right'),
      ...this.getPortsByDirection('bottom'),
      ...this.getPortsByDirection('left'),
    ];
  }

  // Update ports for all directions
  updatePorts(_graph: Graph): ActorShape {
    const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
      'top',
      'right',
      'bottom',
      'left',
    ];
    const portsPerDirection = 1;

    let allPorts: PortManager.Port[] = [];

    directions.forEach(direction => {
      // Get existing ports or create initial ports if none exist
      const existingPorts = this.getPortsByDirection(direction);

      if (existingPorts.length === 0) {
        // Only create new ports if there are no existing ones
        // Create new ports inline
        const newPorts = Array.from({ length: portsPerDirection }, (_, index) => {
          return {
            id: `new-${direction}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
            group: direction,
            position: { name: direction },
          } as PortManager.Port;
        });
        allPorts = [...allPorts, ...newPorts];
      } else {
        // Keep existing ports
        allPorts = [...allPorts, ...existingPorts];
      }
    });

    // Update all ports at once
    this.prop(['ports', 'items'], allPorts, {
      rewrite: true,
    });

    return this;
  }
}

// Configure ActorShape
ActorShape.config({
  markup: [
    {
      tagName: 'rect',
      selector: 'body',
    },
  ],
  attrs: {
    root: {
      magnet: false,
    },
    body: {
      fill: '#FFFFFF',
      stroke: '#333333',
      strokeWidth: 2,
      opacity: 1,
    },
  },
  ports: {
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    groups: {
      top: {
        position: {
          name: 'top',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      right: {
        position: {
          name: 'right',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      bottom: {
        position: {
          name: 'bottom',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      left: {
        position: {
          name: 'left',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
    },
  },
  portMarkup: [
    {
      tagName: 'circle',
      selector: 'portBody',
    },
  ],
});

// Define ProcessShape class
class ProcessShape extends Shape.Circle {
  // Get ports by direction
  getPortsByDirection(direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[] {
    const ports = this.getPortsByGroup(direction);
    return ports.map(port => ({
      ...port,
      id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: direction },
    })) as PortManager.Port[];
  }

  // Get all ports from all directions
  getAllPorts(): PortManager.Port[] {
    return [
      ...this.getPortsByDirection('top'),
      ...this.getPortsByDirection('right'),
      ...this.getPortsByDirection('bottom'),
      ...this.getPortsByDirection('left'),
    ];
  }

  // Update ports for all directions
  updatePorts(_graph: Graph): ProcessShape {
    const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
      'top',
      'right',
      'bottom',
      'left',
    ];
    const portsPerDirection = 1;

    let allPorts: PortManager.Port[] = [];

    directions.forEach(direction => {
      // Get existing ports or create initial ports if none exist
      const existingPorts = this.getPortsByDirection(direction);

      if (existingPorts.length === 0) {
        // Only create new ports if there are no existing ones
        // Create new ports inline
        const newPorts = Array.from({ length: portsPerDirection }, (_, index) => {
          return {
            id: `new-${direction}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
            group: direction,
            position: { name: direction },
          } as PortManager.Port;
        });
        allPorts = [...allPorts, ...newPorts];
      } else {
        // Keep existing ports
        allPorts = [...allPorts, ...existingPorts];
      }
    });

    // Update all ports at once
    this.prop(['ports', 'items'], allPorts, {
      rewrite: true,
    });

    return this;
  }
}

// Configure ProcessShape
ProcessShape.config({
  attrs: {
    root: {
      magnet: false,
    },
    body: {
      fill: '#FFFFFF',
      stroke: '#333333',
      strokeWidth: 2,
    },
  },
  ports: {
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    groups: {
      top: {
        position: {
          name: 'top',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      right: {
        position: {
          name: 'right',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      bottom: {
        position: {
          name: 'bottom',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      left: {
        position: {
          name: 'left',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
    },
  },
  portMarkup: [
    {
      tagName: 'circle',
      selector: 'portBody',
    },
  ],
});

// Define StoreShape class
class StoreShape extends Shape.Rect {
  // Get ports by direction
  getPortsByDirection(direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[] {
    const ports = this.getPortsByGroup(direction);
    return ports.map(port => ({
      ...port,
      id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: direction },
    })) as PortManager.Port[];
  }

  // Get all ports from all directions
  getAllPorts(): PortManager.Port[] {
    return [
      ...this.getPortsByDirection('top'),
      ...this.getPortsByDirection('right'),
      ...this.getPortsByDirection('bottom'),
      ...this.getPortsByDirection('left'),
    ];
  }

  // Update ports for all directions
  updatePorts(_graph: Graph): StoreShape {
    const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
      'top',
      'right',
      'bottom',
      'left',
    ];
    const portsPerDirection = 1;

    let allPorts: PortManager.Port[] = [];

    directions.forEach(direction => {
      // Get existing ports or create initial ports if none exist
      const existingPorts = this.getPortsByDirection(direction);

      if (existingPorts.length === 0) {
        // Only create new ports if there are no existing ones
        // Create new ports inline
        const newPorts = Array.from({ length: portsPerDirection }, (_, index) => {
          return {
            id: `new-${direction}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
            group: direction,
            position: { name: direction },
          } as PortManager.Port;
        });
        allPorts = [...allPorts, ...newPorts];
      } else {
        // Keep existing ports
        allPorts = [...allPorts, ...existingPorts];
      }
    });

    // Update all ports at once
    this.prop(['ports', 'items'], allPorts, {
      rewrite: true,
    });

    return this;
  }
}

// Configure StoreShape
StoreShape.config({
  markup: [
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
  ],
  attrs: {
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
      refY: '100%', // Position at the bottom of the shape
      refD: 'M 0 0 l 200 0',
    },
  },
  ports: {
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    groups: {
      top: {
        position: {
          name: 'top',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      right: {
        position: {
          name: 'right',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      bottom: {
        position: {
          name: 'bottom',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
      left: {
        position: {
          name: 'left',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
          },
        },
      },
    },
  },
  portMarkup: [
    {
      tagName: 'circle',
      selector: 'portBody',
    },
  ],
});

// Import only the specific Material modules needed
import { CoreMaterialModule } from '../../shared/material/core-material.module';

@Component({
  selector: 'app-zzz',
  standalone: true,
  imports: [CommonModule, CoreMaterialModule],
  templateUrl: './zzz.component.html',
  styleUrls: ['./zzz.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZzzComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;

  private _graph: Graph | null = null;
  private _observer: MutationObserver | null = null;

  // Method to add a node at a random position
  addRandomNode(shapeType: 'actor' | 'process' | 'store' = 'actor'): void {
    this.logger.info(`addRandomNode called with shapeType: ${shapeType}`);

    if (!this._graph) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return;
    }

    try {
      // Get graph dimensions from the container
      const container = this.graphContainer.nativeElement;
      const graphWidth = container.clientWidth;
      const graphHeight = container.clientHeight;

      this.logger.info(`Graph dimensions: ${graphWidth}x${graphHeight}`);

      // Calculate random position (ensuring the node is fully inside the graph)
      const nodeWidth = 120;
      const nodeHeight = shapeType === 'process' ? 120 : 40; // Circle for process, rectangle for others
      const randomX = Math.floor(Math.random() * (graphWidth - nodeWidth)) + nodeWidth / 2;
      const randomY = Math.floor(Math.random() * (graphHeight - nodeHeight)) + nodeHeight / 2;

      // Create the appropriate shape based on type
      let node;
      switch (shapeType) {
        case 'process':
          this.logger.info('Creating ProcessShape');
          node = new ProcessShape()
            .resize(80, 80)
            .position(randomX, randomY)
            .updatePorts(this._graph);
          break;
        case 'store':
          this.logger.info('Creating StoreShape');
          node = new StoreShape()
            .resize(120, 40)
            .position(randomX, randomY)
            .updatePorts(this._graph);
          break;
        case 'actor':
        default:
          this.logger.info('Creating ActorShape');
          node = new ActorShape()
            .resize(120, 40)
            .position(randomX, randomY)
            .updatePorts(this._graph);
          break;
      }

      // Add the node
      this._graph.addNode(node);
      this.logger.info(`Added new ${shapeType} node at position (${randomX}, ${randomY})`);

      // Force change detection
      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error adding node:', error);
    }
  }

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private passiveEventHandler: PassiveEventHandler,
  ) {
    this.logger.info('ZzzComponent constructor called');
  }

  ngOnInit(): void {
    this.logger.info('ZzzComponent ngOnInit called');

    // Apply passive event handler patches
    this.passiveEventHandler.applyPatches();

    // Delay initialization slightly to ensure the container is fully rendered
    setTimeout(() => {
      this.initializeGraph();

      // Force change detection after initialization
      this.cdr.detectChanges();

      // Add passive event listeners for touch and wheel events
      this.addPassiveEventListeners();

      this.logger.info('Graph initialization complete, change detection triggered');
    }, 100); // Increase timeout to ensure DOM is fully rendered
  }

  /**
   * Add passive event listeners to the graph container
   * This is a workaround for the browser warnings about non-passive event listeners
   */
  /**
   * Add passive event listeners to the graph container and its child elements
   * This is a workaround for the browser warnings about non-passive event listeners
   */
  private addPassiveEventListeners(): void {
    if (!this.graphContainer || !this.graphContainer.nativeElement || !this._graph) {
      return;
    }

    const container = this.graphContainer.nativeElement;

    // Get all the elements that might have event listeners
    const canvasElements = container.querySelectorAll('canvas');
    const svgElements = container.querySelectorAll('svg');

    // Add passive event listeners to all relevant elements
    const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];

    // Function to safely add passive event listener
    const addPassiveListener = (element: Element) => {
      passiveEvents.forEach(eventType => {
        // Create a passive event listener that captures events before X6 processes them
        element.addEventListener(
          eventType,
          e => {
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

    // Add a mutation observer to handle dynamically added elements
    this._observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof Element) {
              // Add passive listeners to newly added elements
              addPassiveListener(node);

              // Also add to any canvas or svg children
              node.querySelectorAll('canvas, svg').forEach(addPassiveListener);
            }
          });
        }
      });
    });

    // Start observing the container for added nodes
    this._observer.observe(container, { childList: true, subtree: true });

    this.logger.info('Added passive event listeners to graph elements');
  }

  ngOnDestroy(): void {
    // Disconnect the mutation observer
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    // Dispose the graph
    if (this._graph) {
      this._graph.dispose();
      this._graph = null;
    }
  }

  /**
   * Initialize the X6 graph
   */
  private initializeGraph(): void {
    this.logger.info('ZzzComponent initializeGraph called');

    try {
      // Prepare the container
      const containerElement = this.validateAndSetupContainer();

      if (!containerElement) {
        this.logger.error('Failed to get valid container element');
        return;
      }

      // Configure highlighters
      const magnetAvailabilityHighlighter = this.createMagnetAvailabilityHighlighter();

      // Create and configure the graph
      this.createGraph(containerElement, magnetAvailabilityHighlighter);

      if (!this._graph) {
        this.logger.error('Failed to create graph');
        return;
      }

      // Set up event handlers
      this.setupEventHandlers(magnetAvailabilityHighlighter);

      // Add initial nodes
      this.addInitialNodes();

      this.logger.info('X6 graph initialized successfully');

      // Force change detection
      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error initializing X6 graph', error);
    }
  }

  /**
   * Validates the graph container and sets up dimensions
   * @returns The container element with proper dimensions
   */
  private validateAndSetupContainer(): HTMLElement | null {
    if (!this.graphContainer || !this.graphContainer.nativeElement) {
      this.logger.error('Graph container reference is not available');
      return null;
    }

    const containerElement = this.graphContainer.nativeElement as HTMLElement;
    const initialContainerHeight = containerElement.clientHeight;
    const initialContainerWidth = containerElement.clientWidth;

    this.logger.info(
      `Initial container dimensions: ${initialContainerWidth}x${initialContainerHeight}`,
    );

    // Check if the container has a valid height
    if (initialContainerHeight <= 0) {
      this.logger.warn(
        `Graph container has invalid height: ${initialContainerHeight}px. Using fallback height.`,
      );
      // Set a fallback height
      containerElement.style.height = '600px';
      containerElement.style.minHeight = '600px';
      // Use the fallback height
      const fallbackHeight = 600;
      this.logger.info(`Using fallback height: ${fallbackHeight}px`);

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
      this.logger.warn('Container width is invalid, using fallback width of 800px');
      containerElement.style.width = '800px';
      containerElement.style.minWidth = '800px';
      containerElement.getBoundingClientRect();
    }

    this.logger.info(`Graph container dimensions: ${containerWidth}x${containerHeight}`);

    // Set explicit dimensions on the container element
    containerElement.style.width = `${containerWidth || 800}px`;
    containerElement.style.height = `${containerHeight}px`;

    return containerElement;
  }

  /**
   * Creates the magnet availability highlighter configuration
   * @returns The highlighter configuration object
   */
  private createMagnetAvailabilityHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          fill: '#fff',
          stroke: '#47C769',
        },
      },
    };
  }

  /**
   * Creates the node highlighter configuration for hover effects
   * @returns The highlighter configuration object
   */
  private createNodeHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          // No fill - transparent
          stroke: '#47C769', // Green stroke matching port highlighter
        },
      },
    };
  }

  /**
   * Creates the edge highlighter configuration for hover effects
   * @returns The highlighter configuration object
   */
  private createEdgeHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          stroke: '#47C769', // Green stroke matching port highlighter
          strokeWidth: 2, // Make the stroke wider for emphasis
        },
      },
    };
  }

  /**
   * Creates and configures the X6 graph
   * @param containerElement The container element
   * @param magnetAvailabilityHighlighter The highlighter configuration
   */
  private createGraph(
    containerElement: HTMLElement,
    magnetAvailabilityHighlighter: HighlighterConfig,
  ): void {
    try {
      const containerWidth = containerElement.clientWidth || 800;
      const containerHeight = containerElement.clientHeight || 600;

      this.logger.info(`Creating graph with dimensions: ${containerWidth}x${containerHeight}`);

      this._graph = new Graph({
        container: containerElement, // Use the provided containerElement instead of this.graphContainer.nativeElement
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
        },
        connecting: {
          snap: true,
          allowBlank: false,
          allowLoop: false, // Prevent self-loops
          highlight: true,
          connector: 'rounded',
          connectionPoint: 'boundary',
          anchor: 'center', // Ensure proper anchor point
          sourceAnchor: 'center', // Source anchor
          targetAnchor: 'center', // Target anchor
          router: {
            name: 'metro',
            args: {
              direction: 'V',
            },
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
            const isValidSourceNode =
              sourceCell instanceof ActorShape ||
              sourceCell instanceof ProcessShape ||
              sourceCell instanceof StoreShape;

            const isValidTargetNode =
              targetCell instanceof ActorShape ||
              targetCell instanceof ProcessShape ||
              targetCell instanceof StoreShape;

            // Allow connections between any valid node types
            return isValidSourceNode && isValidTargetNode;
          },
          createEdge() {
            return new Shape.Edge({
              attrs: {
                line: {
                  stroke: '#A2B1C3',
                  strokeWidth: 1,
                  targetMarker: {
                    name: 'classic',
                    size: 7,
                  },
                },
              },
              // Add default vertices for better routing
              vertices: [
                // Default vertices will be adjusted by the router
              ],
            });
          },
        },
      });

      // Register tool item created event handler
      if (this._graph) {
        this._graph.on(
          'tool:created',
          ({
            name,
            cell: _cell,
            tool,
          }: {
            name: string;
            cell: unknown;
            tool: {
              options?: { index?: number };
              setAttrs(attrs: { fill: string }): void;
            };
          }) => {
            // Customize vertices tool appearance
            if (name === 'vertices') {
              const options = tool.options;
              if (options && options.index !== undefined && options.index % 2 === 1) {
                // Make every other vertex a different color
                tool.setAttrs({ fill: '#47C769' });
              }
            }
          },
        );
      }

      // Show ports when creating a new edge
      this._graph.on('edge:connected', ({ edge }) => {
        // Make the connected ports visible
        const sourceId = edge.getSourcePortId();
        const targetId = edge.getTargetPortId();
        const sourceCell = edge.getSourceCell();
        const targetCell = edge.getTargetCell();

        if (sourceCell && sourceId) {
          const sourceView = this._graph?.findViewByCell(sourceCell);
          if (sourceView && sourceView instanceof NodeView) {
            const portElem = sourceView.findPortElem(sourceId, 'portBody');
            if (portElem) {
              portElem.setAttribute('visibility', 'visible');
            }
          }
        }

        if (targetCell && targetId) {
          const targetView = this._graph?.findViewByCell(targetCell);
          if (targetView && targetView instanceof NodeView) {
            const portElem = targetView.findPortElem(targetId, 'portBody');
            if (portElem) {
              portElem.setAttribute('visibility', 'visible');
            }
          }
        }

        // Hide ports on all other nodes that aren't in use
        this.hideUnusedPortsOnAllNodes();
      });

      // Show all ports when starting to create an edge
      this._graph.on('edge:mousedown', ({ cell: _cell, view: _view }) => {
        // Show all ports on all nodes when starting to create an edge
        const nodes = this._graph?.getNodes() || [];
        nodes.forEach(node => {
          if (
            node instanceof ActorShape ||
            node instanceof ProcessShape ||
            node instanceof StoreShape
          ) {
            const nodeView = this._graph?.findViewByCell(node);
            if (nodeView && nodeView instanceof NodeView) {
              const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
                'top',
                'right',
                'bottom',
                'left',
              ];

              directions.forEach(direction => {
                node.getPortsByDirection(direction).forEach((port: PortManager.Port) => {
                  const portNode = nodeView.findPortElem(port.id, 'portBody');
                  if (portNode) {
                    portNode.setAttribute('visibility', 'visible');
                  }
                });
              });
            }
          }
        });
      });

      // Show all ports when starting to create an edge from a port
      this._graph.on('node:port:mousedown', () => {
        // Show all ports on all nodes when starting to create an edge
        const nodes = this._graph?.getNodes() || [];
        nodes.forEach(node => {
          if (
            node instanceof ActorShape ||
            node instanceof ProcessShape ||
            node instanceof StoreShape
          ) {
            const nodeView = this._graph?.findViewByCell(node);
            if (nodeView && nodeView instanceof NodeView) {
              const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
                'top',
                'right',
                'bottom',
                'left',
              ];

              directions.forEach(direction => {
                node.getPortsByDirection(direction).forEach((port: PortManager.Port) => {
                  const portNode = nodeView.findPortElem(port.id, 'portBody');
                  if (portNode) {
                    portNode.setAttribute('visibility', 'visible');
                  }
                });
              });
            }
          }
        });
      });
    } catch (error) {
      this.logger.error('Error creating graph:', error);
    }
  }

  /**
   * Sets up event handlers for the graph
   * @param magnetAvailabilityHighlighter The highlighter configuration
   */
  private setupEventHandlers(magnetAvailabilityHighlighter: HighlighterConfig): void {
    if (!this._graph) {
      return;
    }

    // Create highlighters for nodes and edges
    const nodeHighlighter = this.createNodeHighlighter();
    const edgeHighlighter = this.createEdgeHighlighter();

    const update = (view: NodeView): void => {
      const cell = view.cell;
      if (
        (cell instanceof ActorShape ||
          cell instanceof ProcessShape ||
          cell instanceof StoreShape) &&
        this._graph
      ) {
        // Unhighlight all ports
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];
        directions.forEach(direction => {
          cell.getPortsByDirection(direction).forEach(port => {
            const portNode = view.findPortElem(port.id, 'portBody');
            if (portNode) {
              view.unhighlight(portNode, {
                highlighter: magnetAvailabilityHighlighter,
              });
            }
          });
        });

        // Update all ports
        cell.updatePorts(this._graph);
      }
    };

    this._graph.on('edge:connected', ({ previousView, currentView }) => {
      if (previousView) {
        update(previousView as NodeView);
      }
      if (currentView) {
        update(currentView as NodeView);
      }
    });

    this._graph.on('edge:removed', ({ edge, options }) => {
      if (!options['ui'] || !this._graph) {
        return;
      }

      const target = edge.getTargetCell();
      if (
        target instanceof ActorShape ||
        target instanceof ProcessShape ||
        target instanceof StoreShape
      ) {
        target.updatePorts(this._graph);
      }
    });

    // Add node hover highlighting, show ports, and add remove button
    this._graph.on('node:mouseenter', ({ cell, view }) => {
      // Highlight the node using the view
      view.highlight(null, {
        highlighter: nodeHighlighter,
      });

      // Add button-remove tool to the node
      cell.addTools({
        name: 'button-remove',
        args: {
          x: '100%',
          y: 0,
          offset: { x: -10, y: 10 },
        },
      });

      // Show ports when hovering over the node
      if (
        view.cell instanceof ActorShape ||
        view.cell instanceof ProcessShape ||
        view.cell instanceof StoreShape
      ) {
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];

        directions.forEach(direction => {
          (view.cell as ActorShape | ProcessShape | StoreShape)
            .getPortsByDirection(direction)
            .forEach((port: PortManager.Port) => {
              const portNode = view.findPortElem(port.id, 'portBody');
              if (portNode) {
                portNode.setAttribute('visibility', 'visible');
              }
            });
        });
      }
    });

    this._graph.on('node:mouseleave', ({ cell, view }) => {
      // Remove the highlight using the view
      view.unhighlight(null, {
        highlighter: nodeHighlighter,
      });

      // Remove tools from the node
      cell.removeTools();

      // Hide ports when not hovering, except for ports that are in use
      if (
        view.cell instanceof ActorShape ||
        view.cell instanceof ProcessShape ||
        view.cell instanceof StoreShape
      ) {
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];

        directions.forEach(direction => {
          (view.cell as ActorShape | ProcessShape | StoreShape)
            .getPortsByDirection(direction)
            .forEach((port: PortManager.Port) => {
              const portNode = view.findPortElem(port.id, 'portBody');
              if (portNode) {
                // Check if this port has any connected edges
                const connectedEdges = this._graph?.getConnectedEdges(view.cell, {
                  outgoing: true,
                  incoming: true,
                });

                const isPortInUse = connectedEdges?.some(edge => {
                  const sourcePort = edge.getSourcePortId();
                  const targetPort = edge.getTargetPortId();
                  return sourcePort === port.id || targetPort === port.id;
                });

                // Only hide ports that are not in use
                if (!isPortInUse) {
                  portNode.setAttribute('visibility', 'hidden');
                }
              }
            });
        });
      }
    });

    // Enhance existing edge hover events
    this._graph.on('edge:mouseenter', ({ edge, view }) => {
      // Highlight the edge using the view
      view.highlight(null, {
        highlighter: edgeHighlighter,
      });

      // Add tools (target arrowhead, vertices, and remove button)
      edge.addTools([
        'target-arrowhead',
        {
          name: 'vertices',
          args: {
            attrs: {
              fill: '#666',
              stroke: '#A2B1C3',
              strokeWidth: 1,
            },
          },
        },
        {
          name: 'button-remove',
          args: {
            distance: -30,
          },
        },
      ]);
    });

    this._graph.on('edge:mouseleave', ({ edge, view }) => {
      // Remove the highlight using the view
      view.unhighlight(null, {
        highlighter: edgeHighlighter,
      });

      // Remove tools (existing functionality)
      edge.removeTools();
    });
  }

  /**
   * Hides all unused ports on all nodes in the graph
   * Used after edge creation to clean up visible ports
   */
  private hideUnusedPortsOnAllNodes(): void {
    if (!this._graph) {
      return;
    }

    // Get all nodes in the graph
    const nodes = this._graph.getNodes();

    // For each node, hide all ports that aren't connected to an edge
    nodes.forEach(node => {
      if (
        node instanceof ActorShape ||
        node instanceof ProcessShape ||
        node instanceof StoreShape
      ) {
        const nodeView = this._graph?.findViewByCell(node);
        if (nodeView && nodeView instanceof NodeView) {
          const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
            'top',
            'right',
            'bottom',
            'left',
          ];

          directions.forEach(direction => {
            node.getPortsByDirection(direction).forEach((port: PortManager.Port) => {
              const portNode = nodeView.findPortElem(port.id, 'portBody');
              if (portNode) {
                // Check if this port has any connected edges
                const connectedEdges = this._graph?.getConnectedEdges(node, {
                  outgoing: true,
                  incoming: true,
                });

                const isPortInUse = connectedEdges?.some(edge => {
                  const sourcePort = edge.getSourcePortId();
                  const targetPort = edge.getTargetPortId();
                  return sourcePort === port.id || targetPort === port.id;
                });

                // Only hide ports that are not in use
                if (!isPortInUse) {
                  portNode.setAttribute('visibility', 'hidden');
                }
              }
            });
          });
        }
      }
    });
  }

  /**
   * Adds initial nodes to the graph
   */
  private addInitialNodes(): void {
    if (!this._graph) {
      return;
    }

    this._graph.addNode(
      new ActorShape().resize(120, 40).position(200, 50).updatePorts(this._graph),
    );

    this._graph.addNode(
      new ProcessShape().resize(80, 80).position(400, 50).updatePorts(this._graph),
    );

    this._graph.addNode(
      new StoreShape().resize(120, 40).position(300, 250).updatePorts(this._graph),
    );
  }
}
