import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import * as mxgraph from '@maxgraph/core';
// Import necessary types and utilities
import { Client } from '@maxgraph/core';
import { v4 as uuidv4 } from 'uuid';

import { DiagramTheme, ThemeInfo } from '../models/diagram-theme.model';

import { LoggerService } from '../../../core/services/logger.service';
import { DiagramService } from './diagram.service';
import { DiagramComponent, AnchorPointPosition } from '../models/diagram.model';

// Configure maxGraph globally with multiple safeguards for image paths
// This ensures path resolution works correctly from any route or URL

// Get the base URL for absolute paths
const baseUrl = window.location.origin;

// 1. Configure the Client module directly - this is the proper API approach
// This is crucial for ConstraintHandler which uses Client.imageBasePath for point.gif
Client.setBasePath(`${baseUrl}/assets`);
Client.setImageBasePath(`${baseUrl}/assets/images`);

// 2. Set the global variables with absolute paths from domain root
// These are kept for backward compatibility with original mxGraph code
(window as any).mxBasePath = `${baseUrl}/assets/images`;
(window as any).mxImageBasePath = `${baseUrl}/assets/images`;
(window as any).mxGraphPath = `${baseUrl}/assets/images`;

// 3. Also set legacy variable names that might be used internally
(window as any).mxResourceExtension = '.gif';

// 4. Set alternate paths used by some components
(window as any).mxImagePath = `${baseUrl}/assets/images/`;
(window as any).mxBasePath = `${baseUrl}/assets/images/`;

// 4. Override the internal image loading mechanism
// This ensures image paths are always resolved correctly
const originalGetImage = (window as any).mxGraph?.prototype?.getImage;
if (originalGetImage) {
  (window as any).mxGraph.prototype.getImage = function(src: string) {
    // If src doesn't start with http or /, prefix it with the correct path
    if (src && typeof src === 'string' && !src.startsWith('http') && !src.startsWith('/')) {
      return `${baseUrl}/assets/images/${src}`;
    }
    // Use call with spread arguments instead of apply with arguments object
    return originalGetImage.call(this, src);
  };
}

/**
 * Interface for cell click event data
 */
export interface CellClickData {
  cellId: string;
  cellType: 'vertex' | 'edge';
  cell: any; // maxgraph cell
}

/**
 * Service responsible for rendering diagrams with maxGraph
 */
@Injectable({
  providedIn: 'root'
})
export class DiagramRendererService {
  // maxGraph instances
  private graph: any = null;
  private model: any = null;
  
  // Track initialization state
  private _isInitialized = new BehaviorSubject<boolean>(false);
  public isInitialized$ = this._isInitialized.asObservable();
  
  // Promise for initialization status
  private _initializationPromise: Promise<boolean> | null = null;
  
  // Cell click events
  private _cellClicked = new BehaviorSubject<CellClickData | null>(null);
  public cellClicked$ = this._cellClicked.asObservable();
  
  // Cell selection events
  private _cellSelected = new BehaviorSubject<{ cellId: string; cellType: 'vertex' | 'edge' } | null>(null);
  public cellSelected$ = this._cellSelected.asObservable();
  
  // Edge creation mode
  private _edgeCreationMode = false;
  
  // Container reference
  private container: HTMLElement | null = null;
  
  // Safe implementation of equalPoints for internal use
  private safeEqualPoints: (points1: any[], points2: any[]) => boolean = (points1, points2) => {
    // Default implementation - will be replaced in patchEqualPointsMethod
    return points1 === points2;
  };
  
  // Method for edge endpoint updates
  public updateEdgeEndpoint!: (
    edge: any,
    componentId: string, 
    isSource: boolean,
    anchorPosition: AnchorPointPosition
  ) => void;
  
  // Maps anchor positions to relative coordinates (0-1 scale)
  private readonly anchorPositionMap: Record<AnchorPointPosition, { x: number, y: number }> = {
    'N': { x: 0.5, y: 0 },    // Top center
    'NE': { x: 1, y: 0 },     // Top right
    'E': { x: 1, y: 0.5 },    // Right center
    'SE': { x: 1, y: 1 },     // Bottom right
    'S': { x: 0.5, y: 1 },    // Bottom center 
    'SW': { x: 0, y: 1 },     // Bottom left
    'W': { x: 0, y: 0.5 },    // Left center
    'NW': { x: 0, y: 0 },     // Top left
    'C': { x: 0.5, y: 0.5 }   // Center
  };
  
  // Track active anchor point markers
  private activeAnchorMarkers = new Map<AnchorPointPosition, any>();
  
  // Theme-related properties
  private _themeLoaded = new BehaviorSubject<boolean>(false);
  public themeLoaded$ = this._themeLoaded.asObservable();
  private _themeLoadPromise: Promise<DiagramTheme> | null = null;
  private _currentTheme: DiagramTheme | null = null;
  private _currentThemeId: string = 'default-theme';
  
  // Theme change event
  private _themeChanged = new BehaviorSubject<string | null>(null);
  public themeChanged$ = this._themeChanged.asObservable();
  
  constructor(
    private logger: LoggerService,
    private diagramService: DiagramService,
    private ngZone: NgZone,
    private http: HttpClient
  ) {
    this.logger.info('DiagramRendererService initialized');
    
    // Load the saved theme or fall back to default
    const savedTheme = localStorage.getItem('diagramTheme') || 'default-theme';
    this._currentThemeId = savedTheme;
    
    // Pre-load the theme
    void this.loadTheme(savedTheme); // void operator to explicitly mark promise as intentionally not awaited
  }
  
  /**
   * Get available themes
   */
  public getAvailableThemes(): Observable<ThemeInfo[]> {
    return this.http.get<ThemeInfo[]>('/assets/themes/theme-registry.json')
      .pipe(
        catchError(error => {
          this.logger.error('Failed to load theme registry', error);
          // Return default theme list if registry fails to load
          return of([
            { id: 'default-theme', name: 'Default', description: 'Default theme' }
          ]);
        })
      );
  }
  
  /**
   * Get current theme ID
   */
  public getCurrentThemeId(): string {
    return this._currentThemeId;
  }
  
  /**
   * Load a theme from JSON file
   */
  public loadTheme(themeId: string = 'default-theme'): Promise<DiagramTheme> {
    if (this._themeLoadPromise) {
      return this._themeLoadPromise;
    }
    
    this.logger.info(`Loading theme: ${themeId}`);
    
    // Create a default theme as fallback
    const defaultTheme: DiagramTheme = {
      defaultVertexStyle: { fillColor: '#ffffff', strokeColor: '#1565c0', rounded: true, shadow: true },
      defaultEdgeStyle: { strokeColor: '#78909c', edgeStyle: 'orthogonalEdgeStyle', shadow: true, rounded: true },
      styles: {},
      gridEnabled: true,
      gridSize: 10,
      backgroundColor: '#ffffff',
      marker: { validColor: '#00ff00', invalidColor: '#ff0000', hotspot: 0.3 }
    };
    
    this._themeLoadPromise = this.http.get<DiagramTheme>(`/assets/themes/${themeId}.json`)
      .pipe(
        tap(theme => {
          this._currentTheme = theme;
          this._currentThemeId = themeId;
          this._themeLoaded.next(true);
          this.logger.info(`Theme ${themeId} loaded successfully`);
        }),
        catchError(error => {
          this.logger.error(`Failed to load theme: ${themeId}`, error);
          // If theme fails to load, try to load default theme instead
          if (themeId !== 'default-theme') {
            this.logger.info('Falling back to default theme');
            return this.http.get<DiagramTheme>('/assets/themes/default-theme.json');
          }
          // If default theme fails too, use hardcoded defaults
          return of(defaultTheme);
        })
      )
      .toPromise()
      .then(theme => {
        // Store the current theme and reset promise
        this._currentTheme = theme || defaultTheme;
        this._themeLoadPromise = null;
        return theme || defaultTheme;
      });
    
    return this._themeLoadPromise;
  }
  
  /**
   * Switch to a different theme
   */
  public switchTheme(themeId: string): Promise<void> {
    // First, check if we're already using this theme
    if (themeId === this._currentThemeId && this.graph) {
      this.logger.debug(`Already using theme: ${themeId}`);
      return Promise.resolve();
    }
    
    // Reset the theme load promise
    this._themeLoadPromise = null;
    
    // Load the new theme
    return this.loadTheme(themeId)
      .then(theme => {
        // Apply the theme if graph is initialized
        if (this.graph) {
          this.applyTheme(theme);
          
          // Save theme preference
          localStorage.setItem('diagramTheme', themeId);
          
          // Notify subscribers
          this._themeChanged.next(themeId);
          
          this.logger.info(`Switched to theme: ${themeId}`);
        }
      });
  }
  
  /**
   * Apply theme to the graph
   */
  private applyTheme(theme: DiagramTheme): void {
    if (!this.graph) {
      this.logger.warn('Cannot apply theme: Graph not initialized');
      return;
    }
    
    try {
      this.logger.debug('Applying theme to graph');
      
      // Get the graph's stylesheet
      const stylesheet = this.graph.getStylesheet();
      
      // Apply default vertex style
      if (theme.defaultVertexStyle) {
        // Clear existing style
        const defaultVertexStyle = stylesheet.getDefaultVertexStyle();
        for (const key in defaultVertexStyle) {
          if (Object.prototype.hasOwnProperty.call(defaultVertexStyle, key)) {
            delete defaultVertexStyle[key];
          }
        }
        
        // Apply new style
        Object.assign(defaultVertexStyle, theme.defaultVertexStyle);
      }
      
      // Apply default edge style
      if (theme.defaultEdgeStyle) {
        // Clear existing style
        const defaultEdgeStyle = stylesheet.getDefaultEdgeStyle();
        for (const key in defaultEdgeStyle) {
          if (Object.prototype.hasOwnProperty.call(defaultEdgeStyle, key)) {
            delete defaultEdgeStyle[key];
          }
        }
        
        // Apply new style
        Object.assign(defaultEdgeStyle, theme.defaultEdgeStyle);
      }
      
      // Apply named styles
      if (theme.styles) {
        for (const [styleName, styleConfig] of Object.entries(theme.styles)) {
          stylesheet.putCellStyle(styleName, {...styleConfig});
        }
      }
      
      // Apply grid settings
      if (theme.gridEnabled !== undefined) {
        this.graph.setGridEnabled(theme.gridEnabled);
      }
      
      if (theme.gridSize !== undefined) {
        this.graph.setGridSize(theme.gridSize);
      }
      
      // Apply background color if specified
      if (theme.backgroundColor && this.container) {
        this.container.style.backgroundColor = theme.backgroundColor;
      }
      
      // Refresh the graph to apply new styles to existing elements
      this.graph.refresh();
      
      this.logger.info('Theme applied successfully');
    } catch (error) {
      this.logger.error('Error applying theme', error);
    }
  }
  
  /**
   * Helper function to patch the CellRenderer methods where errors are occurring
   */
  private patchCellRendererMethods(): void {
    try {
      // First try to find the CellRenderer through various paths
      let CellRenderer: any = null;
      
      if (CellRenderer) {
        // Use the imported CellRenderer
        this.logger.debug('Using imported CellRenderer');
      } else if (mxgraph.CellRenderer) {
        CellRenderer = mxgraph.CellRenderer;
        this.logger.debug('Found CellRenderer via mxgraph.CellRenderer');
      } else if (this.graph && this.graph.cellRenderer && this.graph.cellRenderer.constructor) {
        CellRenderer = this.graph.cellRenderer.constructor;
        this.logger.debug('Found CellRenderer via graph.cellRenderer.constructor');
      }
      
      // Patch CellState clone method to fix TypeError: p.clone is not a function
      if (mxgraph.CellState) {
        // Add clone method to CellState prototype if it's missing or broken
        const CellStateProto = mxgraph.CellState.prototype;
        if (CellStateProto) {
          // Store direct reference to original method to avoid infinite recursion
          const originalCloneMethod = CellStateProto.clone;
          
          // Save a reference to this for logger access
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const self = this;
          
          // Replace the prototype method with our own implementation
          CellStateProto.clone = function(this: any) {
            try {
              if (typeof originalCloneMethod === 'function') {
                return originalCloneMethod.call(this);
              } else {
                // Create a basic clone with essential properties
                const clone = new mxgraph.CellState(this.view, this.cell, this.style);
                clone.x = this.x;
                clone.y = this.y;
                clone.width = this.width;
                clone.height = this.height;
                clone.style = this.style;
                
                // Add a safe copy of points if available
                if (this.absolutePoints) {
                  clone.absolutePoints = [];
                  for (let i = 0; i < this.absolutePoints.length; i++) {
                    const point = this.absolutePoints[i];
                    if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                      if (point.clone) {
                        clone.absolutePoints.push(point.clone());
                      } else {
                        // Create a point with clone method
                        const newPoint = new mxgraph.Point(point.x, point.y);
                        if (!newPoint.clone) {
                          newPoint.clone = function() {
                            return new mxgraph.Point(this.x, this.y);
                          };
                        }
                        clone.absolutePoints.push(newPoint);
                      }
                    }
                  }
                }
                return clone;
              }
            } catch (error) {
              self.logger.error('Error in CellState.clone, using fallback:', error);
              // Create a minimal clone with basic properties
              const clone = new mxgraph.CellState(this.view, this.cell, this.style);
              return clone;
            }
          };
          this.logger.info('Successfully patched CellState.clone method');
        }
      }
      
      if (CellRenderer) {
        // Patch the isShapeInvalid method that's causing errors
        if (CellRenderer.prototype && CellRenderer.prototype.isShapeInvalid) {
          const originalIsShapeInvalid = CellRenderer.prototype.isShapeInvalid;
          
          CellRenderer.prototype.isShapeInvalid = function(state: any, shape: any): boolean {
            try {
              // Ensure state and view exist to avoid errors in the original method
              if (!(state && state.view)) {
                return true; // Shape is invalid if state or view is missing
              }
              
              // If shape has points, ensure every point has an equals method to avoid errors
              if (shape && shape.points && Array.isArray(shape.points)) {
                for (let i = 0; i < shape.points.length; i++) {
                  const p = shape.points[i];
                  if (p && !p.equals) {
                    p.equals = function(other: any): boolean {
                      if (!other) return false;
                      if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
                      return this.x === other.x && this.y === other.y;
                    };
                  }
                  // Also add clone method to each point
                  if (p && !p.clone) {
                    p.clone = function() {
                      return {x: this.x, y: this.y, equals: this.equals, clone: this.clone};
                    };
                  }
                }
              }
              
              // Call original method with our safer objects
              return originalIsShapeInvalid.call(this, state, shape);
            } catch (error) {
              // If an error occurs, return true as a safe default (will cause redraw)
              console.error('Error in patched isShapeInvalid:', error);
              return true;
            }
          };
          
          this.logger.info('Successfully patched CellRenderer.isShapeInvalid method');
        } else {
          this.logger.warn('Could not find CellRenderer.prototype.isShapeInvalid method to patch');
        }
        
        // Also patch redrawShape method which might invoke the isShapeInvalid method
        if (CellRenderer.prototype && CellRenderer.prototype.redrawShape) {
          const originalRedrawShape = CellRenderer.prototype.redrawShape;
          
          CellRenderer.prototype.redrawShape = function(state: any, force: boolean): boolean {
            try {
              return originalRedrawShape.call(this, state, force);
            } catch (error) {
              console.error('Error in CellRenderer.redrawShape:', error);
              // Return false as a safe default (was not redrawn)
              return false;
            }
          };
          
          this.logger.info('Successfully patched CellRenderer.redrawShape method');
        }
      } else {
        this.logger.warn('Could not find CellRenderer to patch');
      }
    } catch (error) {
      this.logger.error('Error patching CellRenderer methods', error);
    }
  }
  
  /**
   * Helper function to provide safer point comparison functions and patches for maxGraph
   */
  private patchEqualPointsMethod(): void {
    try {
      // We can't directly override the imported function, so we'll define our own helper methods
      // Define a safe equal points function for use in our own code
      this.safeEqualPoints = (points1: any[], points2: any[]): boolean => {
        if (points1 === points2) {
          return true;
        }
        
        if (!points1 || !points2 || points1.length !== points2.length) {
          return false;
        }
        
        for (let i = 0; i < points1.length; i++) {
          const p1 = points1[i];
          const p2 = points2[i];
          
          // Handle null/undefined values
          if (!p1 && !p2) {
            continue;
          }
          
          if (!p1 || !p2) {
            return false;
          }
          
          // Safe coordinate comparison
          const x1 = typeof p1.x === 'number' ? p1.x : 0;
          const y1 = typeof p1.y === 'number' ? p1.y : 0;
          const x2 = typeof p2.x === 'number' ? p2.x : 0;
          const y2 = typeof p2.y === 'number' ? p2.y : 0;
          
          if (x1 !== x2 || y1 !== y2) {
            return false;
          }
        }
        
        return true;
      };
      
      // Patch Point prototype to ensure clone method exists
      if (mxgraph.Point && mxgraph.Point.prototype) {
        if (!mxgraph.Point.prototype.clone) {
          mxgraph.Point.prototype.clone = function() {
            return new mxgraph.Point(this.x, this.y);
          };
          this.logger.info('Added missing clone method to Point prototype');
        }
      }
      
      // Try to patch the global mx object if used by maxGraph internally
      if ((window as any).mx && (window as any).mx.mxPoint && (window as any).mx.mxPoint.prototype) {
        if (!(window as any).mx.mxPoint.prototype.clone) {
          (window as any).mx.mxPoint.prototype.clone = function() {
            return new (window as any).mx.mxPoint(this.x, this.y);
          };
          this.logger.info('Added missing clone method to global mxPoint prototype');
        }
      }
      
      this.logger.info('Patched Point-related methods successfully');
    } catch (error) {
      this.logger.error('Error patching equalPoints and Point methods', error);
    }
  }
  
  /**
   * Initialize maxGraph with a container element
   */
  initialize(container: HTMLElement): void {
    this.logger.info('Initializing maxGraph');
    this.container = container;
    
    // Log the configured paths for debugging
    this.logger.info(`maxGraph paths configured as:
      Client.basePath: ${Client.basePath}
      Client.imageBasePath: ${Client.imageBasePath}
      mxBasePath: ${(window as any).mxBasePath}
      mxImageBasePath: ${(window as any).mxImageBasePath}
      mxGraphPath: ${(window as any).mxGraphPath}
    `);
    
    // Verify that Client paths are correctly set
    this.logger.debug('Verifying point.gif path should be:', `${Client.imageBasePath}/point.gif`);
    
    // Apply a global image path fix for all resources before initializing the graph
    this.applyImagePathFixes();
    
    // Wait for the theme to load before initializing the graph
    this.loadTheme(this._currentThemeId).then(theme => {
      try {
        // Run outside Angular zone for better performance
        this.ngZone.runOutsideAngular(() => {
          // Create graph instance
          this.graph = new mxgraph.Graph(container);
          
          if (!this.graph) {
            throw new Error('Failed to create maxGraph instance');
          }
          
          // Apply patches to problematic maxGraph methods
          this.patchEqualPointsMethod();
          
          // Patch CellRenderer methods that are causing errors
          this.patchCellRendererMethods();
          
          // Store the model reference
          this.model = this.graph.model;
          
          // Apply the theme
          this.applyTheme(theme);
          
          // Apply non-theme configuration
          this.configureNonThemeSettings();
          
          // Set up event handlers
          this.setupEventHandlers();
          
          this._isInitialized.next(true);
          this.logger.info('maxGraph initialized successfully with theme');
        });
      } catch (error) {
        this.logger.error('Failed to initialize maxGraph', error);
        this._isInitialized.next(false);
      }
    }).catch(error => {
      this.logger.error('Failed to load theme for initialization', error);
      // Try to initialize without a theme as a fallback
      try {
        this.ngZone.runOutsideAngular(() => {
          this.graph = new mxgraph.Graph(container);
          if (!this.graph) {
            throw new Error('Failed to create maxGraph instance');
          }
          
          this.patchEqualPointsMethod();
          this.patchCellRendererMethods();
          this.model = this.graph.model;
          
          // Fall back to standard configuration
          this.configureGraph();
          
          this.setupEventHandlers();
          
          this._isInitialized.next(true);
          this.logger.info('maxGraph initialized successfully with fallback configuration');
        });
      } catch (fallbackError) {
        this.logger.error('Failed to initialize maxGraph even with fallback', fallbackError);
        this._isInitialized.next(false);
      }
    });
  }
  
  /**
   * Configure the graph instance (legacy method kept for fallback)
   */
  private configureGraph(): void {
    if (!this.graph) {
      this.logger.error('Cannot configure graph: Graph not initialized');
      return;
    }
    
    // Grid settings
    this.graph.setGridEnabled(true);
    this.graph.setGridSize(10);
    
    // Enable panning
    this.graph.setPanning(true);
    
    // Configure visual appearance
    const style = this.graph.getStylesheet().getDefaultVertexStyle();
    style['fillColor'] = '#ffffff';
    style['strokeColor'] = '#1565c0';
    style['rounded'] = true;
    style['shadow'] = true;
    
    const edgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
    edgeStyle['strokeColor'] = '#78909c';
    edgeStyle['edgeStyle'] = 'orthogonalEdgeStyle';
    edgeStyle['shadow'] = true;
    edgeStyle['rounded'] = true;
    
    // Define a selected style for highlighting vertices
    const highlightedStyle: Record<string, any> = {};
    Object.assign(highlightedStyle, style);
    highlightedStyle['strokeColor'] = '#ff0000';
    highlightedStyle['strokeWidth'] = 3;
    this.graph.getStylesheet().putCellStyle('highlighted', highlightedStyle);
    
    // Define edge creation mode style
    const edgeCreationStyle: Record<string, any> = {};
    Object.assign(edgeCreationStyle, style);
    edgeCreationStyle['strokeColor'] = '#4caf50';
    edgeCreationStyle['strokeWidth'] = 2;
    edgeCreationStyle['fillColor'] = '#e8f5e9';
    this.graph.getStylesheet().putCellStyle('edgeCreation', edgeCreationStyle);
    
    // Enable connection points
    this.graph.setConnectable(true);
    this.graph.setAllowDanglingEdges(false);
    
    // Set default edge style with better connection handling
    const defaultEdgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
    defaultEdgeStyle['edgeStyle'] = 'orthogonalEdgeStyle';
    defaultEdgeStyle['rounded'] = true;
    defaultEdgeStyle['jettySize'] = 'auto';
    defaultEdgeStyle['orthogonalLoop'] = 1;
    
    // Initialize core maxGraph components that are needed 
    this.initializeMaxGraphComponents();
    
    // Instead of direct setup, defer until the components are ready
    setTimeout(() => {
      // Setup connection point handling with a delay to ensure all components are ready
      this.setupConnectionPointHandling();
    }, 500);
    
    this.logger.debug('Graph instance configured');
  }
  
  /**
   * Configure non-theme related graph settings
   */
  private configureNonThemeSettings(): void {
    if (!this.graph) {
      this.logger.error('Cannot configure non-theme settings: Graph not initialized');
      return;
    }
    
    // Enable panning
    this.graph.setPanning(true);
    
    // Enable connection points
    this.graph.setConnectable(true);
    this.graph.setAllowDanglingEdges(false);
    
    // Initialize core maxGraph components that are needed 
    this.initializeMaxGraphComponents();
    
    // Instead of direct setup, defer until the components are ready
    setTimeout(() => {
      // Setup connection point handling with a delay to ensure all components are ready
      this.setupConnectionPointHandling();
    }, 500);
    
    this.logger.debug('Non-theme graph settings configured');
  }
  
  /**
   * Initialize core maxGraph components that might not be ready immediately
   */
  private initializeMaxGraphComponents(): void {
    try {
      // Create/initialize the connection handler if needed
      if (!this.graph.connectionHandler) {
        this.logger.debug('Initializing connection handler');
        try {
          // Try to access ConnectionHandler through proper channels
          if (typeof this.graph.getConnectionHandler === 'function') {
            // Try using a factory method if available
            this.graph.connectionHandler = this.graph.getConnectionHandler();
            this.logger.info('Created connection handler using factory method');
          } else {
            // Try multiple ways to access the ConnectionHandler constructor
            let ConnectionHandlerClass = null;
            
            // Method 1: Try to access via graph's prototype chain
            try {
              // Accessing internal maxGraph properties
              ConnectionHandlerClass = Object.getPrototypeOf(this.graph).constructor.ConnectionHandler;
              if (ConnectionHandlerClass) {
                this.logger.debug('Found ConnectionHandler via graph prototype');
              }
            } catch (err) {
              this.logger.debug('Could not find ConnectionHandler via graph prototype', err);
            }
            
            // Method 2: Try to access via mxgraph namespace
            if (!ConnectionHandlerClass && mxgraph) {
              try {
                // Accessing internal maxGraph properties
                ConnectionHandlerClass = mxgraph.ConnectionHandler;
                if (ConnectionHandlerClass) {
                  this.logger.debug('Found ConnectionHandler via mxgraph namespace');
                }
                
                // Also check if we need to patch Point class for equals method
                if (mxgraph.Point && !mxgraph.Point.prototype.equals) {
                  // Add equals method to Point prototype to avoid p.equals is not a function errors
                  this.logger.debug('Adding equals method to Point prototype');
                  mxgraph.Point.prototype.equals = function(other: any): boolean {
                    if (!other) return false;
                    if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
                    return this.x === other.x && this.y === other.y;
                  };
                }
              } catch (err) {
                this.logger.debug('Could not find ConnectionHandler via mxgraph namespace', err);
              }
            }
            
            // Method 3: Try to access via the window object
            if (!ConnectionHandlerClass) {
              try {
                // Accessing internal maxGraph properties
                // Don't rely on global window namespace for maxGraph
                ConnectionHandlerClass = null;
                if (ConnectionHandlerClass) {
                  this.logger.debug('Found ConnectionHandler via window object');
                }
              } catch (err) {
                this.logger.debug('Could not find ConnectionHandler via window object', err);
              }
            }
            
            // Use the ConnectionHandler if found
            if (ConnectionHandlerClass) {
              this.graph.connectionHandler = new ConnectionHandlerClass(this.graph);
              this.logger.info('Created connection handler successfully');
            } else {
              // We couldn't find the class through any method
              throw new Error('Could not find ConnectionHandler class');
            }
          }
        } catch (error) {
          this.logger.warn('Failed to create connection handler, will retry later', error);
          // Use our safe connection handler implementation
          this.graph.connectionHandler = this.createSafeConnectionHandler();
          this.logger.info('Created safe connection handler to prevent errors');
        }
      }
      
      // Override getConnectionPoint method to prevent "Invalid x" errors
      try {
        // Override with a safer version (original method not used - direct implementation for safety)
        this.graph.getConnectionPoint = (state: any, constraint: any) => {
          try {
            // Safety checks for constraint
            if (!constraint || !constraint.point || 
                typeof constraint.point.x !== 'number' || 
                typeof constraint.point.y !== 'number' ||
                isNaN(constraint.point.x) || isNaN(constraint.point.y)) {
              
              // Return center of cell as fallback
              if (state && state.getCenterX && state.getCenterY) {
                // Accessing internal maxGraph properties
                const Point = Object.getPrototypeOf(this.graph).constructor.Point;
                if (Point) {
                  return new Point(state.getCenterX(), state.getCenterY());
                } else {
                  return { x: state.getCenterX(), y: state.getCenterY() };
                }
              }
              return null;
            }
            
            // Verify state is valid
            if (!state || !state.x || !state.y || !state.width || !state.height) {
              return null;
            }
            
            // Safe calculation of point coordinates
            const x = state.x + state.width * constraint.point.x;
            const y = state.y + state.height * constraint.point.y;
            
            // Validate calculated values
            if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
              return null;
            }
            
            // Accessing internal maxGraph properties
            const Point = Object.getPrototypeOf(this.graph).constructor.Point;
            
            // Create point using safe values
            if (Point) {
              const point = new Point(x, y);
              // Add equals method if it doesn't exist to avoid p.equals is not a function errors
              if (!point.equals) {
                point.equals = function(other: any): boolean {
                  if (!other) return false;
                  if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
                  return this.x === other.x && this.y === other.y;
                };
              }
              return point;
            } else {
              // Create a point-like object with equals method built in
              return {
                x, 
                y,
                equals: function(other: any): boolean {
                  if (!other) return false;
                  if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
                  return this.x === other.x && this.y === other.y;
                }
              };
            }
          } catch (error) {
            console.error('Error in getConnectionPoint:', error);
            return null;
          }
        };
        
        this.logger.info('Successfully overrode getConnectionPoint method to prevent errors');
      } catch (error) {
        this.logger.error('Error overriding getConnectionPoint method', error);
      }
      
      // Define connection constraints (anchor points) - this doesn't need the handler
      try {
        // Access Graph prototype properly
        const graphProto = Object.getPrototypeOf(this.graph);
        if (graphProto) {
          graphProto.getAllConnectionConstraints = (terminal: any) => {
            if (terminal && this.isVertex(terminal.cell)) {
              // Return constraints for all anchor positions
              return Object.entries(this.anchorPositionMap).map(([position, coords]) => {
                // Use Point and ConnectionConstraint from the same context as the graph
                // Accessing internal maxGraph properties
                const Point = Object.getPrototypeOf(this.graph).constructor.Point;
                // Accessing internal maxGraph properties
                const ConnectionConstraint = Object.getPrototypeOf(this.graph).constructor.ConnectionConstraint;
                
                if (Point && ConnectionConstraint) {
                  return new ConnectionConstraint(
                    new Point(coords.x, coords.y),
                    true,
                    null,
                    position as unknown as number
                  );
                }
                
                // Return a simple object if we can't create proper classes
                return {
                  point: { x: coords.x, y: coords.y },
                  perimeter: true,
                  name: position
                };
              });
            }
            return null;
          };
          this.logger.info('Successfully set up connection constraints');
        }
      } catch (error) {
        this.logger.error('Error setting up connection constraints', error);
      }
      
      // Initialize other maxGraph components if needed (for future expansion)
      
    } catch (error) {
      this.logger.error('Error initializing maxGraph components', error);
    }
  }
  
  /**
   * Set up graph event handlers
   */
  private setupEventHandlers(): void {
    if (!this.graph) {
      this.logger.error('Cannot set up event handlers: Graph not initialized');
      return;
    }
    
    // Use a more direct approach for cell click handling
    // This avoids the issue with mouseMove not being a function
    this.graph.addListener('click', (sender: any, evt: any) => {
      try {
        const cell = evt.getProperty('cell');
        this.logger.debug('Click event received from graph', {
          hasCell: Boolean(cell),
          eventType: evt.name,
          eventSource: evt.source ? evt.source.toString() : 'unknown'
        });
        
        if (cell) {
          // Run inside Angular zone to update UI
          this.ngZone.run(() => {
            this.handleCellClick(cell);
          });
        } else {
          this.logger.debug('Click was not on a cell');
          // Clicked on the background - deselect any selected cells
          this.ngZone.run(() => {
            // Clear the graph selection
            if (this.graph) {
              this.logger.info('Clearing graph selection due to background click');
              this.graph.clearSelection();
            }
            
            // Explicitly emit null selection
            this.logger.info('Manually emitting null selection due to background click');
            this.emitSelectionChanged(null);
          });
        }
      } catch (error) {
        this.logger.error('Error handling click event', error);
      }
    });
    
    // Add selection change listener
    this.graph.getSelectionModel().addListener('changed', (_sender: any, _evt: any) => {
      try {
        // Get the current selection
        const cells = this.graph.getSelectionModel().cells;
        const cellsArray = Object.values(cells || {});
        
        this.logger.info(`Selection changed: ${cellsArray.length} cells selected`);
        
        // Dump detailed information about selected cells for debugging
        if (cellsArray.length > 0) {
          cellsArray.forEach((cell: any, index) => {
            this.logger.info(`Selected cell ${index}: id=${cell.id}, vertex=${this.isVertex(cell)}, edge=${this.isEdge(cell)}`);
          });
        }
        
        // Run inside Angular zone to update UI
        this.ngZone.run(() => {
          if (cellsArray.length > 0) {
            const selectedCell = cellsArray[0] as any; // Just handle the first selected cell for now
            const cellId = selectedCell.id;
            const cellType = this.isVertex(selectedCell) ? 'vertex' : this.isEdge(selectedCell) ? 'edge' : 'unknown';
            
            this.logger.info(`Processing selection: cellId=${cellId}, cellType=${cellType}`);
            
            if (cellType !== 'unknown') {
              this.emitSelectionChanged({ cellId, cellType: cellType });
            } else {
              this.logger.warn(`Unknown cell type in selection: ${cellId}`);
              this.emitSelectionChanged(null);
            }
          } else {
            this.logger.info('No cells selected, clearing selection state');
            this.emitSelectionChanged(null);
          }
        });
      } catch (error) {
        this.logger.error('Error handling selection change event', error);
      }
    });
    
    // Complete mouse listener implementation with all required methods
    const mouseListener = {
      mouseDown: (_sender: any, me: any) => {
        this.logger.debug('Mouse down on graph', {
          x: me.graphX,
          y: me.graphY,
          event: me.getEvent().type
        });
      },
      mouseMove: (_sender: any, _me: any) => {
        // Empty implementation to avoid "is not a function" error
      },
      mouseUp: (_sender: any, _me: any) => {
        // Empty implementation to avoid "is not a function" error
      }
    };
    
    // Add the complete mouse listener
    this.graph.addMouseListener(mouseListener);
    
    this.logger.debug('Graph event handlers set up');
  }
  
  /**
   * Emit a selection changed event
   */
  emitSelectionChanged(selection: { cellId: string; cellType: 'vertex' | 'edge' } | null): void {
    this._cellSelected.next(selection);
    this.logger.debug(`Selection changed: ${selection ? `${selection.cellType} ${selection.cellId}` : 'none'}`);
  }
  
  /**
   * Handle cell click events
   */
  /**
   * Helper method to check if a cell is a vertex
   */
  private isVertex(cell: any): boolean {
    if (!cell) return false;
    
    // Try multiple ways to detect if a cell is a vertex
    return cell.vertex === 1 || 
           cell.getAttribute?.('vertex') === 1 || 
           (cell.style && typeof cell.style === 'string' && cell.style.includes('shape')) || 
           Boolean(cell.geometry && 
                  typeof cell.geometry.width === 'number' && 
                  typeof cell.geometry.height === 'number');
  }
  
  /**
   * Helper method to check if a cell is an edge
   */
  private isEdge(cell: any): boolean {
    if (!cell) return false;
    
    // Try multiple ways to detect if a cell is an edge
    return cell.edge === 1 || 
           cell.getAttribute?.('edge') === 1 || 
           (cell.style && typeof cell.style === 'string' && cell.style.includes('edgeStyle')) || 
           Boolean(cell.source && cell.target);
  }
  
  private handleCellClick(cell: any): void {
    if (!cell) return;
    
    try {
      const cellId = cell.id;
      
      // Validate cellId exists
      if (!cellId) {
        this.logger.warn('Cell has no ID, cannot process click');
        return;
      }
      
      // Log cell properties for debugging - with safe property access
      this.logger.debug('Cell properties:', {
        id: cell.id,
        vertex: cell.vertex,
        edge: cell.edge,
        value: cell.value,
        style: cell.style,
        geometry: cell.geometry ? { 
          width: cell.geometry.width,
          height: cell.geometry.height,
          x: cell.geometry.x,
          y: cell.geometry.y
        } : null,
        source: cell.source ? cell.source.id : null,
        target: cell.target ? cell.target.id : null
      });
      
      // Determine cell type using helper methods with extra safety
      const isVertex = this.isVertex(cell);
      const isEdge = this.isEdge(cell);
      
      if (!isVertex && !isEdge) {
        this.logger.warn(`Cell ${cellId} is neither vertex nor edge, skipping click handling`);
        return;
      }
      
      this.logger.info(`Cell clicked: ${cellId} (${isVertex ? 'vertex' : isEdge ? 'edge' : 'unknown'})`);
      
      // Look up if there's a component associated with this cell
      const component = this.diagramService.findComponentByCellId(cellId);
      
      if (component) {
        this.logger.debug(`Found component with ID ${component.id} for cell ${cellId}`);
      } else {
        this.logger.debug(`No component found for cell ${cellId}`);
      }
      
      // Select this cell in the graph and force a selection change notification
      if (this.graph) {
        try {
          this.logger.info(`Selecting cell ${cellId} in graph`);
          this.graph.setSelectionCell(cell);
          
          // Explicitly emit the selection change since the event might not fire
          const cellType = isVertex ? 'vertex' : isEdge ? 'edge' : 'unknown';
          if (cellType !== 'unknown') {
            this.logger.info(`Manually emitting selection for cell ${cellId}`);
            this.emitSelectionChanged({ cellId, cellType: cellType });
          }
        } catch (err) {
          this.logger.error(`Error selecting cell ${cellId}`, err);
          // Continue with event emission even if selection fails
        }
      }
      
      // Emit cell click event for component to handle - with safe type checking
      if (isVertex) {
        this._cellClicked.next({
          cellId,
          cellType: 'vertex',
          cell
        });
        this.logger.info(`Emitted vertex click event for cell ${cellId}`);
      } else if (isEdge) {
        this._cellClicked.next({
          cellId,
          cellType: 'edge',
          cell
        });
        this.logger.info(`Emitted edge click event for cell ${cellId}`);
      } else {
        this.logger.warn(`Cell type not recognized for ${cellId}, not emitting event`);
      }
    } catch (error) {
      this.logger.error('Error handling cell click', error);
    }
  }
  
  /**
   * Handle graph change events
   */
  private handleGraphChange(): void {
    // TODO: Sync changes to diagram model
    this.logger.debug('Graph changed');
  }
  
  /**
   * Update the rendered diagram based on the model
   */
  updateDiagram(): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot update diagram: Graph not initialized');
      return;
    }
    
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram) {
      this.logger.warn('No diagram to render');
      return;
    }
    
    try {
      // Begin graph update
      this.model.beginUpdate();
      
      try {
        // Clear existing graph
        const cells = this.graph.getChildVertices(this.graph.getDefaultParent());
        this.graph.removeCells(cells);
        
        // Add components to graph
        this.renderDiagramComponents(diagram.components);
        
        this.logger.info(`Diagram updated: ${diagram.name} (${diagram.components.length} components)`);
      } finally {
        // End graph update (applies layout)
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error updating diagram', error);
    }
  }
  
  /**
   * Render diagram components to the graph
   */
  private renderDiagramComponents(components: DiagramComponent[]): void {
    if (!this.graph) {
      this.logger.error('Cannot render components: Graph not initialized');
      return;
    }
    
    const parent = this.graph.getDefaultParent();
    
    // Log how many components we're rendering
    this.logger.debug(`Rendering ${components.length} diagram components`);
    
    // Track the cells we create for each component
    const vertexComponents: DiagramComponent[] = [];
    const edgeComponents: DiagramComponent[] = [];
    // Track cell IDs to update component model in a single operation later
    const componentIdToCellId: Map<string, string> = new Map();
    
    // First pass: Create all vertices
    for (const component of components) {
      if (component.type === 'vertex') {
        const { x, y, width, height, label, style } = component.data;
        
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        // Insert the vertex (unused variable)
        this.graph.insertVertex(
          parent,
          cellId, // Use UUID for cell ID
          label || '',
          x || 0,
          y || 0,
          width || 100,
          height || 40,
          style || 'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // Store the mapping for later batch updating
        componentIdToCellId.set(component.id, cellId);
        
        // Add to vertices list for debugging
        vertexComponents.push(component);
        this.logger.debug(`Rendered vertex: component=${component.id}, cell=${cellId}`);
      } else if (component.type === 'edge') {
        // Collect edges for second pass
        edgeComponents.push(component);
      }
    }
    
    // Second pass: Create all edges
    let edgesRendered = 0;
    let edgesSkipped = 0;
    
    for (const component of edgeComponents) {
      const { source, target, label, style, sourceAnchor = 'C', targetAnchor = 'C' } = component.data;
      
      // Find the source and target components
      const sourceComponent = components.find(c => c.id === source);
      const targetComponent = components.find(c => c.id === target);
      
      if (!sourceComponent || !targetComponent) {
        this.logger.warn(`Could not create edge ${component.id}: missing source or target component`);
        edgesSkipped++;
        continue;
      }
      
      // Get the cell IDs from our mapping
      const sourceCellId = componentIdToCellId.get(sourceComponent.id) || sourceComponent.cellId;
      const targetCellId = componentIdToCellId.get(targetComponent.id) || targetComponent.cellId;
      
      if (!sourceCellId || !targetCellId) {
        this.logger.warn(`Could not create edge ${component.id}: missing source or target cell ID`);
        edgesSkipped++;
        continue;
      }
      
      const sourceCell = this.getCellById(sourceCellId);
      const targetCell = this.getCellById(targetCellId);
      
      if (sourceCell && targetCell) {
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          cellId, // Use UUID for cell ID
          label || '',
          sourceCell,
          targetCell,
          style || 'edgeStyle=orthogonalEdgeStyle;rounded=1;'
        );
        
        // Set the connection points for source and target
        this.setEdgeTerminalPoint(edge, sourceAnchor as AnchorPointPosition, true);  // Source
        this.setEdgeTerminalPoint(edge, targetAnchor as AnchorPointPosition, false); // Target
        
        // Store the mapping for later batch updating
        componentIdToCellId.set(component.id, cellId);
        
        this.logger.debug(`Rendered edge: component=${component.id}, cell=${cellId}, source=${source}, target=${target}`);
        edgesRendered++;
      } else {
        this.logger.warn(`Could not create edge ${component.id}: missing source (${source}) or target (${target}) cell`);
        this.logger.debug(`Source cell found: ${Boolean(sourceCell)}, Target cell found: ${Boolean(targetCell)}`);
        edgesSkipped++;
      }
    }
    
    // After all cells are created, update component references in a batch to avoid circular updates
    this.batchUpdateComponentCellIds(componentIdToCellId);
    
    // Log rendering summary
    this.logger.debug(`Rendering summary: ${vertexComponents.length} vertices, ${edgesRendered} edges rendered, ${edgesSkipped} edges skipped`);
  }
  
  /**
   * Batch update component cell IDs without triggering circular updates
   */
  private batchUpdateComponentCellIds(componentIdToCellId: Map<string, string>): void {
    const updateOperations = [];
    
    for (const [componentId, cellId] of componentIdToCellId.entries()) {
      // Create update operation for each component
      const operation = {
        componentId,
        changes: { cellId }
      };
      updateOperations.push(operation);
    }
    
    if (updateOperations.length > 0) {
      // Tell the diagram service to update components without triggering re-renders
      this.diagramService.bulkUpdateComponentsWithoutRender(updateOperations);
      this.logger.debug(`Batch updated ${updateOperations.length} component cell IDs`);
    }
  }
  
  /**
   * Get a cell by ID
   * @param cellId The ID of the cell to retrieve
   * @returns The maxGraph cell or null if not found
   */
  getCellById(cellId?: string): any {
    if (!cellId || !this.graph) return null;
    
    // Get all cells from the graph
    const allCells = this.graph.getChildCells(this.graph.getDefaultParent());
    
    // Find the cell with the matching ID
    for (const cell of allCells) {
      if (cell.id === cellId) {
        return cell;
      }
    }
    
    return null;
  }
  
  /**
   * Get the current graph instance
   */
  getGraph(): any {
    return this.graph;
  }
  
  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    return this._isInitialized.getValue();
  }
  
  /**
   * Initialize renderer and return a promise that resolves when ready
   */
  initializeRenderer(): Promise<boolean> {
    // Return existing promise if available
    if (this._initializationPromise) {
      return this._initializationPromise;
    }
    
    // If already initialized, resolve immediately
    if (this.isInitialized()) {
      return Promise.resolve(true);
    }
    
    // Create a new promise for initialization
    this._initializationPromise = new Promise<boolean>((resolve) => {
      // If already initialized, resolve immediately
      if (this.isInitialized()) {
        resolve(true);
        return;
      }
      
      // Subscribe to initialization state
      const subscription = this.isInitialized$.subscribe(initialized => {
        if (initialized) {
          subscription.unsubscribe();
          resolve(true);
        }
      });
    });
    
    return this._initializationPromise;
  }
  
  /**
   * Wait for graph stabilization with configurable delays
   */
  waitForStabilization(initialDelay: number = 2000, stabilizationDelay: number = 1500): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.logger.info('Initial renderer delay completed, waiting for full stabilization');
        setTimeout(() => {
          this.logger.info('Full graph stabilization completed');
          resolve();
        }, stabilizationDelay);
      }, initialDelay);
    });
  }
  
  /**
   * Set edge creation mode
   */
  setEdgeCreationMode(active: boolean): void {
    this._edgeCreationMode = active;
    this.logger.debug(`Edge creation mode: ${active ? 'active' : 'inactive'}`);
    
    // Optionally update cursor or other visual indicators
    if (this.container) {
      this.container.style.cursor = active ? 'crosshair' : 'default';
    }
  }
  
  /**
   * Setup connection point handling
   */
  private setupConnectionPointHandling(): void {
    if (!this.graph) {
      this.logger.error('Cannot setup connection points: Graph not initialized');
      return;
    }
    
    // We'll move this to a class method to avoid the unused warning and make it reusable
    
    try {
      // Check if connectionHandler is properly created
      if (!this.graph.connectionHandler) {
        this.logger.warn('Connection handler not available yet, creating it');
        
        try {
          // Try accessing ConnectionHandler through the graph as it already has access to mxgraph
          if (typeof this.graph.getConnectionHandler === 'function') {
            // Try using a factory method if available
            this.graph.connectionHandler = this.graph.getConnectionHandler();
            this.logger.info('Created connection handler using factory method');
          } else {
            // Extract ConnectionHandler from mxgraph
            // Accessing internal maxGraph properties
            const ConnectionHandlerClass = mxgraph.ConnectionHandler || 
              // Try to get it from the graph constructor as a fallback
              (Object.getPrototypeOf(this.graph).constructor.ConnectionHandler);
            
            if (ConnectionHandlerClass) {
              // Accessing internal maxGraph properties
              this.graph.connectionHandler = new ConnectionHandlerClass(this.graph);
              this.logger.info('Created connection handler from class');
            } else {
              throw new Error('ConnectionHandler class not found');
            }
          }
        } catch (error) {
          this.logger.error('Failed to create full connection handler, using safe implementation', error);
          // Set a safe implementation
          this.graph.connectionHandler = this.createSafeConnectionHandler();
        }
      }
      
      // Make sure the connection handler has required sub-handlers
      if (this.graph.connectionHandler && !this.graph.connectionHandler.constraintHandler) {
        this.logger.debug('Creating constraint handler');
        try {
          // Try to get ConstraintHandler through proper channels (via graph prototype)
          // Accessing internal maxGraph properties
          const ConstraintHandlerClass = Object.getPrototypeOf(this.graph).constructor.ConstraintHandler;
          
          if (ConstraintHandlerClass) {
            // Create using proper constructor
            this.graph.connectionHandler.constraintHandler = new ConstraintHandlerClass(this.graph);
            
            // Immediately override the problematic methods
            this.overrideConstraintHandlerMethods(this.graph.connectionHandler.constraintHandler);
            
            this.logger.info('Created constraint handler using constructor from prototype');
          } else {
            // Try to create directly from graph if available
            if (typeof this.graph.createConstraintHandler === 'function') {
              this.graph.connectionHandler.constraintHandler = this.graph.createConstraintHandler();
              
              // Override methods on this instance too
              this.overrideConstraintHandlerMethods(this.graph.connectionHandler.constraintHandler);
              
              this.logger.info('Created constraint handler using factory method');
            } else {
              throw new Error('Could not find ConstraintHandler class');
            }
          }
        } catch (error) {
          this.logger.debug('Could not create ConstraintHandler, using alternative approach', error);
          // Create a minimal implementation rather than failing
          this.graph.connectionHandler.constraintHandler = this.createSafeConstraintHandler();
          this.logger.info('Created minimal constraint handler implementation');
        }
      } else if (this.graph.connectionHandler && this.graph.connectionHandler.constraintHandler) {
        // If the constraint handler already exists, still override its methods
        this.overrideConstraintHandlerMethods(this.graph.connectionHandler.constraintHandler);
        this.logger.info('Overrode methods on existing constraint handler');
      }
      
      // Fix for the specific "currentPoint.clone is not a function" error
      if (this.graph.connectionHandler) {
        // Add direct fix for mouseMove method
        if (typeof this.graph.connectionHandler.mouseMove === 'function') {
          const originalMouseMove = this.graph.connectionHandler.mouseMove;
          
          this.graph.connectionHandler.mouseMove = function(this: any, sender: any, me: any) {
            try {
              // Ensure constraintHandler exists
              if (!this.constraintHandler) {
                return false;
              }
              
              // If the constraintHandler is missing currentPoint, add it directly
              if (!this.constraintHandler.currentPoint) {
                // Create a well-typed point object with clone method
                const safePoint: Record<string, unknown> = {
                  x: 0, 
                  y: 0, 
                  clone: function(): Record<string, unknown> { 
                    return { 
                      x: (this)['x'] as number, 
                      y: (this)['y'] as number, 
                      clone: (this)['clone'] 
                    }; 
                  }
                };
                this.constraintHandler.currentPoint = safePoint;
              }
              
              // Ensure the clone method exists
              if (this.constraintHandler.currentPoint) {
                // Direct implementation without using callee/caller which is not allowed in strict mode
                if (!this.constraintHandler.currentPoint.clone) {
                  (this.constraintHandler.currentPoint as Record<string, unknown>)['clone'] = function(): Record<string, unknown> {
                    return { 
                      x: (this)['x'] as number || 0, 
                      y: (this)['y'] as number || 0, 
                      clone: (this)['clone'] 
                    };
                  };
                }
              }
              
              // Call original method with proper this binding
              return originalMouseMove.call(this, sender, me);
            } catch (error) {
              // In strict mode we can't use arguments.callee.caller, so use direct console
              // Log to console but with proper eslint exception
               
              console.error('Error in patched mouseMove:', error);
               
              return false;
            }
          };
          
          this.logger.info('Patched ConnectionHandler.mouseMove method to handle currentPoint safely');
        }
      }
      
      // Set up the customizations
      this.setupConnectionHandlerCustomizations();
      
    } catch (error) {
      this.logger.error('Error setting up connection point handling, will retry', error);
      
      // Retry after a longer delay
      setTimeout(() => {
        this.logger.info('Retrying connection handler setup');
        this.setupRetryConnectionHandling();
      }, 1000);
    }
  }
  
  /**
   * Apply fixes to ensure all maxGraph images are loaded from the correct absolute path
   * This prevents 404 errors when the application is accessed from different routes
   */
  private applyImagePathFixes(): void {
    try {
      const baseUrl = window.location.origin;
      
      // Verify the Client configuration is correct
      this.logger.debug('Current Client settings in applyImagePathFixes:');
      this.logger.debug(`  Client.basePath: ${Client.basePath}`);
      this.logger.debug(`  Client.imageBasePath: ${Client.imageBasePath}`);
      
      // Re-apply Client settings to be absolutely sure they're set
      // This is crucial for ConstraintHandler which uses Client.imageBasePath for point.gif
      Client.setBasePath(`${baseUrl}/assets`);
      Client.setImageBasePath(`${baseUrl}/assets/images`);
      
      // 1. Create a global function to fix image URLs
      (window as any).mxGraphFixImagePath = (path: string): string => {
        if (!path) return path;
        
        // Log when point.gif is being resolved (to debug the issue)
        if (path.includes('point.gif')) {
          this.logger.debug(`Fixing point.gif path: ${path} -> ${baseUrl}/assets/images/point.gif`);
        }
        
        // If it's already an absolute URL, don't modify it
        if (path.startsWith('http') || path.startsWith('//')) {
          return path;
        }
        
        // If it's already an absolute path from root, just add domain
        if (path.startsWith('/')) {
          return `${baseUrl}${path}`;
        }
        
        // Extract filename from path
        const filename = path.split('/').pop();
        
        // Always use the absolute path from domain root
        return `${baseUrl}/assets/images/${filename}`;
      };
      
      // 2. Use an alternate approach to fix markers
      // Since we can't modify imports directly, we'll use a different approach
      // Define a helper that can be used when any marker is created
      (window as any).mxFixMarkerImagePaths = (marker: any) => {
        if (marker && typeof marker === 'object') {
          // If the marker has a createImage method, patch it
          if (typeof marker.createImage === 'function') {
            // Save the original method
            const originalCreateImage = marker.createImage;
            
            // Replace with our fixed version
            marker.createImage = function(imagePath: string) {
              // Fix the path
              const fixedPath = (window as any).mxGraphFixImagePath(imagePath);
              // Call the original
              return originalCreateImage.call(this, fixedPath);
            };
          }
        }
        return marker;
      };
      
      // 3. Define a wrapper for image initialization
      // This will be used when any image instance is created
      (window as any).mxFixImageInit = (imageInstance: any) => {
        if (imageInstance && typeof imageInstance === 'object') {
          // For instances with an init method
          if (typeof imageInstance.init === 'function') {
            const originalInit = imageInstance.init;
            
            // Override the init method
            imageInstance.init = function(imagePath: string) {
              const fixedPath = (window as any).mxGraphFixImagePath(imagePath);
              return originalInit.call(this, fixedPath);
            };
          }
        }
        return imageInstance;
      };
      
      // 4. Fix paths in ConnectionHandler in a type-safe way
      if (mxgraph.ConnectionHandler && mxgraph.ConnectionHandler.prototype) {
        // ConnectionHandler may create markers with point.gif
        // Store direct reference to the original method to avoid recursive calls
        const originalCreateMarkerMethod = mxgraph.ConnectionHandler.prototype.createMarker;
        
        if (typeof originalCreateMarkerMethod === 'function') {
          // TypeScript-safe override using a regular function for 'this' binding
          mxgraph.ConnectionHandler.prototype.createMarker = function(this: any): any {
            // Call the original method to get the marker
            const marker = originalCreateMarkerMethod.call(this);
            
            // Apply our marker path fix helper
            if (marker && typeof marker === 'object') {
              try {
                // Use our helper to fix image paths in this marker
                (window as any).mxFixMarkerImagePaths(marker);
              } catch (error) {
                console.warn('Error fixing marker paths:', error);
              }
            }
            
            return marker;
          };
        }
      }
      
      // 5. Handle point.gif image URL used by ConstraintHandler
      // Instead of trying to modify the imported class (which isn't allowed),
      // we'll make sure that when any ConstraintHandler is created, its imagery will be fixed
      try {
        // Set the Image constructor to make sure ConstraintHandler creates images with proper paths
        if (typeof (window as any).Image === 'function') {
          // Save the original Image constructor
          const originalImageConstructor = (window as any).Image;
          
          // Create a wrapper function for Image constructor
          function ImageWrapper(this: any, src: string, width?: number, height?: number): HTMLImageElement {
            try {
              // Fix the source path if it's point.gif
              if (src && typeof src === 'string' && src.includes('point.gif')) {
                console.debug(`Fixing point.gif image URL: ${src} -> ${baseUrl}/assets/images/point.gif`);
                src = `${baseUrl}/assets/images/point.gif`;
              }
            } catch (err) {
              console.warn('Error fixing image URL:', err);
            }
            
            // Handle both 'new Image()' and direct function call cases
            if (this instanceof ImageWrapper) {
              // Called with new operator
              return new originalImageConstructor(src, width, height);
            } else {
              // Called as a function
              return originalImageConstructor(src, width, height);
            }
          }
          
          // Override the global Image constructor
          (window as any).Image = ImageWrapper;
          
          // Preserve prototype
          (window as any).Image.prototype = originalImageConstructor.prototype;
        }
        
        // Also set a global hook for any maxGraph object that creates point images
        (window as any).fixPointGifUrl = function(obj: any) {
          if (obj && obj.pointImage && obj.pointImage.src) {
            if (obj.pointImage.src.includes('point.gif')) {
              // Override with the proper URL
              obj.pointImage.src = `${baseUrl}/assets/images/point.gif`;
              console.debug('Fixed pointImage URL to absolute path');
            }
          }
          return obj;
        };
        
        this.logger.debug('Set up global Image patching to fix ConstraintHandler point.gif URLs');
      } catch (error) {
        this.logger.error('Error setting up ConstraintHandler image fixers:', error);
      }
      
      this.logger.info('Applied maxGraph image path fixes');
    } catch (error) {
      this.logger.error('Error applying image path fixes', error);
    }
  }
  
  /**
   * Create a robust constraint handler that won't throw errors
   * This is the single implementation we use everywhere for consistency
   * @returns A constraint handler object with required methods and properties
   */
  private createSafeConstraintHandler(): Record<string, unknown> {
    // Create a safe Point object with clone method
    const safePoint: Record<string, unknown> = {
      x: 0,
      y: 0,
      clone: function(): Record<string, unknown> {
        return { 
          x: this['x'] as number, 
          y: this['y'] as number, 
          clone: this['clone'] 
        };
      }
    };
    
    return {
      reset: () => {},
      isEnabled: () => true,
      createHighlightShape: () => ({
        node: document.createElement('div'),
        redraw: () => {},
        highlight: {
          shape: document.createElement('div')
        }
      }),
      destroy: () => {},
      // Safe implementations for all required methods
      update: () => false,
      setFocus: () => false,
      redraw: () => {},
      isConstraintHandlerEnabled: () => false,
      // Include current point with clone method to prevent the error
      currentPoint: safePoint
    };
  }
  
  /**
   * Utility function to ensure a constraint handler is properly configured
   * @param connectionHandler The connection handler to ensure has a safe constraint handler
   */
  private ensureSafeConstraintHandler(connectionHandler: any): void {
    if (!connectionHandler) return;
    
    try {
      // If no constraint handler exists, create a safe one
      if (!connectionHandler.constraintHandler) {
        connectionHandler.constraintHandler = this.createSafeConstraintHandler();
        this.logger.info('Added safe constraint handler to connection handler');
      } else if (connectionHandler.constraintHandler) {
        // Ensure currentPoint exists and has clone method
        if (!connectionHandler.constraintHandler.currentPoint) {
          connectionHandler.constraintHandler.currentPoint = {
            x: 0, y: 0,
            clone: function(): Record<string, unknown> {
              return { 
                x: this['x'] as number, 
                y: this['y'] as number, 
                clone: this['clone'] 
              };
            }
          };
          this.logger.info('Added safe currentPoint to constraint handler');
        } else if (connectionHandler.constraintHandler.currentPoint && 
                 !connectionHandler.constraintHandler.currentPoint.clone) {
          // Add clone method if it doesn't exist
          connectionHandler.constraintHandler.currentPoint.clone = function(): Record<string, unknown> { 
            return { 
              x: this['x'] as number, 
              y: this['y'] as number, 
              clone: this['clone'] 
            }; 
          };
          this.logger.info('Added clone method to existing currentPoint');
        }
      }
    } catch (error) {
      this.logger.error('Error ensuring safe constraint handler', error);
    }
  }
  
  /**
   * Patch all ConnectionHandler methods to safely handle constraintHandler.currentPoint.clone
   * This comprehensive fix ensures all methods that might use the clone method are patched
   * @param connectionHandler The connection handler to patch
   */
  private patchAllConnectionHandlerMethods(connectionHandler: any): void {
    if (!connectionHandler) return;
    
    const methodsToMakeSafe = [
      'mouseDown', 'mouseMove', 'mouseDrag', 'mouseUp', 'connect',
      'createTarget', 'selectCells', 'reset', 'setError'
    ];
    
    // Save reference to this for use in handler functions
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    
    // First patch the specific instance methods
    methodsToMakeSafe.forEach(methodName => {
      if (typeof connectionHandler[methodName] === 'function') {
        const originalMethod = connectionHandler[methodName];
        
        connectionHandler[methodName] = function(...args: any[]) {
          try {
            // Ensure constraint handler is safe before any operation
            self.ensureSafeConstraintHandler(this);
            
            // Call original method with all arguments
            return originalMethod.apply(this, args);
          } catch (error) {
            self.logger.error(`Error in ConnectionHandler ${methodName}:`, error);
            // Continue without throwing
            return methodName === 'connect' ? null : false;
          }
        };
        
        self.logger.debug(`Patched instance ConnectionHandler.${methodName} to handle currentPoint safely`);
      }
    });
    
    // Also patch the prototype methods to catch all instances
    if (mxgraph.ConnectionHandler && mxgraph.ConnectionHandler.prototype) {
      // Use type assertion to allow indexing with string
      const protoObj = mxgraph.ConnectionHandler.prototype as Record<string, any>;
      
      methodsToMakeSafe.forEach(methodName => {
        if (typeof protoObj[methodName] === 'function') {
          const originalProtoMethod = protoObj[methodName];
          
          protoObj[methodName] = function(this: any, ...args: any[]) {
            try {
              // Make sure constraintHandler exists
              if (!this.constraintHandler) {
                this.constraintHandler = self.createSafeConstraintHandler();
              }
              
              // Ensure currentPoint exists and has clone method
              if (!this.constraintHandler.currentPoint) {
                this.constraintHandler.currentPoint = {
                  x: 0, y: 0,
                  clone: function(): Record<string, unknown> { 
                    return { 
                      x: this['x'] as number, 
                      y: this['y'] as number, 
                      clone: this['clone'] 
                    }; 
                  }
                };
              } else if (this.constraintHandler.currentPoint && 
                       !this.constraintHandler.currentPoint.clone) {
                // Add clone method if it doesn't exist
                this.constraintHandler.currentPoint.clone = function(): Record<string, unknown> { 
                  return { 
                    x: this['x'] as number, 
                    y: this['y'] as number, 
                    clone: this['clone'] 
                  }; 
                };
              }
              
              // Call original method with all arguments
              return originalProtoMethod.apply(this, args);
            } catch (error) {
              self.logger.error(`Error in ConnectionHandler.prototype.${methodName}:`, error);
              // Continue without throwing
              return methodName === 'connect' ? null : false;
            }
          };
          
          self.logger.debug(`Patched prototype ConnectionHandler.${methodName} to handle currentPoint safely`);
        }
      });
      
      self.logger.info('Patched ConnectionHandler prototype methods for all instances');
      
      // Apply direct patches for specific methods causing errors
      // Apply a direct patch for the mouseDown method (original error location)
      if (protoObj['mouseDown']) {
        // Store direct reference to original method
        const originalMouseDownMethod = protoObj['mouseDown'];
        
        protoObj['mouseDown'] = function(this: any, sender: any, me: any): any {
          try {
            // Ensure constraint handler exists and is properly configured BEFORE any use
            if (!this.constraintHandler) {
              this.constraintHandler = self.createSafeConstraintHandler();
            } else {
              // Always ensure the currentPoint is set up with a clone method
              if (!this.constraintHandler.currentPoint) {
                this.constraintHandler.currentPoint = {
                  x: 0, 
                  y: 0,
                  clone: function() { 
                    return { x: this['x'], y: this['y'], clone: this['clone'] }; 
                  }
                };
              } else if (!this.constraintHandler.currentPoint.clone) {
                this.constraintHandler.currentPoint.clone = function() { 
                  // Use bracket notation for type safety
                  return { 
                    x: this['x'], 
                    y: this['y'], 
                    clone: this['clone'] 
                  }; 
                };
              }
            }
            
            // Now it's safe to call the original method
            return originalMouseDownMethod.call(this, sender, me);
          } catch (error) {
            self.logger.error('Explicit mouseDown patch: caught error', error);
            return false; // Continue without crashing
          }
        };
        
        self.logger.info('Applied explicit patch to ConnectionHandler.prototype.mouseDown');
      }
      
      // Apply a direct patch for the mouseMove method (also causing errors)
      if (protoObj['mouseMove']) {
        // Store direct reference to original method
        const originalMouseMoveMethod = protoObj['mouseMove'];
        
        protoObj['mouseMove'] = function(this: any, sender: any, me: any): any {
          try {
            // Ensure constraint handler exists and is properly configured BEFORE any use
            if (!this.constraintHandler) {
              this.constraintHandler = self.createSafeConstraintHandler();
            } else {
              // Always ensure the currentPoint is set up with a clone method
              if (!this.constraintHandler.currentPoint) {
                this.constraintHandler.currentPoint = {
                  x: 0, 
                  y: 0,
                  clone: function() { 
                    return { x: this['x'], y: this['y'], clone: this['clone'] }; 
                  }
                };
              } else if (!this.constraintHandler.currentPoint.clone) {
                this.constraintHandler.currentPoint.clone = function() { 
                  // Use bracket notation for type safety
                  return { 
                    x: this['x'], 
                    y: this['y'], 
                    clone: this['clone'] 
                  }; 
                };
              }
            }
            
            // Now it's safe to call the original method
            return originalMouseMoveMethod.call(this, sender, me);
          } catch (error) {
            self.logger.error('Explicit mouseMove patch: caught error', error);
            return false; // Continue without crashing
          }
        };
        
        self.logger.info('Applied explicit patch to ConnectionHandler.prototype.mouseMove');
      }
    }
    
    this.logger.info('All ConnectionHandler methods patched for safe constraint handling');
  }
  
  /**
   * Ensures a Point object has a clone method
   * @param point The point object to check/modify
   * @returns The same point object with added clone method if needed
   */
  private ensurePointHasClone(point: Record<string, unknown>): Record<string, unknown> {
    if (point && typeof point === 'object' && !('clone' in point)) {
      this.logger.debug('Adding clone method to Point object');
      // Add clone method to the point object
      point['clone'] = function(): Record<string, unknown> {
        return { 
          x: (this)['x'] as number || 0, 
          y: (this)['y'] as number || 0, 
          clone: (this)['clone'] 
        };
      };
    }
    return point;
  }
  
  /**
   * Override constraint handler methods to prevent errors
   * @param constraintHandler The constraint handler to modify
   */
  private overrideConstraintHandlerMethods(constraintHandler: any): void {
    if (!constraintHandler) return;
    
    try {
      // Store original methods if they exist
      const originalUpdate = constraintHandler.update;
      const originalSetFocus = constraintHandler.setFocus;
      
      // Override update method to prevent errors
      constraintHandler.update = (me: any, source: any, existingEdge: any, point: any) => {
        try {
          // Skip if mouse event is invalid
          if (!me || typeof me.getGraphX !== 'function' || typeof me.getGraphY !== 'function') {
            return null;
          }
          
          // Safe X and Y
          const graphX = me.getGraphX();
          const graphY = me.getGraphY();
          
          // Validate coordinates
          if (typeof graphX !== 'number' || typeof graphY !== 'number' || 
              isNaN(graphX) || isNaN(graphY)) {
            return null;
          }
          
          // Call original if it exists
          if (typeof originalUpdate === 'function') {
            return originalUpdate.call(constraintHandler, me, source, existingEdge, point);
          }
        } catch (error) {
          this.logger.error('Error in constraint handler update:', error);
        }
        return null;
      };
      
      // Override setFocus to prevent errors
      constraintHandler.setFocus = (me: any, state: any, source: any) => {
        try {
          // Skip if state is invalid
          if (!state || !state.cell) {
            return false;
          }
          
          // Skip if mouse event is invalid
          if (!me || typeof me.getGraphX !== 'function' || typeof me.getGraphY !== 'function') {
            return false;
          }
          
          // Call original if it exists
          if (typeof originalSetFocus === 'function') {
            return originalSetFocus.call(constraintHandler, me, state, source);
          }
        } catch (error) {
          this.logger.error('Error in constraint handler setFocus:', error);
        }
        return false;
      };
      
      this.logger.debug('Successfully overrode constraint handler methods');
    } catch (error) {
      this.logger.error('Error overriding constraint handler methods', error);
    }
  }
  
  /**
   * Retry connection handler setup after a delay
   */
  private setupRetryConnectionHandling(): void {
    try {
      if (!this.graph) {
        this.logger.error('Cannot retry connection handling: Graph not initialized');
        return;
      }
      
      // Force create the connection handler if it's still missing
      if (!this.graph.connectionHandler) {
        this.logger.info('Forcing creation of connectionHandler during retry');
        try {
          // Always prefer our robust safe implementation
          this.graph.connectionHandler = this.createSafeConnectionHandler();
          this.logger.info('Created safe connection handler during retry');
        } catch (error) {
          this.logger.error('Failed to create connection handler even after retry', error);
          // Fall back to our safe implementation
          this.setupSafeConnectionHandler();
          return;
        }
      }
      
      // Ensure constraint handler exists and is properly configured
      this.ensureSafeConstraintHandler(this.graph.connectionHandler);
      this.logger.info('Ensured safe constraint handler during retry');
      
      // Apply comprehensive method patching to all connection handler methods
      this.patchAllConnectionHandlerMethods(this.graph.connectionHandler);
      this.logger.info('Applied comprehensive patching to all ConnectionHandler methods');
      
      // Also override methods for extra safety
      if (this.graph.connectionHandler.constraintHandler) {
        this.overrideConstraintHandlerMethods(this.graph.connectionHandler.constraintHandler);
      }
      
      // Add specific fix for the mouseMove method that's causing "currentPoint.clone is not a function" error
      if (typeof this.graph.connectionHandler.mouseMove === 'function') {
        const originalMouseMove = this.graph.connectionHandler.mouseMove;
        
        this.graph.connectionHandler.mouseMove = (sender: any, me: any) => {
          try {
            // Use the utility function to ensure constraint handler is properly set up
            this.ensureSafeConstraintHandler(this.graph.connectionHandler);
            
            // Now call the original mouseMove method
            return originalMouseMove.call(this.graph.connectionHandler, sender, me);
          } catch (error) {
            this.logger.error('Error in ConnectionHandler mouseMove:', error);
            // Continue without throwing
            return false;
          }
        };
        
        this.logger.info('Added safety wrapper to ConnectionHandler.mouseMove to prevent clone errors');
      }
      
      // Now setup the customizations
      this.setupConnectionHandlerCustomizations();
      this.logger.info('Connection handler retry setup completed');
    } catch (error) {
      this.logger.error('Error in retry connection handler setup, using safe implementation', error);
      
      // Last resort - create safe handlers
      if (this.graph && !this.graph.connectionHandler) {
        this.graph.connectionHandler = this.createSafeConnectionHandler();
      }
      
      if (this.graph && this.graph.connectionHandler && !this.graph.connectionHandler.constraintHandler) {
        this.graph.connectionHandler.constraintHandler = this.createSafeConstraintHandler();
      }
    }
  }
  
  /**
   * Create a safe connection handler that won't throw errors
   * This unified function replaces both createMinimalConnectionHandler and setupMinimalConnectionHandler
   * @returns A connection handler object with required methods and properties
   */
  private createSafeConnectionHandler(): Record<string, unknown> {
    const baseUrl = window.location.origin;
    this.logger.info('Creating safe connection handler with robust error handling');
    
    // Create a safe marker
    const safeMarker = {
      highlight: { validate: () => true },
      validColor: '#00ff00',
      invalidColor: '#ff0000',
      process: () => {},
      // Create fixed image method that uses absolute paths
      createImage: (src: string) => {
        // Always use the correct absolute path for all images
        const fixedSrc = `${baseUrl}/assets/images/${src.split('/').pop()}`;
        this.logger.debug(`Fixed image path: ${src} -> ${fixedSrc}`);
        
        const imgElement = document.createElement('img');
        imgElement.setAttribute('src', fixedSrc);
        return imgElement;
      }
    };
    
    return {
      // Safe methods
      createMarker: () => safeMarker,
      reset: () => {},
      isConnecting: () => false,
      connect: () => {},
      graph: this.graph,
      // Use our consistent constraint handler implementation
      constraintHandler: this.createSafeConstraintHandler(),
      // Basic properties
      marker: safeMarker
    };
  }
  
  /**
   * Setup a safe connection handler to avoid errors
   * This function both creates and installs a safe handler
   */
  private setupSafeConnectionHandler(): void {
    if (!this.graph) return;
    
    try {
      // Install the safe handler if needed
      if (!this.graph.connectionHandler) {
        this.graph.connectionHandler = this.createSafeConnectionHandler();
        this.logger.info('Installed safe connection handler');
      }
      
      // Always ensure the constraint handler is properly set up
      if (!this.graph.connectionHandler.constraintHandler) {
        this.graph.connectionHandler.constraintHandler = this.createSafeConstraintHandler();
        this.logger.info('Added safe constraint handler to existing connection handler');
      }
    } catch (error) {
      this.logger.error('Failed to set up safe connection handler', error);
    }
  }
  
  /**
   * Setup connection handler customizations
   * This configures the connection handler with our custom behavior
   */
  private setupConnectionHandlerCustomizations(): void {
    if (!this.graph) {
      this.logger.error('Cannot customize connection handler: Graph not initialized');
      return;
    }
    
    if (!this.graph.connectionHandler) {
      this.logger.error('Cannot customize connection handler: Handler not initialized');
      return;
    }
    
    // Ensure connection handler has a safe constraint handler before any method override
    this.ensureSafeConstraintHandler(this.graph.connectionHandler);
    
    // Apply comprehensive method patching to all connection handler methods
    this.patchAllConnectionHandlerMethods(this.graph.connectionHandler);
    
    // Add safe mouseDown handler to fix "this.constraintHandler.currentPoint.clone is not a function" error
    if (typeof this.graph.connectionHandler.mouseDown === 'function') {
      const originalMouseDown = this.graph.connectionHandler.mouseDown;
      this.graph.connectionHandler.mouseDown = function(sender: any, me: any): any {
        try {
          // Ensure constraintHandler is safe before proceeding
          this.constraintHandler = this.constraintHandler || {};
          
          // Add clone method to currentPoint if needed (using index notation for type safety)
          if (!this.constraintHandler.currentPoint) {
            this.constraintHandler.currentPoint = {
              x: 0,
              y: 0,
              clone: function(): Record<string, unknown> {
                return {
                  x: this['x'] as number,
                  y: this['y'] as number,
                  clone: this['clone']
                };
              }
            };
          } else if (!this.constraintHandler.currentPoint.clone) {
            this.constraintHandler.currentPoint.clone = function(): Record<string, unknown> {
              return {
                x: this['x'] as number,
                y: this['y'] as number,
                clone: this['clone']
              };
            };
          }
          
          // Call original method
          return originalMouseDown.call(this, sender, me);
        } catch (error) {
           
          console.error('Error in ConnectionHandler mouseDown:', error);
           
          // Continue without throwing
          return false;
        }
      };
      this.logger.info('Patched ConnectionHandler.mouseDown to handle currentPoint safely');
    }
    
    // Also patch the connect method
    if (typeof this.graph.connectionHandler.connect === 'function') {
      const originalConnect = this.graph.connectionHandler.connect;
      this.graph.connectionHandler.connect = function(source: any, target: any, evt: any, dropTarget: any): any {
        try {
          // Ensure constraintHandler is safe before proceeding
          this.constraintHandler = this.constraintHandler || {};
          
          // Add clone method to currentPoint if needed
          if (!this.constraintHandler.currentPoint) {
            this.constraintHandler.currentPoint = {
              x: 0,
              y: 0,
              clone: function(): Record<string, unknown> {
                return {
                  x: this['x'] as number,
                  y: this['y'] as number,
                  clone: this['clone']
                };
              }
            };
          } else if (!this.constraintHandler.currentPoint.clone) {
            this.constraintHandler.currentPoint.clone = function(): Record<string, unknown> {
              return {
                x: this['x'] as number,
                y: this['y'] as number,
                clone: this['clone']
              };
            };
          }
          
          // Call original method
          return originalConnect.call(this, source, target, evt, dropTarget);
        } catch (error) {
           
          console.error('Error in ConnectionHandler connect:', error);
           
          // Continue without throwing
          return null;
        }
      };
      this.logger.info('Patched ConnectionHandler.connect to handle currentPoint safely');
    }
    
    try {
      // Make anchor points visible when connecting
      this.graph.connectionHandler.createMarker = function() {
        // Try-catch to avoid crashes
        try {
          const marker = new mxgraph.CellMarker(this.graph, JSON.stringify({
            validColor: '#00ff00',
            invalidColor: '#ff0000',
            hotspot: 0.3
          }) as any);
          
          // Show only for valid connection points
          marker.getMarkerColor = function(_evt: any, temp: any) {
            return temp.highlight.valid ? this.validColor : this.invalidColor;
          };
          
          return marker;
        } catch (error) {
          console.error('Error creating marker', error);
          // Return a minimal implementation to avoid errors
          return {
            highlight: { valid: true },
            validColor: '#00ff00',
            invalidColor: '#ff0000'
          } as any;
        }
      };
      
      // Make connection points visible on hover if constraintHandler exists
      if (this.graph.connectionHandler.constraintHandler) {
        try {
          this.graph.connectionHandler.constraintHandler.createHighlightShape = function() {
            const highlight = new mxgraph.RectangleShape(
              new mxgraph.Rectangle(),
              '#00ff00',
              '#00ff00',
              2
            );
            highlight.strokeWidth = 3;
            return highlight;
          };
        } catch (error) {
          this.logger.error('Error setting up constraint handler highlight shape', error);
        }
        
        // Override update method to prevent invalid point errors
        try {
          const originalUpdate = this.graph.connectionHandler.constraintHandler.update;
          this.graph.connectionHandler.constraintHandler.update = function(me: any, source: any, existingEdge: any, point: any) {
            try {
              // Only call original if all parameters are valid
              if (me && (!point || (typeof point.x === 'number' && typeof point.y === 'number'))) {
                return originalUpdate.call(this, me, source, existingEdge, point);
              }
            } catch (error) {
              console.error('Error in constraint handler update:', error);
            }
            return null;
          };
          
          // Override setFocus to prevent invalid point errors
          const originalSetFocus = this.graph.connectionHandler.constraintHandler.setFocus;
          this.graph.connectionHandler.constraintHandler.setFocus = function(me: any, state: any, source?: any) {
            try {
              // Verify state and state.cell before calling original
              if (me && state && state.cell) {
                return originalSetFocus.call(this, me, state, source);
              }
            } catch (error) {
              console.error('Error in constraint handler setFocus:', error);
            }
            return false;
          };
        } catch (error) {
          this.logger.error('Error overriding constraint handler methods', error);
        }
      }
      
      // Override connection handler methods
      const connectionHandler = this.graph.connectionHandler;
      // Store original methods only if they exist
      const originalMouseMove = typeof connectionHandler.mouseMove === 'function' ? connectionHandler.mouseMove : null;
      const originalMouseUp = typeof connectionHandler.mouseUp === 'function' ? connectionHandler.mouseUp : null;
      
      // Save reference to this for use in handler functions
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      
      // Safely patch updateCurrentState to prevent invalid point errors
      try {
        const originalUpdateCurrentState = connectionHandler.updateCurrentState;
        connectionHandler.updateCurrentState = function(me: any, point: any) {
          try {
            // Ensure point has valid coordinates before calling original
            if (!point || (point && typeof point.x === 'number' && typeof point.y === 'number')) {
              return originalUpdateCurrentState.call(this, me, point);
            }
          } catch (error) {
            self.logger.error('Error in updateCurrentState', error);
          }
          return null;
        };
      } catch (error) {
        this.logger.warn('Could not override updateCurrentState', error);
      }
      
      // Override mouseMove to handle anchor point snapping and fix constraint handler issues
      connectionHandler.mouseMove = function(sender: any, me: any) {
        try {
          // Check if mouse event is valid first
          if (!me || typeof me.graphX !== 'number' || typeof me.graphY !== 'number') {
            return; // Skip this event if coordinates are invalid
          }
          
          // Ensure constraint handler is safe before proceeding
          self.ensureSafeConstraintHandler(this);
          
          // Call original method first if it exists
          if (originalMouseMove) {
            try {
              originalMouseMove.call(this, sender, me);
            } catch (error) {
              // If original mouseMove fails, log but continue with our implementation
              self.logger.warn('Original mouseMove handler failed, continuing with custom handler', error);
            }
          }
          
          // If we're creating or modifying a connection
          if (this.previous != null && this.edgeState != null) {
            // Find the cell under the mouse
            const cell = self.graph.getCellAt(me.graphX, me.graphY);
            
            if (cell && self.isVertex(cell)) {
              // Show anchor points for this vertex
              const markers = self.showVertexAnchorPoints(cell);
              
              // Find nearest anchor point to mouse position
              const nearestAnchor = self.findNearestAnchorPoint(cell, me.graphX, me.graphY);
              
              if (nearestAnchor) {
                // Highlight the nearest anchor
                self.highlightAnchorPoint(markers, nearestAnchor.position);
                
                // Snap the edge endpoint to this anchor
                try {
                  self.snapEdgeToAnchor(this.edgeState, nearestAnchor, this.previous === this.source);
                } catch (error) {
                  self.logger.error('Error in snapEdgeToAnchor', error);
                }
                
                // Store the current anchor and target 
                this.targetAnchor = nearestAnchor.position;
                this.targetVertex = cell;
              }
            } else {
              // Hide all anchor points if not over a vertex
              self.hideAllAnchorPoints();
              this.targetAnchor = null;
              this.targetVertex = null;
            }
          }
        } catch (error) {
          self.logger.error('Error in connection handler mouseMove', error);
        }
      };
      
      // Override mouseUp to finalize the connection and fix constraint handler issues
      connectionHandler.mouseUp = function(_sender: any, _me: any) {
        try {
          // Ensure constraint handler is safe before proceeding
          self.ensureSafeConstraintHandler(this);
          
          // If we have a target vertex and anchor
          if (this.targetVertex && this.targetAnchor) {
            // Get component IDs
            const sourceCell = this.source;
            const targetCell = this.targetVertex;
            
            if (sourceCell && targetCell) {
              const sourceComponent = self.diagramService.findComponentByCellId(sourceCell.id);
              const targetComponent = self.diagramService.findComponentByCellId(targetCell.id);
              
              if (sourceComponent && targetComponent) {
                // Determine if this is source or target modification
                const isSource = this.previous === this.source;
                
                if (isSource) {
                  // Define and add updateEdgeEndpoint method first
                  if (!self.updateEdgeEndpoint) {
                    self.updateEdgeEndpoint = (
                      edge: any,
                      componentId: string, 
                      isSource: boolean,
                      anchorPosition: AnchorPointPosition
                    ) => {
                      if (!edge) return;
                      
                      // Get the edge component
                      const edgeComponent = self.diagramService.findComponentByCellId(edge.id);
                      if (!edgeComponent) return;
                      
                      // Get the target vertex's cell
                      const component = self.diagramService.getCurrentDiagram()?.components.find(c => c.id === componentId);
                      if (!component || !component.cellId) return;
                      
                      const cell = self.getCellById(component.cellId);
                      if (!cell) return;
                      
                      // Update the visual connection in maxGraph
                      if (isSource) {
                        // Update source
                        self.graph.getModel().setTerminal(edge, cell, true);
                        
                        // Update the component data
                        self.diagramService.updateComponent(edgeComponent.id, {
                          data: {
                            ...edgeComponent.data,
                            source: componentId,
                            sourceAnchor: anchorPosition
                          }
                        });
                      } else {
                        // Update target
                        self.graph.getModel().setTerminal(edge, cell, false);
                        
                        // Update the component data
                        self.diagramService.updateComponent(edgeComponent.id, {
                          data: {
                            ...edgeComponent.data,
                            target: componentId,
                            targetAnchor: anchorPosition
                          }
                        });
                      }
                      
                      // Update the connection point visually
                      self.setEdgeTerminalPoint(edge, anchorPosition, isSource);
                    };
                  }
                  
                  // We're modifying the source endpoint
                  self.updateEdgeEndpoint(
                    this.edge, 
                    targetComponent.id, 
                    true, 
                    this.targetAnchor
                  );
                } else {
                  // We're modifying the target endpoint
                  self.updateEdgeEndpoint(
                    this.edge, 
                    targetComponent.id, 
                    false, 
                    this.targetAnchor
                  );
                }
              }
            }
          }
          
          // Clean up
          self.hideAllAnchorPoints();
          this.targetAnchor = null;
          this.targetVertex = null;
          
          // Call original method if it exists
          if (originalMouseUp) {
            // Use the parameters passed to this function
            originalMouseUp.call(this, _sender, _me);
          }
        } catch (error) {
          self.logger.error('Error in connection handler mouseUp', error);
        }
      };
      
      this.logger.debug('Connection handler customization completed successfully');
    } catch (error) {
      this.logger.error('Error customizing connection handler', error);
    }
  }
  
  /**
   * Show anchor points for a vertex
   */
  private showVertexAnchorPoints(vertex: any): Map<AnchorPointPosition, any> {
    // Hide any existing anchor points
    this.hideAllAnchorPoints();
    
    // Create and show anchor points for this vertex
    const markers = this.createAnchorPointMarkers(vertex);
    
    // Show all markers
    markers.forEach(marker => {
      marker.setVisible(true);
    });
    
    // Store active markers for later reference
    this.activeAnchorMarkers = markers;
    return markers;
  }

  /**
   * Hide all visible anchor points
   */
  private hideAllAnchorPoints(): void {
    if (this.activeAnchorMarkers) {
      this.activeAnchorMarkers.forEach(marker => {
        marker.setVisible(false);
        if (marker.node && marker.node.parentNode) {
          marker.node.parentNode.removeChild(marker.node);
        }
      });
      this.activeAnchorMarkers.clear();
    }
  }

  /**
   * Create markers for anchor points
   */
  private createAnchorPointMarkers(vertex: any): Map<AnchorPointPosition, any> {
    const markers = new Map<AnchorPointPosition, any>();
    
    // Get vertex geometry
    const geometry = this.graph.getCellGeometry(vertex);
    if (!geometry) return markers;
    
    const state = this.graph.view.getState(vertex);
    if (!state) return markers;
    
    // For each anchor point position
    Object.entries(this.anchorPositionMap).forEach(([position, coords]) => {
      // Calculate absolute position
      const x = state.x + geometry.width * coords.x;
      const y = state.y + geometry.height * coords.y;
      
      // Create a marker for this position
      const marker = this.createAnchorPointMarker(x, y, position as AnchorPointPosition);
      if (marker) {
        markers.set(position as AnchorPointPosition, marker);
      }
    });
    
    return markers;
  }

  /**
   * Create a visual marker for an anchor point
   */
  private createAnchorPointMarker(x: number, y: number, position: AnchorPointPosition): any {
    try {
      // Create a small circle to represent the anchor point
      // Use RectangleShape with rounded styling as Ellipse may not be available
      const marker = new mxgraph.RectangleShape(
        new mxgraph.Rectangle(x - 5, y - 5, 10, 10), 
        '#4285F4', // Fill color
        '#1565C0', // Stroke color
        2          // Stroke width
      );
      
      // Store position for reference
      (marker as any).anchorPosition = position;
      
      // Add to the graph's overlay pane
      const container = this.graph.view.getOverlayPane();
      if (container) {
        marker.init(container);
        marker.redraw();
      }
      
      return marker;
    } catch (error) {
      this.logger.error('Error creating anchor point marker', error);
      return null;
    }
  }

  /**
   * Find the nearest anchor point to a given coordinate
   */
  private findNearestAnchorPoint(vertex: any, x: number, y: number): { position: AnchorPointPosition, distance: number } | null {
    // Validate inputs
    if (!vertex || typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      this.logger.warn('Invalid parameters for findNearestAnchorPoint', { vertex: Boolean(vertex), x, y });
      return null;
    }
    
    // Get geometry and state
    try {
      const geometry = this.graph.getCellGeometry(vertex);
      if (!geometry || typeof geometry.width !== 'number' || typeof geometry.height !== 'number') return null;
      
      const state = this.graph.view.getState(vertex);
      if (!state || typeof state.x !== 'number' || typeof state.y !== 'number') return null;
      
      let minDistance = Infinity;
      let nearestPosition: AnchorPointPosition | null = null;
      
      // Check each anchor point
      Object.entries(this.anchorPositionMap).forEach(([position, coords]) => {
        // Validate coordinates
        if (typeof coords.x !== 'number' || typeof coords.y !== 'number') return;
        
        try {
          // Calculate absolute position
          const anchorX = state.x + geometry.width * coords.x;
          const anchorY = state.y + geometry.height * coords.y;
          
          // Validate calculated coordinates
          if (isNaN(anchorX) || isNaN(anchorY) || !isFinite(anchorX) || !isFinite(anchorY)) return;
          
          // Calculate distance to mouse
          const dx = anchorX - x;
          const dy = anchorY - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Validate distance
          if (isNaN(distance) || !isFinite(distance)) return;
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestPosition = position as AnchorPointPosition;
          }
        } catch (error) {
          this.logger.debug(`Error calculating distance for anchor ${position}`, error);
        }
      });
      
      // Only return if we found a valid nearest anchor within threshold
      if (nearestPosition && minDistance < 30) {
        return {
          position: nearestPosition,
          distance: minDistance
        };
      }
    } catch (error) {
      this.logger.error('Error finding nearest anchor point', error);
    }
    
    return null;
  }

  /**
   * Highlight an anchor point
   */
  private highlightAnchorPoint(markers: Map<AnchorPointPosition, any>, position: AnchorPointPosition): void {
    // Reset all markers to default style
    markers.forEach(marker => {
      if (marker) {
        marker.stroke = '#1565C0';
        marker.fill = '#4285F4';
        marker.redraw();
      }
    });
    
    // Highlight the selected marker
    const marker = markers.get(position);
    if (marker) {
      marker.stroke = '#E65100';
      marker.fill = '#FF9800';
      marker.redraw();
    }
  }

  /**
   * Snap an edge to an anchor point
   */
  private snapEdgeToAnchor(edgeState: any, anchor: { position: AnchorPointPosition }, isSource: boolean): void {
    if (!edgeState || !anchor) return;
    
    try {
      // Get the vertex geometry and state
      const vertex = isSource ? edgeState.visibleSourceState?.cell : edgeState.visibleTargetState?.cell;
      if (!vertex) return;
      
      const geometry = this.graph.getCellGeometry(vertex);
      const state = this.graph.view.getState(vertex);
      
      if (!geometry || !state) return;
      
      // Get the anchor position
      const coords = this.anchorPositionMap[anchor.position];
      if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') return;
      
      // Calculate absolute position
      const x = state.x + geometry.width * coords.x;
      const y = state.y + geometry.height * coords.y;
      
      // Validate x and y are numeric
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
        this.logger.warn('Invalid coordinates calculated for anchor point:', { x, y, anchor: anchor.position });
        return;
      }
      
      // Create a robust point with equals method that won't throw errors
      let point;
      try {
        // Try to use the maxGraph Point constructor
        if (mxgraph.Point) {
          point = new mxgraph.Point(x, y);
          // Add equals method if it doesn't exist
          if (!point.equals) {
            point.equals = function(other: any): boolean {
              if (!other) return false;
              if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
              return this.x === other.x && this.y === other.y;
            };
          }
        } else {
          // Create a point-like object with guaranteed equals method
          point = {
            x,
            y,
            equals: function(other: any): boolean {
              if (!other) return false;
              if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
              return this.x === other.x && this.y === other.y;
            }
          };
        }
      } catch (error) {
        // If all else fails, create a robust point-like object
        point = {
          x,
          y,
          equals: function(other: any): boolean {
            if (!other) return false;
            if (typeof other.x !== 'number' || typeof other.y !== 'number') return false;
            return this.x === other.x && this.y === other.y;
          }
        };
        this.logger.warn('Created robust point object with equals method', error);
      }
      
      // Safely update the edge point in absolutePoints array
      try {
        if (isSource) {
          if (edgeState.absolutePoints && Array.isArray(edgeState.absolutePoints)) {
            edgeState.absolutePoints[0] = point;
          }
        } else {
          if (edgeState.absolutePoints && Array.isArray(edgeState.absolutePoints)) {
            const lastIndex = edgeState.absolutePoints.length - 1;
            if (lastIndex >= 0) {
              edgeState.absolutePoints[lastIndex] = point;
            }
          }
        }
      } catch (err) {
        this.logger.error('Error updating edge points array', err);
        return;
      }
      
      // Repaint the edge - wrap in try/catch as view methods might be undefined
      try {
        if (this.graph.view && typeof this.graph.view.invalidate === 'function') {
          this.graph.view.invalidate(edgeState.cell, true, false);
        }
        if (this.graph.view && typeof this.graph.view.validate === 'function') {
          this.graph.view.validate();
        }
      } catch (error) {
        this.logger.error('Error repainting edge', error);
      }
    } catch (error) {
      this.logger.error('Error snapping edge to anchor', error);
    }
  }

  /**
   * Set a specific connection point for an edge terminal
   */
  private setEdgeTerminalPoint(
    edge: any,
    anchorPosition: AnchorPointPosition,
    isSource: boolean
  ): void {
    if (!edge) return;
    
    try {
      const terminal = isSource ? edge.source : edge.target;
      if (!terminal) return;
      
      // Create a point object safely
      const x = this.anchorPositionMap[anchorPosition].x;
      const y = this.anchorPositionMap[anchorPosition].y;
      
      // Use the proper Point constructor
      const point = new mxgraph.Point(x, y);
      
      // Create constraint with the point
      const constraint = new mxgraph.ConnectionConstraint(point, true);
      
      // Set the constraint on the edge
      this.graph.setConnectionConstraint(edge, terminal, isSource, constraint);
      
      // Force a redraw of the edge
      this.graph.view.invalidate(edge, true, false);
      this.graph.view.validate();
    } catch (error) {
      this.logger.error(`Error setting edge terminal point: ${error}`, error);
    }
  }
  
  /**
   * Highlight a cell (vertex or edge)
   * 
   * @param id The ID to highlight - can be either a component ID or a cell ID
   * @param highlight Whether to highlight or unhighlight the cell
   * @param isComponentId Whether the provided ID is a component ID (true) or a cell ID (false)
   */
  highlightCell(id: string, highlight: boolean, isComponentId = true): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot highlight cell: Graph not initialized');
      return;
    }
    
    if (!id) {
      this.logger.error('Cannot highlight cell: No ID provided');
      return;
    }
    
    let cell;
    
    if (isComponentId) {
      // Find the component by ID
      const component = this.diagramService.getCurrentDiagram()?.components.find(c => c.id === id);
      
      if (!component) {
        this.logger.error(`Cannot highlight cell: Component not found ${id}`);
        return;
      }
      
      // Get the cell using the cellId from the component (if it exists)
      if (!component.cellId) {
        this.logger.error(`Cannot highlight cell: Component ${id} has no cellId`);
        return;
      }
      
      cell = this.getCellById(component.cellId);
      
      if (!cell) {
        this.logger.error(`Cannot highlight cell: Cell not found for component ${id} (cellId: ${component.cellId})`);
        return;
      }
      
      this.logger.debug(`Highlighting by component ID: ${id}, using cell ID: ${component.cellId}`);
    } else {
      // The ID is directly a cell ID
      cell = this.getCellById(id);
      
      if (!cell) {
        this.logger.error(`Cannot highlight cell: Cell not found with ID ${id}`);
        return;
      }
      
      this.logger.debug(`Highlighting directly by cell ID: ${id}`);
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Use a safer approach to modify cell styles that doesn't involve the problematic methods
        if (highlight) {
          // Instead of using setCellStyle which might trigger problematic point equality checks,
          // directly modify the cell style property and then refresh the cell
          if (cell.style) {
            // Only apply highlight if it's not already highlighted
            if (!cell.style.includes('highlighted')) {
              // Store original style for later restoration
              cell.originalStyle = cell.style;
              
              // Apply highlighted style - ensure we don't lose existing styles
              cell.style = 'highlighted;' + cell.style;
              
              // Refresh the cell visualization
              this.graph.refresh(cell);
              this.logger.debug(`Applied highlight style to cell ${cell.id}`);
            }
          } else {
            // If no style exists, set a basic one
            cell.style = 'highlighted';
            this.graph.refresh(cell);
          }
        } else {
          // Restore original style if available
          if (cell.originalStyle) {
            cell.style = cell.originalStyle;
            delete cell.originalStyle;
          } else {
            // Reset to default style based on cell type
            const isVertex = this.isVertex(cell);
            const isEdge = this.isEdge(cell);
            
            if (isVertex) {
              cell.style = cell.style.replace('highlighted;', '');
              this.logger.debug(`Reset vertex ${cell.id} to default style`);
            } else if (isEdge) {
              cell.style = cell.style.replace('highlighted;', '');
              this.logger.debug(`Reset edge ${cell.id} to default style`);
            } else {
              this.logger.warn(`Unable to determine cell type for ${cell.id} during unhighlight`);
            }
          }
          
          // Refresh the cell visualization
          this.graph.refresh(cell);
        }
        
        const actionType = highlight ? 'highlighted' : 'unhighlighted';
        const idType = isComponentId ? 'component' : 'cell';
        this.logger.debug(`${idType} ${id} ${actionType} (cell: ${cell.id})`);
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error highlighting cell', error);
    }
  }
  
  /**
   * Create a new vertex at the specified position
   */
  createVertex(x: number, y: number, label: string, width = 100, height = 40): string | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create vertex: Graph not initialized');
      return null;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // First create the cell in maxGraph
        const parent = this.graph.getDefaultParent();
        const vertex = this.graph.insertVertex(
          parent,
          null, // Let maxGraph generate the cell ID
          label || '',
          x || 0,
          y || 0,
          width || 100,
          height || 40,
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // Get the generated cell ID
        const cellId = vertex.id;
        
        // Create the component data with the cell ID
        const componentData = {
          x,
          y,
          width,
          height,
          label,
          style: 'rounded=1;whiteSpace=wrap;html=1;'
        };
        
        // Add the component to diagram with cellId already set
        // This follows the "maxGraph first" approach in our architecture
        const component = this.diagramService.addComponent('vertex', { ...componentData, cellId });
        
        // Log for debugging
        this.logger.debug(`Vertex created: component=${component.id}, cell=${cellId}`);
        
        // Return component ID
        this.logger.info(`Vertex created: ${cellId}`);
        return component.id;
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating vertex', error);
      return null;
    }
  }
  
  /**
   * Create a new vertex and return both component and cell IDs
   * This follows the architecture where maxGraph cells are created first, 
   * then component models that reference them
   */
  createVertexWithIds(
    x: number, 
    y: number, 
    label: string, 
    width = 100, 
    height = 40, 
    style = 'rounded=1;whiteSpace=wrap;html=1;'
  ): { componentId: string, cellId: string } | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create vertex: Graph not initialized');
      return null;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // 1. FIRST CREATE THE CELL IN MXGRAPH
        const parent = this.graph.getDefaultParent();
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        // Insert the vertex (unused variable)
        this.graph.insertVertex(
          parent,
          cellId, // Use UUID instead of letting maxGraph generate the ID
          label || '',
          x || 0,
          y || 0,
          width || 100,
          height || 40,
          style
        );
        
        // Verify the cell ID is what we provided
        // (maxGraph should have used our UUID)
        this.logger.debug(`Created maxGraph cell with ID: ${cellId}`);
        
        // 2. THEN CREATE THE COMPONENT THAT REFERENCES THE MXGRAPH CELL
        // Create the component data with the cell ID
        const componentData = {
          x,
          y,
          width,
          height,
          label,
          style,
          cellId // Include the cellId in the initial data
        };
        
        // Add the component to the diagram
        const component = this.diagramService.addComponent('vertex', componentData);
        
        // Log for debugging
        this.logger.debug(`Created component with ID: ${component.id} for cell: ${cellId}`);
        
        // Return both IDs to allow proper tracking
        return {
          componentId: component.id,
          cellId
        };
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating vertex', error);
      return null;
    }
  }

  /**
   * Create a new edge between components by their IDs
   * This method is designed to work with component IDs, not cell IDs
   */
  createEdgeBetweenComponents(
    sourceComponentId: string, 
    targetComponentId: string, 
    label = '', 
    style = 'edgeStyle=orthogonalEdgeStyle;rounded=1;',
    sourceAnchor: AnchorPointPosition = 'C',
    targetAnchor: AnchorPointPosition = 'C'
  ): { componentId: string, cellId: string } | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return null;
    }
    
    this.logger.debug(`Creating edge between components: ${sourceComponentId} -> ${targetComponentId}`);
    
    // Get the source and target components
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram) {
      this.logger.error('Cannot create edge: No diagram loaded');
      return null;
    }
    
    // Find source component
    const sourceComponent = diagram.components.find(c => c.id === sourceComponentId);
    if (!sourceComponent) {
      this.logger.error(`Cannot create edge: Source component not found: ${sourceComponentId}`);
      
      // Debug info - list available components
      const availableComponents = diagram.components.map(c => ({id: c.id, type: c.type}));
      this.logger.debug(`Available components: ${JSON.stringify(availableComponents)}`);
      return null;
    }
    
    // Find target component
    const targetComponent = diagram.components.find(c => c.id === targetComponentId);
    if (!targetComponent) {
      this.logger.error(`Cannot create edge: Target component not found: ${targetComponentId}`);
      return null;
    }
    
    // Get cell IDs from components
    const sourceCellId = sourceComponent.cellId;
    const targetCellId = targetComponent.cellId;
    
    if (!sourceCellId || !targetCellId) {
      this.logger.error('Cannot create edge: Source or target component missing cell ID', {
        sourceComponentId,
        targetComponentId,
        sourceCellId: sourceCellId ?? 'undefined',
        targetCellId: targetCellId ?? 'undefined'
      });
      return null;
    }
    
    // Get actual cells using cell IDs
    const sourceCell = this.getCellById(sourceCellId);
    const targetCell = this.getCellById(targetCellId);
    
    if (!sourceCell) {
      this.logger.error(`Cannot create edge: Source cell not found with ID: ${sourceCellId}`);
      return null;
    }
    
    if (!targetCell) {
      this.logger.error(`Cannot create edge: Target cell not found with ID: ${targetCellId}`);
      return null;
    }
    
    this.logger.debug(`Found required cells: source=${sourceCellId}, target=${targetCellId}`);
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // 1. FIRST CREATE THE MXGRAPH EDGE
        const parent = this.graph.getDefaultParent();
        
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          cellId, // Use UUID instead of letting maxGraph generate the ID
          label || '',
          sourceCell,
          targetCell,
          style
        );
        
        if (!edge) {
          throw new Error('Edge creation failed: insertEdge returned null or undefined');
        }
        
        // Verify the cell ID is what we provided
        // (maxGraph should have used our UUID)
        this.logger.debug(`Created maxGraph edge with ID: ${cellId}`);
        
        // Set the connection points for source and target
        this.setEdgeTerminalPoint(edge, sourceAnchor, true);  // Source
        this.setEdgeTerminalPoint(edge, targetAnchor, false); // Target
        
        // 2. THEN CREATE THE COMPONENT THAT REFERENCES THE MXGRAPH EDGE
        // Create the component data with the cell ID
        const componentData = {
          source: sourceComponentId,
          target: targetComponentId,
          sourceAnchor,
          targetAnchor,
          label,
          style,
          cellId // Include cell ID from the start
        };
        
        // Add the component to the diagram
        const component = this.diagramService.addComponent('edge', componentData);
        this.logger.debug(`Created component with ID: ${component.id} for edge cell: ${cellId}`);
        
        this.logger.info(`Edge created successfully: component=${component.id}, cell=${cellId}, source=${sourceComponentId}, target=${targetComponentId}`);
        
        // Return both IDs
        return {
          componentId: component.id,
          cellId
        };
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating edge', error);
      return null;
    }
  }

  /**
   * Create a new edge between two vertices using component IDs
   * @deprecated Use createEdgeBetweenComponents instead which returns both component and cell IDs
   */
  createEdge(sourceComponentId: string, targetComponentId: string, label = '', style = 'edgeStyle=orthogonalEdgeStyle;rounded=1;'): string | null {
    this.logger.debug(`Using deprecated createEdge method - delegating to createEdgeBetweenComponents`);
    
    // Simply delegate to the more robust method and return just the component ID
    const result = this.createEdgeBetweenComponents(sourceComponentId, targetComponentId, label, style);
    
    if (result) {
      return result.componentId;
    }
    
    return null;
  }
  
  /**
   * Delete a component from the diagram
   * Following our architecture: delete maxGraph cells first, then remove components
   */
  deleteComponent(componentId: string): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot delete component: Graph not initialized');
      return;
    }
    
    // Find the component
    const component = this.diagramService.getCurrentDiagram()?.components.find(c => c.id === componentId);
    
    if (!component) {
      this.logger.error(`Cannot delete component: Component not found ${componentId}`);
      return;
    }
    
    // Get the cell using the cellId from the component (if it exists)
    const cell = component.cellId ? this.getCellById(component.cellId) : null;
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Remove from graph first if cell exists
        if (cell) {
          // If this is a vertex, also remove all connected edges
          if (this.isVertex(cell)) {
            this.logger.info(`Deleting vertex with connected edges: ${component.cellId}`);
            // Setting includeEdges to true removes all connected edges
            this.graph.removeCells([cell], true);
            
            // We also need to delete the edge components from our diagram model
            if (component.cellId) {
              this.deleteEdgesConnectedToVertex(component.id, component.cellId);
            }
          } else {
            // For edges or other cells, just remove the cell
            this.graph.removeCells([cell]);
          }
          this.logger.debug(`Removed cell ${component.cellId} from graph`);
        } else {
          this.logger.warn(`Cell not found for component ${componentId}, only removing component from model`);
        }
        
        // Then remove from diagram model
        this.diagramService.deleteComponent(componentId);
        
        this.logger.info(`Component deleted: ${componentId}, cell: ${component.cellId ?? 'not found'}`);
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error deleting component', error);
    }
  }
  
  /**
   * Delete all edges connected to a vertex from the diagram model
   * This is called after deleting a vertex from maxGraph to keep the model in sync
   */
  private deleteEdgesConnectedToVertex(vertexComponentId: string, vertexCellId: string | undefined): void {
    if (!vertexCellId) {
      this.logger.warn(`Cannot delete connected edges: No cellId for component ${vertexComponentId}`);
      return;
    }
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram) {
      this.logger.warn('Cannot delete connected edges: No diagram loaded');
      return;
    }
    
    // Find all edge components connected to this vertex component
    const edgesToDelete = diagram.components.filter(component => {
      if (component.type !== 'edge') return false;
      
      // Look for edges where this vertex is the source or target
      const edgeData = component.data;
      const source = edgeData['source'] as string;
      const target = edgeData['target'] as string;
      
      return source === vertexComponentId || target === vertexComponentId;
    });
    
    // Delete each connected edge component
    if (edgesToDelete.length > 0) {
      this.logger.info(`Found ${edgesToDelete.length} edges connected to vertex ${vertexComponentId} to delete`);
      
      for (const edge of edgesToDelete) {
        this.logger.debug(`Deleting edge component: ${edge.id}`);
        this.diagramService.deleteComponent(edge.id);
      }
    } else {
      this.logger.debug(`No edges found connected to vertex ${vertexComponentId}`);
    }
  }
  
  /**
   * Delete a cell directly by its ID
   * This is used when a cell doesn't have an associated component
   */
  deleteCellById(cellId: string): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot delete cell: Graph not initialized');
      return;
    }
    
    // Get the cell by ID
    const cell = this.getCellById(cellId);
    
    if (!cell) {
      this.logger.error(`Cannot delete cell: Cell not found with ID ${cellId}`);
      return;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Remove the cell from the graph
        this.graph.removeCells([cell]);
        this.logger.info(`Cell deleted: ${cellId}`);
        
        // Emit a selection changed event to update UI
        this.emitSelectionChanged(null);
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error(`Error deleting cell with ID ${cellId}`, error);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.graph) {
      this.graph.destroy();
      this.graph = null;
    }
    
    this.model = null;
    this.container = null;
    this._isInitialized.next(false);
    
    this.logger.info('DiagramRendererService destroyed');
  }
  
  /**
   * Create a direct edge between two vertices - simpler version for testing
   * This creates two vertices and an edge between them in one operation
   */
  createDirectEdge(sourceX: number, sourceY: number, targetX: number, targetY: number, label = ''): string | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return null;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Create the source vertex first
        const parent = this.graph.getDefaultParent();
        
        // 1. First create the source vertex in maxGraph with UUID
        const sourceCellId = uuidv4();
        const sourceVertex = this.graph.insertVertex(
          parent,
          sourceCellId, // Use UUID
          'Source',
          sourceX,
          sourceY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 2. Then create the component that references the cell
        const sourceComponentData = {
          x: sourceX,
          y: sourceY,
          width: 100,
          height: 40,
          label: 'Source',
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: sourceCellId // Use our UUID
        };
        
        // Add source component to diagram model
        const sourceComponent = this.diagramService.addComponent('vertex', sourceComponentData);
        this.logger.debug(`Created source vertex: component=${sourceComponent.id}, cell=${sourceCellId}`);

        // 1. First create the target vertex in maxGraph with UUID
        const targetCellId = uuidv4();
        const targetVertex = this.graph.insertVertex(
          parent,
          targetCellId, // Use UUID
          'Target',
          targetX,
          targetY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 2. Then create the component that references the cell
        const targetComponentData = {
          x: targetX,
          y: targetY,
          width: 100,
          height: 40,
          label: 'Target',
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: targetCellId // Use our UUID
        };
        
        // Add target component to diagram model
        const targetComponent = this.diagramService.addComponent('vertex', targetComponentData);
        this.logger.debug(`Created target vertex: component=${targetComponent.id}, cell=${targetCellId}`);
        
        // First create the edge in the graph (maxGraph first) with UUID
        const edgeCellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          edgeCellId, // Use UUID
          label,
          sourceVertex,
          targetVertex,
          'edgeStyle=orthogonalEdgeStyle;rounded=1;'
        );
        
        // Set default anchor points (center)
        this.setEdgeTerminalPoint(edge, 'C', true);   // Source
        this.setEdgeTerminalPoint(edge, 'C', false);  // Target
        
        // Then create the edge component with the cell ID
        const edgeComponentData = {
          source: sourceComponent.id,
          target: targetComponent.id,
          sourceAnchor: 'C',  // Default center anchor
          targetAnchor: 'C',  // Default center anchor
          label,
          style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;',
          cellId: edgeCellId // Include the cell ID from the start
        };
        
        // Add the edge component to the diagram model
        const edgeComponent = this.diagramService.addComponent('edge', edgeComponentData);
        
        this.logger.info(`Direct edge created: component=${edgeComponent.id}, cell=${edgeCellId}`);
        return edgeComponent.id;
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating direct edge', error);
      return null;
    }
  }
  
  /**
   * Create a complete edge with source and target vertices in a single operation.
   * This method handles both the graph operations and component creation in one step.
   * Following our architecture: create maxGraph elements first, then create components.
   */
  createSingleEdgeWithVertices(
    sourceX: number,
    sourceY: number,
    sourceLabel: string,
    targetX: number,
    targetY: number,
    targetLabel: string,
    edgeLabel = '',
    sourceAnchor: AnchorPointPosition = 'C',
    targetAnchor: AnchorPointPosition = 'C'
  ): string | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return null;
    }
    
    try {
      // Begin a single atomic update for all maxGraph operations
      this.model.beginUpdate();
      
      try {
        const parent = this.graph.getDefaultParent();
        
        // 1. First create source vertex in maxGraph with UUID
        const sourceCellId = uuidv4();
        const sourceVertex = this.graph.insertVertex(
          parent,
          sourceCellId, // Use UUID
          sourceLabel,
          sourceX,
          sourceY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 2. Create target vertex in maxGraph with UUID
        const targetCellId = uuidv4();
        const targetVertex = this.graph.insertVertex(
          parent,
          targetCellId, // Use UUID
          targetLabel,
          targetX,
          targetY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 3. Create the edge in maxGraph with UUID
        const edgeCellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          edgeCellId, // Use UUID
          edgeLabel,
          sourceVertex,
          targetVertex,
          'edgeStyle=orthogonalEdgeStyle;rounded=1;'
        );
        
        // Set the connection points for source and target
        this.setEdgeTerminalPoint(edge, sourceAnchor, true);  // Source
        this.setEdgeTerminalPoint(edge, targetAnchor, false); // Target
        
        // 4. Create source vertex component with cell ID already set
        const sourceComponentData = {
          x: sourceX,
          y: sourceY,
          width: 100,
          height: 40,
          label: sourceLabel,
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: sourceCellId
        };
        
        // 5. Create target vertex component with cell ID already set
        const targetComponentData = {
          x: targetX,
          y: targetY,
          width: 100,
          height: 40,
          label: targetLabel,
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: targetCellId
        };
        
        // Create and add components in one step
        const sourceComponent = this.diagramService.addComponent('vertex', sourceComponentData);
        const targetComponent = this.diagramService.addComponent('vertex', targetComponentData);
        
        // 6. Create edge component with cell ID already set
        const edgeComponentData = {
          source: sourceComponent.id,
          target: targetComponent.id,
          sourceAnchor,
          targetAnchor,
          label: edgeLabel,
          style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;',
          cellId: edgeCellId
        };
        
        // Create and add edge component in one step
        const edgeComponent = this.diagramService.addComponent('edge', edgeComponentData);
        
        // Log what we've created
        this.logger.info('Created complete edge with vertices', {
          sourceComponentId: sourceComponent.id,
          targetComponentId: targetComponent.id,
          edgeComponentId: edgeComponent.id,
          sourceCellId: sourceCellId,
          targetCellId: targetCellId,
          edgeCellId: edgeCellId
        });
        
        return edgeComponent.id;
      } finally {
        // End the update to apply all changes at once
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating edge with vertices', error);
      return null;
    }
  }
}