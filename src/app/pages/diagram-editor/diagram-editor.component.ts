import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  AfterViewInit,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription } from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';
import { AssetLoaderService } from '../../core/services/asset-loader.service';
import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { Diagram } from './models/diagram.model';
import { DiagramService } from './services/diagram.service';
import { DiagramRendererService } from './services/diagram-renderer.service';
import { StateManagerService } from './services/state/state-manager.service';
import { EditorState } from './services/state/editor-state.enum';
import { DiagramElementRegistryService } from './services/registry/diagram-element-registry.service';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule, RouterModule],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.scss',
})
export class DiagramEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  diagramId: string = '';
  diagramTitle: string = 'Loading diagram...';

  // Reference to the canvas element
  @ViewChild('diagramCanvas') diagramCanvas!: ElementRef<HTMLDivElement>;

  // Diagram data
  diagram: Diagram | null = null;

  // Edge creation state
  isCreatingEdge = false;
  sourceVertexId: string | null = null; // Stores component ID of source vertex
  private _sourceCellId: string | null = null; // Stores cell ID of source vertex
  edgeType = 'default';

  // Subscriptions to clean up
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private logger: LoggerService,
    private diagramService: DiagramService,
    private diagramRenderer: DiagramRendererService,
    private cdr: ChangeDetectorRef,
    private translocoService: TranslocoService,
    private assetLoader: AssetLoaderService,
    private stateManager: StateManagerService,
    private registry: DiagramElementRegistryService,
  ) {
    this.logger.info('DiagramEditorComponent constructed');
  }

  ngOnInit(): void {
    this.logger.info('DiagramEditorComponent initializing');

    // Set initial loading message
    this.loadingMessage = 'Initializing renderer...';

    // Subscribe to state changes
    this.subscriptions.push(
      this.stateManager.state$.subscribe((state: EditorState) => {
        this.currentState = state;
        this.updateStateClass(state);
        this.updateLoadingMessage(state);

        // Update isEditorReady based on state
        this.isEditorReady = state === EditorState.READY;

        // Force change detection
        this.cdr.detectChanges();
      }),
    );

    // Reset state to UNINITIALIZED
    this.stateManager.reset();

    // Preload assets for better performance
    this.preloadAssets();

    // Init tooltip translations from translation service
    this.updateTooltipTranslations();

    // Subscribe to language change events to update tooltips when language changes
    this.subscriptions.push(
      this.translocoService.langChanges$.subscribe(() => {
        this.updateTooltipTranslations();
      }),
    );

    // Subscribe to route params to get diagram ID
    this.subscriptions.push(
      this.route.paramMap.subscribe(params => {
        this.diagramId = params.get('id') || 'new';
        this.logger.debug(`Diagram ID from route: ${this.diagramId}`);

        // Load or create diagram
        this.loadDiagram(this.diagramId);
      }),
    );

    // Subscribe to current diagram changes
    this.subscriptions.push(
      this.diagramService.currentDiagram$.subscribe(diagram => {
        if (diagram) {
          this.diagram = diagram;
          this.diagramTitle = diagram.name;
          this.logger.debug(`Current diagram updated: ${diagram.name}`);

          // If renderer is initialized, update the diagram
          // Note: We only trigger rendering for specific operations that should update visualization
          // Component-only updates don't require re-rendering to avoid circular dependencies
          if (this.diagramRenderer.isInitialized() && diagram.graphData.length === 0) {
            // Always render when diagram is first loaded or cleared
            this.diagramRenderer.updateDiagram();
          }
        }
      }),
    );

    // No longer subscribing to grid state changes from renderer
    // as we're using our own grid state for the CSS grid

    // Subscribe to cell click events from the renderer
    this.subscriptions.push(
      this.diagramRenderer.cellClicked$.subscribe(cellData => {
        this.logger.debug('Cell click event received:', cellData);
        if (cellData?.cellId && cellData.cellType === 'vertex') {
          this.logger.debug(`Processing vertex click for cell ${cellData.cellId}`);
          this.handleVertexClick(cellData.cellId);
        } else {
          this.logger.debug('Cell click was not for a vertex or was missing data');
        }
      }),
    );

    // Subscribe to cell selection events
    this.subscriptions.push(
      this.diagramRenderer.cellSelected$.subscribe(selectionData => {
        if (selectionData) {
          this.logger.info(
            `Cell selected in component: ${selectionData.cellType} ${selectionData.cellId}`,
          );
          this.hasSelectedCell = true;
          this._selectedCellId = selectionData.cellId;
          this.logger.info(
            `DELETE BUTTON SHOULD BE ENABLED: hasSelectedCell=${this.hasSelectedCell}`,
          );

          try {
            // Get the cell properties and populate the properties panel
            this.updateSelectedCellProperties(selectionData.cellId).catch(err => {
              this.logger.error('Error in updateSelectedCellProperties:', err);
            });
          } catch (error) {
            this.logger.error('Error updating selected cell properties:', error);
            // If properties can't be loaded, still keep the cell selected
          }
        } else {
          this.logger.info('Cell selection cleared in component');
          this.hasSelectedCell = false;
          this._selectedCellId = null;
          this.selectedCellProperties = null;
          this.logger.info(
            `DELETE BUTTON SHOULD BE DISABLED: hasSelectedCell=${this.hasSelectedCell}`,
          );
        }

        // Force Angular to detect the change to hasSelectedCell
        this.cdr.detectChanges();
        this.logger.info(`Change detection triggered: hasSelectedCell=${this.hasSelectedCell}`);
      }),
    );

    // Set up listener for label editing state
    this.setupEditingStateListener();
  }

  ngAfterViewInit(): void {
    if (!this.diagramCanvas) {
      this.logger.error('Diagram canvas element not found');
      this.stateManager.transitionTo(EditorState.ERROR);
      return;
    }

    try {
      // Reset state to UNINITIALIZED first to ensure proper initialization sequence
      this.stateManager.reset();

      // Initialize the renderer
      this.logger.debug('Initializing diagram renderer with canvas element');
      this.diagramRenderer.initialize(this.diagramCanvas.nativeElement);

      // At this point, the state should be INITIALIZING (set by the renderer)

      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      this.cdr.detectChanges();

      setTimeout(() => {
        // Wait for initialization using the Promise-based approach
        this.diagramRenderer
          .initializeRenderer()
          .then(() => {
            if (this.diagram) {
              // Transition to LOADING state
              this.stateManager.transitionTo(EditorState.LOADING);

              this.logger.debug('Renderer initialized, updating diagram');
              this.diagramRenderer.updateDiagram();

              // Set initial grid state
              this.gridEnabled = true; // Default to show CSS grid

              // Transition to STABILIZING state
              this.stateManager.transitionTo(EditorState.STABILIZING);

              // Force change detection
              this.cdr.detectChanges();

              // Wait for full stabilization
              return this.diagramRenderer.waitForStabilization();
            }
            return Promise.resolve();
          })
          .then(() => {
            // Transition to READY state
            this.stateManager.transitionTo(EditorState.READY);
            this.logger.info('Diagram fully stabilized and ready for operations');

            // Force change detection
            this.cdr.detectChanges();
          })
          .catch(error => {
            this.logger.error('Error during renderer initialization chain', error);

            // Only transition to ERROR state if we're not already in it
            if (this.stateManager.getCurrentState() !== EditorState.ERROR) {
              this.stateManager.transitionTo(EditorState.ERROR);
            }
            // After a short delay, transition to RECOVERING and then READY to hide spinner
            setTimeout(() => {
              // First transition to RECOVERING state
              this.stateManager.transitionTo(EditorState.RECOVERING);

              // Then after another short delay, transition to READY
              setTimeout(() => {
                this.stateManager.transitionTo(EditorState.READY);
                this.cdr.detectChanges();
              }, 1000);
            }, 2000);
          });
      });
    } catch (error) {
      this.logger.error('Error during diagram renderer initialization', error);
      this.stateManager.transitionTo(EditorState.ERROR);
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Reset flags
    // Reset state
    this.stateManager.reset();

    // Clean up any ongoing retry operations
    this._vertexCreationRetries = {};

    // Clean up renderer
    try {
      this.diagramRenderer.destroy();
    } catch (error) {
      this.logger.error('Error during renderer destruction', error);
    }

    this.logger.info('DiagramEditorComponent destroyed');
  }

  /**
   * Load a diagram by ID or create a new one
   * Following our architecture: load diagram structure first, then create maxGraph cells
   */
  loadDiagram(id: string): void {
    this.logger.info(`Loading diagram: ${id}`);

    // Transition to LOADING state if we're already initialized
    if (this.stateManager.getCurrentState() === EditorState.READY) {
      this.stateManager.transitionTo(EditorState.LOADING);
    }

    // Create a new diagram if the ID is 'new' or starts with 'new-diagram-'
    if (id === 'new' || id.startsWith('new-diagram-')) {
      this.logger.info(`Creating new diagram with ID: ${id}`);
      this.createNewDiagram();

      // Transition back to READY state if we were in LOADING
      if (this.stateManager.getCurrentState() === EditorState.LOADING) {
        this.stateManager.transitionTo(EditorState.READY);
      }
      return;
    }

    // Try to load from local storage
    try {
      const diagram = this.diagramService.loadDiagramFromLocalStorage(id);

      if (!diagram) {
        // If not found, create a new one
        this.logger.warn(`Diagram not found: ${id}, creating new`);
        this.createNewDiagram();
      } else {
        this.logger.info(`Diagram loaded successfully: ${diagram.name} (${diagram.id})`);

        // If we're already initialized, transition to STABILIZING
        if (this.diagramRenderer.isInitialized()) {
          this.stateManager.transitionTo(EditorState.STABILIZING);

          // Explicitly trigger graph render after diagram is loaded
          this.diagramRenderer.updateDiagram();

          // Transition back to READY state
          this.stateManager.transitionTo(EditorState.READY);
        }
      }
    } catch (error) {
      this.logger.error(`Error loading diagram: ${id}`, error);

      // Transition to ERROR state
      this.stateManager.transitionTo(EditorState.ERROR);

      // Create a new diagram after a short delay
      setTimeout(() => {
        this.createNewDiagram();

        // Transition back to READY state
        this.stateManager.transitionTo(EditorState.READY);
      }, 1000);
    }
  }

  /**
   * Create a new diagram
   */
  private createNewDiagram(): void {
    this.diagramService.createNewDiagram(
      'New Diagram',
      'Created on ' + new Date().toLocaleString(),
    );
    this.logger.info('New diagram created');
  }

  /**
   * Save the current diagram
   */
  saveDiagram(): void {
    this.logger.info('Saving diagram');

    // Transition to SAVING state
    this.stateManager.transitionTo(EditorState.SAVING);

    try {
      // Save to local storage for now
      this.diagramService.saveDiagramToLocalStorage();

      // Transition back to READY state
      this.stateManager.transitionTo(EditorState.READY);

      // Show a success message (could use a snackbar or toast in a real app)
      this.logger.info('Diagram saved successfully');
    } catch (error) {
      // Transition to ERROR state on failure
      this.stateManager.transitionTo(EditorState.ERROR);
      this.logger.error('Error saving diagram', error);

      // After a short delay, transition back to READY
      setTimeout(() => {
        this.stateManager.transitionTo(EditorState.READY);
      }, 3000);
    }

    // TODO: In the future, this would call an API
  }

  /**
   * Add a vertex of the specified type to the diagram
   * @param type The type of vertex to create (process, store, actor)
   */
  async addVertex(type: 'process' | 'store' | 'actor'): Promise<void> {
    // Generate random position within the visible canvas area
    const x = Math.floor(Math.random() * 500);
    const y = Math.floor(Math.random() * 300);

    // For tracking
    const maxRetries = 5;
    let retryCount = 0;
    const retryKey = `${type}-${Date.now()}`;
    this._vertexCreationRetries[retryKey] = 0;

    // Keep trying until success or max retries reached
    while (retryCount <= maxRetries) {
      try {
        // Wait for renderer to be ready if it's not
        if (!this.diagramRenderer.isInitialized() || !this.isEditorReady) {
          if (retryCount === 0) {
            this.logger.warn(`Cannot add ${type} vertex: Renderer not initialized. Please wait...`);

            // Give feedback to user about readiness state
            if (!this.diagramRenderer.isInitialized()) {
              this.logger.error('Renderer is not initialized yet');
            }
            if (!this.isEditorReady) {
              this.logger.warn(
                'Renderer is initialized but not fully ready - internal flag is false',
              );
            }
          }

          // Force readiness if we're in a retry
          if (retryCount > 0 && this.diagramRenderer.isInitialized()) {
            this.isEditorReady = true;
          }

          // Wait before retrying
          const retryDelay = 1000 + retryCount * 500;
          this.logger.info(
            `Waiting ${retryDelay}ms before retry #${retryCount + 1} for ${type} vertex`,
          );
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
          continue;
        }

        // Verify graph is available
        const graph = this.diagramRenderer.getGraph();
        if (!graph) {
          this.logger.error(`Cannot create ${type} vertex: Graph object is null`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
          continue;
        }

        // Handle connection handler if necessary
        if (!graph.connectionHandler && retryCount > 2) {
          try {
            this.logger.warn('Connection handler missing - attempting to force create one');

            if (graph.getConnectionHandler) {
              // Try using a factory method if available
              graph.connectionHandler = graph.getConnectionHandler();
              this.logger.info('Created connection handler using factory method');
            } else {
              // Create ConnectionHandler directly using the constructor from the graph's prototype
              // Access maxgraph internals through prototype
              const ConnectionHandlerClass =
                Object.getPrototypeOf(graph).constructor.ConnectionHandler;
              if (ConnectionHandlerClass) {
                graph.connectionHandler = new ConnectionHandlerClass(graph);
                this.logger.info('Created connection handler using constructor from prototype');
              } else {
                throw new Error('Could not find ConnectionHandler class');
              }
            }
          } catch (error) {
            this.logger.error('Could not force create connection handler', error);
            // Create a minimal implementation if we couldn't create a real one
            graph.connectionHandler = {
              createMarker: () => null,
              reset: () => {},
              isConnecting: () => false,
              constraintHandler: {
                reset: () => {},
                createHighlightShape: () => null,
              },
            } as any;
            this.logger.info('Created minimal connection handler to prevent errors');
          }
        }

        // Create the vertex using our shared method
        const result = await this.addVertexAtPosition(type, x, y);

        // If the vertex was created successfully, update test vertex references
        if (result) {
          // Save a reference to the test vertex for potential edge creation
          this._secondTestVertex = this._lastTestVertex;
          this._lastTestVertex = result;
        }

        // Clean up retry tracking
        delete this._vertexCreationRetries[retryKey];
        return;
      } catch (error) {
        this.logger.error(`Exception while creating ${type} vertex`, error);

        if (retryCount < maxRetries) {
          this.logger.info(
            `Will retry ${type} vertex creation after error (attempt ${retryCount + 1})`,
          );
          await new Promise(resolve => setTimeout(resolve, 1500));
          retryCount++;
        } else {
          this.logger.error(
            `Failed to create ${type} vertex after ${maxRetries} attempts - giving up`,
          );
          delete this._vertexCreationRetries[retryKey];
          return;
        }
      }
    }
  }

  // Store information about the last created test vertex
  private _lastTestVertex: { componentId: string; cellId: string } | null = null;
  // Store information about the second test vertex for edge creation
  private _secondTestVertex: { componentId: string; cellId: string } | null = null;

  // Track if there is a currently selected cell
  // This needs to be public to be accessible in the template
  public hasSelectedCell = false;
  // Store the currently selected cell's ID
  private _selectedCellId: string | null = null;
  // Properties of the selected cell as JSON string
  public selectedCellProperties: string | null = null;

  // State management properties
  public isEditorReady = false;
  public currentState = '';
  public currentStateClass = '';
  public localizedStateText = ''; // Localized state text for display
  public showStateIndicator = true;

  // Loading message for the spinner
  public loadingMessage = 'Initializing diagram editor...';
  /**
   * Update the state class for styling the state indicator
   * @param state The current editor state
   */
  private updateStateClass(state: EditorState): void {
    // Update CSS class for styling
    switch (state) {
      case EditorState.UNINITIALIZED:
      case EditorState.INITIALIZING:
      case EditorState.LOADING:
      case EditorState.STABILIZING:
        this.currentStateClass = 'state-loading';
        break;
      case EditorState.READY:
        this.currentStateClass = 'state-ready';
        break;
      case EditorState.EDITING_LABEL:
      case EditorState.CREATING_EDGE:
      case EditorState.DELETING:
      case EditorState.SAVING:
        this.currentStateClass = 'state-working';
        break;
      case EditorState.ERROR:
        this.currentStateClass = 'state-error';
        break;
      case EditorState.RECOVERING:
        this.currentStateClass = 'state-recovering';
        break;
      default:
        this.currentStateClass = '';
    }

    // Update localized state text
    this.updateLocalizedStateText(state);
  }

  /**
   * Update the localized state text based on the current state
   * @param state The current editor state
   */
  private updateLocalizedStateText(state: EditorState): void {
    const translationKey = `editor.states.${state}`;
    this.localizedStateText = this.translocoService.translate(translationKey);
  }

  /**
   * Update the loading message based on the current state
   * @param state The current editor state
   */
  private updateLoadingMessage(state: EditorState): void {
    switch (state) {
      case EditorState.UNINITIALIZED:
        this.loadingMessage = 'Initializing diagram editor...';
        break;
      case EditorState.INITIALIZING:
        this.loadingMessage = 'Initializing renderer...';
        break;
      case EditorState.LOADING:
        this.loadingMessage = 'Loading diagram...';
        break;
      case EditorState.STABILIZING:
        this.loadingMessage = 'Stabilizing diagram...';
        break;
      case EditorState.ERROR:
        this.loadingMessage = 'Error occurred. Attempting to recover...';
        break;
      case EditorState.RECOVERING:
        this.loadingMessage = 'Recovering from error...';
        break;
      default:
        this.loadingMessage = 'Processing...';
    }
  }

  // Track vertex creation retries
  private _vertexCreationRetries: Record<string, number> = {};

  // Tooltip text properties
  public processTooltip = 'Process';
  public storeTooltip = 'Store';
  public actorTooltip = 'Actor';
  public flowTooltip = 'Flow';
  public flowCancelTooltip = 'Cancel Flow';
  public deleteTooltip = 'Delete';
  public styleTooltip = 'Style';
  public gridTooltip = 'Toggle Grid';

  // Grid state
  public gridEnabled = true;

  // Drag-and-drop state
  public isDragOver = false;
  private draggedVertexType: 'process' | 'store' | 'actor' | null = null;

  /**
   * Create a test edge between the last two vertices created
   * This is only called when the user explicitly requests it
   */
  addTestEdge(): void {
    if (!this.diagramRenderer.isInitialized()) {
      this.logger.error('Cannot create test edge: Renderer not initialized');
      return;
    }

    // We need both a first and second vertex to create an edge
    if (!this._lastTestVertex) {
      this.logger.error('Cannot create test edge: No source vertex available');
      return;
    }

    if (!this._secondTestVertex) {
      this.logger.error('Cannot create test edge: No target vertex available');
      return;
    }

    this.logger.info(
      `Creating test edge between ${this._lastTestVertex.componentId} and ${this._secondTestVertex.componentId}`,
    );

    // Create the edge between the last two vertices
    const edgeResult = this.diagramRenderer.createEdgeBetweenComponents(
      this._lastTestVertex.componentId,
      this._secondTestVertex.componentId,
      'Test Edge',
    );

    if (edgeResult) {
      this.logger.info(`Created test edge with ID: ${edgeResult.componentId}`);
    } else {
      this.logger.error('Failed to create test edge');
    }
  }

  /**
   * Add test vertices and edges to demonstrate functionality
   */
  addTestDiagram(): void {
    if (!this.diagramRenderer.isInitialized()) {
      this.logger.error('Cannot create test diagram: Renderer not initialized');
      return;
    }

    this.logger.info('Creating test diagram with ultra-reliable method');

    try {
      // First create the vertices and get their IDs
      const serverId = this.diagramRenderer.createVertex(100, 100, 'Server');
      const databaseId = this.diagramRenderer.createVertex(300, 100, 'Database');
      const clientId = this.diagramRenderer.createVertex(100, 250, 'Client');
      const logId = this.diagramRenderer.createVertex(300, 300, 'Log');

      // Then create edges between them
      this.diagramRenderer.createSingleEdgeWithVertices(serverId, databaseId, 'Server to Database');

      this.diagramRenderer.createSingleEdgeWithVertices(clientId, serverId, 'Client to Server');

      this.diagramRenderer.createSingleEdgeWithVertices(logId, databaseId, 'Log to Database');

      this.logger.info('Test diagram created successfully');
    } catch (error) {
      this.logger.error('Error creating test diagram', error);
    }
  }

  /**
   * Test the direct edge creation functionality
   * This bypasses the interactive edge creation process
   */
  testDirectEdgeCreation(): void {
    if (!this.diagramRenderer.isInitialized()) {
      this.logger.error('Cannot test edge creation: Renderer not initialized');
      return;
    }

    // Create source and target coordinates
    const sourceX = 150;
    const sourceY = 150;
    const targetX = 350;
    const targetY = 150;

    this.logger.info('Testing direct edge creation with ultra-reliable method');

    // Use the single operation method that lets mxGraph generate IDs
    try {
      // First create source and target vertices
      const sourceId = this.diagramRenderer.createVertex(sourceX, sourceY, 'Source Node');

      const targetId = this.diagramRenderer.createVertex(targetX, targetY, 'Target Node');

      // Then create the edge between them
      const edgeId = this.diagramRenderer.createSingleEdgeWithVertices(
        sourceId,
        targetId,
        'Direct Test Edge',
      );

      if (edgeId) {
        this.logger.info(`Direct edge creation successful with ID: ${edgeId}`);
      } else {
        this.logger.error('Direct edge creation failed');
      }
    } catch (error) {
      this.logger.error('Exception during direct edge creation test', error);
    }
  }

  // Method left in place but unused - flow button removed from UI
  toggleEdgeCreationMode(): void {
    this.isCreatingEdge = !this.isCreatingEdge;
    this.sourceVertexId = null;

    if (this.isCreatingEdge) {
      this.logger.info('Flow creation mode activated');
    } else {
      this.logger.info('Flow creation mode deactivated');
    }

    // Update the UI to show that flow creation mode is active
    this.diagramRenderer.setEdgeCreationMode(this.isCreatingEdge);
  }

  /**
   * Toggle the grid visibility
   */
  toggleGridVisibility(): void {
    this.logger.info('Toggling grid visibility');
    this.gridEnabled = !this.gridEnabled;
    this.logger.debug(`Grid visibility toggled to: ${this.gridEnabled}`);
  }

  /**
   * Handle dragstart event from palette buttons
   * @param event The drag event
   * @param vertexType The type of vertex being dragged
   */
  onDragStart(event: DragEvent, vertexType: 'process' | 'store' | 'actor'): void {
    this.logger.info(`Drag started for ${vertexType} vertex`);

    // Store the vertex type so we know what to create on drop
    this.draggedVertexType = vertexType;

    // Set the drag image and data
    if (event.dataTransfer) {
      // Set the drag data
      event.dataTransfer.setData('application/tmi-vertex-type', vertexType);

      // Create a ghost drag image
      const dragIcon = document.createElement('div');
      dragIcon.style.width = '40px';
      dragIcon.style.height = '40px';
      dragIcon.style.borderRadius = '50%';
      dragIcon.style.backgroundColor = '#3f51b5';
      dragIcon.style.display = 'flex';
      dragIcon.style.alignItems = 'center';
      dragIcon.style.justifyContent = 'center';

      // Add an icon based on vertex type
      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined';
      iconSpan.style.color = 'white';
      iconSpan.style.fontSize = '24px';

      switch (vertexType) {
        case 'process':
          iconSpan.textContent = 'crop_square';
          break;
        case 'store':
          iconSpan.textContent = 'database';
          break;
        case 'actor':
          iconSpan.textContent = 'person';
          break;
      }

      dragIcon.appendChild(iconSpan);
      document.body.appendChild(dragIcon);

      // Set it as the drag image and position it at the cursor
      event.dataTransfer.setDragImage(dragIcon, 20, 20);

      // Set effectAllowed to copy to indicate we're creating a new element
      event.dataTransfer.effectAllowed = 'copy';

      // Set a timeout to remove the ghost element after it's no longer needed
      setTimeout(() => {
        document.body.removeChild(dragIcon);
      }, 0);
    }
  }

  /**
   * Handle dragover event on the canvas
   * @param event The drag event
   */
  onDragOver(event: DragEvent): void {
    // Prevent default to allow drop
    event.preventDefault();

    // Set the dropEffect to copy
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    // Add visual indicator that dropping is allowed
    this.isDragOver = true;
  }

  /**
   * Handle dragleave event on the canvas
   * @param _event The drag event (unused)
   */
  onDragLeave(_event: DragEvent): void {
    // Remove visual indicator
    this.isDragOver = false;
  }

  /**
   * Handle drop event on the canvas
   * @param event The drop event
   */
  onDrop(event: DragEvent): void {
    // Prevent the browser's default drop handling
    event.preventDefault();
    event.stopPropagation();

    // Remove visual indicator
    this.isDragOver = false;

    // Get the vertex type from the data transfer
    const vertexType =
      this.draggedVertexType ||
      (event.dataTransfer
        ? (event.dataTransfer.getData('application/tmi-vertex-type') as
            | 'process'
            | 'store'
            | 'actor')
        : null);

    if (!vertexType) {
      this.logger.warn('No vertex type found in drop data');
      return;
    }

    // Calculate drop position relative to the canvas
    const canvasRect = this.diagramCanvas.nativeElement.getBoundingClientRect();
    const x = Math.max(0, event.clientX - canvasRect.left);
    const y = Math.max(0, event.clientY - canvasRect.top);

    this.logger.info(`Dropped ${vertexType} vertex at (${x}, ${y})`);

    // Create the vertex at the drop position
    void this.addVertexAtPosition(vertexType, x, y);

    // Reset the dragged vertex type
    this.draggedVertexType = null;
  }

  /**
   * Add a vertex at a specific position
   * @param type The type of vertex to create
   * @param x The x coordinate
   * @param y The y coordinate
   */
  private async addVertexAtPosition(
    type: 'process' | 'store' | 'actor',
    x: number,
    y: number,
  ): Promise<{ componentId: string; cellId: string } | null> {
    try {
      // Wait for renderer to be ready if it's not
      if (!this.diagramRenderer.isInitialized() || !this.isEditorReady) {
        this.logger.warn(`Cannot add ${type} vertex: Renderer not initialized. Please wait...`);
        return null;
      }

      // Add a brief delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 0));

      // Define vertex style and label based on type
      let style = '';
      let width = 100;
      let height = 60;
      let label = '';

      // Use inline styles instead of theme-based styles
      switch (type) {
        case 'process':
          style = 'rounded=1;fillColor=#2196F3;strokeColor=#0D47A1;fontColor=#ffffff';
          label = 'Process';
          width = 120;
          height = 60;
          break;

        case 'store':
          style = 'shape=cylinder;fillColor=#4CAF50;strokeColor=#1B5E20;fontColor=#ffffff';
          label = 'Store';
          width = 80;
          height = 80;
          break;

        case 'actor':
          style = 'shape=actor;fillColor=#9C27B0;strokeColor=#4A148C;fontColor=#ffffff';
          label = 'Actor';
          width = 40;
          height = 80;
          break;
      }

      // Create the vertex with the appropriate style at the exact drop position
      const result = this.diagramRenderer.createVertexWithIds(x, y, label, width, height, style);

      if (result) {
        const { componentId, cellId } = result;
        this.logger.info(
          `Added ${type} vertex at (${x}, ${y}) with ID: ${componentId} (cell: ${cellId})`,
        );
        return { componentId, cellId };
      } else {
        this.logger.error(`Failed to create ${type} vertex at (${x}, ${y})`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Exception while creating ${type} vertex`, error);
      return null;
    }
  }

  /**
   * Handle vertex click events for edge creation
   * Note: vertexId is a cell ID, not a component ID
   */
  handleVertexClick(cellId: string): void {
    this.logger.info(`Vertex cell clicked: ${cellId}`);

    if (!this.isCreatingEdge) {
      // Not in edge creation mode, do nothing
      this.logger.debug(`Not in edge creation mode, ignoring vertex click`);
      return;
    }

    // Find the component associated with this cell
    const component = this.diagramService.findComponentByCellId(cellId);
    if (!component) {
      this.logger.error(`No component found for cell ${cellId}`);
      return;
    }

    // From now on, we'll track component IDs but maintain the cell IDs for highlighting
    const componentId = component.id;

    this.logger.info(
      `Processing vertex component ${componentId} (cell: ${cellId}) in edge creation mode`,
    );

    if (!this.sourceVertexId) {
      // First click - select source vertex
      // Store both component ID and cell ID
      this.sourceVertexId = componentId;
      this._sourceCellId = cellId; // Store cell ID for highlighting
      this.logger.info(`Source vertex selected: component=${componentId}, cell=${cellId}`);

      try {
        this.diagramRenderer.highlightCell(cellId, true, false); // isComponentId=false since we're passing cellId
        this.logger.debug(`Source vertex cell ${cellId} highlighted`);
      } catch (error) {
        this.logger.error(`Failed to highlight source vertex cell ${cellId}`, error);
      }
    } else if (this.sourceVertexId === componentId) {
      // Clicked the same vertex again - cancel selection
      try {
        this.diagramRenderer.highlightCell(this._sourceCellId!, false, false); // Using cell ID for highlighting
        this.sourceVertexId = null;
        this._sourceCellId = null;
        this.logger.info('Source vertex selection canceled');
      } catch (error) {
        this.logger.error(`Failed to unhighlight vertex ${this._sourceCellId}`, error);
      }
    } else {
      // Second click - create the edge
      this.logger.info(`Creating edge from component ${this.sourceVertexId} to ${componentId}`);

      // Use a try-catch block to ensure errors are properly handled
      try {
        // We now pass component IDs to createEdge for proper lookup
        const edgeId = this.createEdge(this.sourceVertexId, componentId, 'Flow');

        if (edgeId) {
          this.logger.info(`Edge created successfully with ID: ${edgeId}`);
        } else {
          this.logger.error(`Failed to create edge from ${this.sourceVertexId} to ${componentId}`);
        }
      } catch (error) {
        this.logger.error(
          `Exception while creating edge from ${this.sourceVertexId} to ${componentId}`,
          error,
        );
      } finally {
        // Always reset state, even if an error occurred
        try {
          this.diagramRenderer.highlightCell(this._sourceCellId!, false, false); // Using cell ID for highlighting
          this.logger.debug(`Source vertex ${this._sourceCellId} unhighlighted`);
        } catch (error) {
          this.logger.error(`Failed to unhighlight source vertex ${this._sourceCellId}`, error);
        }

        this.sourceVertexId = null;
        this._sourceCellId = null;

        // If not in continuous edge creation mode, exit edge creation mode
        if (!this.isContinuousEdgeCreation()) {
          this.toggleEdgeCreationMode();
        }
      }
    }
  }

  /**
   * Create an edge between two vertices using component IDs
   * @param sourceComponentId The source component ID (not cell ID)
   * @param targetComponentId The target component ID (not cell ID)
   * @param label Optional label for the edge
   * @returns The ID of the created edge, or null if creation failed
   */
  private createEdge(
    sourceComponentId: string,
    targetComponentId: string,
    label = '',
  ): string | null {
    if (!this.diagramRenderer.isInitialized()) {
      this.logger.error('Cannot create edge: Renderer not initialized');
      return null;
    }

    try {
      // Use createEdgeBetweenComponents which properly handles component IDs
      const flowStyle =
        'endArrow=classic;html=1;rounded=1;edgeStyle=orthogonalEdgeStyle;strokeColor=#4D4D4D;';
      const result = this.diagramRenderer.createEdgeBetweenComponents(
        sourceComponentId,
        targetComponentId,
        label,
        flowStyle,
      );
      if (result) {
        this.logger.info(
          `Edge created between components ${sourceComponentId} and ${targetComponentId}`,
        );
        return result.componentId;
      } else {
        this.logger.error(
          `Failed to create edge between components ${sourceComponentId} and ${targetComponentId}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Exception while creating edge between components ${sourceComponentId} and ${targetComponentId}`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if continuous edge creation is enabled
   * This would be controlled by a UI toggle in a full implementation
   */
  private isContinuousEdgeCreation(): boolean {
    // For now, hardcode to false - one edge at a time
    return false;
  }

  /**
   * Delete the currently selected cell and its associated component
   */
  deleteSelected(): void {
    if (!this.hasSelectedCell || !this._selectedCellId) {
      this.logger.warn('Cannot delete: No cell selected');
      return;
    }

    // Transition to DELETING state
    this.stateManager.transitionTo(EditorState.DELETING);

    this.logger.info(`Deleting selected cell: ${this._selectedCellId}`);

    try {
      // First check if the cell exists in the registry
      const componentId = this.registry.getComponentId(this._selectedCellId);

      if (componentId) {
        // Delete component using the registry information
        this.diagramRenderer.deleteComponent(componentId);
        this.logger.info(`Deleted component: ${componentId} from registry`);
      } else {
        // Fall back to the old method if not in registry
        const component = this.diagramService.findComponentByCellId(this._selectedCellId);

        if (component) {
          // Delete component (which will also delete the cell)
          this.diagramRenderer.deleteComponent(component.id);
          this.logger.info(`Deleted component: ${component.id}`);
        } else {
          // If no component was found, try to delete just the cell
          this.logger.warn(
            `No component found for cell ${this._selectedCellId}, attempting to delete cell only`,
          );
          this.diagramRenderer.deleteCellById(this._selectedCellId);
        }
      }

      // Reset selection state
      this.hasSelectedCell = false;
      this._selectedCellId = null;

      // Transition back to READY state
      this.stateManager.transitionTo(EditorState.READY);
    } catch (error) {
      this.logger.error('Error deleting selected item', error);

      // Transition to ERROR state
      this.stateManager.transitionTo(EditorState.ERROR);

      // After a short delay, transition back to READY
      setTimeout(() => {
        this.stateManager.transitionTo(EditorState.READY);
      }, 2000);
    }
  }

  // Track if we're currently editing a label
  private _isEditingLabel = false;

  // Subscribe to editing state changes from the event handler service
  private setupEditingStateListener(): void {
    this.subscriptions.push(
      this.diagramRenderer.getEventHandlingService().labelEditingState$.subscribe(isEditing => {
        this._isEditingLabel = isEditing;
        this.logger.debug(`Label editing state changed to: ${isEditing}`);
      }),
    );
  }

  /**
   * Handle keyboard events for diagram editing:
   * - Delete/Backspace: Delete selected cell (only when not editing a label)
   * - F2: Edit label of selected cell
   * - Escape: Cancel selection or exit editing mode
   * - Enter: Complete label editing (when in edit mode)
   *
   * When editing a label, keyboard events for Backspace/Delete are carefully
   * handled to prevent accidental deletion of the object while allowing normal
   * text editing operations.
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // IMPORTANT: We need to check for active text inputs to determine
    // if we're in label editing mode, since the graph editing events
    // might not fire perfectly in sync with keydown events
    const activeElement = document.activeElement;
    const isTextInput =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).hasAttribute('contenteditable') ||
        activeElement.className.includes('mxCellEditor') ||
        activeElement.parentElement?.className.includes('mxCellEditor'));

    // Local check takes precedence over event-based flag
    const isCurrentlyEditing = isTextInput || this._isEditingLabel;

    // Get graph for operations
    const graph = this.diagramRenderer.getGraph();
    if (!graph) return;

    // Debugging logs only if not in common edit operations
    if (
      !(
        isCurrentlyEditing &&
        (event.key === 'Backspace' || event.key === 'Delete' || event.key.length === 1)
      )
    ) {
      // Single character keys
      this.logger.debug(
        `Key pressed: ${event.key}, editing: ${isCurrentlyEditing}, element: ${activeElement?.tagName}`,
      );
    }

    // If editing a label, handle special cases and let other events pass through
    if (isCurrentlyEditing) {
      // Handle Escape key to exit editing
      if (event.key === 'Escape' && graph.cellEditor && graph.cellEditor.stopEditing) {
        graph.cellEditor.stopEditing(true); // true = cancel editing
        event.preventDefault();
        this.logger.debug('Stopped label editing with Escape');
        return;
      }

      // Handle Enter key to complete editing (unless Shift+Enter for new line)
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        graph.cellEditor &&
        graph.cellEditor.stopEditing
      ) {
        graph.cellEditor.stopEditing(false); // false = accept changes
        event.preventDefault();
        this.logger.debug('Completed label editing with Enter');
        return;
      }

      // For Delete/Backspace, stop propagation but don't prevent default
      // This allows the editor to handle the key normally but prevents
      // the cell from being deleted
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.stopPropagation();
        // DO NOT call preventDefault() - we want the default text editing behavior
        return;
      }

      // IMPORTANT: Let everything else pass through to the editor
      return;
    }

    // Only handle keys when a cell is selected (and not in edit mode)
    if (this.hasSelectedCell) {
      // Handle delete/backspace to delete the selected cell
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Prevent the default browser behavior
        event.preventDefault();

        this.logger.debug(`Deleting selected cell with ${event.key} key`);
        this.deleteSelected();
      }

      // Handle F2 or Enter to start editing the label
      else if (event.key === 'F2' || event.key === 'Enter') {
        event.preventDefault();

        // Start editing the selected cell's label
        if (this._selectedCellId) {
          const cell = this.diagramRenderer.getCellById(this._selectedCellId);
          if (cell) {
            this.logger.debug(
              `Starting label edit via ${event.key} key for cell ${this._selectedCellId}`,
            );
            graph.startEditingAtCell(cell);
          }
        }
      }

      // Handle Escape to cancel selection
      else if (event.key === 'Escape') {
        this.logger.debug('Escape key pressed, clearing selection');
        graph.clearSelection();
      }
    }
  }

  /**
   * Update tooltip translations from the translation service
   */
  private updateTooltipTranslations(): void {
    this.processTooltip = this.translocoService.translate('editor.palette.items.process');
    this.storeTooltip = this.translocoService.translate('editor.palette.items.store');
    this.actorTooltip = this.translocoService.translate('editor.palette.items.actor');
    this.flowTooltip = this.translocoService.translate('editor.palette.items.flow');
    this.flowCancelTooltip = this.translocoService.translate('editor.palette.items.flowCancel');
    this.deleteTooltip = this.translocoService.translate('editor.toolbar.items.delete');
    this.styleTooltip = this.translocoService.translate('editor.toolbar.items.style');
    this.gridTooltip = this.translocoService.translate('editor.toolbar.items.grid');
  }

  /**
   * Preload assets used in the diagram editor
   * This improves performance by loading images before they're needed
   */
  private preloadAssets(): void {
    this.logger.debug('Preloading assets for diagram editor');

    // List of image assets to preload
    const imageAssets = [
      { path: 'assets/images/point', ext: 'gif' },
      { path: 'assets/images/resize', ext: 'gif' },
      { path: 'assets/images/warning', ext: 'gif' },
    ];

    // Preload each asset
    imageAssets.forEach(asset => {
      // Get the optimal image path (WebP if supported)
      const optimalPath = this.assetLoader.getOptimalImagePath(asset.path, asset.ext);

      // Preload the image
      this.assetLoader
        .preloadImage(optimalPath)
        .then(() => this.logger.debug(`Preloaded asset: ${optimalPath}`))
        .catch(err => this.logger.error(`Failed to preload asset: ${optimalPath}`, err));
    });
  }

  /**
   * Update the properties panel with the selected cell's properties
   * @param cellId The ID of the selected cell
   */
  private async updateSelectedCellProperties(cellId: string): Promise<void> {
    try {
      // Safety check for null/empty ID
      if (!cellId) {
        this.logger.warn('Cannot update properties: Cell ID is null or empty');
        this.selectedCellProperties = JSON.stringify(
          { error: 'No valid cell ID provided' },
          null,
          2,
        );
        return;
      }

      // Wait for renderer to be fully initialized if it's not already
      if (!this.diagramRenderer.isInitialized()) {
        this.logger.debug('Waiting for renderer initialization before getting properties');
        await this.diagramRenderer.initializeRenderer();
      }

      // Get the cell from the renderer
      const graph = this.diagramRenderer.getGraph();
      if (!graph) {
        this.logger.error('Cannot get properties: Graph not initialized');
        this.selectedCellProperties = JSON.stringify({ error: 'Graph not initialized' }, null, 2);
        return;
      }

      // Find the cell by ID
      const cell = this.diagramRenderer.getCellById(cellId);
      if (!cell) {
        this.logger.error(`Cell not found with ID: ${cellId}`);

        // Clear the selection since we can't find the cell
        this.hasSelectedCell = false;
        this._selectedCellId = null;
        this.selectedCellProperties = JSON.stringify(
          {
            error: `Cell not found with ID: ${cellId}`,
            note: 'The cell may have been deleted or modified by another operation.',
          },
          null,
          2,
        );
        return;
      }

      // Find the component associated with this cell
      const component = this.diagramService.findComponentByCellId(cellId);

      // Create a properties object with both cell and component data
      const properties: any = {
        // Cell properties
        id: cell.id,
        value: cell.value,
        style: cell.style,
        type: cell.isVertex() ? 'vertex' : cell.isEdge() ? 'edge' : 'unknown',
        geometry: cell.geometry
          ? {
              x: cell.geometry.x,
              y: cell.geometry.y,
              width: cell.geometry.width,
              height: cell.geometry.height,
            }
          : null,
        // Connection info for edges
        source: cell.source ? cell.source.id : null,
        target: cell.target ? cell.target.id : null,
      };

      // Add component properties if available
      if (component) {
        properties.component = {
          id: component.id,
          type: component.type,
          data: component.data,
          metadata: component.metadata || [],
        };
      }

      // Convert to formatted JSON string
      this.selectedCellProperties = JSON.stringify(properties, null, 2);
      this.logger.debug(`Updated properties panel for cell ${cellId}`);
    } catch (error) {
      this.logger.error('Error getting cell properties', error);
      this.selectedCellProperties = JSON.stringify(
        { error: 'Failed to get cell properties' },
        null,
        2,
      );
    }
  }
}
