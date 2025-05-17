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
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { Node, Cell } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { DfdService, ExportFormat } from './services/dfd.service';
import { ShapeType } from './services/dfd-node.service';
import { DfdEventBusService, DfdEventType } from './services/dfd-event-bus.service';
import { DfdStateStore } from './state/dfd.state';
import { DfdCommandService } from './services/dfd-command.service';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';
import { ThreatModelService } from '../../pages/tm/services/threat-model.service';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../pages/tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { v4 as uuidv4 } from 'uuid';

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
    private dfdService: DfdService,
    private eventBus: DfdEventBusService,
    private stateStore: DfdStateStore,
    private commandService: DfdCommandService,
    private route: ActivatedRoute,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
  ) {
    this.logger.info('DfdComponent constructor called');

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

    // Subscribe to state changes
    this._subscriptions.add(
      this.stateStore.canUndo$.subscribe(canUndo => {
        this.canUndo = canUndo;
        this.cdr.markForCheck();
      }),
    );

    this._subscriptions.add(
      this.stateStore.canRedo$.subscribe(canRedo => {
        this.canRedo = canRedo;
        this.cdr.markForCheck();
      }),
    );

    // Subscribe to selection state changes
    this._subscriptions.add(
      this.stateStore.selectedNode$.subscribe(selectedNode => {
        this.hasSelectedCells = !!selectedNode;
        this.cdr.markForCheck();
      }),
    );

    // Subscribe to cell context menu events
    this._subscriptions.add(
      this.eventBus.onEventType(DfdEventType.CellContextMenu).subscribe(event => {
        if ('cell' in event && 'event' in event) {
          this.openCellContextMenu(event.cell, event.event);
        }
      }),
    );
  }

  /**
   * Loads the diagram data for the given diagram ID
   * @param diagramId The ID of the diagram to load
   */
  private loadDiagramData(diagramId: string): void {
    // In a real implementation, this would use a dedicated diagram service
    // For now, we'll use the DIAGRAMS_BY_ID map from the diagram model
    void import('../../pages/tm/models/diagram.model').then(module => {
      const diagram = module.DIAGRAMS_BY_ID.get(diagramId);
      if (diagram) {
        this.diagramName = diagram.name;
        this.logger.info('Loaded diagram data', { name: this.diagramName, id: diagramId });
        this.cdr.markForCheck();
      } else {
        this.logger.warn('Diagram not found', { id: diagramId });
      }
    });
  }

  ngAfterViewInit(): void {
    // Initialize the graph after the view is fully initialized
    this.initializeGraph();
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

    // Dispose the DFD service
    this.dfdService.dispose();

    // Reset the state store
    this.stateStore.resetState();
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
      if (this.dfdService.graph) {
        const container = this.graphContainer.nativeElement as HTMLElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.logger.info('Resizing graph due to window resize', { width, height });

        // Force the graph to resize with explicit dimensions
        this.dfdService.graph.resize(width, height);

        // Update the graph's container size
        this.dfdService.graph.container.style.width = `${width}px`;
        this.dfdService.graph.container.style.height = `${height}px`;

        this._resizeTimeout = null;
      }
    }, 100); // 100ms debounce
  }

  /**
   * Method to add a node at a random position
   * @param shapeType The type of shape to create
   */
  addRandomNode(shapeType: ShapeType = 'actor'): void {
    if (!this.stateStore.isInitialized) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return;
    }

    // Use command service to create node with command pattern
    this.commandService
      .createRandomNode(shapeType, this.graphContainer.nativeElement as HTMLElement)
      .pipe(take(1))
      .subscribe(result => {
        if (result.success) {
          this.logger.info('Node created successfully', {
            nodeId: result.data?.id,
            shapeType,
          });
          // Force change detection
          this.cdr.detectChanges();
        } else {
          this.logger.error('Failed to create node', result.error);
        }
      });
  }

  /**
   * Initialize the X6 graph
   */
  private initializeGraph(): void {
    this.logger.info('DfdComponent initializeGraph called');

    try {
      // Initialize the graph
      const success = this.dfdService.initialize(this.graphContainer.nativeElement as HTMLElement);

      if (success) {
        // Trigger an initial resize to ensure the graph fits the container
        setTimeout(() => {
          if (this.dfdService.graph) {
            const container = this.graphContainer.nativeElement as HTMLElement;
            const width = container.clientWidth;
            const height = container.clientHeight;
            this.dfdService.graph.resize(width, height);
            this.logger.info('Initial graph resize', { width, height });
          }
        }, 0);
        // Set up observation for DOM changes to add passive event listeners
        this.setupDomObservation();

        // Add passive event listeners for touch and wheel events
        this.dfdService.addPassiveEventListeners(this.graphContainer.nativeElement as HTMLElement);

        // Set up port tooltips
        this.setupPortTooltips();

        // Update the state store with the initialized graph
        this.stateStore.updateState(
          {
            isInitialized: true,
            graph: this.dfdService.graph,
          },
          'DfdComponent.initializeGraph',
        );

        this.logger.info('Graph initialization complete');
      } else {
        this.logger.error('Failed to initialize graph');
      }

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
    const graph = this.dfdService.graph;
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
        // Get port details from the node - define a structured port object type
        type PortObject = {
          id?: string;
          attrs?: Record<string, { text?: string }>;
        };
        // Cast node to any and then to PortObject to avoid TypeScript errors with the X6 library
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
    this.commandService
      .undo()
      .pipe(take(1))
      .subscribe(result => {
        if (result.success) {
          this.logger.info('Undo successful');
        } else {
          this.logger.warn('Undo failed', result.error);
        }
      });
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    this.commandService
      .redo()
      .pipe(take(1))
      .subscribe(result => {
        if (result.success) {
          this.logger.info('Redo successful');
        } else {
          this.logger.warn('Redo failed', result.error);
        }
      });
  }

  /**
   * Export the diagram to the specified format
   * @param format The format to export to (png, jpeg, svg)
   */
  exportDiagram(format: ExportFormat): void {
    this.dfdService.exportDiagram(format);
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(): void {
    if (!this.stateStore.isInitialized) {
      this.logger.warn('Cannot delete: Graph is not initialized');
      return;
    }

    const selectedNode = this.stateStore.selectedNode;
    if (selectedNode) {
      this.logger.info('Deleting selected node', { nodeId: selectedNode.id });

      // Use command service to delete node with command pattern
      this.commandService
        .deleteNode(selectedNode.id)
        .pipe(take(1))
        .subscribe(result => {
          if (result.success) {
            this.logger.info('Node deleted successfully', { nodeId: selectedNode.id });

            // Selection is updated in the command service already
            this.cdr.markForCheck();
          } else {
            this.logger.error('Failed to delete node', result.error);
          }
        });
    }
  }

  /**
   * Opens the context menu for a cell at the specified position
   * @param cell The cell to open the context menu for
   * @param event The mouse event that triggered the context menu
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

        // We've already checked that threatModelId is not null above
        const dialogData: ThreatEditorDialogData = {
          threatModelId: this.threatModelId as string,
          mode: 'create',
        };

        const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
          width: '500px',
          data: dialogData,
        });

        this._subscriptions.add(
          dialogRef.afterClosed().subscribe(result => {
            if (result && threatModel) {
              const now = new Date().toISOString();

              // Type the result to avoid unsafe assignments
              interface ThreatFormResult {
                name: string;
                description: string;
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
                metadata: [],
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
}
