import { Injectable } from '@angular/core';
import { Graph, Node, Edge } from '@antv/x6'; // Removed Cell
import { Observable, of } from 'rxjs'; // Removed from
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdStateStore } from '../state/dfd.state';
import { CommandManagerService } from '../commands/command-manager.service';
import { CommandFactory } from '../commands/command-factory.service';
import { ShapeType } from './dfd-node.service';
import { DfdEventBusService, DfdEventType, NodeDeletedEvent } from './dfd-event-bus.service';
import { CommandResult } from '../commands/command.interface';
import { DfdErrorService } from './dfd-error.service';

interface GraphWithUndoFlag extends Graph {
  isUndoingOperation?: boolean;
}

/**
 * Service that combines the command pattern with DFD operations
 * Leverages the CommandManagerService to execute operations with undo/redo support
 */
@Injectable({
  providedIn: 'root',
})
export class DfdCommandService {
  constructor(
    private logger: LoggerService,
    private stateStore: DfdStateStore,
    private commandManager: CommandManagerService,
    private commandFactory: CommandFactory,
    private eventBus: DfdEventBusService,
    private errorService: DfdErrorService,
  ) {
    this.logger.info('DfdCommandService initialized');
  }

  /**
   * Create a new node with the specified shape type
   * @param shapeType The type of shape to create
   * @param position The position for the new node
   * @param containerElement Optional container element for sizing calculations
   * @returns Observable that emits the command result
   */
  createNode(
    shapeType: ShapeType,
    position: { x: number; y: number },
    containerElement?: HTMLElement,
  ): Observable<CommandResult<Node>> {
    this.logger.info('Creating node with command', { shapeType, position });

    try {
      // Get the graph instance
      const graph = this.stateStore.graph;
      if (!graph) {
        return of({
          success: false,
          error: new Error('Graph is not initialized'),
        });
      }

      // Create the command
      const command = this.commandFactory.createAddNodeCommand({
        type: shapeType,
        position,
        containerElement,
      });

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success && result.data) {
            // Publish event that a node was added
            this.eventBus.publish({
              type: DfdEventType.GraphChanged,
              timestamp: Date.now(),
              cells: graph.getCells(),
              added: [result.data],
            });
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error creating node', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Creates a node at a random position
   * @param shapeType The type of shape to create
   * @param containerElement The container element for sizing calculations
   * @returns Observable that emits the command result
   */
  createRandomNode(
    shapeType: ShapeType,
    containerElement?: HTMLElement,
  ): Observable<CommandResult<Node>> {
    // Generate a random position within the visible area
    const graph = this.stateStore.graph;
    if (!graph) {
      return of({
        success: false,
        error: new Error('Graph is not initialized'),
      });
    }

    // Get the size of the container
    let width = 800;
    let height = 600;

    if (containerElement) {
      width = containerElement.clientWidth;
      height = containerElement.clientHeight;
    } else if (graph.container) {
      width = graph.container.clientWidth;
      height = graph.container.clientHeight;
    }

    // Calculate a random position with some padding
    const padding = 100;
    const x = Math.floor(Math.random() * (width - 2 * padding)) + padding;
    const y = Math.floor(Math.random() * (height - 2 * padding)) + padding;

    return this.createNode(shapeType, { x, y }, containerElement);
  }

  /**
   * Delete a node
   * @param nodeId The ID of the node to delete
   * @returns Observable that emits the command result
   */
  deleteNode(nodeId: string): Observable<CommandResult<void>> {
    this.logger.info('Deleting node with command', { nodeId });

    try {
      // Create the command
      const command = this.commandFactory.createDeleteNodeCommand(nodeId);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success) {
            const graph = this.stateStore.graph;
            if (graph) {
              // Publish event that a node was deleted
              this.eventBus.publish({
                type: DfdEventType.NodeDeleted,
                timestamp: Date.now(),
                nodeId,
              } as NodeDeletedEvent);

              // Update the selection state if the deleted node was selected
              const selectedNode = this.stateStore.selectedNode;
              if (selectedNode && selectedNode.id === nodeId) {
                this.stateStore.updateState({ selectedNode: null }, 'DfdCommandService.deleteNode');
              }
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error deleting node', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Move a node to a new position
   * @param nodeId The ID of the node to move
   * @param newPosition The new position for the node
   * @returns Observable that emits the command result
   */
  moveNode(nodeId: string, newPosition: { x: number; y: number }): Observable<CommandResult<void>> {
    this.logger.info('Moving node with command', { nodeId, newPosition });

    try {
      // Create the command
      const command = this.commandFactory.createMoveNodeCommand(nodeId, newPosition);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success) {
            const graph = this.stateStore.graph;
            if (graph) {
              // Publish event that a node was moved
              this.eventBus.publish({
                type: DfdEventType.NodeMoved,
                timestamp: Date.now(),
                node: graph.getCellById(nodeId) as Node,
              });
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error moving node', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Edit a node's label
   * @param nodeId The ID of the node to edit
   * @param newLabel The new label for the node
   * @returns Observable that emits the command result
   */
  editNodeLabel(nodeId: string, newLabel: string): Observable<CommandResult<string>> {
    this.logger.info('Editing node label with command', { nodeId, newLabel });

    try {
      // Create the command
      const command = this.commandFactory.createEditNodeLabelCommand(nodeId, newLabel);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success) {
            const graph = this.stateStore.graph;
            if (graph) {
              // Update the state store with the edited node
              const node = graph.getCellById(nodeId) as Node;
              if (node) {
                // Only update selection if this node is already selected
                const selectedNode = this.stateStore.selectedNode;
                if (selectedNode && selectedNode.id === nodeId) {
                  this.stateStore.updateState(
                    {
                      selectedNode: node,
                    },
                    'DfdCommandService.editNodeLabel',
                  );
                }

                // Publish event that the graph changed
                this.eventBus.publish({
                  type: DfdEventType.GraphChanged,
                  timestamp: Date.now(),
                  cells: graph.getCells(),
                });
              }
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error editing node label', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Create an edge between nodes
   * @param params Edge creation parameters
   * @returns Observable that emits the command result
   */
  createEdge(params: {
    source: { id: string; port?: string };
    target: { id: string; port?: string };
    vertices?: Array<{ x: number; y: number }>;
    attrs?: Record<string, unknown>;
    data?: Record<string, unknown>;
    router?: { name: string; args?: Record<string, unknown> };
    connector?: { name: string; args?: Record<string, unknown> };
  }): Observable<CommandResult<Edge>> {
    this.logger.info('Creating edge with command', params);

    try {
      // Create the command
      const command = this.commandFactory.createAddEdgeCommand(params);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success && result.data) {
            const graph = this.stateStore.graph;
            if (graph) {
              // Publish event that an edge was created
              this.eventBus.publish({
                type: DfdEventType.EdgeCreated,
                timestamp: Date.now(),
                edge: result.data,
              });
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error creating edge', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Delete an edge
   * @param edgeId The ID of the edge to delete
   * @returns Observable that emits the command result
   */
  deleteEdge(edgeId: string): Observable<CommandResult<void>> {
    this.logger.info('Deleting edge with command', { edgeId });

    try {
      // Get the edge before deletion for event
      const graph = this.stateStore.graph;
      if (!graph) {
        return of({
          success: false,
          error: new Error('Graph is not initialized'),
        });
      }

      const edge = graph.getCellById(edgeId) as Edge;

      // Create the command
      const command = this.commandFactory.createDeleteEdgeCommand(edgeId);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success && edge) {
            // Publish event that an edge was removed
            this.eventBus.publish({
              type: DfdEventType.EdgeRemoved,
              timestamp: Date.now(),
              edge,
            });
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error deleting edge', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Update an edge's vertices (control points)
   * @param edgeId The ID of the edge to update
   * @param newVertices The new vertices for the edge
   * @returns Observable that emits the command result
   */
  updateEdgeVertices(
    edgeId: string,
    newVertices: Array<{ x: number; y: number }>,
  ): Observable<CommandResult<void>> {
    this.logger.info('Updating edge vertices with command', { edgeId, newVertices });

    try {
      // Create the command
      const command = this.commandFactory.createUpdateEdgeVerticesCommand(edgeId, newVertices);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success) {
            const graph = this.stateStore.graph;
            if (graph) {
              // Publish event that the graph changed
              this.eventBus.publish({
                type: DfdEventType.GraphChanged,
                timestamp: Date.now(),
                cells: graph.getCells(),
              });
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error updating edge vertices', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Edit an edge's label
   * @param edgeId The ID of the edge to edit
   * @param newLabel The new label for the edge
   * @returns Observable that emits the command result
   */
  editEdgeLabel(edgeId: string, newLabel: string): Observable<CommandResult<string>> {
    this.logger.info('Editing edge label with command', { edgeId, newLabel });

    try {
      // Create the command
      const command = this.commandFactory.createEditEdgeLabelCommand(edgeId, newLabel);

      // Execute the command
      return this.commandManager.executeCommand(command).pipe(
        tap(result => {
          if (result.success) {
            const graph = this.stateStore.graph;
            if (graph) {
              // Publish event that the graph changed
              this.eventBus.publish({
                type: DfdEventType.GraphChanged,
                timestamp: Date.now(),
                cells: graph.getCells(),
              });
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error editing edge label', error);
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Performs an undo operation if available
   * @returns Observable that emits the command result
   */
  undo(): Observable<CommandResult> {
    this.logger.info('Undoing last command');

    // Get the graph instance
    const graph = this.stateStore.graph;
    if (!graph) {
      return of({
        success: false,
        error: new Error('Graph is not initialized'),
      });
    }

    try {
      // Set the flag to prevent history entries during undo
      (graph as GraphWithUndoFlag).isUndoingOperation = true;
      this.logger.debug('Set isUndoingOperation flag to true for undo operation');

      return this.commandManager.undo().pipe(
        tap(result => {
          if (result.success) {
            // Publish event that the graph changed after undo
            this.eventBus.publish({
              type: DfdEventType.GraphChanged,
              timestamp: Date.now(),
              cells: graph.getCells(),
            });

            // Update state store with latest cells
            this.stateStore.updateState(
              {
                cells: graph.getCells(),
              },
              'DfdCommandService.undo',
            );

            // Update can undo/redo states
            this.stateStore.updateState(
              {
                canUndo: this.commandManager.canUndo,
                canRedo: this.commandManager.canRedo,
              },
              'DfdCommandService.undo',
            );
          }

          // Reset the flag after the operation completes
          (graph as GraphWithUndoFlag).isUndoingOperation = false;
          this.logger.debug('Reset isUndoingOperation flag to false after undo operation');
        }),
        catchError(error => {
          // Make sure to reset the flag even if an error occurs
          (graph as GraphWithUndoFlag).isUndoingOperation = false;
          this.logger.debug('Reset isUndoingOperation flag to false after undo error');
          this.errorService.logError(error as Error, 'Error undoing command');
          return of({
            success: false,
            error: error as Error,
          });
        }),
      );
    } catch (error) {
      // Make sure to reset the flag in case of synchronous errors
      (graph as GraphWithUndoFlag).isUndoingOperation = false;
      this.logger.debug('Reset isUndoingOperation flag to false after undo exception');
      this.errorService.logError(error as Error, 'Error undoing command');
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Performs a redo operation if available
   * @returns Observable that emits the command result
   */
  redo(): Observable<CommandResult> {
    this.logger.info('Redoing last undone command');

    // Get the graph instance
    const graph = this.stateStore.graph;
    if (!graph) {
      return of({
        success: false,
        error: new Error('Graph is not initialized'),
      });
    }

    try {
      // Set the flag to prevent history entries during redo
      (graph as GraphWithUndoFlag).isUndoingOperation = true; // Use the same flag for redo operations
      this.logger.debug('Set isUndoingOperation flag to true for redo operation');

      return this.commandManager.redo().pipe(
        tap(result => {
          if (result.success) {
            // Publish event that the graph changed after redo
            this.eventBus.publish({
              type: DfdEventType.GraphChanged,
              timestamp: Date.now(),
              cells: graph.getCells(),
            });

            // Update state store with latest cells
            this.stateStore.updateState(
              {
                cells: graph.getCells(),
              },
              'DfdCommandService.redo',
            );

            // Update can undo/redo states
            this.stateStore.updateState(
              {
                canUndo: this.commandManager.canUndo,
                canRedo: this.commandManager.canRedo,
              },
              'DfdCommandService.redo',
            );
          }

          // Reset the flag after the operation completes
          (graph as GraphWithUndoFlag).isUndoingOperation = false;
          this.logger.debug('Reset isUndoingOperation flag to false after redo operation');
        }),
        catchError(error => {
          // Make sure to reset the flag even if an error occurs
          (graph as GraphWithUndoFlag).isUndoingOperation = false;
          this.logger.debug('Reset isUndoingOperation flag to false after redo error');
          this.errorService.logError(error as Error, 'Error redoing command');
          return of({
            success: false,
            error: error as Error,
          });
        }),
      );
    } catch (error) {
      // Make sure to reset the flag in case of synchronous errors
      (graph as GraphWithUndoFlag).isUndoingOperation = false;
      this.logger.debug('Reset isUndoingOperation flag to false after redo exception');
      this.errorService.logError(error as Error, 'Error redoing command');
      return of({
        success: false,
        error: error as Error,
      });
    }
  }

  /**
   * Clears all command history
   */
  clearHistory(): void {
    this.logger.info('Clearing command history');
    this.commandManager.clearHistory();

    // Update can undo/redo states
    this.stateStore.updateState(
      {
        canUndo: false,
        canRedo: false,
      },
      'DfdCommandService.clearHistory',
    );
  }
}
