import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Injector,
} from '@angular/core';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { DfdGraphService } from './services/dfd-graph.service';
import { DfdPortService } from './services/dfd-port.service';
import { DfdHighlighterService } from './services/dfd-highlighter.service';
import { DfdLabelEditorService } from './services/dfd-label-editor.service';
import { DfdAngularShapeService } from './services/dfd-angular-shape.service';
import { DfdNodeAngularService } from './services/dfd-node-angular.service';
import { DfdEventAngularService } from './services/dfd-event-angular.service';
import { ShapeType } from './services/dfd-node.service';

@Component({
  selector: 'app-dfd-angular',
  standalone: true,
  imports: [CommonModule, CoreMaterialModule],
  template: `
    <div class="dfd-container">
      <div class="title-row">
        <h1 class="page-title">DFD Page (Angular Components)</h1>
      </div>

      <div class="graph-toolbar">
        <button mat-raised-button color="primary" (click)="addRandomNode('actor')">
          Add Actor
        </button>
        <button mat-raised-button color="accent" (click)="addRandomNode('process')">
          Add Process
        </button>
        <button mat-raised-button color="warn" (click)="addRandomNode('store')">Add Store</button>
        <button mat-raised-button color="basic" (click)="addRandomNode('securityBoundary')">
          Add Security Boundary
        </button>
      </div>

      <div class="graph-container">
        <div #graphContainer class="x6-graph"></div>
      </div>
    </div>
  `,
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdAngularComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;

  private _graph: Graph | null = null;
  private _observer: MutationObserver | null = null;

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private injector: Injector,
    private graphService: DfdGraphService,
    private nodeService: DfdNodeAngularService,
    private portService: DfdPortService,
    private eventService: DfdEventAngularService,
    private highlighterService: DfdHighlighterService,
    private labelEditorService: DfdLabelEditorService,
    private angularShapeService: DfdAngularShapeService,
  ) {
    this.logger.info('DfdAngularComponent constructor called');
  }

  /**
   * Method to add a node at a random position
   * @param shapeType The type of shape to create
   */
  addRandomNode(shapeType: ShapeType = 'actor'): void {
    if (!this._graph) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return;
    }

    const node = this.nodeService.createRandomNode(
      this._graph,
      shapeType,
      this.graphContainer.nativeElement as HTMLElement,
    );

    if (node) {
      // Force change detection
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    this.logger.info('DfdAngularComponent ngOnInit called');

    // Add passive event listeners for touch and wheel events BEFORE graph initialization
    this.addPassiveEventListeners();

    // Register Angular shapes
    this.angularShapeService.registerShapes();

    // Delay initialization slightly to ensure the container is fully rendered
    setTimeout(() => {
      this.initializeGraph();

      // Force change detection after initialization
      this.cdr.detectChanges();

      // Add passive event listeners again after graph is initialized to catch any new elements
      this.addPassiveEventListeners();

      this.logger.info('Graph initialization complete, change detection triggered');
    }, 100); // Increase timeout to ensure DOM is fully rendered
  }

  /**
   * Add passive event listeners to the graph container and its child elements
   * This is a workaround for the browser warnings about non-passive event listeners
   */
  /**
   * Add passive event listeners to all elements to prevent browser warnings
   * about non-passive touch event listeners blocking scrolling
   */
  private addPassiveEventListeners(): void {
    if (!this.graphContainer || !this.graphContainer.nativeElement) {
      this.logger.warn('Cannot add passive event listeners: Graph container is not available');
      return;
    }

    const container = this.graphContainer.nativeElement as HTMLElement;

    // Get all the elements that might have event listeners
    // Include more element types that might handle touch events
    const allElements = container.querySelectorAll('*');

    // Add passive event listeners to all relevant elements
    const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'wheel', 'mousewheel'];

    // Function to safely add passive event listener
    const addPassiveListener = (element: Element): void => {
      passiveEvents.forEach((eventType: string): void => {
        // First, try to remove any existing non-passive listeners
        // This is a workaround to override any existing listeners
        const nonPassiveListener = (): void => {};
        element.removeEventListener(eventType, nonPassiveListener);

        // Create a passive event listener that captures events before X6 processes them
        element.addEventListener(
          eventType,
          (_e: Event) => {
            // Empty handler with passive: true to prevent browser warnings
            // The event will still propagate to X6's handlers
          },
          { passive: true, capture: true }, // Use capture: true to ensure our listener runs first
        );
      });
    };

    // Add listeners to all elements in the container
    allElements.forEach(addPassiveListener);

    // Add listeners to the container itself
    addPassiveListener(container as Element);

    // Add listeners to the document and window for good measure
    addPassiveListener(document.documentElement);

    // Add a more comprehensive mutation observer to handle dynamically added elements
    if (this._observer) {
      this._observer.disconnect();
    }

    this._observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node: globalThis.Node) => {
            if (node instanceof Element) {
              // Add passive listeners to newly added elements
              addPassiveListener(node);

              // Also add to all children
              const elements = node.querySelectorAll('*');
              elements.forEach(element => addPassiveListener(element));
            }
          });
        }
      });
    });

    // Start observing the container for added nodes with more comprehensive options
    this._observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'], // Watch for style/class changes that might affect event handling
    });

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
    this.logger.info('DfdAngularComponent initializeGraph called');

    try {
      // Prepare the container
      const containerElement = this.graphService.validateAndSetupContainer(
        this.graphContainer.nativeElement as HTMLElement,
        this.logger,
      );

      if (!containerElement) {
        this.logger.error('Failed to get valid container element');
        return;
      }

      // Configure highlighters
      const magnetAvailabilityHighlighter =
        this.highlighterService.createMagnetAvailabilityHighlighter();

      // Create and configure the graph
      this._graph = this.graphService.createGraph(containerElement, magnetAvailabilityHighlighter);

      if (!this._graph) {
        this.logger.error('Failed to create graph');
        return;
      }

      // Set up event handlers
      this.eventService.setupEventHandlers(this._graph);

      // Set up label editing handlers
      this.labelEditorService.setupLabelEditingHandlers(this._graph);

      // Set up port tooltips
      this.setupPortTooltips();

      // Add initial nodes
      this.nodeService.createInitialNodes(this._graph);

      this.logger.info('X6 graph initialized successfully');

      // Force change detection
      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error initializing X6 graph', error);
    }
  }

  /**
   * Set up tooltips for ports
   */
  private setupPortTooltips(): void {
    if (!this._graph) {
      return;
    }

    // Create tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'port-tooltip';
    tooltipEl.style.display = 'none';
    tooltipEl.style.fontFamily = '"Roboto Condensed", Arial, sans-serif';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.fontWeight = 'normal';
    tooltipEl.style.color = '#333333';
    this._graph.container.appendChild(tooltipEl);

    // Handle port mouseenter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._graph.on('node:port:mouseenter', ({ node, port, e }: any) => {
      if (!port || !node) {
        return;
      }

      // Get the port label
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const portObj = node.getPort(String(port.id));
      if (!portObj) {
        return;
      }

      // Get the port label text
      let labelText = '';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (portObj.attrs && portObj.attrs['text']) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const textAttr = portObj.attrs['text'];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        labelText = typeof textAttr['text'] === 'string' ? textAttr['text'] : '';
      }

      // If no label, use the port ID as fallback
      if (!labelText) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        labelText = String(port.id);
      }

      // Set tooltip content and position
      tooltipEl.textContent = labelText;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      tooltipEl.style.left = `${e.clientX + 10}px`;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      tooltipEl.style.top = `${e.clientY - 30}px`;
      tooltipEl.style.display = 'block';
    });

    // Handle port mouseleave
    this._graph.on('node:port:mouseleave', () => {
      tooltipEl.style.display = 'none';
    });

    // Hide tooltip on other events
    this._graph.on('blank:mousedown node:mousedown edge:mousedown', () => {
      tooltipEl.style.display = 'none';
    });
  }
}
