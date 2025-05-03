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
      fill: string;
      stroke: string;
    };
  };
}

// Define MyShape class outside of the component
class MyShape extends Shape.Rect {
  getInPorts(): PortManager.Port[] {
    const ports = this.getPortsByGroup('in');
    return ports.map(port => ({
      ...port,
      id: port.id || `in-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: 'top' },
    })) as PortManager.Port[];
  }

  getOutPorts(): PortManager.Port[] {
    const ports = this.getPortsByGroup('out');
    return ports.map(port => ({
      ...port,
      id: port.id || `out-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: 'bottom' },
    })) as PortManager.Port[];
  }

  getUsedInPorts(graph: Graph): PortManager.Port[] {
    const incomingEdges = graph.getIncomingEdges(this) || [];
    return incomingEdges.map((edge: Edge) => {
      const portId = edge.getTargetPortId();
      const port = this.getPort(portId!);
      if (port) {
        return {
          ...port,
          id: port.id || `used-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          position: { name: 'top' },
        } as PortManager.Port;
      }
      // This should never happen, but we need to handle it for TypeScript
      return {
        id: `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        group: 'in',
        position: { name: 'top' },
      } as PortManager.Port;
    });
  }

  getNewInPorts(length: number): PortManager.Port[] {
    return Array.from(
      {
        length,
      },
      (_, index) => {
        return {
          id: `new-in-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
          group: 'in',
          position: { name: 'top' },
        } as PortManager.Port;
      },
    );
  }

  updateInPorts(graph: Graph): MyShape {
    const minNumberOfPorts = 2;
    const ports = this.getInPorts();
    const usedPorts = this.getUsedInPorts(graph);
    const newPorts = this.getNewInPorts(Math.max(minNumberOfPorts - usedPorts.length, 1));

    if (ports.length === minNumberOfPorts && ports.length - usedPorts.length > 0) {
      // noop
    } else if (ports.length === usedPorts.length) {
      this.addPorts(newPorts);
    } else if (ports.length + 1 > usedPorts.length) {
      this.prop(['ports', 'items'], this.getOutPorts().concat(usedPorts).concat(newPorts), {
        rewrite: true,
      });
    }

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
    items: [
      {
        group: 'out',
      },
    ],
    groups: {
      in: {
        position: {
          name: 'top',
        },
        attrs: {
          portBody: {
            magnet: 'passive',
            r: 6,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
          },
        },
      },
      out: {
        position: {
          name: 'bottom',
        },
        attrs: {
          portBody: {
            magnet: true,
            r: 6,
            fill: '#fff',
            stroke: '#5F95FF',
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
      new MyShape().resize(120, 40).position(randomX, randomY).updateInPorts(this._graph),
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
        connector: 'smooth',
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
        validateConnection: ({ targetView, targetMagnet }) => {
          if (!targetMagnet) {
            return false;
          }

          if (targetMagnet.getAttribute('port-group') !== 'in') {
            return false;
          }

          if (targetView && this._graph) {
            const node = targetView.cell;
            if (node instanceof MyShape) {
              const portId = targetMagnet.getAttribute('port');
              const usedInPorts = node.getUsedInPorts(this._graph);
              if (usedInPorts.find(port => port && port.id === portId)) {
                return false;
              }
            }
          }

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

    const update = (view: NodeView): void => {
      const cell = view.cell;
      if (cell instanceof MyShape && this._graph) {
        cell.getInPorts().forEach(port => {
          const portNode = view.findPortElem(port.id, 'portBody');
          view.unhighlight(portNode, {
            highlighter: magnetAvailabilityHighlighter,
          });
        });
        cell.updateInPorts(this._graph);
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
        target.updateInPorts(this._graph);
      }
    });

    this._graph.on('edge:mouseenter', ({ edge }) => {
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

    this._graph.on('edge:mouseleave', ({ edge }) => {
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

    this._graph.addNode(new MyShape().resize(120, 40).position(200, 50).updateInPorts(this._graph));

    this._graph.addNode(new MyShape().resize(120, 40).position(400, 50).updateInPorts(this._graph));

    this._graph.addNode(
      new MyShape().resize(120, 40).position(300, 250).updateInPorts(this._graph),
    );
  }
}
