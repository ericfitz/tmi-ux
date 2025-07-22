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

// Import the facade service and remaining infrastructure
import { DfdFacadeService } from './services/dfd-facade.service';
import { DfdNodeService } from './services/dfd-node.service';
import { DfdEdgeService } from './services/dfd-edge.service';
import { DfdEventHandlersService } from './services/dfd-event-handlers.service';
import { DfdExportService } from './services/dfd-export.service';
import { X6EventLoggerService } from './infrastructure/adapters/x6-event-logger.service';
import { DfdDiagramService } from './services/dfd-diagram.service';
import { DfdTooltipService } from './services/dfd-tooltip.service';
import { X6TooltipAdapter } from './infrastructure/adapters/x6-tooltip.adapter';
import { GraphHistoryCoordinator } from './services/graph-history-coordinator.service';
import { X6SelectionAdapter } from './infrastructure/adapters/x6-selection.adapter';
import { ThreatModelService } from '../tm/services/threat-model.service';
import { MatDialog } from '@angular/material/dialog';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../tm/components/metadata-dialog/metadata-dialog.component';
import { Metadata } from '../tm/models/threat-model.model';

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
    DfdTooltipService,

    // Facade service
    DfdFacadeService,

    // X6 Event Logger
    X6EventLoggerService,

    // Threat Model Service
    ThreatModelService,
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
  threatModelName: string | null = null;

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

  // Expose context menu position from facade service
  get contextMenuPosition(): { x: string; y: string } {
    return this.facade.contextMenuPosition;
  }

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private x6GraphAdapter: X6GraphAdapter,
    private route: ActivatedRoute,
    private facade: DfdFacadeService,
    private tooltipAdapter: X6TooltipAdapter,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
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

    // Load threat model data if we have a threatModelId
    if (this.threatModelId) {
      this.loadThreatModelData(this.threatModelId);
    }

    // Load diagram data if we have a dfdId
    if (this.dfdId) {
      this.loadDiagramData(this.dfdId);
    }

    // Initialize event handlers
    this.facade.initializeEventHandlers(this.x6GraphAdapter);

    // Subscribe to context menu events from X6GraphAdapter
    this._subscriptions.add(
      this.x6GraphAdapter.cellContextMenu$.subscribe(({ cell, x, y }) => {
        // Direct call to event handlers for component-specific UI operations
        // This is acceptable since it involves component-specific parameters (MatMenuTrigger, ChangeDetectorRef)
        // that shouldn't be exposed through the facade
        this.facade.openCellContextMenu(cell, x, y, this.contextMenuTrigger, this.cdr);
      }),
    );

    // Subscribe to selection state changes from facade
    this._subscriptions.add(
      this.facade.selectedCells$.subscribe(selectedCells => {
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
   * Loads the threat model data for the given threat model ID
   */
  private loadThreatModelData(threatModelId: string): void {
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(threatModelId).subscribe({
        next: threatModel => {
          if (threatModel) {
            this.threatModelName = threatModel.name;
            this.cdr.markForCheck();
          }
        },
        error: error => {
          this.logger.error('Error loading threat model data', error);
        },
      }),
    );
  }

  /**
   * Loads the diagram data for the given diagram ID using the diagram service
   */
  private loadDiagramData(diagramId: string): void {
    this._subscriptions.add(
      this.facade.loadDiagram(diagramId, this.threatModelId ?? undefined).subscribe({
        next: result => {
          if (result.success && result.diagram) {
            this.diagramName = result.diagram.name;
            this.cdr.markForCheck();
          } else {
            // Handle diagram not found
            this.facade.closeDiagram(this.threatModelId, this.dfdId);
          }
        },
        error: error => {
          this.logger.error('Error loading diagram data', error);
          this.facade.closeDiagram(this.threatModelId, this.dfdId);
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

    // Dispose event handlers through facade
    this.facade.disposeEventHandlers();

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
    this._resizeTimeout = this.facade.onWindowResize(
      this.graphContainer,
      this._resizeTimeout,
      this.x6GraphAdapter,
    );
  }

  /**
   * Handle keyboard events for delete functionality and undo/redo
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.facade.onKeyDown(event, this.dfdId || 'default-diagram', this._isInitialized, this.x6GraphAdapter);
  }

  /**
   * Method to add a node at a predictable position
   */
  addGraphNode(shapeType: NodeType = 'actor'): void {
    const container = this.graphContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.facade
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
    this.facade.exportDiagram(format, this.threatModelName ?? undefined, this.diagramName ?? undefined);
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(): void {
    this.facade.onDeleteSelected(this._isInitialized, this.x6GraphAdapter);
    this.cdr.markForCheck();
  }

  /**
   * Shows the cell properties dialog with the serialized JSON object definition
   */
  showCellProperties(): void {
    this.facade.showCellProperties();
  }

  /**
   * Opens the threat editor dialog to create a new threat
   */
  openThreatEditor(): void {
    this.facade.openThreatEditor(this.threatModelId, this.dfdId);
  }

  /**
   * Opens the metadata dialog for the selected cell
   */
  openCellMetadataDialog(): void {
    if (!this.hasExactlyOneSelectedCell) {
      this.logger.warn('Cannot open metadata dialog: no single cell selected');
      return;
    }

    // Get the selected cell from the graph adapter
    const selectedCells = this.x6GraphAdapter.getSelectedCells();
    if (selectedCells.length !== 1) {
      return;
    }

    const cell = selectedCells[0];
    const cellData = cell.getData() || {};
    
    const dialogData: MetadataDialogData = {
      metadata: cellData.metadata || [],
      isReadOnly: false,
    };

    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      minWidth: '500px',
      maxHeight: '80vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: Metadata[] | undefined) => {
        if (result && cell) {
          // Update the cell metadata
          const updatedData = { ...cellData, metadata: result };
          cell.setData(updatedData);
          
          this.logger.info('Updated cell metadata', { cellId: cell.id, metadata: result });
        }
      }),
    );
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(): void {
    this.facade.closeDiagram(this.threatModelId, this.dfdId);
  }

  /**
   * Handle edge added events from the graph adapter
   */
  private handleEdgeAdded(edge: Edge): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.facade
      .handleEdgeAdded(edge, graph, this.dfdId || 'default-diagram', this._isInitialized)
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
    const graph = this.x6GraphAdapter.getGraph();
    this.facade
      .handleEdgeVerticesChanged(
        edgeId,
        vertices,
        graph,
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
    this.facade.moveForward(this.x6GraphAdapter);
  }

  /**
   * Move selected cells backward in z-order
   */
  moveBackward(): void {
    this.facade.moveBackward(this.x6GraphAdapter);
  }

  /**
   * Move selected cells to front
   */
  moveToFront(): void {
    this.facade.moveToFront(this.x6GraphAdapter);
  }

  /**
   * Move selected cells to back
   */
  moveToBack(): void {
    this.facade.moveToBack(this.x6GraphAdapter);
  }

  /**
   * Check if the right-clicked cell is an edge
   */
  isRightClickedCellEdge(): boolean {
    return this.facade.isRightClickedCellEdge();
  }

  /**
   * Edit the text/label of the right-clicked cell by invoking the label editor
   */
  editCellText(): void {
    this.facade.editCellText(this.x6GraphAdapter);
  }

  /**
   * Add an inverse connection for the right-clicked edge using the edge service
   */
  addInverseConnection(): void {
    const rightClickedCell = this.facade.getRightClickedCell();
    if (!rightClickedCell || !rightClickedCell.isEdge()) {
      this.logger.warn('No edge selected for inverse connection');
      return;
    }

    const originalEdge = rightClickedCell;
    const graph = this.x6GraphAdapter.getGraph();
    
    this.facade
      .addInverseConnection(originalEdge, graph, this.dfdId || 'default-diagram')
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
    this.facade.undo(this._isInitialized, this.x6GraphAdapter);
  }

  /**
   * Redo the last undone action using X6 history addon
   */
  redo(): void {
    this.facade.redo(this._isInitialized, this.x6GraphAdapter);
  }
}
