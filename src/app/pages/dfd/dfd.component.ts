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
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Graph } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
import { saveAs } from 'file-saver-es';
import { LoggerService } from '../../core/services/logger.service';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { DfdGraphService } from './services/dfd-graph.service';
import { DfdNodeService } from './services/dfd-node.service';
import { DfdPortService } from './services/dfd-port.service';
import { DfdEventService } from './services/dfd-event.service';
import { DfdHighlighterService } from './services/dfd-highlighter.service';
import { DfdLabelEditorService } from './services/dfd-label-editor.service';
import { ShapeType } from './services/dfd-node.service';

@Component({
  selector: 'app-dfd',
  standalone: true,
  imports: [CommonModule, CoreMaterialModule, MatMenuModule, MatTooltipModule],
  templateUrl: './dfd.component.html',
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;

  private _graph: Graph | null = null;
  private _observer: MutationObserver | null = null;

  // History state
  canUndo = false;
  canRedo = false;

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private graphService: DfdGraphService,
    private nodeService: DfdNodeService,
    private portService: DfdPortService,
    private eventService: DfdEventService,
    private highlighterService: DfdHighlighterService,
    private labelEditorService: DfdLabelEditorService,
  ) {
    this.logger.info('DfdComponent constructor called');
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
    this.logger.info('DfdComponent ngOnInit called');

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
   * Add passive event listeners to the graph container and its child elements
   * This is a workaround for the browser warnings about non-passive event listeners
   */
  private addPassiveEventListeners(): void {
    if (!this.graphContainer || !this.graphContainer.nativeElement || !this._graph) {
      return;
    }

    const container = this.graphContainer.nativeElement as HTMLElement;

    // Get all the elements that might have event listeners
    const canvasElements = container.querySelectorAll('canvas') as NodeListOf<Element>;
    const svgElements = container.querySelectorAll('svg') as NodeListOf<Element>;

    // Add passive event listeners to all relevant elements
    const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];

    // Function to safely add passive event listener
    const addPassiveListener = (element: Element): void => {
      passiveEvents.forEach(eventType => {
        // Create a passive event listener that captures events before X6 processes them
        element.addEventListener(
          eventType,
          (_e: Event) => {
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
    addPassiveListener(container as Element);

    // Add a mutation observer to handle dynamically added elements
    this._observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node: globalThis.Node) => {
            if (node instanceof Element) {
              // Add passive listeners to newly added elements
              addPassiveListener(node);

              // Also add to any canvas or svg children
              const elements = node.querySelectorAll('canvas, svg');
              elements.forEach(element => addPassiveListener(element));
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
    this.logger.info('DfdComponent initializeGraph called');

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

      // Set up history state change listener
      this.setupHistoryStateListener();

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

  /**
   * Set up history state change listener
   */
  private setupHistoryStateListener(): void {
    if (!this._graph) {
      return;
    }

    const history = this._graph.getPlugin<History>('history');
    if (!history) {
      this.logger.warn('History plugin not found');
      return;
    }

    // Update history state whenever it changes
    history.on('change', () => {
      this.canUndo = history.canUndo();
      this.canRedo = history.canRedo();
      this.logger.debug(`History state changed: canUndo=${this.canUndo}, canRedo=${this.canRedo}`);
      this.cdr.detectChanges();
    });
  }

  /**
   * Undo the last action
   */
  undo(): void {
    if (!this._graph) {
      this.logger.warn('Cannot undo: Graph is not initialized');
      return;
    }

    const history = this._graph.getPlugin<History>('history');
    if (!history) {
      this.logger.warn('History plugin not found');
      return;
    }

    if (history.canUndo()) {
      history.undo();
      this.logger.info('Undo action performed');
    } else {
      this.logger.info('Cannot undo: No more actions to undo');
    }
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    if (!this._graph) {
      this.logger.warn('Cannot redo: Graph is not initialized');
      return;
    }

    const history = this._graph.getPlugin<History>('history');
    if (!history) {
      this.logger.warn('History plugin not found');
      return;
    }

    if (history.canRedo()) {
      history.redo();
      this.logger.info('Redo action performed');
    } else {
      this.logger.info('Cannot redo: No more actions to redo');
    }
  }

  /**
   * Export the diagram to the specified format
   * @param format The format to export to (png, jpeg, svg)
   */
  exportDiagram(format: 'png' | 'jpeg' | 'svg'): void {
    if (!this._graph) {
      this.logger.warn('Cannot export: Graph is not initialized');
      return;
    }

    try {
      this.logger.info(`Exporting diagram as ${format}`);

      // Generate a filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dfd-diagram-${timestamp}.${format}`;

      if (format === 'svg') {
        // For SVG export
        this._graph.toSVG((svgString: string) => {
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          saveAs(blob, filename);
          this.logger.info(`Diagram exported as SVG: ${filename}`);
        });
      } else if (format === 'png') {
        // For PNG export
        this._graph.toPNG(
          (dataUri: string) => {
            // Convert data URI to Blob
            const byteString = atob(dataUri.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: 'image/png' });
            saveAs(blob, filename);
            this.logger.info(`Diagram exported as PNG: ${filename}`);
          },
          {
            backgroundColor: 'white',
            padding: 20,
            quality: 1,
          },
        );
      } else {
        // For JPEG export
        this._graph.toJPEG(
          (dataUri: string) => {
            // Convert data URI to Blob
            const byteString = atob(dataUri.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: 'image/jpeg' });
            saveAs(blob, filename);
            this.logger.info(`Diagram exported as JPEG: ${filename}`);
          },
          {
            backgroundColor: 'white',
            padding: 20,
            quality: 0.8,
          },
        );
      }
    } catch (error: unknown) {
      this.logger.error(`Error exporting diagram as ${format}`, error);
    }
  }
}
