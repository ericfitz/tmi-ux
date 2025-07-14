import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuTrigger } from '@angular/material/menu';
import { TranslocoModule } from '@jsverse/transloco';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { Node, Edge } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { initializeX6CellExtensions } from './utils/x6-cell-extensions';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { NodeType } from './domain/value-objects/node-data';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';

// Import providers needed for standalone component
import { EdgeQueryService } from './infrastructure/services/edge-query.service';
import { NodeConfigurationService } from './infrastructure/services/node-configuration.service';
import { X6KeyboardHandler } from './infrastructure/adapters/x6-keyboard-handler';

// Import the new consolidated services
import { DfdNodeService } from './services/dfd-node.service';
import { DfdEdgeService } from './services/dfd-edge.service';
import { DfdEventHandlersService } from './services/dfd-event-handlers.service';
import { DfdExportService } from './services/dfd-export.service';

type ExportFormat = 'png' | 'jpeg' | 'svg';

@Component({
  selector: 'app-dfd',
  standalone: true,
  imports: [
    CommonModule,
    CoreMaterialModule,
    MatMenuModule,
    MatTooltipModule,
    TranslocoModule,
    DfdCollaborationComponent,
  ],
  providers: [
    // Infrastructure adapters
    X6GraphAdapter,
    EdgeQueryService,
    NodeConfigurationService,
    X6KeyboardHandler,

    // New consolidated services
    DfdNodeService,
    DfdEdgeService,
    DfdEventHandlersService,
    DfdExportService,
  ],
  templateUrl: './dfd.component.html',
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;
  @ViewChild('contextMenuTrigger') contextMenuTrigger!: MatMenuTrigger;

  private _observer: MutationObserver | null = null;
  private _subscriptions = new Subscription();
  private _resizeTimeout: number | null = null;
  private _isInitialized = false;

  // Route parameters
  threatModelId: string | null = null;
  dfdId: string | null = null;

  // Diagram data
  diagramName: string | null = null;

  // State properties - exposed as public properties for template binding
  hasSelectedCells = false;
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;

  // Undo/redo state properties - updated by X6 history addon
  canUndo = false;
  canRedo = false;

  // Private properties to track previous undo/redo states
  private _previousCanUndo = false;
  private _previousCanRedo = false;

  // Expose context menu position from event handlers service
  get contextMenuPosition(): { x: string; y: string } {
    return this.eventHandlers.contextMenuPosition;
  }

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private x6GraphAdapter: X6GraphAdapter,
    private route: ActivatedRoute,
    private nodeManager: DfdNodeService,
    private edgeManager: DfdEdgeService,
    private eventHandlers: DfdEventHandlersService,
    private exportService: DfdExportService,
  ) {
    this.logger.info('DfdComponent constructor called');

    // Initialize X6 cell extensions first
    this.logger.info('Initializing X6 cell extensions');
    initializeX6CellExtensions();

    // Get route parameters
    this.threatModelId = this.route.snapshot.paramMap.get('id');
    this.dfdId = this.route.snapshot.paramMap.get('dfdId');

    this.logger.info('DFD Component initialized with parameters', {
      threatModelId: this.threatModelId,
      dfdId: this.dfdId,
    });
  }

  ngOnInit(): void {
    this.logger.info('DfdComponent ngOnInit called');

    // Load diagram data if we have a dfdId
    if (this.dfdId) {
      this.loadDiagramData(this.dfdId);
    }

    // Initialize event handlers
    this.eventHandlers.initialize();

    // Subscribe to context menu events from X6GraphAdapter
    this._subscriptions.add(
      this.x6GraphAdapter.cellContextMenu$.subscribe(({ cell, x, y }) => {
        this.eventHandlers.openCellContextMenu(cell, x, y, this.contextMenuTrigger, this.cdr);
      }),
    );

    // Subscribe to selection state changes from event handlers
    this._subscriptions.add(
      this.eventHandlers.selectedCells$.subscribe(selectedCells => {
        this.hasSelectedCells = selectedCells.length > 0;
        this.hasExactlyOneSelectedCell = selectedCells.length === 1;
        this.selectedCellIsTextBox = selectedCells.some(
          cell => (cell.data as { type?: string })?.type === 'textbox',
        );
        this.cdr.markForCheck();
      }),
    );

    // Subscribe to history state changes for undo/redo button states
    this._subscriptions.add(
      this.x6GraphAdapter.historyChanged$.subscribe(({ canUndo, canRedo }) => {
        // Only emit and log if the state has actually changed
        if (canUndo !== this._previousCanUndo || canRedo !== this._previousCanRedo) {
          this.canUndo = canUndo;
          this.canRedo = canRedo;

          // Update previous state tracking
          this._previousCanUndo = canUndo;
          this._previousCanRedo = canRedo;

          this.cdr.markForCheck();
        }
      }),
    );

    // Subscribe to edge creation events
    this._subscriptions.add(
      this.x6GraphAdapter.edgeAdded$.subscribe(edge => {
        this.handleEdgeAdded(edge);
      }),
    );

    // Subscribe to edge vertices changes
    this._subscriptions.add(
      this.x6GraphAdapter.edgeVerticesChanged$.subscribe(({ edgeId, vertices }) => {
        this.handleEdgeVerticesChanged(edgeId, vertices);
      }),
    );
  }

  /**
   * Loads the diagram data for the given diagram ID
   */
  private loadDiagramData(diagramId: string): void {
    // In a real implementation, this would use a dedicated diagram service
    void import('../../pages/tm/models/diagram.model').then(module => {
      const diagram = module.DIAGRAMS_BY_ID.get(diagramId);
      if (diagram) {
        this.diagramName = diagram.name;
        this.logger.info('Loaded diagram data', { name: this.diagramName, id: diagramId });
        this.cdr.markForCheck();
      } else {
        this.logger.warn('Diagram not found, redirecting to threat model page', { id: diagramId });
        // Redirect to threat model page if diagram doesn't exist
        this.eventHandlers.closeDiagram(this.threatModelId, this.dfdId);
      }
    });
  }

  ngAfterViewInit(): void {
    // Initialize the graph after the view is fully initialized
    this.initializeGraph();

    // Ensure Roboto Condensed font is loaded
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap';
    document.head.appendChild(fontLink);
  }

  ngOnDestroy(): void {
    // Disconnect the mutation observer
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    // Clear any pending resize timeout
    if (this._resizeTimeout) {
      window.clearTimeout(this._resizeTimeout);
      this._resizeTimeout = null;
    }

    // Dispose event handlers
    this.eventHandlers.dispose();

    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();

    // Dispose the graph adapter
    this.x6GraphAdapter.dispose();
  }

  /**
   * Handle window resize events to update the graph size
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    this._resizeTimeout = this.eventHandlers.onWindowResize(
      this.graphContainer,
      this._resizeTimeout,
    );
  }

  /**
   * Handle keyboard events for delete functionality and undo/redo
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.eventHandlers.onKeyDown(event, this.dfdId || 'default-diagram', this._isInitialized);
  }

  /**
   * Method to add a node at a predictable position
   */
  addGraphNode(shapeType: NodeType = 'actor'): void {
    const container = this.graphContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.nodeManager
      .addGraphNode(shapeType, width, height, this.dfdId || 'default-diagram', this._isInitialized)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.detectChanges();
        },
        error: error => {
          this.logger.error('Error adding node', error);
        },
      });
  }

  /**
   * Initialize the X6 graph
   */
  private initializeGraph(): void {
    this.logger.info('DfdComponent initializeGraph called');

    try {
      // Initialize the graph using X6GraphAdapter
      this.x6GraphAdapter.initialize(this.graphContainer.nativeElement as HTMLElement);
      this._isInitialized = true;

      // Trigger an initial resize to ensure the graph fits the container
      setTimeout(() => {
        const graph = this.x6GraphAdapter.getGraph();
        if (graph) {
          const container = this.graphContainer.nativeElement as HTMLElement;
          const width = container.clientWidth;
          const height = container.clientHeight;
          graph.resize(width, height);
          this.logger.info('Initial graph resize', { width, height });
        }
      }, 0);

      // Set up observation for DOM changes to add passive event listeners
      this.setupDomObservation();

      // Set up port tooltips
      this.setupPortTooltips();

      this.logger.info('Graph initialization complete');

      // Force change detection after initialization
      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error initializing graph', error);
    }
  }

  /**
   * Sets up observation of DOM changes to add passive event listeners to new elements
   */
  private setupDomObservation(): void {
    if (!this.graphContainer || !this.graphContainer.nativeElement) {
      return;
    }

    const container = this.graphContainer.nativeElement as HTMLElement;

    // Function to safely add passive event listener
    const addPassiveListener = (element: Element): void => {
      const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];
      passiveEvents.forEach(eventType => {
        element.addEventListener(
          eventType,
          (_e: Event) => {
            // Empty handler with passive: true to prevent browser warnings
          },
          { passive: true, capture: false },
        );
      });
    };

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
    this.logger.info('DOM observation set up for passive event listeners');
  }

  /**
   * Set up tooltips for ports
   */
  private setupPortTooltips(): void {
    const graph = this.x6GraphAdapter.getGraph();
    if (!graph) {
      return;
    }

    // Create tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'dfd-port-tooltip';
    tooltipEl.style.display = 'none';
    graph.container.appendChild(tooltipEl);

    // Handle port mouseenter
    graph.on(
      'node:port:mouseenter',
      ({ node, port, e }: { node: Node; port: { id: string }; e: MouseEvent }) => {
        if (!port || !node) {
          return;
        }

        // Get the port label
        type PortObject = {
          id?: string;
          attrs?: Record<string, { text?: string }>;
        };

        const portObj = node ? ((node as any).getPort(String(port.id)) as PortObject) : null;
        if (!portObj) {
          return;
        }

        // Get the port label text
        let labelText = '';
        if (portObj?.attrs && 'text' in portObj.attrs) {
          const textAttr = portObj.attrs['text'];
          labelText = typeof textAttr['text'] === 'string' ? textAttr['text'] : '';
        }

        // If no label, use the port ID as fallback
        if (!labelText) {
          labelText = String(port.id);
        }

        // Set tooltip content and position
        tooltipEl.textContent = labelText;
        tooltipEl.style.left = `${e.clientX + 10}px`;
        tooltipEl.style.top = `${e.clientY - 30}px`;
        tooltipEl.style.display = 'block';
      },
    );

    // Handle port mouseleave
    graph.on('node:port:mouseleave', () => {
      tooltipEl.style.display = 'none';
    });

    // Hide tooltip on other events
    graph.on('blank:mousedown node:mousedown edge:mousedown', () => {
      tooltipEl.style.display = 'none';
    });
  }

  /**
   * Export the diagram to the specified format
   */
  exportDiagram(format: ExportFormat): void {
    this.exportService.exportDiagram(format);
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(): void {
    this.eventHandlers.deleteSelected(this._isInitialized);
    this.cdr.markForCheck();
  }

  /**
   * Copies the complete definition of the right-clicked cell to the clipboard
   */
  copyCellDefinition(): void {
    this.eventHandlers.copyCellDefinition();
  }

  /**
   * Opens the threat editor dialog to create a new threat
   */
  openThreatEditor(): void {
    this.eventHandlers.openThreatEditor(this.threatModelId, this.dfdId);
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(): void {
    this.eventHandlers.closeDiagram(this.threatModelId, this.dfdId);
  }

  /**
   * Handle edge added events from the graph adapter
   */
  private handleEdgeAdded(edge: Edge): void {
    this.edgeManager
      .handleEdgeAdded(edge, this.dfdId || 'default-diagram', this._isInitialized)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error handling edge added', error);
        },
      });
  }

  /**
   * Handle edge vertices changes from the graph adapter
   */
  private handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
  ): void {
    this.edgeManager
      .handleEdgeVerticesChanged(
        edgeId,
        vertices,
        this.dfdId || 'default-diagram',
        this._isInitialized,
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error handling edge vertices changed', error);
        },
      });
  }

  /**
   * Move selected cells forward in z-order
   */
  moveForward(): void {
    this.eventHandlers.moveForward();
  }

  /**
   * Move selected cells backward in z-order
   */
  moveBackward(): void {
    this.eventHandlers.moveBackward();
  }

  /**
   * Move selected cells to front
   */
  moveToFront(): void {
    this.eventHandlers.moveToFront();
  }

  /**
   * Move selected cells to back
   */
  moveToBack(): void {
    this.eventHandlers.moveToBack();
  }

  /**
   * Check if the right-clicked cell is an edge
   */
  isRightClickedCellEdge(): boolean {
    return this.eventHandlers.isRightClickedCellEdge();
  }

  /**
   * Edit the text/label of the right-clicked cell by invoking the label editor
   */
  editCellText(): void {
    this.eventHandlers.editCellText();
  }

  /**
   * Add an inverse connection for the right-clicked edge using X6 native functionality
   */
  addInverseConnection(): void {
    const rightClickedCell = this.eventHandlers.getRightClickedCell();
    if (!rightClickedCell || !rightClickedCell.isEdge()) {
      this.logger.warn('No edge selected for inverse connection');
      return;
    }

    const originalEdge = rightClickedCell;
    const sourceNodeId = originalEdge.getSourceCellId();
    const targetNodeId = originalEdge.getTargetCellId();
    const sourcePortId = originalEdge.getSourcePortId();
    const targetPortId = originalEdge.getTargetPortId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Cannot create inverse connection: edge missing source or target', {
        edgeId: originalEdge.id,
        sourceNodeId,
        targetNodeId,
      });
      return;
    }

    this.logger.info('Creating inverse connection using X6 native functionality', {
      originalEdgeId: originalEdge.id,
      originalSource: sourceNodeId,
      originalTarget: targetNodeId,
      originalSourcePort: sourcePortId,
      originalTargetPort: targetPortId,
    });

    // Get the original edge's label for consistency
    const originalLabel = this.x6GraphAdapter.getCellLabel(originalEdge) || 'Flow';

    // Create inverse edge using X6GraphAdapter's addEdge method to ensure proper domain model integration
    // This will trigger the normal edge creation flow and register the edge in the domain model
    const graph = this.x6GraphAdapter.getGraph();

    // Use X6's createEdge method to create the edge with proper configuration
    const inverseEdge = graph.createEdge({
      source: { cell: targetNodeId, port: targetPortId },
      target: { cell: sourceNodeId, port: sourcePortId },
      shape: 'edge',
      markup: [
        {
          tagName: 'path',
          selector: 'wrap',
          attrs: {
            fill: 'none',
            cursor: 'pointer',
            stroke: 'transparent',
            strokeLinecap: 'round',
          },
        },
        {
          tagName: 'path',
          selector: 'line',
          attrs: {
            fill: 'none',
            pointerEvents: 'none',
          },
        },
      ],
      attrs: {
        wrap: {
          connection: true,
          strokeWidth: 10,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          stroke: 'transparent',
          fill: 'none',
        },
        line: {
          connection: true,
          stroke: '#000000',
          strokeWidth: 2,
          fill: 'none',
          targetMarker: {
            name: 'classic',
            size: 8,
            fill: '#000000',
            stroke: '#000000',
          },
        },
      },
      vertices: [],
      labels: [
        {
          position: 0.5,
          attrs: {
            text: {
              text: originalLabel,
              fontSize: 12,
              fill: '#333',
              fontFamily: '"Roboto Condensed", Arial, sans-serif',
              textAnchor: 'middle',
              dominantBaseline: 'middle',
            },
            rect: {
              fill: '#ffffff',
              stroke: 'none',
            },
          },
        },
      ],
      zIndex: 1,
    });

    // Add the edge to the graph, which will trigger the normal edge creation flow
    graph.addCell(inverseEdge);

    this.logger.info('Inverse edge created successfully using X6 native functionality', {
      originalEdgeId: originalEdge.id,
      inverseEdgeId: inverseEdge.id,
      newSource: targetNodeId,
      newTarget: sourceNodeId,
      newSourcePort: targetPortId,
      newTargetPort: sourcePortId,
    });

    this.cdr.markForCheck();
  }

  /**
   * Undo the last action using X6 history addon
   */
  undo(): void {
    this.eventHandlers.undo(this._isInitialized);
  }

  /**
   * Redo the last undone action using X6 history addon
   */
  redo(): void {
    this.eventHandlers.redo(this._isInitialized);
  }
}
