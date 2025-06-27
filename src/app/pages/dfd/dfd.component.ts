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
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuTrigger } from '@angular/material/menu';
import { TranslocoModule } from '@jsverse/transloco';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { Node, Cell, Edge } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { NodeType } from './domain/value-objects/node-data';
import { DfdApplicationService } from './application/services/dfd-application.service';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { PerformanceTestingService } from './infrastructure/services/performance-testing.service';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';
import { ThreatModelService } from '../../pages/tm/services/threat-model.service';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../pages/tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { v4 as uuidv4 } from 'uuid';
import { CommandBusService } from './application/services/command-bus.service';
import { DiagramCommandFactory } from './domain/commands/diagram-commands';
import { NodeData } from './domain/value-objects/node-data';
import { EdgeData } from './domain/value-objects/edge-data';
import { Point } from './domain/value-objects/point';
import { DiagramNode } from './domain/value-objects/diagram-node';

// Import providers needed for standalone component
import { CommandBusInitializerService } from './application/services/command-bus-initializer.service';
import {
  CommandValidationMiddleware,
  CommandLoggingMiddleware,
  CommandSerializationMiddleware,
} from './application/services/command-bus.service';
import {
  DIAGRAM_REPOSITORY_TOKEN,
  CreateDiagramCommandHandler,
  AddNodeCommandHandler,
  UpdateNodePositionCommandHandler,
  UpdateNodeDataCommandHandler,
  RemoveNodeCommandHandler,
  AddEdgeCommandHandler,
  UpdateEdgeDataCommandHandler,
  RemoveEdgeCommandHandler,
  UpdateDiagramMetadataCommandHandler,
} from './application/handlers/diagram-command-handlers';
import { InMemoryDiagramRepository } from './infrastructure/repositories/in-memory-diagram.repository';

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
    // Command Bus and middleware
    CommandBusService,
    CommandValidationMiddleware,
    CommandLoggingMiddleware,
    CommandSerializationMiddleware,

    // Repository implementation
    {
      provide: DIAGRAM_REPOSITORY_TOKEN,
      useClass: InMemoryDiagramRepository,
    },

    // Command Handlers
    CreateDiagramCommandHandler,
    AddNodeCommandHandler,
    UpdateNodePositionCommandHandler,
    UpdateNodeDataCommandHandler,
    RemoveNodeCommandHandler,
    AddEdgeCommandHandler,
    UpdateEdgeDataCommandHandler,
    RemoveEdgeCommandHandler,
    UpdateDiagramMetadataCommandHandler,

    // CommandBus initializer
    CommandBusInitializerService,

    // Infrastructure adapters
    X6GraphAdapter,

    // Application services
    DfdApplicationService,

    // Performance testing
    PerformanceTestingService,
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
  private _rightClickedCell: Cell | null = null;
  private _selectedCells$ = new BehaviorSubject<Cell[]>([]);
  private _isInitialized = false;

  // Context menu position
  contextMenuPosition = { x: '0px', y: '0px' };

  // Route parameters
  threatModelId: string | null = null;
  dfdId: string | null = null;

  // Diagram data
  diagramName: string | null = null;

  // State properties - exposed as public properties for template binding
  canUndo = false;
  canRedo = false;
  hasSelectedCells = false;

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private dfdApplicationService: DfdApplicationService,
    private x6GraphAdapter: X6GraphAdapter,
    private commandBus: CommandBusService,
    private performanceTestingService: PerformanceTestingService,
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private commandBusInitializer: CommandBusInitializerService,
  ) {
    this.logger.info('DfdComponent constructor called');

    // Ensure command bus is initialized
    if (!this.commandBusInitializer.isInitialized) {
      this.logger.warn('CommandBus not initialized, forcing initialization');
      this.commandBusInitializer.initialize();
    }

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

    // Subscribe to selection state changes
    this._subscriptions.add(
      this._selectedCells$.subscribe(selectedCells => {
        this.hasSelectedCells = selectedCells.length > 0;
        this.cdr.markForCheck();
      }),
    );

    // Subscribe to graph adapter events
    this._subscriptions.add(
      this.x6GraphAdapter.selectionChanged$.subscribe(() => {
        // Get selected cells directly from the adapter
        const selectedCells = this.x6GraphAdapter.getSelectedCells();
        this._selectedCells$.next(selectedCells);
      }),
    );

    // Subscribe to edge creation events
    this._subscriptions.add(
      this.x6GraphAdapter.edgeAdded$.subscribe(edge => {
        this.handleEdgeAdded(edge);
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
        if (this.threatModelId) {
          void this.router.navigate(['/tm', this.threatModelId]);
        } else {
          void this.router.navigate(['/tm']);
        }
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
    // Debounce resize events to avoid excessive updates
    if (this._resizeTimeout) {
      window.clearTimeout(this._resizeTimeout);
    }

    this._resizeTimeout = window.setTimeout(() => {
      const graph = this.x6GraphAdapter.getGraph();
      if (graph) {
        const container = this.graphContainer.nativeElement as HTMLElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.logger.info('Resizing graph due to window resize', { width, height });

        // Force the graph to resize with explicit dimensions
        graph.resize(width, height);

        // Update the graph's container size
        graph.container.style.width = `${width}px`;
        graph.container.style.height = `${height}px`;

        this._resizeTimeout = null;
      }
    }, 100); // 100ms debounce
  }

  /**
   * Handle keyboard events for delete functionality
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Only handle delete key if the graph container has focus or if no input elements are focused
    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true');

    if (!isInputFocused && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      this.deleteSelected();
    }
  }

  /**
   * Method to add a node at a random position
   */
  addRandomNode(shapeType: NodeType = 'actor'): void {
    if (!this._isInitialized) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return;
    }

    const container = this.graphContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Calculate a random position with some padding
    const padding = 100;
    const x = Math.floor(Math.random() * (width - 2 * padding)) + padding;
    const y = Math.floor(Math.random() * (height - 2 * padding)) + padding;

    this.createNode(shapeType, { x, y });
  }

  /**
   * Create a node with the specified type and position
   */
  private createNode(shapeType: NodeType, position: { x: number; y: number }): void {
    const diagramId = this.dfdId || 'default-diagram';
    const userId = 'current-user'; // TODO: Get from auth service
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const nodeData = new NodeData(
      nodeId,
      shapeType,
      this.getDefaultLabelForType(shapeType),
      new Point(position.x, position.y),
      120, // default width
      80, // default height
      {}, // empty metadata
    );

    const command = DiagramCommandFactory.addNode(
      diagramId,
      userId,
      nodeId,
      new Point(position.x, position.y),
      nodeData,
    );

    this.commandBus
      .execute<void>(command)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.logger.info('Node created successfully', { nodeId, shapeType });
          // Add the node to the visual graph
          const diagramNode = new DiagramNode(nodeData);
          this.x6GraphAdapter.addNode(diagramNode);
          this.cdr.detectChanges();
        },
        error: error => {
          this.logger.error('Error creating node', error);
        },
      });
  }

  /**
   * Get default label for a shape type
   */
  private getDefaultLabelForType(shapeType: NodeType): string {
    switch (shapeType) {
      case 'actor':
        return 'Actor';
      case 'process':
        return 'Process';
      case 'store':
        return 'Data Store';
      case 'security-boundary':
        return 'Security Boundary';
      case 'textbox':
        return 'Text';
      default:
        return 'Element';
    }
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
   * Undo the last action
   */
  undo(): void {
    this.logger.info('Undo operation requested - not yet implemented');
    // TODO: Implement undo functionality
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    this.logger.info('Redo operation requested - not yet implemented');
    // TODO: Implement redo functionality
  }

  /**
   * Export the diagram to the specified format
   */
  exportDiagram(format: ExportFormat): void {
    const graph = this.x6GraphAdapter.getGraph();
    if (!graph) {
      this.logger.warn('Cannot export - graph not initialized');
      return;
    }

    this.logger.info('Exporting diagram', { format });

    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dfd-diagram-${timestamp}.${format}`;

      // Default callback for handling exported data
      const handleExport = (blob: Blob, name: string): void => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      // Cast graph to access export methods added by the plugin
      const exportGraph = graph as {
        toSVG: (callback: (svgString: string) => void) => void;
        toPNG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
        toJPEG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
      };

      if (format === 'svg') {
        exportGraph.toSVG((svgString: string) => {
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          handleExport(blob, filename);
          this.logger.info('SVG export completed', { filename });
        });
      } else {
        const exportOptions = {
          backgroundColor: 'white',
          padding: 20,
          quality: format === 'jpeg' ? 0.8 : 1,
        };

        if (format === 'png') {
          exportGraph.toPNG((dataUri: string) => {
            const blob = this.dataUriToBlob(dataUri, 'image/png');
            handleExport(blob, filename);
            this.logger.info('PNG export completed', { filename });
          }, exportOptions);
        } else {
          exportGraph.toJPEG((dataUri: string) => {
            const blob = this.dataUriToBlob(dataUri, 'image/jpeg');
            handleExport(blob, filename);
            this.logger.info('JPEG export completed', { filename });
          }, exportOptions);
        }
      }
    } catch (error) {
      this.logger.error('Error exporting diagram', error);
    }
  }

  /**
   * Convert data URI to Blob
   */
  private dataUriToBlob(dataUri: string, mimeType: string): Blob {
    const byteString = atob(dataUri.split(',')[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(): void {
    if (!this._isInitialized) {
      this.logger.warn('Cannot delete: Graph is not initialized');
      return;
    }

    const selectedCells = this._selectedCells$.value;
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for deletion');
      return;
    }

    this.logger.info('Deleting selected cells', {
      count: selectedCells.length,
      cellIds: selectedCells.map(cell => cell.id),
    });

    const diagramId = this.dfdId || 'default-diagram';
    const userId = 'current-user'; // TODO: Get from auth service

    // Separate nodes and edges for different command handling
    const selectedNodes = selectedCells.filter(cell => cell.isNode());
    const selectedEdges = selectedCells.filter(cell => cell.isEdge());

    // Delete nodes first (this will also remove connected edges automatically)
    selectedNodes.forEach(node => {
      const command = DiagramCommandFactory.removeNode(diagramId, userId, node.id);

      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Node deleted successfully', { nodeId: node.id });
            // Remove from visual graph
            this.x6GraphAdapter.removeNode(node.id);
          },
          error: error => {
            this.logger.error('Error deleting node', error);
          },
        });
    });

    // Delete standalone edges (edges not connected to deleted nodes)
    selectedEdges.forEach(edge => {
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();

      // Check if this edge is connected to any of the nodes being deleted
      const isConnectedToDeletedNode = selectedNodes.some(
        node => node.id === sourceNodeId || node.id === targetNodeId,
      );

      // Only delete the edge if it's not connected to a node being deleted
      // (since deleting the node will automatically delete connected edges)
      if (!isConnectedToDeletedNode) {
        const command = DiagramCommandFactory.removeEdge(diagramId, userId, edge.id);

        this.commandBus
          .execute<void>(command)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.logger.info('Edge deleted successfully', { edgeId: edge.id });
              // Remove from visual graph
              this.x6GraphAdapter.removeEdge(edge.id);
            },
            error: error => {
              this.logger.error('Error deleting edge', error);
            },
          });
      }
    });

    // Clear selection after deletion
    const graph = this.x6GraphAdapter.getGraph();
    if (graph && typeof graph.cleanSelection === 'function') {
      graph.cleanSelection();
    }

    this.cdr.markForCheck();
  }

  /**
   * Opens the context menu for a cell at the specified position
   */
  openCellContextMenu(cell: Cell, event: MouseEvent): void {
    // Prevent the default context menu
    event.preventDefault();

    // Store the right-clicked cell
    this._rightClickedCell = cell;

    // Set the position of the context menu
    this.contextMenuPosition = {
      x: `${event.clientX}px`,
      y: `${event.clientY}px`,
    };

    // Force change detection to update the position
    this.cdr.detectChanges();

    // Open the context menu
    this.contextMenuTrigger.openMenu();

    this.logger.info('Opened context menu for cell', { cellId: cell.id });
  }

  /**
   * Copies the JSON representation of the right-clicked cell to the clipboard
   */
  copyCellJson(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for copying JSON');
      return;
    }

    try {
      // Get the cell data
      const cellData = this._rightClickedCell.toJSON();

      // Convert to JSON string with pretty formatting
      const jsonString = JSON.stringify(cellData, null, 2);

      // Copy to clipboard
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          this.logger.info('Cell JSON copied to clipboard', { cellId: this._rightClickedCell?.id });
        })
        .catch(error => {
          this.logger.error('Failed to copy cell JSON to clipboard', error);
        });
    } catch (error) {
      this.logger.error('Error serializing cell to JSON', error);
    }
  }

  /**
   * Opens the threat editor dialog to create a new threat
   */
  openThreatEditor(): void {
    if (!this.threatModelId) {
      this.logger.warn('Cannot add threat: No threat model ID available');
      return;
    }

    // Get the threat model to add the threat to
    this.threatModelService
      .getThreatModelById(this.threatModelId)
      .pipe(take(1))
      .subscribe(threatModel => {
        if (!threatModel) {
          this.logger.error('Threat model not found', { id: this.threatModelId });
          return;
        }

        const dialogData: ThreatEditorDialogData = {
          threatModelId: this.threatModelId as string,
          mode: 'create',
          diagramId: this.dfdId || '',
          cellId: this._selectedCells$.value.find(cell => cell.isNode())?.id || '',
        };

        const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
          width: '900px',
          maxHeight: '90vh',
          data: dialogData,
        });

        this._subscriptions.add(
          dialogRef.afterClosed().subscribe(result => {
            if (result && threatModel) {
              const now = new Date().toISOString();

              interface ThreatFormResult {
                name: string;
                description: string;
                severity?: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
                threat_type?: string;
                diagram_id?: string;
                cell_id?: string;
                score?: number;
                priority?: string;
                issue_url?: string;
                metadata?: Array<{ key: string; value: string }>;
              }
              const formResult = result as ThreatFormResult;

              // Create a new threat
              const newThreat = {
                id: uuidv4(),
                threat_model_id: threatModel.id,
                name: formResult.name,
                description: formResult.description,
                created_at: now,
                modified_at: now,
                severity: formResult.severity || 'High',
                threat_type: formResult.threat_type || 'Information Disclosure',
                diagram_id: formResult.diagram_id || this.dfdId || '',
                cell_id:
                  formResult.cell_id ||
                  this._selectedCells$.value.find(cell => cell.isNode())?.id ||
                  '',
                score: formResult.score || 10.0,
                priority: formResult.priority || 'High',
                issue_url: formResult.issue_url || 'n/a',
                metadata: formResult.metadata || [],
              };

              // Add the threat to the threat model
              if (!threatModel.threats) {
                threatModel.threats = [];
              }
              threatModel.threats.push(newThreat);

              // Update the threat model
              this._subscriptions.add(
                this.threatModelService.updateThreatModel(threatModel).subscribe(updatedModel => {
                  if (updatedModel) {
                    this.logger.info('Threat added successfully', { threatId: newThreat.id });
                  }
                }),
              );
            }
          }),
        );
      });
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(): void {
    this.logger.info('Closing diagram', { diagramId: this.dfdId });

    if (this.threatModelId) {
      // Navigate back to the threat model editor page
      void this.router.navigate(['/tm', this.threatModelId]);
    } else {
      // Fallback to the threat models list if no threat model ID is available
      void this.router.navigate(['/tm']);
    }
  }

  /**
   * Handle edge added events from the graph adapter
   */
  private handleEdgeAdded(edge: Edge): void {
    if (!this._isInitialized) {
      this.logger.warn('Cannot handle edge added: Graph is not initialized');
      return;
    }

    // Check if this edge was created by user interaction (drag-connect)
    // We can identify this by checking if the edge has source and target nodes
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Edge added without valid source or target nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
      });
      // Remove the invalid edge from the graph
      this.x6GraphAdapter.removeEdge(edge.id);
      return;
    }

    // Verify that the source and target nodes actually exist in the graph
    const sourceNode = this.x6GraphAdapter.getNode(sourceNodeId);
    const targetNode = this.x6GraphAdapter.getNode(targetNodeId);

    if (!sourceNode || !targetNode) {
      this.logger.warn('Edge references non-existent nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
        sourceNodeExists: !!sourceNode,
        targetNodeExists: !!targetNode,
      });
      // Remove the invalid edge from the graph
      this.x6GraphAdapter.removeEdge(edge.id);
      return;
    }

    // Check if this edge already exists in the domain (to avoid duplicate processing)
    const existingEdge = this.x6GraphAdapter.getEdge(edge.id);
    if (existingEdge) {
      const existingEdgeData: unknown = existingEdge.getData();
      if (
        existingEdgeData &&
        typeof existingEdgeData === 'object' &&
        existingEdgeData !== null &&
        'domainEdgeId' in existingEdgeData
      ) {
        this.logger.debug('Edge already has domain representation, skipping', { edgeId: edge.id });
        return;
      }
    }

    this.logger.info('Processing user-created edge', {
      edgeId: edge.id,
      sourceNodeId,
      targetNodeId,
    });

    // Extract port information if available
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    // Create domain edge data
    const domainEdgeData =
      sourcePortId && targetPortId
        ? EdgeData.createWithPorts(
            edge.id,
            sourceNodeId,
            targetNodeId,
            sourcePortId,
            targetPortId,
            'Data Flow', // Default label
          )
        : EdgeData.createSimple(
            edge.id,
            sourceNodeId,
            targetNodeId,
            'Data Flow', // Default label
          );

    // Create and execute AddEdgeCommand
    const diagramId = this.dfdId || 'default-diagram';
    const userId = 'current-user'; // TODO: Get from auth service

    const command = DiagramCommandFactory.addEdge(
      diagramId,
      userId,
      edge.id,
      sourceNodeId,
      targetNodeId,
      domainEdgeData,
    );

    this.commandBus
      .execute<void>(command)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.logger.info('Edge created successfully in domain model', {
            edgeId: edge.id,
            sourceNodeId,
            targetNodeId,
          });

          // Update the edge's data to mark it as having a domain representation
          edge.setData({
            ...edge.getData(),
            domainEdgeId: edge.id,
          });

          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error creating edge in domain model', error);
          // Remove the visual edge if domain creation failed
          this.x6GraphAdapter.removeEdge(edge.id);
        },
      });
  }

  /**
   * Run performance tests
   */
  runPerformanceTests(): void {
    this.logger.info('Starting performance tests');
    this.performanceTestingService.runPerformanceTestSuite().subscribe({
      next: results => {
        this.logger.info('Performance tests completed', { results });
      },
      error: error => {
        this.logger.error('Performance tests failed', error);
      },
    });
  }
}
