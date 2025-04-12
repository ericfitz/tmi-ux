import { Injectable, NgZone } from '@angular/core';
import { Graph, constants } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { MxGraphPatchingService } from './mx-graph-patching.service';

// Define custom interfaces for extending HTML elements with custom properties
interface ExtendedHTMLElement extends HTMLElement {
  _mxGraphKeydownHandler?: (e: KeyboardEvent) => void;
  _mxResizeObserver?: ResizeObserver;
}

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
            // MaxGraph exposes model directly as a property, not through a method
            this.model = this.graph.model;
            
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
      
      // Allow selection and connections
      this.graph.setPanning(true);
      this.graph.setTooltips(true);
      this.graph.setConnectable(true); // Enable creating connections
      this.graph.setCellsEditable(true); // Allow editing labels
      this.graph.setEnabled(true);
      
      // Enable connection handling
      this.graph.setPortsEnabled(true); // Make sure ports are enabled
      this.graph.setAllowDanglingEdges(false); // Don't allow edges without targets
      
      // Auto sizing
      this.graph.setAutoSizeCells(true);
      this.graph.setCellsResizable(true);
      
      // Enable rubberband selection
      // Note: MaxGraph handles RubberBand selection differently than mxGraph
      // We'll use MaxGraph's built-in selection behavior
      // MaxGraph doesn't have setRubberband method
      
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
      
      // Enable cell editing via double-click
      this.graph.setCellsLocked(false);
      this.graph.setCellsEditable(true); // Allow cells to be edited
      this.graph.setAutoSizeCells(false); // Disable auto-sizing to prevent resizing after label edits
      
      // Configure cell editor behavior
      if (this.graph.cellEditor) {
        // Configure how Enter and Shift+Enter behave in the editor
        const originalInstallListeners = this.graph.cellEditor.installListeners;
        
        if (originalInstallListeners) {
          this.graph.cellEditor.installListeners = function(inputElement: HTMLElement) {
            originalInstallListeners.apply(this, arguments);
            
            // Add keydown handler for the input element
            if (inputElement) {
              const editor = this;
              
              // Define property to store handler on element for later cleanup
              // Use type assertion to add custom property
              const inputEl = inputElement as HTMLElement & { _mxGraphKeydownHandler?: (e: KeyboardEvent) => void };
              
              // Remove any previous keydown handlers to prevent duplicates
              const oldKeydownHandler = inputEl._mxGraphKeydownHandler;
              if (oldKeydownHandler) {
                inputEl.removeEventListener('keydown', oldKeydownHandler);
              }
              
              // Create and store the new keydown handler
              const keydownHandler = function(evt: KeyboardEvent) {
                // Handle Enter key to complete editing (unless Shift is pressed)
                if (evt.key === 'Enter' && !evt.shiftKey) {
                  editor.stopEditing(!evt.altKey);
                  evt.preventDefault();
                } 
                // Prevent default for Delete/Backspace only when in label editing
                // to prevent accidental cell deletion
                else if (evt.key === 'Delete' || evt.key === 'Backspace') {
                  // Don't prevent default - let the editor handle it normally
                  // Just prevent event propagation to avoid triggering cell deletion
                  evt.stopPropagation();
                }
                // Shift+Enter will add a new line (default behavior)
              };
              
              // Store reference to the handler for potential cleanup
              inputEl._mxGraphKeydownHandler = keydownHandler;
              inputEl.addEventListener('keydown', keydownHandler);
            }
          };
        }
        
        // Override the default escape handler to properly cancel editing
        if (this.graph.cellEditor.cancelEditing) {
          const originalCancelEditing = this.graph.cellEditor.cancelEditing;
          this.graph.cellEditor.cancelEditing = function() {
            originalCancelEditing.apply(this, arguments);
            // Additional cleanup if needed
            if (this.textarea) {
              // Use type assertion to access the custom property
              const textareaEl = this.textarea as HTMLElement & { 
                _mxGraphKeydownHandler?: (e: KeyboardEvent) => void 
              };
              
              if (textareaEl._mxGraphKeydownHandler) {
                textareaEl.removeEventListener('keydown', textareaEl._mxGraphKeydownHandler);
                delete textareaEl._mxGraphKeydownHandler;
              }
            }
          };
        }
        
        // Override stopEditing to prevent auto-sizing vertices
        if (this.graph.cellEditor.stopEditing) {
          const originalStopEditing = this.graph.cellEditor.stopEditing;
          this.graph.cellEditor.stopEditing = function(cancel?: boolean) {
            // Get current editing cell before stopping
            const cell = this.editingCell;
            const isVertex = cell && cell.vertex;
            
            // If it's a vertex, temporarily store its geometry
            let originalGeometry = null;
            if (isVertex && this.graph && this.graph.model && this.graph.model.getGeometry) {
              try {
                originalGeometry = this.graph.model.getGeometry(cell);
                if (originalGeometry) {
                  originalGeometry = originalGeometry.clone();
                }
              } catch (e) {
                // If we can't get geometry, continue without this optimization
              }
            }
            
            // Call original method
            const result = originalStopEditing.apply(this, arguments);
            
            // Restore original geometry if needed
            if (isVertex && originalGeometry && this.graph && this.graph.model) {
              try {
                // Using a transaction to avoid multiple refresh calls
                this.graph.model.beginUpdate();
                try {
                  // Check if dimensions changed and restore them if needed
                  const currentGeometry = this.graph.model.getGeometry(cell);
                  if (currentGeometry && 
                      (currentGeometry.width !== originalGeometry.width ||
                       currentGeometry.height !== originalGeometry.height)) {
                    // Create a new geometry with original dimensions but keeping the new position
                    const restoredGeometry = currentGeometry.clone();
                    restoredGeometry.width = originalGeometry.width;
                    restoredGeometry.height = originalGeometry.height;
                    this.graph.model.setGeometry(cell, restoredGeometry);
                  }
                } finally {
                  this.graph.model.endUpdate();
                }
              } catch (e) {
                // If restoration fails, log but allow editing to complete
                console.error('Error restoring cell geometry after editing', e);
              }
            }
            
            return result;
          };
        }
      }
      
      // Enable label movement for both edges and vertices
      this.graph.edgeLabelsMovable = true; // Allow moving edge labels
      this.graph.vertexLabelsMovable = true; // Allow moving vertex labels
      
      // Configure label handle position to be at the top center
      try {
        // First, check if we can set the global label handle position
        if (this.graph.graphHandler && this.graph.graphHandler.getLabelPosition) {
          const originalGetLabelPosition = this.graph.graphHandler.getLabelPosition;
          this.graph.graphHandler.getLabelPosition = function(state: any) {
            const pos = originalGetLabelPosition.apply(this, arguments);
            
            if (pos && state && state.text && state.text.boundingBox) {
              // Calculate position at the top center of the label
              return {
                x: state.text.boundingBox.x + state.text.boundingBox.width / 2,
                y: state.text.boundingBox.y - 10 // Position above the text
              };
            }
            
            return pos;
          };
        }
        
        // Modify the cell editor to maintain existing label position during editing
        // and to show bounding box during editing
        if (this.graph.cellEditor) {
          // We want to preserve the original label position during editing
          if (this.graph.cellEditor.getInitialCellStyle) {
            const originalGetInitialCellStyle = this.graph.cellEditor.getInitialCellStyle;
            this.graph.cellEditor.getInitialCellStyle = function() {
              // Get the original style without our modifications
              return originalGetInitialCellStyle.apply(this, arguments);
            };
          }
          
          // Add bounding box visualization during editing
          // And hide the label handle
          if (this.graph.cellEditor.startEditing) {
            const originalStartEditing = this.graph.cellEditor.startEditing;
            this.graph.cellEditor.startEditing = function() {
              // Call original method to start editing
              const result = originalStartEditing.apply(this, arguments);
              
              if (this.textarea) {
                try {
                  // Add visual bounding box to the textarea with !important to override any theme settings
                  this.textarea.style.setProperty('border', '2px dashed #2196F3', 'important');
                  this.textarea.style.setProperty('box-shadow', '0 0 6px rgba(33, 150, 243, 0.5)', 'important');
                  this.textarea.style.setProperty('padding', '4px', 'important');
                  this.textarea.style.setProperty('border-radius', '2px', 'important');
                  this.textarea.style.setProperty('background-color', 'rgba(255, 255, 255, 0.95)', 'important');
                  
                  // Make sure textarea is visible and has proper z-index
                  this.textarea.style.setProperty('z-index', '999', 'important');
                  this.textarea.style.setProperty('opacity', '1', 'important');
                } catch (e) {
                  // Ignore styling errors, not critical
                }
              }
              
              // Deselect the parent object (vertex/edge) when editing its label
              try {
                if (this.editingCell && this.graph) {
                  // Clear the current selection to deselect the parent
                  this.graph.clearSelection();
                }
              } catch (e) {
                // Ignore selection errors
              }
              
              // Hide the label handle for the current editing cell
              try {
                if (this.editingCell && this.graph && this.graph.selectionHandler) {
                  const handler = this.graph.selectionHandler.handlers && 
                                  this.graph.selectionHandler.handlers[this.editingCell.id];
                  
                  if (handler && handler.labelShape) {
                    // Store current visibility state so we can restore it later
                    handler.labelShape._wasVisible = handler.labelShape.node && 
                                                    handler.labelShape.node.style.visibility !== 'hidden';
                    
                    // Hide the handle
                    if (handler.labelShape.node) {
                      handler.labelShape.node.style.visibility = 'hidden';
                    }
                  }
                }
              } catch (e) {
                // Ignore any errors during handle hiding
              }
              
              return result;
            };
          }
          
          // Update label handle position during editing as text changes
          if (this.graph.cellEditor.installListeners) {
            const originalInstallListeners = this.graph.cellEditor.installListeners;
            this.graph.cellEditor.installListeners = function(inputElement: ExtendedHTMLElement) {
              // Call original method
              originalInstallListeners.apply(this, arguments);
              
              // Add input event listener to track content changes
              if (inputElement) {
                const editor = this;
                
                // Create a resize observer to track textarea size changes
                // We'll still need this to update handle positions correctly
                // once editing is completed
                const resizeObserver = new ResizeObserver(() => {
                  // If the cell is being edited and we know which cell it is
                  if (editor.editingCell && editor.graph) {
                    try {
                      // Get the state for this cell
                      const state = editor.graph.view.getState(editor.editingCell);
                      
                      // Just store the final bounding box dimensions
                      // We won't update the handle position during editing (it's hidden)
                      // but we'll store the information for when editing stops
                      if (state && state.text && state.text.boundingBox) {
                        // Get handler for this cell
                        const handler = editor.graph.selectionHandler && 
                                        editor.graph.selectionHandler.handlers && 
                                        editor.graph.selectionHandler.handlers[editor.editingCell.id];
                        
                        if (handler && handler.labelShape) {
                          // Store the dimensions for when editing is complete
                          const bbox = state.text.boundingBox;
                          
                          // Save the new position for when we make the handle visible again
                          handler.labelShape._pendingX = bbox.x + bbox.width / 2 - handler.labelShape.bounds.width / 2;
                          handler.labelShape._pendingY = bbox.y - handler.labelShape.bounds.height - 2;
                        }
                      }
                    } catch (e) {
                      // Ignore errors during dimension tracking
                    }
                  }
                });
                
                // Start observing the textarea
                try {
                  resizeObserver.observe(inputElement);
                  
                  // Store observer for cleanup - we already know inputElement is ExtendedHTMLElement
                  inputElement._mxResizeObserver = resizeObserver;
                } catch (e) {
                  // Ignore observer errors
                }
              }
            };
          }
          
          // Ensure cleanup of observers when editing stops
          // And restore handle visibility
          if (this.graph.cellEditor.stopEditing) {
            const originalStopEditing = this.graph.cellEditor.stopEditing;
            this.graph.cellEditor.stopEditing = function(cancel?: boolean) {
              // Restore label handle visibility
              try {
                if (this.editingCell && this.graph && this.graph.selectionHandler) {
                  const handler = this.graph.selectionHandler.handlers && 
                                 this.graph.selectionHandler.handlers[this.editingCell.id];
                  
                  if (handler && handler.labelShape) {
                    // We only restore visibility if it was previously visible
                    const shouldBeVisible = handler.labelShape._wasVisible !== false;
                    
                    // Show the handle if it was previously visible
                    if (handler.labelShape.node && shouldBeVisible) {
                      // Apply any pending position update that was tracked during editing
                      if (handler.labelShape._pendingX !== undefined && 
                          handler.labelShape._pendingY !== undefined) {
                        // Update the position to match the new text dimensions
                        handler.labelShape.bounds.x = handler.labelShape._pendingX;
                        handler.labelShape.bounds.y = handler.labelShape._pendingY;
                        
                        // Make the handle visible again
                        handler.labelShape.node.style.visibility = 'visible';
                        
                        // Force redraw after position update
                        if (handler.labelShape.redraw) {
                          handler.labelShape.redraw();
                        }
                        
                        // Clean up pending positions
                        delete handler.labelShape._pendingX;
                        delete handler.labelShape._pendingY;
                      } else {
                        // Just make it visible if no pending position
                        handler.labelShape.node.style.visibility = 'visible';
                      }
                    }
                    
                    // Clean up our tracking property
                    delete handler.labelShape._wasVisible;
                  }
                }
              } catch (e) {
                // Ignore any errors during handle visibility restoration
              }
              
              // Clean up resize observer if it exists
              if (this.textarea) {
                const textareaEl = this.textarea as ExtendedHTMLElement;
                if (textareaEl._mxResizeObserver) {
                  try {
                    textareaEl._mxResizeObserver.disconnect();
                    delete textareaEl._mxResizeObserver;
                  } catch (e) {
                    // Ignore cleanup errors
                  }
                }
              }
              
              // Call original method
              const result = originalStopEditing.apply(this, arguments);
              
              // Small delay to ensure handle is visible after editing is fully complete
              setTimeout(() => {
                try {
                  if (this.graph && this.graph.refresh) {
                    this.graph.refresh();
                  }
                } catch (e) {
                  // Ignore refresh errors
                }
              }, 0);
              
              return result;
            };
          }
        }
        
        // Force the graph to maintain the position of the label handle at the top
        if (this.graph) {
          // Directly set label position properties
          this.graph.cellsLocked = false;
          this.graph.vertexLabelsMovable = true;
          
          // We only want to change the handle position, not the actual label position
          // Keep labels centered within vertices by default
        }
        
        // Set up custom label handle shape and positioning
        // Also implement real-time label movement during handle drag
        if (this.graph.createHandler) {
          const originalCreateHandler = this.graph.createHandler;
          this.graph.createHandler = function(state: any) {
            const handler = originalCreateHandler.apply(this, arguments);
            
            // If this handler is for a cell with a label
            if (handler && state && state.text) {
              // Store references to text and shape elements
              const textElement = state.text.node;
              const boundingBox = state.text.boundingBox;
              
              // Define a function to update the handle position to top center
              const updateLabelHandlePosition = function() {
                if (handler.labelShape && state.text && state.text.boundingBox) {
                  const bbox = state.text.boundingBox;
                  
                  // Position at top center
                  handler.labelShape.bounds.x = bbox.x + bbox.width / 2 - handler.labelShape.bounds.width / 2;
                  handler.labelShape.bounds.y = bbox.y - handler.labelShape.bounds.height - 2; // Above text
                  
                  // Update the shape visually
                  if (handler.labelShape.node) {
                    if (handler.labelShape.updateBoundingBox) {
                      handler.labelShape.updateBoundingBox();
                    }
                    if (handler.labelShape.redraw) {
                      handler.labelShape.redraw();
                    }
                  }
                }
              };
              
              // Create label bounding box indicator for drag operations
              const createBoundingBoxIndicator = function() {
                if (!handler._labelBoundingBox && state.text && state.text.boundingBox) {
                  const bbox = state.text.boundingBox;
                  
                  // Create a bounding box element
                  const boxElement = document.createElement('div');
                  boxElement.style.position = 'absolute';
                  boxElement.style.border = '1px dashed #2196F3';
                  boxElement.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
                  boxElement.style.pointerEvents = 'none'; // Don't interfere with mouse events
                  boxElement.style.display = 'none'; // Initially hidden
                  boxElement.style.zIndex = '999';
                  
                  // Add to the graph container
                  if (handler.graph && handler.graph.container) {
                    handler.graph.container.appendChild(boxElement);
                    
                    // Store reference for updates
                    handler._labelBoundingBox = boxElement;
                    
                    // Initial position
                    updateBoundingBoxIndicator();
                  }
                }
              };
              
              // Update bounding box position and size
              const updateBoundingBoxIndicator = function() {
                if (handler._labelBoundingBox && state.text && state.text.boundingBox) {
                  const bbox = state.text.boundingBox;
                  
                  // Update position and size
                  handler._labelBoundingBox.style.left = bbox.x + 'px';
                  handler._labelBoundingBox.style.top = bbox.y + 'px';
                  handler._labelBoundingBox.style.width = bbox.width + 'px';
                  handler._labelBoundingBox.style.height = bbox.height + 'px';
                }
              };
              
              // Show the bounding box during drag
              const showBoundingBoxDuringDrag = function(show: boolean) {
                if (handler._labelBoundingBox) {
                  handler._labelBoundingBox.style.display = show ? 'block' : 'none';
                }
              };
              
              // Update immediately after handler creation
              setTimeout(updateLabelHandlePosition, 0);
              setTimeout(createBoundingBoxIndicator, 0);
              
              // Override label mouse down to show bounding box
              if (handler.labelShape) {
                const originalMouseDown = handler.labelShape.mouseDown;
                if (originalMouseDown) {
                  handler.labelShape.mouseDown = function(sender: any, evt: any) {
                    // Show the bounding box when starting to drag
                    showBoundingBoxDuringDrag(true);
                    return originalMouseDown.apply(this, arguments);
                  };
                }
              }
              
              // Implement real-time dragging for the label text
              // Override the existing mouseDragged method to update text position in real-time
              if (handler.labelShape) {
                const originalMouseDragged = handler.labelShape.mouseDragged;
                if (originalMouseDragged) {
                  handler.labelShape.mouseDragged = function(sender: any, evt: any) {
                    // Call original method to update handle position
                    const result = originalMouseDragged.apply(this, arguments);
                    
                    // Get the current dx, dy for the drag operation
                    const dx = evt.getX() - this.startX;
                    const dy = evt.getY() - this.startY;
                    
                    // Update the text position in real-time during drag
                    if (state.text && textElement) {
                      // Calculate the current transform 
                      if (state.text.updateTransform) {
                        // Move the actual text element with the handle
                        // This handles the real-time visual update without changing the model yet
                        const transform = `translate(${dx}px, ${dy}px)`;
                        textElement.style.transform = transform;
                        
                        // Update the bounding box indicator's position
                        if (handler._labelBoundingBox && boundingBox) {
                          handler._labelBoundingBox.style.transform = transform;
                        }
                      }
                    }
                    
                    return result;
                  };
                }
                
                // Also override mouseUp to properly reset transforms when drag ends
                const originalMouseUp = handler.labelShape.mouseUp;
                if (originalMouseUp) {
                  handler.labelShape.mouseUp = function(sender: any, evt: any) {
                    // Hide the bounding box when done dragging
                    showBoundingBoxDuringDrag(false);
                    
                    // Reset transforms before the GraphEvent handler makes the actual model change
                    if (state.text && textElement) {
                      textElement.style.transform = '';
                    }
                    
                    if (handler._labelBoundingBox) {
                      handler._labelBoundingBox.style.transform = '';
                    }
                    
                    // Call the original method to finalize the drag in the model
                    return originalMouseUp.apply(this, arguments);
                  };
                }
              }
              
              // Also update when state changes
              const originalRedrawHandles = handler.redrawHandles;
              if (originalRedrawHandles) {
                handler.redrawHandles = function() {
                  originalRedrawHandles.apply(this, arguments);
                  updateLabelHandlePosition();
                  updateBoundingBoxIndicator();
                };
              }
              
              // Override updateLabelShape if it exists
              if (handler.updateLabelShape) {
                const originalUpdateLabelShape = handler.updateLabelShape;
                handler.updateLabelShape = function() {
                  originalUpdateLabelShape.apply(this, arguments);
                  updateLabelHandlePosition();
                  updateBoundingBoxIndicator();
                };
              }
              
              // Also update on selection to ensure consistent positioning
              if (handler.selectionChanged) {
                const originalSelectionChanged = handler.selectionChanged;
                handler.selectionChanged = function() {
                  originalSelectionChanged.apply(this, arguments);
                  setTimeout(updateLabelHandlePosition, 10);
                  setTimeout(updateBoundingBoxIndicator, 10);
                };
              }
              
              // Force top center position by modifying the point getter if needed
              if (handler.getLabelPosition) {
                handler.getLabelPosition = function() {
                  if (state && state.text && state.text.boundingBox) {
                    const bbox = state.text.boundingBox;
                    return {
                      x: bbox.x + bbox.width/2,
                      y: bbox.y - 10
                    };
                  }
                  return null;
                };
              }
              
              // Clean up bounding box element when handler is destroyed
              if (handler.destroy) {
                const originalDestroy = handler.destroy;
                handler.destroy = function() {
                  // Remove bounding box
                  if (handler._labelBoundingBox && handler._labelBoundingBox.parentNode) {
                    handler._labelBoundingBox.parentNode.removeChild(handler._labelBoundingBox);
                    delete handler._labelBoundingBox;
                  }
                  
                  // Call original destroy
                  return originalDestroy.apply(this, arguments);
                };
              }
            }
            
            return handler;
          };
        }
      } catch (error) {
        this.logger.error('Error configuring label handle position', error);
      }
      
      // Resize parent on child resize
      this.graph.setExtendParents(true);
      this.graph.setExtendParentsOnAdd(true);
      this.graph.setConstrainChildren(true);
      
      // Grid settings
      this.graph.gridSize = 10;
      
      // Configure disconnection behavior
      this.graph.setDisconnectOnMove(false);
      this.graph.setAllowDanglingEdges(false);
      
      // Configure connection points and handlers
      this.graph.setPortsEnabled(true);
      
      // Configure bend points for edges (MaxGraph API differs from mxGraph)
      this.graph.setConnectableEdges(true); // Set to true to enable connecting edges

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