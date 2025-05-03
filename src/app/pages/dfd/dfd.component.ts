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
import { Transform } from '@antv/x6-plugin-transform';
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

// Define SecurityBoundaryShape class outside of the component
class SecurityBoundaryShape extends Shape.Rect {
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
  updatePorts(_graph: Graph): SecurityBoundaryShape {
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

// Configure SecurityBoundaryShape
SecurityBoundaryShape.config({
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
      strokeDasharray: '5,5', // Dashed border
      rx: 10, // Rounded corners
      ry: 10, // Rounded corners
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
  selector: 'app-dfd',
  standalone: true,
  imports: [CommonModule, CoreMaterialModule],
  templateUrl: './dfd.component.html',
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;

  private _graph: Graph | null = null;
  private _observer: MutationObserver | null = null;
  private _selectedNode: ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape | null =
    null;

  // Method to add a node at a random position
  addRandomNode(shapeType: 'actor' | 'process' | 'store' | 'securityBoundary' = 'actor'): void {
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
      const nodeWidth = shapeType === 'securityBoundary' ? 180 : 120; // Wider for security boundary
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
        case 'securityBoundary':
          this.logger.info('Creating SecurityBoundaryShape');
          node = new SecurityBoundaryShape()
            .resize(180, 40)
            .position(randomX, randomY)
            .updatePorts(this._graph);

          // Set a lower z-index to make security boundary appear below other shapes
          node.setZIndex(-1);
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
    this.logger.info('DfdComponent constructor called');
  }

  ngOnInit(): void {
    this.logger.info('DfdComponent ngOnInit called');

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
    // Clear selected node reference
    this._selectedNode = null;

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
    this.logger.info('DfdComponent initializeGraph called');

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
          strokeWidth: 3, // Make the stroke wider for emphasis (increased to stand out from the thicker default)
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
              sourceCell instanceof StoreShape ||
              sourceCell instanceof SecurityBoundaryShape;

            const isValidTargetNode =
              targetCell instanceof ActorShape ||
              targetCell instanceof ProcessShape ||
              targetCell instanceof StoreShape ||
              targetCell instanceof SecurityBoundaryShape;

            // Allow connections between any valid node types
            return isValidSourceNode && isValidTargetNode;
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

        // Register the Transform plugin for node resizing
        this._graph.use(
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

        // Configure resize handles to be square-shaped
        const transformPlugin = this._graph.getPlugin<Transform>('transform');
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
            node instanceof StoreShape ||
            node instanceof SecurityBoundaryShape
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
            node instanceof StoreShape ||
            node instanceof SecurityBoundaryShape
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
          cell instanceof StoreShape ||
          cell instanceof SecurityBoundaryShape) &&
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

      // Get both source and target cells
      const source = edge.getSourceCell();
      const target = edge.getTargetCell();

      // Update ports on source and target cells
      if (
        source instanceof ActorShape ||
        source instanceof ProcessShape ||
        source instanceof StoreShape ||
        source instanceof SecurityBoundaryShape
      ) {
        source.updatePorts(this._graph);
      }

      if (
        target instanceof ActorShape ||
        target instanceof ProcessShape ||
        target instanceof StoreShape ||
        target instanceof SecurityBoundaryShape
      ) {
        target.updatePorts(this._graph);
      }

      // Hide all unused ports on all nodes
      this.hideUnusedPortsOnAllNodes();
    });

    /**
     * Handle node resizing event
     * Updates ports and node-specific elements after a node is resized
     */
    this._graph.on(
      'node:resized',
      ({ node }: { node: ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape }) => {
        this.logger.info('Node resized:', node.id);

        // Update ports after resize
        if (
          this._graph &&
          (node instanceof ActorShape ||
            node instanceof ProcessShape ||
            node instanceof StoreShape ||
            node instanceof SecurityBoundaryShape)
        ) {
          node.updatePorts(this._graph);
        }

        // For StoreShape, update the top and bottom lines
        if (node instanceof StoreShape) {
          const { width } = node.size();
          node.attr('topLine/refD', `M 0 0 l ${width} 0`);
          node.attr('bottomLine/refD', `M 0 0 l ${width} 0`);
        }

        // Force change detection
        this.cdr.detectChanges();
      },
    );

    /**
     * Handle node hover
     * Highlights the node and shows its ports
     */
    this._graph.on('node:mouseenter', ({ cell, view }) => {
      // Highlight the node using the view
      view.highlight(null, {
        highlighter: nodeHighlighter,
      });

      // Show ports when hovering over the node
      if (
        view.cell instanceof ActorShape ||
        view.cell instanceof ProcessShape ||
        view.cell instanceof StoreShape ||
        view.cell instanceof SecurityBoundaryShape
      ) {
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];

        directions.forEach(direction => {
          (view.cell as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape)
            .getPortsByDirection(direction)
            .forEach((port: PortManager.Port) => {
              const portNode = view.findPortElem(port.id, 'portBody');
              if (portNode) {
                portNode.setAttribute('visibility', 'visible');
              }
            });
        });
      }

      // Show ports when hovering over the node
      if (
        view.cell instanceof ActorShape ||
        view.cell instanceof ProcessShape ||
        view.cell instanceof StoreShape ||
        view.cell instanceof SecurityBoundaryShape
      ) {
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];

        directions.forEach(direction => {
          (view.cell as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape)
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

    /**
     * Handle node selection on click
     * Selects a node and adds resize handles using the boundary tool
     * The boundary tool provides a resizable border around the node
     */
    this._graph.on('node:click', ({ cell, e }) => {
      // Prevent event propagation to avoid deselection
      e.stopPropagation();

      // If there's a previously selected node, deselect it
      if (this._selectedNode && this._selectedNode !== cell) {
        // Remove tools from the previously selected node
        this._selectedNode.removeTools();
        // Disable transform on the previously selected node
        if (this._selectedNode) {
          // Just removing the selection is enough to disable transform
          this._selectedNode.removeTools();
        }
      }

      // Select the clicked node
      this._selectedNode = cell as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;

      // Add tools to the selected node (remove button and boundary)
      const tools = [
        {
          name: 'button-remove',
          args: {
            x: '100%',
            y: 0,
            offset: { x: -10, y: 10 },
          },
        },
        {
          name: 'boundary',
          args: {
            padding: 10,
            attrs: {
              fill: '#47C769',
              stroke: 'none',
              'fill-opacity': 0.2,
            },
          },
        },
      ];

      cell.addTools(tools);

      // Enable the transform handles on the selected node
      // For ProcessShape (circle), we need to preserve aspect ratio
      // Instead of trying to modify the Transform plugin options directly,
      // we'll use a different approach with CSS to style the handles

      // Add a custom attribute to the node to indicate its type
      if (cell instanceof ProcessShape) {
        cell.attr('data-shape-type', 'process');
      } else {
        cell.attr('data-shape-type', 'rect');
      }

      // Add a style element to the document if it doesn't exist yet
      if (!document.getElementById('resize-handles-style')) {
        const style = document.createElement('style');
        style.id = 'resize-handles-style';
        style.textContent = `
          /* Style the resize handles as smaller, solid black squares */
          .x6-widget-transform {
            border: none !important;
          }
          /* Base style for all resize handles */
          .x6-widget-transform-resize {
            width: 8px !important;
            height: 8px !important;
            border-radius: 0 !important;
            background-color: #000000 !important;
            border: none !important;
            outline: none !important;
            position: absolute !important;
          }
          
          /* Position the handles using nth-child selectors */
          /* Top-left handle */
          .x6-widget-transform-resize:nth-child(1) {
            top: -4px !important;
            left: -4px !important;
          }
          
          /* Top-middle handle */
          .x6-widget-transform-resize:nth-child(2) {
            top: -4px !important;
          }
          
          /* Top-right handle */
          .x6-widget-transform-resize:nth-child(3) {
            top: -4px !important;
            right: -6px !important;
          }
          
          /* Middle-right handle */
          .x6-widget-transform-resize:nth-child(4) {
            right: -6px !important;
          }
          
          /* Bottom-right handle */
          .x6-widget-transform-resize:nth-child(5) {
            bottom: -6px !important;
            right: -6px !important;
          }
          
          /* Bottom-middle handle */
          .x6-widget-transform-resize:nth-child(6) {
            bottom: -6px !important;
          }
          
          /* Bottom-left handle */
          .x6-widget-transform-resize:nth-child(7) {
            bottom: -6px !important;
            left: -4px !important;
          }
          
          /* Middle-left handle */
          .x6-widget-transform-resize:nth-child(8) {
            left: -4px !important;
          }
          /* Ensure circular nodes maintain aspect ratio during resize */
          [data-shape-type="process"] {
            aspect-ratio: 1 / 1;
          }
        `;
        document.head.appendChild(style);
      }
    });

    /**
     * Handle background click
     * Deselects the currently selected node and removes its tools
     */
    this._graph.on('blank:click', () => {
      if (this._selectedNode) {
        // Remove all tools from the selected node
        this._selectedNode.removeTools();

        // Disable transform on the deselected node
        // No need to do anything special here, removeTools is sufficient

        this._selectedNode = null;
      }
    });

    this._graph.on('node:mouseleave', ({ cell, view }) => {
      // Remove the highlight using the view
      view.unhighlight(null, {
        highlighter: nodeHighlighter,
      });

      // Only remove tools if the node is not selected
      if (cell !== this._selectedNode) {
        cell.removeTools();
        // Disable transform for non-selected nodes
        // No need to do anything special here, removeTools is sufficient
      }

      // Hide ports when not hovering, except for ports that are in use
      if (
        view.cell instanceof ActorShape ||
        view.cell instanceof ProcessShape ||
        view.cell instanceof StoreShape ||
        view.cell instanceof SecurityBoundaryShape
      ) {
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];

        directions.forEach(direction => {
          (view.cell as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape)
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
        node instanceof StoreShape ||
        node instanceof SecurityBoundaryShape
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

    // Add a security boundary first (so it's at the bottom of the z-order)
    const securityBoundary = new SecurityBoundaryShape()
      .resize(250, 150)
      .position(300, 150)
      .updatePorts(this._graph);

    // Set a lower z-index to make security boundary appear below other shapes
    securityBoundary.setZIndex(-1);
    this._graph.addNode(securityBoundary);

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
