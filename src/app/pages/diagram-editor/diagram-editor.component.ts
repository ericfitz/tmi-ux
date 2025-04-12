import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, AfterViewInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { LoggerService } from '../../core/services/logger.service';
import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { Diagram } from './models/diagram.model';
import { DiagramService } from './services/diagram.service';
import { DiagramRendererService } from './services/diagram-renderer.service';
import { ThemeSelectorComponent } from './components/theme-selector.component';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [
    CommonModule, 
    SharedModule, 
    MaterialModule, 
    TranslocoModule, 
    RouterModule,
    ThemeSelectorComponent
  ],
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
    private translocoService: TranslocoService
  ) {
    this.logger.info('DiagramEditorComponent constructed');
  }

  ngOnInit(): void {
    this.logger.info('DiagramEditorComponent initializing');
    
    // Init tooltip translations from translation service
    this.updateTooltipTranslations();
    
    // Subscribe to language change events to update tooltips when language changes
    this.subscriptions.push(
      this.translocoService.langChanges$.subscribe(() => {
        this.updateTooltipTranslations();
      })
    );
    
    // Subscribe to route params to get diagram ID
    this.subscriptions.push(
      this.route.paramMap.subscribe(params => {
        this.diagramId = params.get('id') || 'new';
        this.logger.debug(`Diagram ID from route: ${this.diagramId}`);
        
        // Load or create diagram
        this.loadDiagram(this.diagramId);
      })
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
          if (this.diagramRenderer.isInitialized() && diagram.components.length === 0) {
            // Always render when diagram is first loaded or cleared
            this.diagramRenderer.updateDiagram();
          }
        }
      })
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
      })
    );
    
    // Subscribe to cell selection events
    this.subscriptions.push(
      this.diagramRenderer.cellSelected$.subscribe(selectionData => {
        if (selectionData) {
          this.logger.info(`Cell selected in component: ${selectionData.cellType} ${selectionData.cellId}`);
          this.hasSelectedCell = true;
          this._selectedCellId = selectionData.cellId;
          this.logger.info(`DELETE BUTTON SHOULD BE ENABLED: hasSelectedCell=${this.hasSelectedCell}`);
          
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
          this.logger.info(`DELETE BUTTON SHOULD BE DISABLED: hasSelectedCell=${this.hasSelectedCell}`);
        }
        
        // Force Angular to detect the change to hasSelectedCell
        this.cdr.detectChanges();
        this.logger.info(`Change detection triggered: hasSelectedCell=${this.hasSelectedCell}`);
      })
    );
  }
  
  ngAfterViewInit(): void {
    if (!this.diagramCanvas) {
      this.logger.error('Diagram canvas element not found');
      return;
    }
    
    try {
      // Initialize the renderer
      this.logger.debug('Initializing diagram renderer with canvas element');
      this.diagramRenderer.initialize(this.diagramCanvas.nativeElement);
      
      // Wait for initialization using the Promise-based approach
      this.diagramRenderer.initializeRenderer()
        .then(initialized => {
          if (initialized && this.diagram) {
            this.logger.debug('Renderer initialized, updating diagram');
            this.diagramRenderer.updateDiagram();
            
            // Set initial grid state
            // this.gridEnabled = this.diagramRenderer.isGridEnabled(); - not using maxGraph grid anymore
            this.gridEnabled = true; // Default to show CSS grid
            
            // Wait for full stabilization
            return this.diagramRenderer.waitForStabilization();
          }
          return Promise.resolve();
        })
        .then(() => {
          this._isRendererReady = true;
          this.logger.info('Renderer fully ready for operations');
          
          this._isFullyStabilized = true;
          this.logger.info('Diagram fully stabilized and ready for all operations');
        })
        .catch(error => {
          this.logger.error('Error during renderer initialization chain', error);
        });
    } catch (error) {
      this.logger.error('Error during diagram renderer initialization', error);
    }
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Reset flags
    this._isRendererReady = false;
    this._isFullyStabilized = false;
    
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
    
    // Create a new diagram if the ID is 'new' or starts with 'new-diagram-'
    if (id === 'new' || id.startsWith('new-diagram-')) {
      this.logger.info(`Creating new diagram with ID: ${id}`);
      this.createNewDiagram();
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
        
        // Explicitly trigger graph render after diagram is loaded
        // This is separate from the component subscription to avoid circular updates
        if (this.diagramRenderer.isInitialized()) {
          this.diagramRenderer.updateDiagram();
        }
      }
    } catch (error) {
      this.logger.error(`Error loading diagram: ${id}`, error);
      this.createNewDiagram();
    }
  }
  
  /**
   * Create a new diagram
   */
  private createNewDiagram(): void {
    this.diagramService.createNewDiagram('New Diagram', 'Created on ' + new Date().toLocaleString());
    this.logger.info('New diagram created');
  }

  /**
   * Save the current diagram
   */
  saveDiagram(): void {
    this.logger.info('Saving diagram');
    
    // Save to local storage for now
    this.diagramService.saveDiagramToLocalStorage();
    
    // TODO: In the future, this would call an API
  }
  
  /**
   * Add a vertex of the specified type to the diagram
   * @param type The type of vertex to create (process, store, actor)
   */
  async addVertex(type: 'process' | 'store' | 'actor'): Promise<void> {
    // For tracking
    const maxRetries = 5;
    let retryCount = 0;
    const retryKey = `${type}-${Date.now()}`;
    this._vertexCreationRetries[retryKey] = 0;
    
    // Keep trying until success or max retries reached
    while (retryCount <= maxRetries) {
      try {
        // Wait for renderer to be ready if it's not
        if (!this.diagramRenderer.isInitialized() || !this._isRendererReady) {
          if (retryCount === 0) {
            this.logger.warn(`Cannot add ${type} vertex: Renderer not initialized. Please wait...`);
            
            // Give feedback to user about readiness state
            if (!this.diagramRenderer.isInitialized()) {
              this.logger.error('Renderer is not initialized yet');
            }
            if (!this._isRendererReady) {
              this.logger.warn('Renderer is initialized but not fully ready - internal flag is false');
            }
          }
          
          // Force readiness if we're in a retry
          if (retryCount > 0 && this.diagramRenderer.isInitialized()) {
            this._isRendererReady = true;
          }
          
          // Wait before retrying
          const retryDelay = 1000 + (retryCount * 500);
          this.logger.info(`Waiting ${retryDelay}ms before retry #${retryCount + 1} for ${type} vertex`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
          continue;
        }
        
        // Add the vertex at a random position within the visible canvas area
        const x = Math.floor(Math.random() * 500);
        const y = Math.floor(Math.random() * 300);
        
        // Define vertex style and label based on type
        let style = '';
        let width = 100;
        let height = 60;
        let label = '';
        
        switch (type) {
          case 'process':
            style = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;';
            label = 'Process';
            width = 120;
            height = 60;
            break;
            
          case 'store':
            style = 'shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;fillColor=#dae8fc;strokeColor=#6c8ebf;';
            label = 'Store';
            width = 80; 
            height = 80;
            break;
            
          case 'actor':
            style = 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fillColor=#d5e8d4;strokeColor=#82b366;';
            label = 'Actor';
            width = 40;
            height = 80;
            break;
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
              const ConnectionHandlerClass = Object.getPrototypeOf(graph).constructor.ConnectionHandler;
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
                createHighlightShape: () => null
              }
            } as any;
            this.logger.info('Created minimal connection handler to prevent errors');
          }
        }
        
        const connectionHandlerAvailable = graph.connectionHandler !== undefined;
        this.logger.debug(`Connection handler available: ${connectionHandlerAvailable}`);
        
        // Create the vertex with the appropriate style
        const result = this.diagramRenderer.createVertexWithIds(x, y, label, width, height, style);
        
        if (!result) {
          throw new Error(`Failed to create ${type} vertex`);
        }
        
        const { componentId, cellId } = result;
        this.logger.info(`Added ${type} vertex at (${x}, ${y}) with ID: ${componentId} (cell: ${cellId})`);
        
        // Save a reference to the test vertex for potential edge creation
        this._secondTestVertex = this._lastTestVertex;
        this._lastTestVertex = { componentId, cellId };
        
        // Clean up retry tracking
        delete this._vertexCreationRetries[retryKey];
        return;
        
      } catch (error) {
        this.logger.error(`Exception while creating ${type} vertex`, error);
        
        if (retryCount < maxRetries) {
          this.logger.info(`Will retry ${type} vertex creation after error (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          retryCount++;
        } else {
          this.logger.error(`Failed to create ${type} vertex after ${maxRetries} attempts - giving up`);
          delete this._vertexCreationRetries[retryKey];
          return;
        }
      }
    }
  }
  
  // Store information about the last created test vertex
  private _lastTestVertex: { componentId: string, cellId: string } | null = null;
  // Store information about the second test vertex for edge creation
  private _secondTestVertex: { componentId: string, cellId: string } | null = null;
  
  // Track if there is a currently selected cell
  // This needs to be public to be accessible in the template
  public hasSelectedCell = false;
  // Store the currently selected cell's ID
  private _selectedCellId: string | null = null;
  // Properties of the selected cell as JSON string
  public selectedCellProperties: string | null = null;
  // Track if the renderer is ready for operations
  private _isRendererReady = false;
  // Track if the graph is fully stabilized
  private _isFullyStabilized = false;
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
    
    this.logger.info(`Creating test edge between ${this._lastTestVertex.componentId} and ${this._secondTestVertex.componentId}`);
    
    // Create the edge between the last two vertices
    const edgeResult = this.diagramRenderer.createEdgeBetweenComponents(
      this._lastTestVertex.componentId,
      this._secondTestVertex.componentId,
      'Test Edge'
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
      // Create complete edges with vertices in a single operation
      this.diagramRenderer.createSingleEdgeWithVertices(
        100, 100, 'Server', 
        300, 100, 'Database', 
        'Server to Database'
      );
      
      this.diagramRenderer.createSingleEdgeWithVertices(
        100, 250, 'Client', 
        100, 100, 'Server',
        'Client to Server'
      );
      
      this.diagramRenderer.createSingleEdgeWithVertices(
        300, 300, 'Log', 
        300, 100, 'Database',
        'Log to Database'
      );
      
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
      const edgeId = this.diagramRenderer.createSingleEdgeWithVertices(
        sourceX,
        sourceY,
        'Source Node',
        targetX,
        targetY,
        'Target Node',
        'Direct Test Edge'
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
    
    this.logger.info(`Processing vertex component ${componentId} (cell: ${cellId}) in edge creation mode`);
    
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
        this.logger.error(`Exception while creating edge from ${this.sourceVertexId} to ${componentId}`, error);
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
  private createEdge(sourceComponentId: string, targetComponentId: string, label = ''): string | null {
    if (!this.diagramRenderer.isInitialized()) {
      this.logger.error('Cannot create edge: Renderer not initialized');
      return null;
    }
    
    try {
      // Use createEdgeBetweenComponents which properly handles component IDs
      const flowStyle = 'endArrow=classic;html=1;rounded=1;edgeStyle=orthogonalEdgeStyle;strokeColor=#4D4D4D;';
      const result = this.diagramRenderer.createEdgeBetweenComponents(sourceComponentId, targetComponentId, label, flowStyle);
      if (result) {
        this.logger.info(`Edge created between components ${sourceComponentId} and ${targetComponentId}`);
        return result.componentId;
      } else {
        this.logger.error(`Failed to create edge between components ${sourceComponentId} and ${targetComponentId}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Exception while creating edge between components ${sourceComponentId} and ${targetComponentId}`, error);
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
    
    this.logger.info(`Deleting selected cell: ${this._selectedCellId}`);
    
    try {
      // Find the component associated with this cell
      const component = this.diagramService.findComponentByCellId(this._selectedCellId);
      
      if (component) {
        // Delete component (which will also delete the cell)
        this.diagramRenderer.deleteComponent(component.id);
        this.logger.info(`Deleted component: ${component.id}`);
      } else {
        // If no component was found, try to delete just the cell
        this.logger.warn(`No component found for cell ${this._selectedCellId}, attempting to delete cell only`);
        this.diagramRenderer.deleteCellById(this._selectedCellId);
      }
      
      // Reset selection state
      this.hasSelectedCell = false;
      this._selectedCellId = null;
    } catch (error) {
      this.logger.error('Error deleting selected item', error);
    }
  }
  
  /**
   * Handle keyboard events for delete and backspace
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Only handle delete/backspace when a cell is selected
    if (this.hasSelectedCell && (event.key === 'Delete' || event.key === 'Backspace')) {
      // Prevent the default browser behavior (like navigating back with backspace)
      event.preventDefault();
      
      // Delete the selected item
      this.deleteSelected();
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
   * Update the properties panel with the selected cell's properties
   * @param cellId The ID of the selected cell
   */
  private async updateSelectedCellProperties(cellId: string): Promise<void> {
    try {
      // Wait for renderer to be fully initialized if it's not already
      if (!this.diagramRenderer.isInitialized()) {
        this.logger.debug('Waiting for renderer initialization before getting properties');
        await this.diagramRenderer.initializeRenderer();
      }
      
      // Get the cell from the renderer
      const graph = this.diagramRenderer.getGraph();
      if (!graph) {
        this.logger.error('Cannot get properties: Graph not initialized');
        return;
      }
      
      // Find the cell by ID
      const cell = this.diagramRenderer.getCellById(cellId);
      if (!cell) {
        this.logger.error(`Cell not found with ID: ${cellId}`);
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
        geometry: cell.geometry ? {
          x: cell.geometry.x,
          y: cell.geometry.y,
          width: cell.geometry.width,
          height: cell.geometry.height
        } : null,
        // Connection info for edges
        source: cell.source ? cell.source.id : null,
        target: cell.target ? cell.target.id : null
      };
      
      // Add component properties if available
      if (component) {
        properties.component = {
          id: component.id,
          type: component.type,
          data: component.data,
          metadata: component.metadata || []
        };
      }
      
      // Convert to formatted JSON string
      this.selectedCellProperties = JSON.stringify(properties, null, 2);
      this.logger.debug(`Updated properties panel for cell ${cellId}`);
    } catch (error) {
      this.logger.error('Error getting cell properties', error);
      this.selectedCellProperties = JSON.stringify({ error: 'Failed to get cell properties' }, null, 2);
    }
  }
}