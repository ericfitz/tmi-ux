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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { Node, Cell, Edge } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { NodeType } from './domain/value-objects/node-data';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';
import { ThreatModelService } from '../../pages/tm/services/threat-model.service';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../pages/tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { v4 as uuidv4 } from 'uuid';
import { CommandBusService } from './application/services/command-bus.service';
import { HistoryService } from './application/services/history.service';
import { DiagramCommandFactory } from './domain/commands/diagram-commands';
import { NodeData } from './domain/value-objects/node-data';
import { EdgeData } from './domain/value-objects/edge-data';
import { Point } from './domain/value-objects/point';
import { DiagramNode } from './domain/value-objects/diagram-node';
import { DiagramEdge } from './domain/value-objects/diagram-edge';

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
  CompositeCommandHandler,
} from './application/handlers/diagram-command-handlers';
import { InMemoryDiagramRepository } from './infrastructure/repositories/in-memory-diagram.repository';
import { InverseCommandFactory } from './domain/commands/inverse-command-factory';
import { OperationStateTracker } from './infrastructure/services/operation-state-tracker.service';
import { HistoryMiddleware } from './application/middleware/history.middleware';
import { HistoryIntegrationService } from './application/services/history-integration.service';
import { OperationType } from './domain/history/history.types';

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
    HistoryMiddleware,

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
    CompositeCommandHandler,

    // CommandBus initializer
    CommandBusInitializerService,

    // Infrastructure adapters
    X6GraphAdapter,

    // History services
    {
      provide: 'ICommandBus',
      useExisting: CommandBusService,
    },
    HistoryService,
    InverseCommandFactory,
    OperationStateTracker,
    HistoryIntegrationService,
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
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private x6GraphAdapter: X6GraphAdapter,
    private commandBus: CommandBusService,
    private historyService: HistoryService,
    private historyIntegrationService: HistoryIntegrationService,
    private operationStateTracker: OperationStateTracker,
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private commandBusInitializer: CommandBusInitializerService,
    private transloco: TranslocoService,
  ) {
    this.logger.info('DfdComponent constructor called');

    // Initialize command bus immediately in constructor
    this.logger.info('Initializing command bus in constructor');
    this.commandBusInitializer.initialize();

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

    // Subscribe to history service observables
    this._subscriptions.add(
      this.historyService.canUndo$.subscribe(canUndo => {
        this.canUndo = canUndo;
        this.cdr.markForCheck();
      }),
    );

    this._subscriptions.add(
      this.historyService.canRedo$.subscribe(canRedo => {
        this.canRedo = canRedo;
        this.cdr.markForCheck();
      }),
    );

    // Subscribe to selection state changes
    this._subscriptions.add(
      this._selectedCells$.subscribe(selectedCells => {
        this.hasSelectedCells = selectedCells.length > 0;
        this.hasExactlyOneSelectedCell = selectedCells.length === 1;
        this.selectedCellIsTextBox = selectedCells.some(
          cell => (cell.data as { type?: string })?.type === 'textbox',
        );
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

    // Subscribe to edge vertices changes
    this._subscriptions.add(
      this.x6GraphAdapter.edgeVerticesChanged$.subscribe(({ edgeId, vertices }) => {
        this.handleEdgeVerticesChanged(edgeId, vertices);
      }),
    );

    // Subscribe to context menu events
    this._subscriptions.add(
      this.x6GraphAdapter.cellContextMenu$.subscribe(({ cell, x, y }) => {
        this.openCellContextMenu(cell, x, y);
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
   * Handle keyboard events for delete functionality and undo/redo
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Only handle keys if the graph container has focus or if no input elements are focused
    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true');

    if (!isInputFocused) {
      // Handle delete/backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.deleteSelected();
        return;
      }

      // Handle undo/redo shortcuts
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          // Ctrl+Z or Cmd+Z for undo
          event.preventDefault();
          this.undo();
          return;
        }

        if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
          // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
          event.preventDefault();
          this.redo();
          return;
        }
      }
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
    const nodeId = uuidv4(); // Generate UUID type 4 for UX-created nodes

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
      true, // isLocalUserInitiated
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
        return this.transloco.translate('editor.nodeLabels.actor');
      case 'process':
        return this.transloco.translate('editor.nodeLabels.process');
      case 'store':
        return this.transloco.translate('editor.nodeLabels.store');
      case 'security-boundary':
        return this.transloco.translate('editor.nodeLabels.securityBoundary');
      case 'textbox':
        return this.transloco.translate('editor.nodeLabels.textbox');
      default:
        return this.transloco.translate('editor.nodeLabels.node');
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

      // Initialize history integration service
      this.initializeHistoryIntegration();

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
   * Initialize the history integration service
   */
  private initializeHistoryIntegration(): void {
    const diagramId = this.dfdId || 'default-diagram';
    const userId = 'current-user'; // TODO: Get from auth service

    this.logger.info('Initializing history integration', { diagramId, userId });

    try {
      this.historyIntegrationService.initialize(diagramId, userId);
      this.logger.info('History integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize history integration', error);
    }
  }

  /**
   * Undo the last action
   */
  undo(): void {
    if (!this.canUndo) {
      this.logger.debug('Undo requested but no operations available to undo');
      return;
    }

    this.logger.info('Executing undo operation');

    this.historyService
      .undo()
      .then(success => {
        if (success) {
          this.logger.info('Undo operation completed successfully');
          this.cdr.markForCheck();
        } else {
          this.logger.warn('Undo operation failed');
        }
      })
      .catch(error => {
        this.logger.error('Undo operation failed with error', error);
      });
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    if (!this.canRedo) {
      this.logger.debug('Redo requested but no operations available to redo');
      return;
    }

    this.logger.info('Executing redo operation');

    this.historyService
      .redo()
      .then(success => {
        if (success) {
          this.logger.info('Redo operation completed successfully');
          this.cdr.markForCheck();
        } else {
          this.logger.warn('Redo operation failed');
        }
      })
      .catch(error => {
        this.logger.error('Redo operation failed with error', error);
      });
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
      // DIAGNOSTIC: Check for connected edges before deletion
      // Note: We'll capture this information from the domain model after deletion
      this.logger.info('DIAGNOSTIC: Node deletion will cascade to connected edges', {
        nodeId: node.id,
        note: 'Connected edges will be automatically deleted by domain logic',
      });

      // CRITICAL FIX: Start operation tracking for delete operations
      const operationId = `delete_node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.operationStateTracker.startOperation(operationId, OperationType.DELETE, {
        entityId: node.id,
        entityType: 'node',
        metadata: {
          operationType: 'DELETE_NODE',
          source: 'keyboard_shortcut',
          note: 'Will cascade delete connected edges',
        },
      });

      this.logger.info('DIAGNOSTIC: Started operation tracking for delete (keyboard)', {
        operationId,
        nodeId: node.id,
        note: 'Connected edges will be automatically deleted by domain logic',
      });

      const command = DiagramCommandFactory.removeNode(diagramId, userId, node.id, true); // isLocalUserInitiated

      // Attach operation ID to command for history middleware
      const commandWithOperationId = command as unknown as Record<string, unknown>;
      commandWithOperationId['operationId'] = operationId;

      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Node deleted successfully', { nodeId: node.id, operationId });

            // CRITICAL FIX: Complete operation tracking
            this.operationStateTracker.completeOperation(operationId);
            this.logger.info('DIAGNOSTIC: Completed operation tracking for delete (keyboard)', {
              operationId,
              nodeId: node.id,
            });

            // Remove from visual graph
            this.x6GraphAdapter.removeNode(node.id);
          },
          error: error => {
            this.logger.error('Error deleting node', error);

            // Cancel operation tracking on error
            this.operationStateTracker.cancelOperation(operationId);
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
        // CRITICAL FIX: Start operation tracking for edge delete operations
        const operationId = `delete_edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.operationStateTracker.startOperation(operationId, OperationType.DELETE, {
          entityId: edge.id,
          entityType: 'edge',
          metadata: { operationType: 'DELETE_EDGE', source: 'keyboard_shortcut' },
        });

        this.logger.info('DIAGNOSTIC: Started operation tracking for edge delete (keyboard)', {
          operationId,
          edgeId: edge.id,
        });

        const command = DiagramCommandFactory.removeEdge(diagramId, userId, edge.id, true); // isLocalUserInitiated

        // Attach operation ID to command for history middleware
        const commandWithOperationId = command as unknown as Record<string, unknown>;
        commandWithOperationId['operationId'] = operationId;

        this.commandBus
          .execute<void>(command)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.logger.info('Edge deleted successfully', { edgeId: edge.id, operationId });

              // CRITICAL FIX: Complete operation tracking
              this.operationStateTracker.completeOperation(operationId);
              this.logger.info(
                'DIAGNOSTIC: Completed operation tracking for edge delete (keyboard)',
                {
                  operationId,
                  edgeId: edge.id,
                },
              );

              // Remove from visual graph
              this.x6GraphAdapter.removeEdge(edge.id);
            },
            error: error => {
              this.logger.error('Error deleting edge', error);

              // Cancel operation tracking on error
              this.operationStateTracker.cancelOperation(operationId);
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
  openCellContextMenu(cell: Cell, x: number, y: number): void {
    // Store the right-clicked cell
    this._rightClickedCell = cell;

    // Set the position of the context menu
    this.contextMenuPosition = {
      x: `${x}px`,
      y: `${y}px`,
    };

    // Force change detection to update the position
    this.cdr.detectChanges();

    // Open the context menu
    this.contextMenuTrigger.openMenu();

    this.logger.info('Opened context menu for cell', { cellId: cell.id });
  }

  /**
   * Copies the complete definition of the right-clicked cell to the clipboard
   */
  copyCellDefinition(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for copying definition');
      return;
    }

    try {
      // Get the complete cell state including all properties
      const cellDefinition = this._rightClickedCell.toJSON();

      // Convert to formatted JSON string
      const jsonString = JSON.stringify(cellDefinition, null, 2);

      // Copy to clipboard
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          this.logger.info('Cell definition copied to clipboard', {
            cellId: this._rightClickedCell?.id,
          });
        })
        .catch(error => {
          this.logger.error('Failed to copy cell definition to clipboard', error);
          // Fallback for older browsers
          this._fallbackCopyToClipboard(jsonString);
        });
    } catch (error) {
      this.logger.error('Error serializing cell definition', error);
    }
  }

  /**
   * Fallback method to copy text to clipboard for older browsers
   */
  private _fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      // Use the Clipboard API if available as a fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText(text).then(
          () => {
            this.logger.info('Text copied to clipboard (Clipboard API fallback)');
          },
          (err: unknown) => {
            this.logger.error('Clipboard API fallback failed', err);
          },
        );
      } else {
        // Last resort: show the text in an alert so user can manually copy
        this.logger.warn('No clipboard API available, showing text for manual copy');
        alert('Please manually copy this text:\n\n' + text);
      }
    } catch (error) {
      this.logger.error('Fallback copy to clipboard failed', error);
    }

    document.body.removeChild(textArea);
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
          cellId: this._selectedCells$.value[0]?.id || '',
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
                cell_id: formResult.cell_id || this._selectedCells$.value[0]?.id || '',
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
      true, // isLocalUserInitiated
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
   * Handle edge vertices changes from the graph adapter
   */
  private handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
  ): void {
    if (!this._isInitialized) {
      this.logger.warn('Cannot handle edge vertices changed: Graph is not initialized');
      return;
    }

    this.logger.info('Edge vertices changed', {
      edgeId,
      vertexCount: vertices.length,
      vertices,
    });

    // Convert vertices to domain Points
    const domainVertices = vertices.map(v => new Point(v.x, v.y));

    // Create and execute UpdateEdgeDataCommand to update the domain model
    const diagramId = this.dfdId || 'default-diagram';
    const userId = 'current-user'; // TODO: Get from auth service

    // Get the current edge from the graph to extract other data
    const edge = this.x6GraphAdapter.getEdge(edgeId);
    if (!edge) {
      this.logger.warn('Edge not found for vertices update', { edgeId });
      return;
    }

    // Create updated edge data with new vertices
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Edge missing source or target for vertices update', {
        edgeId,
        sourceNodeId,
        targetNodeId,
      });
      return;
    }

    // Get the current edge data to preserve existing information
    const currentEdgeData: unknown = edge.getData();
    const currentLabel =
      currentEdgeData &&
      typeof currentEdgeData === 'object' &&
      'label' in currentEdgeData &&
      typeof currentEdgeData.label === 'string'
        ? currentEdgeData.label
        : 'Data Flow';

    // Create a new EdgeData instance with updated vertices
    const updatedEdgeData = new EdgeData(
      edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      currentLabel,
      domainVertices,
      {}, // metadata - could be preserved from current data if needed
    );

    // We need the old data for the command, so let's create it from current state
    const oldVerticesData =
      currentEdgeData &&
      typeof currentEdgeData === 'object' &&
      'vertices' in currentEdgeData &&
      Array.isArray(currentEdgeData.vertices)
        ? (currentEdgeData.vertices as Array<{ x: number; y: number }>)
        : [];
    const oldDomainVertices = oldVerticesData.map(v => new Point(v.x, v.y));

    const oldEdgeData = new EdgeData(
      edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      currentLabel || 'Data Flow',
      oldDomainVertices,
      {}, // metadata
    );

    // Create and execute UpdateEdgeDataCommand
    const command = DiagramCommandFactory.updateEdgeData(
      diagramId,
      userId,
      edgeId,
      updatedEdgeData,
      oldEdgeData,
      true, // isLocalUserInitiated
    );

    this.commandBus
      .execute<void>(command)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.logger.info('Edge vertices updated successfully in domain model', {
            edgeId,
            vertexCount: domainVertices.length,
          });
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error updating edge vertices in domain model', error);
        },
      });
  }

  /**
   * Move selected cells forward in z-order
   */
  moveForward(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move forward operation');
      return;
    }

    this.logger.info('Moving cell forward', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsForward();
  }

  /**
   * Move selected cells backward in z-order
   */
  moveBackward(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move backward operation');
      return;
    }

    this.logger.info('Moving cell backward', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsBackward();
  }

  /**
   * Move selected cells to front
   */
  moveToFront(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move to front operation');
      return;
    }

    this.logger.info('Moving cell to front', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsToFront();
  }

  /**
   * Move selected cells to back
   */
  moveToBack(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move to back operation');
      return;
    }

    this.logger.info('Moving cell to back', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsToBack();
  }

  /**
   * Check if the right-clicked cell is an edge
   */
  isRightClickedCellEdge(): boolean {
    return this._rightClickedCell?.isEdge() ?? false;
  }

  /**
   * Edit the text/label of the right-clicked cell by invoking the label editor
   */
  editCellText(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for text editing');
      return;
    }

    this.logger.info('Invoking label editor for cell', { cellId: this._rightClickedCell.id });

    // Use the X6 graph adapter's label editing functionality
    // We need to simulate a double-click event to trigger the existing label editor
    const mockEvent = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
    });

    // Access the private method through the adapter to add the label editor
    // Since _addLabelEditor is private, we'll call it through a public method we'll add
    this.x6GraphAdapter.startLabelEditing(this._rightClickedCell, mockEvent);
  }

  /**
   * Add an inverse connection for the right-clicked edge
   */
  addInverseConnection(): void {
    if (!this._rightClickedCell || !this._rightClickedCell.isEdge()) {
      this.logger.warn('No edge selected for inverse connection');
      return;
    }

    const edge = this._rightClickedCell;
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Cannot create inverse connection: edge missing source or target', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
      });
      return;
    }

    this.logger.info('Creating inverse connection for edge', {
      originalEdgeId: edge.id,
      originalSource: sourceNodeId,
      originalTarget: targetNodeId,
      originalSourcePort: sourcePortId,
      originalTargetPort: targetPortId,
    });

    // Generate a new UUID for the inverse edge
    const inverseEdgeId = uuidv4();
    const diagramId = this.dfdId || 'default-diagram';
    const userId = 'current-user'; // TODO: Get from auth service

    // Create domain edge data for the inverse connection
    // Swap source and target, and swap source and target ports
    const inverseEdgeData =
      sourcePortId && targetPortId
        ? EdgeData.createWithPorts(
            inverseEdgeId,
            targetNodeId, // Swap: original target becomes new source
            sourceNodeId, // Swap: original source becomes new target
            targetPortId, // Swap: original target port becomes new source port
            sourcePortId, // Swap: original source port becomes new target port
            'Flow', // Default label
          )
        : EdgeData.createSimple(
            inverseEdgeId,
            targetNodeId, // Swap: original target becomes new source
            sourceNodeId, // Swap: original source becomes new target
            'Flow', // Default label
          );

    // Create and execute AddEdgeCommand for the inverse edge
    const command = DiagramCommandFactory.addEdge(
      diagramId,
      userId,
      inverseEdgeId,
      targetNodeId, // New source (original target)
      sourceNodeId, // New target (original source)
      inverseEdgeData,
      true, // isLocalUserInitiated
    );

    this.commandBus
      .execute<void>(command)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.logger.info('Inverse edge created successfully in domain model', {
            originalEdgeId: edge.id,
            inverseEdgeId,
            newSource: targetNodeId,
            newTarget: sourceNodeId,
          });

          // Add the inverse edge to the visual graph
          // Create a DiagramEdge from the EdgeData
          const diagramEdge = new DiagramEdge(inverseEdgeData);

          this.x6GraphAdapter.addEdge(diagramEdge);
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error creating inverse edge in domain model', error);
        },
      });
  }
}
