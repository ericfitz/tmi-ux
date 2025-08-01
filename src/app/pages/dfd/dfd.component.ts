/**
 * Data Flow Diagram (DFD) Component
 *
 * This is the main component for the Data Flow Diagram editor page.
 * It provides a comprehensive diagram editing environment using the X6 graph library.
 *
 * Key functionality:
 * - Renders interactive data flow diagrams with nodes (actors, processes, stores) and edges
 * - Supports real-time collaboration with multiple users via WebSocket integration
 * - Provides comprehensive toolbar with node creation, editing, and export tools
 * - Implements context menu for cell-specific operations (delete, edit, add threats)
 * - Manages diagram loading from threat models with proper history suppression
 * - Handles keyboard shortcuts for common operations (delete, undo, redo)
 * - Supports drag-and-drop node creation and edge connection validation
 * - Provides port visibility management and visual feedback systems
 * - Implements z-order operations for layering control
 * - Handles window resize events for responsive graph sizing
 * - Manages authentication and access control for diagram operations
 * - Supports metadata editing and threat association for diagram elements
 * - Provides export functionality for multiple formats (PNG, JPG, SVG)
 */

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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { Edge } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { initializeX6CellExtensions } from './utils/x6-cell-extensions';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { NodeType } from './domain/value-objects/node-info';
import { getX6ShapeForNodeType } from './infrastructure/adapters/x6-shape-definitions';
import { NodeConfigurationService } from './infrastructure/services/node-configuration.service';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';

// Import providers needed for standalone component
import { EdgeQueryService } from './infrastructure/services/edge-query.service';
import { X6KeyboardHandler } from './infrastructure/adapters/x6-keyboard-handler';
import { X6ZOrderAdapter } from './infrastructure/adapters/x6-z-order.adapter';
import { X6EmbeddingAdapter } from './infrastructure/adapters/x6-embedding.adapter';
import { X6HistoryManager } from './infrastructure/adapters/x6-history-manager';
import { EmbeddingService } from './infrastructure/services/embedding.service';

// Import the facade service and remaining infrastructure
import { DfdFacadeService } from './services/dfd-facade.service';
import { DfdNodeService } from './infrastructure/services/node.service';
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
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../tm/components/threats-dialog/threats-dialog.component';
import {
  X6HistoryDialogComponent,
  X6HistoryDialogData,
} from './components/x6-history-dialog/x6-history-dialog.component';
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
  private pendingDiagramCells: any[] | null = null;

  // State properties - exposed as public properties for template binding
  hasSelectedCells = false;
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;
  selectedCellIsSecurityBoundary = false;

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
    private nodeConfigurationService: NodeConfigurationService,
    private translocoService: TranslocoService,
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
        this.selectedCellIsSecurityBoundary = selectedCells.some(
          cell => cell.shape === 'security-boundary',
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

    // Subscribe to actual history modifications for auto-save
    this._subscriptions.add(
      this.x6GraphAdapter.historyModified$.subscribe(() => {
        this.logger.info('DFD Component received history modification event');

        // Auto-save diagram when history is actually modified
        if (this._isInitialized && this.dfdId && this.threatModelId) {
          const graph = this.x6GraphAdapter.getGraph();
          if (graph) {
            this.logger.info('Triggering auto-save after history modification', {
              dfdId: this.dfdId,
              threatModelId: this.threatModelId
            });
            this.autoSaveDiagram('History modified');
          } else {
            this.logger.warn('Cannot auto-save: graph not available');
          }
        } else {
          this.logger.warn('Cannot auto-save: missing requirements', {
            isInitialized: this._isInitialized,
            dfdId: this.dfdId,
            threatModelId: this.threatModelId
          });
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

    // Subscribe to cell data changes (metadata changes) for auto-save
    this._subscriptions.add(
      this.x6GraphAdapter.nodeInfoChanged$.subscribe(({ nodeId, newData, oldData }) => {
        this.logger.info('Cell metadata changed, auto-saving diagram', {
          nodeId,
          hasNewData: !!newData,
          hasOldData: !!oldData,
        });
        this.autoSaveDiagram('Cell metadata changed');
      }),
    );

    // Subscribe to threat changes for auto-save
    this._subscriptions.add(
      this.facade.threatChanged$.subscribe(({ action, threatId, diagramId }) => {
        this.logger.info('Threat changed, auto-saving diagram', {
          action,
          threatId,
          diagramId,
        });
        this.autoSaveDiagram(`Threat ${action}`);
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
    if (!this.threatModelId) {
      this.logger.error('Cannot load diagram data: threat model ID is required');
      return;
    }

    this.logger.info('Loading diagram data', { diagramId, threatModelId: this.threatModelId });

    this._subscriptions.add(
      this.facade.loadDiagram(diagramId, this.threatModelId).subscribe({
        next: result => {
          this.logger.info('Diagram data loaded', { 
            success: result.success, 
            hasDiagram: !!result.diagram,
            diagramName: result.diagram?.name,
            cellCount: result.diagram?.cells?.length || 0
          });

          if (result.success && result.diagram) {
            this.diagramName = result.diagram.name;

            // Load the diagram cells into the graph if available
            if (result.diagram.cells && result.diagram.cells.length > 0) {
              this.logger.info('Found diagram cells to load', { 
                cellCount: result.diagram.cells.length,
                isInitialized: this._isInitialized 
              });

              if (this._isInitialized) {
                this.logger.info('Graph is initialized - loading cells immediately');
                this.loadDiagramCells(result.diagram.cells);
              } else {
                this.logger.info('Graph not yet initialized - storing cells as pending');
                // Store cells to load after graph is initialized
                this.pendingDiagramCells = result.diagram.cells;
              }
            } else {
              this.logger.info('No diagram cells to load');
            }

            this.cdr.markForCheck();
          } else {
            this.logger.warn('Diagram loading failed or diagram not found', result);
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
    // Skip saving on destroy since we already save manually in closeDiagram()
    // This prevents overwriting with empty graph after disposal
    this.logger.info('Skipping diagram save on destroy - manual save already performed in closeDiagram()');

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
   * Get localized shape name from the raw shape string
   */
  private getLocalizedShapeName(rawShape: string): string {
    // Map node type identifiers to localization keys
    const shapeKeyMap: { [key: string]: string } = {
      'actor': 'editor.nodeLabels.actor',
      'process': 'editor.nodeLabels.process', 
      'store': 'editor.nodeLabels.store',
      'security-boundary': 'editor.nodeLabels.securityBoundary',
      'text-box': 'editor.nodeLabels.textbox',
      'textbox': 'editor.nodeLabels.textbox', // Alternative form
      // Legacy support for display names (in case some places still use them)
      'External Entity': 'editor.nodeLabels.actor',
      'Process': 'editor.nodeLabels.process', 
      'Data Store': 'editor.nodeLabels.store',
      'Trust Boundary': 'editor.nodeLabels.securityBoundary',
      'Text': 'editor.nodeLabels.textbox'
    };

    const localizationKey = shapeKeyMap[rawShape];
    if (localizationKey) {
      return this.translocoService.translate(localizationKey);
    }
    
    // Fallback to raw shape name if no mapping found
    return rawShape;
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
    this.facade.onKeyDown(
      event,
      this.dfdId || 'default-diagram',
      this._isInitialized,
      this.x6GraphAdapter,
    );
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

      // Load any pending diagram cells
      if (this.pendingDiagramCells) {
        this.logger.info('Loading pending diagram cells after graph initialization', { 
          cellCount: this.pendingDiagramCells.length 
        });
        this.loadDiagramCells(this.pendingDiagramCells);
        this.pendingDiagramCells = null;
      } else {
        this.logger.info('No pending diagram cells to load');
      }

      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error initializing graph', error);
    }
  }

  /**
   * Load diagram cells into the graph with proper history suppression and port visibility management
   */
  private loadDiagramCells(cells: any[]): void {
    try {
      const graph = this.x6GraphAdapter.getGraph();
      if (!graph) {
        this.logger.error('Cannot load diagram cells: graph not initialized');
        return;
      }

      this.logger.info('Loading diagram cells into graph', { 
        cellCount: cells.length,
        dfdId: this.dfdId,
        cells: cells.map(cell => ({ id: cell.id, shape: cell.shape }))
      });

      // Use the facade service to handle batch loading with proper history management
      this.facade.loadDiagramCellsBatch(
        cells,
        graph,
        this.dfdId || 'default-diagram',
        this.nodeConfigurationService,
      );
      
      this.logger.info('Successfully loaded diagram cells into graph');
      
      // Check if cells were actually added to the graph
      const graphCells = graph.getCells();
      this.logger.info('Graph state after loading', { 
        totalCellsInGraph: graphCells.length,
        cellIds: graphCells.map(cell => cell.id)
      });
      
      this.cdr.markForCheck();
    } catch (error) {
      this.logger.error('Error loading diagram cells', error);
    }
  }

  /**
   * Convert mock diagram cell data to proper X6 format with correct styling and ports
   * Handles both nodes and edges
   */
  private convertMockCellToX6Format(mockCell: any): any {
    // Handle edges
    if (mockCell.shape === 'edge' || mockCell.edge === true) {
      return this.convertMockEdgeToX6Format(mockCell);
    }

    // Handle nodes
    return this.convertMockNodeToX6Format(mockCell);
  }

  /**
   * Convert mock node data to proper X6 format
   */
  private convertMockNodeToX6Format(mockCell: any): any {
    // Get the node type from the shape (actor, process, store, security-boundary)
    const nodeType = mockCell.shape as NodeType;

    // Get the correct X6 shape name
    const x6Shape = getX6ShapeForNodeType(nodeType);

    // Extract label from various possible import format locations
    // Note: This is for import/conversion, not live X6 cell manipulation
    const label =
      mockCell.attrs?.text?.text || mockCell.value || this.getDefaultLabelForType(nodeType);

    // Get proper port configuration for this node type
    const portConfig = this.nodeConfigurationService.getNodePorts(nodeType);

    // Handle position from either direct properties or geometry object
    const x = mockCell.x ?? mockCell.geometry?.x ?? 0;
    const y = mockCell.y ?? mockCell.geometry?.y ?? 0;
    const width = mockCell.width ?? mockCell.geometry?.width ?? 80;
    const height = mockCell.height ?? mockCell.geometry?.height ?? 80;

    // Create base configuration with default styling (no custom colors)
    const cellConfig: any = {
      id: mockCell.id,
      shape: x6Shape,
      x,
      y,
      width,
      height,
      label,
      zIndex: mockCell.zIndex || 1,
      ports: portConfig,
    };

    // Add metadata if present (convert from array format to object format)
    if (mockCell.data && Array.isArray(mockCell.data)) {
      const metadata: any = {};
      mockCell.data.forEach((item: any) => {
        if (item.key && item.value) {
          metadata[item.key] = item.value;
        }
      });
      cellConfig.data = { metadata };
    }

    return cellConfig;
  }

  /**
   * Convert mock edge data to proper X6 format
   */
  private convertMockEdgeToX6Format(mockCell: any): any {
    // Handle different source/target formats
    let source: any;
    let target: any;

    if (mockCell.source && typeof mockCell.source === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      source = mockCell.source;
    } else {
      // Legacy format: string IDs or separate properties
      source = {
        cell: mockCell.source || mockCell.sourceNodeId,
        port: mockCell.sourcePortId || 'right', // Default to right port
      };
    }

    if (mockCell.target && typeof mockCell.target === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      target = mockCell.target;
    } else {
      // Legacy format: string IDs or separate properties
      target = {
        cell: mockCell.target || mockCell.targetNodeId,
        port: mockCell.targetPortId || 'left', // Default to left port
      };
    }

    // Create edge configuration
    const edgeConfig: any = {
      id: mockCell.id,
      shape: 'edge',
      source,
      target,
      zIndex: mockCell.zIndex || 1,
      attrs: {
        line: {
          stroke: '#000000',
          strokeWidth: 2,
          targetMarker: {
            name: 'classic',
            size: 8,
          },
        },
      },
    };

    // Add custom attributes if present
    if (mockCell.attrs) {
      edgeConfig.attrs = { ...edgeConfig.attrs, ...mockCell.attrs };
    }

    // Add vertices if present
    if (mockCell.vertices && Array.isArray(mockCell.vertices)) {
      edgeConfig.vertices = mockCell.vertices;
    }

    // Add labels if present (import/conversion logic)
    // Note: This creates X6 configuration, not live cell manipulation
    if (mockCell.labels && Array.isArray(mockCell.labels)) {
      edgeConfig.labels = mockCell.labels;
    } else if (mockCell.value) {
      // Convert legacy value to label
      edgeConfig.labels = [
        {
          attrs: {
            text: {
              text: mockCell.value,
            },
          },
        },
      ];
    }

    // Add metadata if present
    if (mockCell.data && Array.isArray(mockCell.data)) {
      const metadata: any = {};
      mockCell.data.forEach((item: any) => {
        if (item.key && item.value) {
          metadata[item.key] = item.value;
        }
      });
      edgeConfig.data = { metadata };
    }

    return edgeConfig;
  }

  /**
   * Get default label for node type
   */
  private getDefaultLabelForType(nodeType: NodeType): string {
    switch (nodeType) {
      case 'actor':
        return 'External Entity';
      case 'process':
        return 'Process';
      case 'store':
        return 'Data Store';
      case 'security-boundary':
        return 'Trust Boundary';
      case 'text-box':
        return 'Text';
      default:
        return 'Element';
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
    this.facade.exportDiagram(
      format,
      this.threatModelName ?? undefined,
      this.diagramName ?? undefined,
    );
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
   * Shows the X6 history dialog with the rendered JSON of the graph history
   */
  showHistory(): void {
    const graph = this.x6GraphAdapter.getGraph();
    if (!graph) {
      this.logger.warn('Cannot show history: graph not initialized');
      return;
    }

    const dialogData: X6HistoryDialogData = {
      graph: graph,
    };

    this.dialog.open(X6HistoryDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      minWidth: '500px',
      maxHeight: '80vh',
      data: dialogData,
    });
  }

  /**
   * Opens the threat editor dialog to create a new threat
   */
  openThreatEditor(): void {
    this.facade.openThreatEditor(this.threatModelId, this.dfdId);
  }

  /**
   * Manages threats for the selected cell
   */
  manageThreats(): void {
    const selectedCells = this.x6GraphAdapter.getSelectedCells();
    if (selectedCells.length !== 1) {
      this.logger.warn('Manage threats requires exactly one selected cell');
      return;
    }

    if (!this.threatModelId) {
      this.logger.warn('Cannot manage threats: No threat model ID available');
      return;
    }

    const selectedCell = selectedCells[0];
    const cellShape = selectedCell.shape || 'unknown';
    const localizedShapeName = this.getLocalizedShapeName(cellShape);
    const cellLabel = this.x6GraphAdapter.getCellLabel(selectedCell);
    const cellId = selectedCell.id;
    
    // Format object name as: <shape>: <label> (id) or <shape>: (id) if no label
    const objectName = cellLabel 
      ? `${localizedShapeName}: ${cellLabel} (${cellId})`
      : `${localizedShapeName}: (${cellId})`;

    // Load the threat model to get threats for this cell
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId).subscribe({
      next: threatModel => {
        if (!threatModel) {
          this.logger.error('Threat model not found', { id: this.threatModelId });
          return;
        }

        // Filter threats for this specific cell and diagram
        const cellThreats = threatModel.threats?.filter(threat => 
          threat.cell_id === cellId && threat.diagram_id === this.dfdId
        ) || [];

        this.logger.info('Found threats for cell', { 
          cellId, 
          diagramId: this.dfdId, 
          threatCount: cellThreats.length 
        });

        const dialogData: ThreatsDialogData = {
          threats: cellThreats,
          isReadOnly: false, // Allow editing for now
          objectType: cellShape,
          objectName: objectName,
          threatModelId: this.threatModelId || undefined,
          diagramId: this.dfdId || undefined
        };

        const dialogRef = this.dialog.open(ThreatsDialogComponent, {
          data: dialogData,
          width: '800px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          disableClose: false
        });

        this._subscriptions.add(
          dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'openThreatEditor') {
              this.logger.info('Opening threat editor from manage threats dialog');
              // Open the threat editor for this specific cell
              this.facade.openThreatEditor(this.threatModelId, this.dfdId);
            } else if (result?.action === 'threatUpdated') {
              this.logger.info('Threat was updated from manage threats dialog', { 
                threatId: result.threat?.id 
              });
              // Handle threat update - the threat editor already saved the changes
              // We could reload the threat model or trigger other updates if needed
            } else if (result) {
              this.logger.info('Manage threats dialog closed with changes');
              // Handle any other updates to threats if needed
            }
          })
        );
      },
      error: error => {
        this.logger.error('Failed to load threat model for manage threats', error);
      }
    }));
  }

  /**
   * Manage metadata for the selected cell
   */
  manageMetadata(): void {
    if (!this.hasExactlyOneSelectedCell) {
      this.logger.warn('Cannot manage metadata: no single cell selected');
      return;
    }

    // Get the selected cell from the graph adapter
    const selectedCells = this.x6GraphAdapter.getSelectedCells();
    if (selectedCells.length !== 1) {
      return;
    }

    const cell = selectedCells[0];
    const cellData = cell.getData() || {};

    // Convert metadata from object format to array format for the dialog
    const metadataArray: Metadata[] = [];
    if (cellData.metadata && typeof cellData.metadata === 'object') {
      Object.entries(cellData.metadata).forEach(([key, value]) => {
        metadataArray.push({ key, value: String(value) });
      });
    }

    // Get cell information for friendly object naming (same as manage threats)
    const cellShape = cell.shape || 'unknown';
    const localizedShapeName = this.getLocalizedShapeName(cellShape);
    const cellLabel = this.x6GraphAdapter.getCellLabel(cell);
    const cellId = cell.id;
    
    // Format object name as: <shape>: <label> (id) or <shape>: (id) if no label
    const objectName = cellLabel 
      ? `${localizedShapeName}: ${cellLabel} (${cellId})`
      : `${localizedShapeName}: (${cellId})`;

    const dialogData: MetadataDialogData = {
      metadata: metadataArray,
      isReadOnly: false,
      objectType: cellShape,
      objectName: objectName,
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
          // Convert metadata from array format back to object format for storage
          const metadataObject: { [key: string]: string } = {};
          result.forEach(item => {
            if (item.key && item.key.trim()) {
              metadataObject[item.key] = item.value || '';
            }
          });

          // Update the cell metadata
          const updatedData = { ...cellData, metadata: metadataObject };
          cell.setData(updatedData);

          this.logger.info('Updated cell metadata', { cellId: cell.id, metadata: metadataObject });
        }
      }),
    );
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(): void {
    // Save diagram changes before closing if we have the necessary IDs
    if (this.threatModelId && this.dfdId && this._isInitialized) {
      const graph = this.x6GraphAdapter.getGraph();
      if (graph) {
        this.logger.info('Saving diagram changes before closing', {
          threatModelId: this.threatModelId,
          dfdId: this.dfdId,
        });

        this._subscriptions.add(
          this.facade.saveDiagramChanges(graph, this.dfdId, this.threatModelId).subscribe({
            next: success => {
              if (success) {
                this.logger.info('Diagram changes saved successfully');
              } else {
                this.logger.warn('Failed to save diagram changes');
              }
              // Navigate away regardless of save success/failure
              this.facade.closeDiagram(this.threatModelId, this.dfdId);
            },
            error: error => {
              this.logger.error('Error saving diagram changes', error);
              // Navigate away even if save failed
              this.facade.closeDiagram(this.threatModelId, this.dfdId);
            },
          }),
        );
        return;
      }
    }

    // If we don't have the necessary data or graph is not initialized, just close
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
   * Auto-save diagram when changes occur
   */
  private autoSaveDiagram(reason: string): void {
    if (this._isInitialized && this.dfdId && this.threatModelId) {
      const graph = this.x6GraphAdapter.getGraph();
      if (graph) {
        this.facade.saveDiagramChanges(graph, this.dfdId, this.threatModelId).subscribe({
          next: (success) => {
            if (success) {
              this.logger.info(`Auto-saved diagram: ${reason}`);
            } else {
              this.logger.warn(`Auto-save failed: ${reason}`);
            }
          },
          error: (error) => {
            this.logger.error(`Error during auto-save (${reason})`, error);
          }
        });
      }
    }
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
