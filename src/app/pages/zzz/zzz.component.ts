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
import { TranslocoModule } from '@jsverse/transloco';
import { Graph, Edge, Shape, NodeView } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';
import { LoggerService } from '../../core/services/logger.service';

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

// Define MyShape class outside of the component
class MyShape extends Shape.Rect {
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
  updatePorts(_graph: Graph): MyShape {
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

// Configure MyShape
MyShape.config({
  attrs: {
    root: {
      magnet: false,
    },
    body: {
      fill: '#EFF4FF',
      stroke: '#5F95FF',
      strokeWidth: 1,
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
            magnet: true,
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
          },
        },
      },
      right: {
        position: {
          name: 'right',
        },
        attrs: {
          portBody: {
            magnet: true,
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
          },
        },
      },
      bottom: {
        position: {
          name: 'bottom',
        },
        attrs: {
          portBody: {
            magnet: true,
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
          },
        },
      },
      left: {
        position: {
          name: 'left',
        },
        attrs: {
          portBody: {
            magnet: true,
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
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
  imports: [CommonModule, CoreMaterialModule, TranslocoModule],
  templateUrl: './zzz.component.html',
  styleUrls: ['./zzz.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZzzComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;

  private _graph: Graph | null = null;

  // Method to add a node at a random position
  addRandomNode(): void {
    if (!this._graph) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return;
    }

    // Get graph dimensions from the container
    const container = this.graphContainer.nativeElement;
    const graphWidth = container.clientWidth;
    const graphHeight = container.clientHeight;

    // Calculate random position (ensuring the node is fully inside the graph)
    // Node size is 120x40, so we need to account for that
    const nodeWidth = 120;
    const nodeHeight = 40;
    const randomX = Math.floor(Math.random() * (graphWidth - nodeWidth)) + nodeWidth / 2;
    const randomY = Math.floor(Math.random() * (graphHeight - nodeHeight)) + nodeHeight / 2;

    // Add the node
    this._graph.addNode(
      new MyShape().resize(120, 40).position(randomX, randomY).updatePorts(this._graph),
    );

    this.logger.info(`Added new node at position (${randomX}, ${randomY})`);

    // Force change detection
    this.cdr.detectChanges();
  }

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {
    this.logger.info('ZzzComponent constructor called');
  }

  ngOnInit(): void {
    this.logger.info('ZzzComponent ngOnInit called');

    // Delay initialization slightly to ensure the container is fully rendered
    setTimeout(() => {
      this.initializeGraph();
    }, 0);
  }

  ngOnDestroy(): void {
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

      // Configure highlighters
      const magnetAvailabilityHighlighter = this.createMagnetAvailabilityHighlighter();

      // Create and configure the graph
      this.createGraph(containerElement, magnetAvailabilityHighlighter);

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
  private validateAndSetupContainer(): HTMLElement {
    const containerElement = this.graphContainer.nativeElement as HTMLElement;
    const initialContainerHeight = containerElement.clientHeight;

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

    this.logger.info(`Graph container dimensions: ${containerWidth}x${containerHeight}`);

    // Set explicit dimensions on the container element
    containerElement.style.width = `${containerWidth}px`;
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
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;

    this._graph = new Graph({
      container: this.graphContainer.nativeElement,
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
      autoResize: false,
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
        allowLoop: true,
        highlight: true,
        connector: 'rounded',
        connectionPoint: 'boundary',
        router: {
          name: 'metro',
          args: {
            direction: 'V',
          },
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
          });
        },
        validateConnection: ({ targetView: _targetView, targetMagnet }) => {
          if (!targetMagnet) {
            return false;
          }

          // Allow connections to any port
          const portGroup = targetMagnet.getAttribute('port-group') as
            | 'top'
            | 'right'
            | 'bottom'
            | 'left'
            | null;
          if (!portGroup) {
            return false;
          }

          // No additional validation - allow connections to any port
          // regardless of direction or existing connections
          return true;
        },
      },
    });
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
      if (cell instanceof MyShape && this._graph) {
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
      if (target instanceof MyShape) {
        target.updatePorts(this._graph);
      }
    });

    // Add node hover highlighting
    this._graph.on('node:mouseenter', ({ cell: _cell, view }) => {
      // Highlight the node using the view
      view.highlight(null, {
        highlighter: nodeHighlighter,
      });
    });

    this._graph.on('node:mouseleave', ({ cell: _cell, view }) => {
      // Remove the highlight using the view
      view.unhighlight(null, {
        highlighter: nodeHighlighter,
      });
    });

    // Enhance existing edge hover events
    this._graph.on('edge:mouseenter', ({ edge, view }) => {
      // Highlight the edge using the view
      view.highlight(null, {
        highlighter: edgeHighlighter,
      });

      // Add tools (existing functionality)
      edge.addTools([
        'source-arrowhead',
        'target-arrowhead',
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
   * Adds initial nodes to the graph
   */
  private addInitialNodes(): void {
    if (!this._graph) {
      return;
    }

    this._graph.addNode(new MyShape().resize(120, 40).position(200, 50).updatePorts(this._graph));

    this._graph.addNode(new MyShape().resize(120, 40).position(400, 50).updatePorts(this._graph));

    this._graph.addNode(new MyShape().resize(120, 40).position(300, 250).updatePorts(this._graph));
  }
}
