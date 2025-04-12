import { Injectable, NgZone } from '@angular/core';
import { Graph, constants } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { MxGraphPatchingService } from './mx-graph-patching.service';

@Injectable({
  providedIn: 'root'
})
export class GraphInitializationService {
  // Graph elements
  private graph: any = null;
  private model: any = null;
  private container: HTMLElement | null = null;
  
  // Initialization state
  private _isInitialized = false;
  private _initializationPromise: Promise<void> | null = null;
  
  constructor(
    private logger: LoggerService,
    private ngZone: NgZone,
    private patchingService: MxGraphPatchingService
  ) {
    this.logger.info('GraphInitializationService initialized');
  }
  
  /**
   * Check if graph is initialized
   */
  isInitialized(): boolean {
    return this._isInitialized && !!this.graph && !!this.container;
  }
  
  /**
   * Initialize the graph with a container
   */
  initialize(container: HTMLElement): void {
    if (this._isInitialized) {
      this.logger.warn('Graph already initialized, destroying first');
      this.destroy();
    }
    
    this.logger.info('Initializing graph with container');
    this.container = container;
    
    // Mark as not initialized until complete
    this._isInitialized = false;
  }
  
  /**
   * Initialize the renderer with the current container
   */
  initializeRenderer(): Promise<void> {
    if (this._initializationPromise) {
      this.logger.debug('Returning existing initialization promise');
      return this._initializationPromise;
    }
    
    if (!this.container) {
      const error = new Error('Cannot initialize renderer: No container set');
      this.logger.error(error.message);
      return Promise.reject(error);
    }
    
    this._initializationPromise = new Promise<void>((resolve, reject) => {
      try {
        this.logger.debug('Starting renderer initialization');
        
        // Run outside Angular zone for better performance
        this.ngZone.runOutsideAngular(() => {
          try {
            // Basic configuration to avoid common errors
            // In MaxGraph, use constants.EVENT_DISABLE_CONTEXTMENU
            if (this.container) {
              this.container.addEventListener('contextmenu', (evt) => evt.preventDefault());
            }
            
            // Create graph instance
            this.graph = new Graph(this.container!);
            this.model = this.graph.getModel();
            
            // Apply patches
            this.patchingService.applyAllPatches(this.graph, this.model);
            
            // Basic graph configuration
            this.configureGraph();
            this.configureNonThemeSettings();
            
            // Mark as initialized
            this._isInitialized = true;
            
            this.logger.info('Graph initialized successfully');
            resolve();
          } catch (error) {
            this.logger.error('Error during graph initialization', error);
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error('Error during renderer initialization', error);
        reject(error);
      }
    });
    
    // Clear promise after completion (for potential re-init)
    this._initializationPromise.catch(() => {
      this._initializationPromise = null;
    });
    
    return this._initializationPromise;
  }
  
  /**
   * Configure the graph with base settings
   */
  private configureGraph(): void {
    if (!this.graph) {
      this.logger.error('Cannot configure graph: Graph instance not created');
      return;
    }
    
    try {
      this.logger.debug('Configuring graph base settings');
      
      // Allow selection
      this.graph.setPanning(true);
      this.graph.setTooltips(true);
      this.graph.setConnectable(true);
      this.graph.setCellsEditable(false);
      this.graph.setEnabled(true);
      
      // Auto sizing
      this.graph.setAutoSizeCells(true);
      this.graph.setCellsResizable(true);
      
      // Enable rubberband selection
      // Note: MaxGraph handles RubberBand selection differently than mxGraph
      // We'll use the built-in selection behavior instead
      this.graph.setRubberband(true);
      
      // Configure the graph view
      const view = this.graph.getView();
      view.setScale(1.0);
      
      // Set default parent
      this.model.beginUpdate();
      try {
        const parent = this.graph.getDefaultParent();
        this.graph.selectCell(parent, false);
      } finally {
        this.model.endUpdate();
      }
      
      this.logger.debug('Graph base settings configured successfully');
    } catch (error) {
      this.logger.error('Error configuring graph', error);
      throw error;
    }
  }
  
  /**
   * Configure non-theme specific settings
   */
  private configureNonThemeSettings(): void {
    if (!this.graph) {
      this.logger.error('Cannot configure non-theme settings: Graph instance not created');
      return;
    }
    
    try {
      this.logger.debug('Configuring non-theme graph settings');
      
      // Disable cell editing on click
      this.graph.setCellsLocked(false);
      this.graph.setAutoSizeCells(true);
      
      // Disable edge label movement
      this.graph.edgeLabelsMovable = false;
      
      // Resize parent on child resize
      this.graph.setExtendParents(true);
      this.graph.setExtendParentsOnAdd(true);
      this.graph.setConstrainChildren(true);
      
      // Grid settings
      this.graph.gridSize = 10;
      
      // Configure disconnection behavior
      this.graph.setDisconnectOnMove(false);
      this.graph.setAllowDanglingEdges(false);
      
      // Enable ports for better connection points
      this.graph.setPortsEnabled(true);
      
      // Configure handlers
      this.graph.connectionHandler.createTarget = false;
      this.graph.connectionHandler.select = true;
      
      // Configure bend points for edges
      this.graph.setConnectableEdges(false);
      this.graph.setBendableEdges(true);
      
      // Enable undo support
      this.graph.setAllowNegativeCoordinates(true);
      
      this.logger.debug('Non-theme graph settings configured successfully');
    } catch (error) {
      this.logger.error('Error configuring non-theme settings', error);
    }
  }
  
  /**
   * Get the graph instance
   */
  getGraph(): any {
    return this.graph;
  }
  
  /**
   * Get the model instance
   */
  getModel(): any {
    return this.model;
  }
  
  /**
   * Get the container element
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }
  
  /**
   * Destroy the graph instance
   */
  destroy(): void {
    if (!this._isInitialized) {
      this.logger.debug('Graph not initialized, nothing to destroy');
      return;
    }
    
    try {
      this.logger.info('Destroying graph');
      
      if (this.graph) {
        // Stop all event handling
        this.graph.destroy();
        this.graph = null;
      }
      
      this.model = null;
      
      if (this.container) {
        // Clear the container
        while (this.container.firstChild) {
          this.container.removeChild(this.container.firstChild);
        }
        this.container = null;
      }
      
      this._isInitialized = false;
      this._initializationPromise = null;
      
      this.logger.info('Graph destroyed successfully');
    } catch (error) {
      this.logger.error('Error destroying graph', error);
    }
  }
  
  /**
   * Wait for graph stabilization
   */
  waitForStabilization(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.isInitialized()) {
        this.logger.warn('Cannot wait for stabilization: Graph not initialized');
        resolve();
        return;
      }
      
      // Wait for a few frames to ensure stable rendering
      let waitCount = 0;
      const checkStability = () => {
        waitCount++;
        if (waitCount >= 5) {
          this.logger.debug('Graph stabilized after wait');
          resolve();
        } else {
          requestAnimationFrame(checkStability);
        }
      };
      
      requestAnimationFrame(checkStability);
    });
  }
}