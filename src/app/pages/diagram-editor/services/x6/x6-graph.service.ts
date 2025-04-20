import { Injectable, NgZone } from '@angular/core';
import { Graph, Node, Edge } from '@antv/x6';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { NodeRegistryService } from './node-registry.service';
import { PassiveEventHandler } from './passive-event-handler';

@Injectable({
  providedIn: 'root',
})
export class X6GraphService {
  private graph: Graph | null = null;
  private container: HTMLElement | null = null;

  // Observable sources
  private readonly nodeSelectedSubject = new BehaviorSubject<Node | null>(null);
  private readonly edgeSelectedSubject = new BehaviorSubject<Edge | null>(null);

  // Observable streams
  readonly nodeSelected$ = this.nodeSelectedSubject.asObservable();
  readonly edgeSelected$ = this.edgeSelectedSubject.asObservable();

  constructor(
    private logger: LoggerService,
    private ngZone: NgZone,
    private nodeRegistryService: NodeRegistryService,
    private passiveEventHandler: PassiveEventHandler,
  ) {
    this.logger.info('X6GraphService initialized');
    // Apply passive event listener patches
    this.passiveEventHandler.applyPatches();
  }

  /**
   * Initialize the graph with a container element
   */
  initialize(container: HTMLElement): void {
    this.logger.info('Initializing X6 graph with container');
    this.container = container;

    // Register node shapes first
    this.nodeRegistryService.registerNodeShapes();

    // Run outside Angular zone for better performance
    this.ngZone.runOutsideAngular(() => {
      try {
        this.graph = new Graph({
          container,
          grid: true,
          mousewheel: {
            enabled: true,
            zoomAtMousePosition: true,
            modifiers: 'ctrl',
            minScale: 0.5,
            maxScale: 3,
            global: false, // Disable global mousewheel events
          },
          // Fix passive event listener warnings
          preventDefaultContextMenu: false,
          preventDefaultBlankAction: false,
          connecting: {
            router: 'manhattan',
            connector: {
              name: 'rounded',
              args: {
                radius: 8,
              },
            },
            anchor: 'center',
            connectionPoint: 'boundary',
            allowBlank: false,
            snap: {
              radius: 20,
            },
            createEdge() {
              return this.createEdge({
                shape: 'edge',
                attrs: {
                  line: {
                    stroke: '#5F95FF',
                    strokeWidth: 1,
                    targetMarker: {
                      name: 'classic',
                      size: 8,
                    },
                  },
                },
                zIndex: 0,
              });
            },
          },
        });

        this.setupEvents();
        this.logger.info('X6 graph initialized successfully');
      } catch (error) {
        this.logger.error('Error initializing X6 graph', error);
      }
    });
  }

  /**
   * Set up graph event handlers
   */
  private setupEvents(): void {
    if (!this.graph) return;

    this.graph.on('node:selected', ({ node }: { node: Node }) => {
      this.ngZone.run(() => {
        this.nodeSelectedSubject.next(node);
      });
    });

    this.graph.on('node:unselected', () => {
      this.ngZone.run(() => {
        this.nodeSelectedSubject.next(null);
      });
    });

    this.graph.on('edge:selected', ({ edge }: { edge: Edge }) => {
      this.ngZone.run(() => {
        this.edgeSelectedSubject.next(edge);
      });
    });

    this.graph.on('edge:unselected', () => {
      this.ngZone.run(() => {
        this.edgeSelectedSubject.next(null);
      });
    });
  }

  /**
   * Get the graph instance
   */
  getGraph(): Graph | null {
    return this.graph;
  }

  /**
   * Create a node
   */
  createNode(options: any): Node | null {
    if (!this.graph) return null;

    try {
      return this.graph.addNode(options);
    } catch (error) {
      this.logger.error('Error creating node', error);
      return null;
    }
  }

  /**
   * Create an edge between two nodes
   */
  createEdge(source: Node | string, target: Node | string, options: any = {}): Edge | null {
    if (!this.graph) return null;

    try {
      const sourceId = typeof source === 'string' ? source : source.id;
      const targetId = typeof target === 'string' ? target : target.id;

      return this.graph.addEdge({
        source: { cell: sourceId },
        target: { cell: targetId },
        ...options,
      });
    } catch (error) {
      this.logger.error('Error creating edge', error);
      return null;
    }
  }

  /**
   * Clear the graph
   */
  clear(): void {
    if (!this.graph) return;
    this.graph.clearCells();
  }

  /**
   * Destroy the graph instance
   */
  destroy(): void {
    if (!this.graph) return;

    this.graph.dispose();
    this.graph = null;
    this.container = null;

    this.nodeSelectedSubject.next(null);
    this.edgeSelectedSubject.next(null);

    this.logger.info('X6 graph destroyed');
  }
}
