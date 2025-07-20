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
import { Edge } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { initializeX6CellExtensions } from './utils/x6-cell-extensions';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { NodeType } from './domain/value-objects/node-info';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';

// Import providers needed for standalone component
import { EdgeQueryService } from './infrastructure/services/edge-query.service';
import { NodeConfigurationService } from './infrastructure/services/node-configuration.service';
import { X6KeyboardHandler } from './infrastructure/adapters/x6-keyboard-handler';
import { X6ZOrderAdapter } from './infrastructure/adapters/x6-z-order.adapter';
import { X6EmbeddingAdapter } from './infrastructure/adapters/x6-embedding.adapter';
import { X6HistoryManager } from './infrastructure/adapters/x6-history-manager';
import { EmbeddingService } from './infrastructure/services/embedding.service';

// Import the new consolidated services
import { DfdNodeService } from './services/dfd-node.service';
import { DfdEdgeService } from './services/dfd-edge.service';
import { DfdEventHandlersService } from './services/dfd-event-handlers.service';
import { DfdExportService } from './services/dfd-export.service';
import { X6EventLoggerService } from './services/x6-event-logger.service';
import { DfdDiagramService } from './services/dfd-diagram.service';
import { DfdConnectionValidationService } from './services/dfd-connection-validation.service';
import { DfdCellLabelService } from './services/dfd-cell-label.service';
import { DfdTooltipService } from './services/dfd-tooltip.service';
import { X6TooltipAdapter } from './infrastructure/adapters/x6-tooltip.adapter';
import { GraphHistoryCoordinator } from './services/graph-history-coordinator.service';
import { X6SelectionAdapter } from './infrastructure/adapters/x6-selection.adapter';

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
    X6ZOrderAdapter,
    X6EmbeddingAdapter,
    X6HistoryManager,
    X6TooltipAdapter,
    X6SelectionAdapter,

    // Infrastructure services
    EmbeddingService,

    // History coordination
    GraphHistoryCoordinator,

    // New consolidated services
    DfdNodeService,
    DfdEdgeService,
    DfdEventHandlersService,
    DfdExportService,
    DfdDiagramService,
    DfdConnectionValidationService,
    DfdCellLabelService,
    DfdTooltipService,

    // X6 Event Logger
    X6EventLoggerService,
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
    private diagramService: DfdDiagramService,
    private tooltipAdapter: X6TooltipAdapter,
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
        this.selectedCellIsTextBox = selectedCells.some(cell => cell.shape === 'text-box');
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
   * Loads the diagram data for the given diagram ID using the diagram service
   */
  private loadDiagramData(diagramId: string): void {
    this._subscriptions.add(
      this.diagramService.loadDiagram(diagramId, this.threatModelId ?? undefined).subscribe({
        next: result => {
          if (result.success && result.diagram) {
            this.diagramName = result.diagram.name;
            this.cdr.markForCheck();
          } else {
            // Handle diagram not found
            this.eventHandlers.closeDiagram(this.threatModelId, this.dfdId);
          }
        },
        error: error => {
          this.logger.error('Error loading diagram data', error);
          this.eventHandlers.closeDiagram(this.threatModelId, this.dfdId);
        },
      }),
    );
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

    // Dispose tooltip adapter
    this.tooltipAdapter.dispose();

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
   * Initialize the X6 graph and related systems
   */
  private initializeGraph(): void {
    this.logger.info('DfdComponent initializeGraph called');

    try {
      const container = this.graphContainer.nativeElement as HTMLElement;
      
      // Initialize the graph using X6GraphAdapter (delegates all X6-specific setup)
      this.x6GraphAdapter.initialize(container);
      this._isInitialized = true;

      // Get the initialized graph for other adapters
      const graph = this.x6GraphAdapter.getGraph();
      if (!graph) {
        throw new Error('Graph initialization failed');
      }

      // Set up additional systems that depend on the graph
      this.setupDomObservation();
      this.tooltipAdapter.initialize(graph);

      this.logger.info('Graph initialization complete');
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
   * Export the diagram to the specified format
   */
  exportDiagram(format: ExportFormat): void {
    this.exportService.exportDiagram(format);
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(): void {
    this.eventHandlers.onDeleteSelected(this._isInitialized);
    this.cdr.markForCheck();
  }

  /**
   * Shows the cell properties dialog with the serialized JSON object definition
   */
  showCellProperties(): void {
    this.eventHandlers.showCellProperties();
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
   * Add an inverse connection for the right-clicked edge using the edge service
   */
  addInverseConnection(): void {
    const rightClickedCell = this.eventHandlers.getRightClickedCell();
    if (!rightClickedCell || !rightClickedCell.isEdge()) {
      this.logger.warn('No edge selected for inverse connection');
      return;
    }

    const originalEdge = rightClickedCell;
    
    this.edgeManager
      .addInverseConnection(originalEdge, this.dfdId || 'default-diagram')
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error adding inverse connection', error);
        },
      });
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
