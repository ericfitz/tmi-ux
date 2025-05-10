import { Graph, Node, Edge } from '@antv/x6';
import { BaseCommand, CommandResult } from './command.interface'; // Removed NodeCommandParams
import { LoggerService } from '../../../core/services/logger.service';
import { DfdShapeFactoryService, ShapeOptions } from '../services/dfd-shape-factory.service';
import { ShapeType } from '../services/dfd-node.service';

/**
 * Command for adding a node to the graph
 */
export class AddNodeCommand extends BaseCommand<Node> {
  readonly name = 'AddNode';
  private createdNodeId: string | null = null;

  constructor(
    private params: {
      type: ShapeType;
      position: { x: number; y: number };
      size?: { width: number; height: number };
      label?: string;
      zIndex?: number;
      parent?: boolean;
      containerElement?: HTMLElement;
    },
    private logger: LoggerService,
    private shapeFactory: DfdShapeFactoryService,
  ) {
    super();
    this.logger.debug('AddNodeCommand created', { params });
  }

  /**
   * Execute the command - adds a node to the graph
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult containing the created node
   */
  execute(graph: Graph): Promise<CommandResult<Node>> {
    try {
      this.logger.debug('Executing AddNodeCommand', { params: this.params });

      // Convert params to shape options
      const options: ShapeOptions = {
        x: this.params.position.x,
        y: this.params.position.y,
        width: this.params.size?.width,
        height: this.params.size?.height,
        label: this.params.label || this.shapeFactory.getDefaultLabel(this.params.type),
        zIndex: this.params.zIndex,
        parent: this.params.parent,
      };

      // Create the shape
      const node = this.shapeFactory.createShape(this.params.type, options, graph);
      if (!node) {
        return Promise.resolve(this.createErrorResult<Node>('Failed to create node'));
      }

      // Add the node to the graph
      graph.addNode(node);

      // Save the created node ID for undo
      this.createdNodeId = node.id;

      return Promise.resolve(this.createSuccessResult(node));
    } catch (error) {
      this.logger.error('Error in AddNodeCommand.execute', error);
      return Promise.resolve(this.createErrorResult<Node>(error as Error));
    }
  }

  /**
   * Undo the command - removes the node from the graph
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.createdNodeId) {
        return Promise.resolve(this.createErrorResult<Node>('Cannot undo - no node was created'));
      }

      const nodeToRemove = graph.getCellById(this.createdNodeId);
      if (!nodeToRemove || !nodeToRemove.isNode()) {
        return Promise.resolve(
          this.createErrorResult<Node>(`Cannot undo - node ${this.createdNodeId} not found`),
        );
      }

      this.logger.debug('Undoing AddNodeCommand', { nodeId: this.createdNodeId });

      // Remove the node from the graph
      graph.removeNode(this.createdNodeId);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in AddNodeCommand.undo', error);
      return Promise.resolve(this.createErrorResult<Node>(error as Error));
    }
  }

  /**
   * Check if this command can be executed
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be executed
   */
  override canExecute(graph: Graph): boolean {
    return !!graph;
  }

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  override canUndo(graph: Graph): boolean {
    return !!graph && !!this.createdNodeId;
  }
}

/**
 * Command for deleting a node from the graph
 */
export class DeleteNodeCommand extends BaseCommand<void> {
  readonly name = 'DeleteNode';
  private deletedNodeData: {
    id: string;
    type: ShapeType;
    position: { x: number; y: number };
    size: { width: number; height: number };
    data: unknown;
    zIndex: number;
    attrs: Record<string, unknown>;
    markup: unknown;
    connectedEdges: Array<{
      id: string;
      source: { cell: string; port?: string }; // Changed id to cell
      target: { cell: string; port?: string }; // Changed id to cell
      vertices: Array<{ x: number; y: number }>;
      attrs: Record<string, unknown>;
      data: unknown;
      router?: { name: string; args?: Record<string, unknown> };
      connector?: { name: string; args?: Record<string, unknown> };
      labels?: Array<Record<string, unknown>>;
      zIndex?: number;
    }>;
  } | null = null;

  constructor(
    private nodeId: string,
    private logger: LoggerService,
    private shapeFactory: DfdShapeFactoryService,
  ) {
    super();
    this.logger.debug('DeleteNodeCommand created', { nodeId });
  }

  /**
   * Execute the command - deletes a node from the graph
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  execute(graph: Graph): Promise<CommandResult<void>> {
    try {
      const nodeToDelete = graph.getCellById(this.nodeId);
      if (!nodeToDelete || !nodeToDelete.isNode()) {
        return Promise.resolve(this.createErrorResult<void>(`Node ${this.nodeId} not found`));
      }

      // Store the node data for undo
      const node = nodeToDelete;
      const connectedEdges = graph.getConnectedEdges(node);

      // Store comprehensive data about each edge to ensure complete restoration
      const edgesData = connectedEdges.map(edge => {
        const edgeObj = edge;
        return {
          id: edgeObj.id,
          source: {
            cell: edgeObj.getSourceCellId() || '', // Changed id to cell
            port: edgeObj.getSourcePortId() || undefined,
          },
          target: {
            cell: edgeObj.getTargetCellId() || '', // Changed id to cell
            port: edgeObj.getTargetPortId() || undefined,
          },
          vertices: edgeObj.getVertices() || [],
          attrs: edgeObj.getAttrs() || {},
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: edgeObj.getData() || {},
          router: edgeObj.getRouter() as
            | { name: string; args?: Record<string, unknown> }
            | undefined,
          connector: edgeObj.getConnector() as
            | { name: string; args?: Record<string, unknown> }
            | undefined,
          labels: (edgeObj.getLabels() as Array<Record<string, unknown>>) || [],
          zIndex: edgeObj.getZIndex() ?? 0, // Provide default for zIndex
        };
      });

      this.logger.debug('Storing complete edge data for connected edges', {
        edgeCount: edgesData.length,
        nodeId: this.nodeId,
      });

      this.deletedNodeData = {
        id: node.id,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        type: (node.getData()?.[`type`] as ShapeType) || 'actor',
        position: node.getPosition(),
        size: node.getSize(),
        data: node.getData(),
        zIndex: node.getZIndex() ?? 0,
        attrs: node.getAttrs(),
        markup: node.getMarkup(),
        connectedEdges: edgesData,
      };

      this.logger.debug('Executing DeleteNodeCommand', {
        nodeId: this.nodeId,
        connectedEdgesCount: connectedEdges.length,
      });

      // Log detailed info about each connected edge before deletion
      if (connectedEdges.length > 0) {
        this.logger.info('Connected edges to be removed with node', {
          nodeId: this.nodeId,
          edges: connectedEdges.map(edge => ({
            id: edge.id,
            source: edge.getSourceCellId(),
            target: edge.getTargetCellId(),
            label: edge.attr('label/text'),
          })),
        });
      }

      // Remove the node from the graph
      // This will also remove all connected edges
      graph.removeNode(this.nodeId);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in DeleteNodeCommand.execute', error);
      return Promise.resolve(this.createErrorResult<void>(error as Error));
    }
  }

  /**
   * Undo the command - restores the deleted node and its connected edges
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.deletedNodeData) {
        return Promise.resolve(
          this.createErrorResult<void>('Cannot undo - no node data was saved'),
        );
      }

      this.logger.debug('Undoing DeleteNodeCommand', {
        nodeId: this.deletedNodeData.id,
        connectedEdgesCount: this.deletedNodeData.connectedEdges.length,
      });

      // Re-create the node with the stored data
      const options: ShapeOptions = {
        // id: this.deletedNodeData.id, // ID will be set after creation
        x: this.deletedNodeData.position.x,
        y: this.deletedNodeData.position.y,
        width: this.deletedNodeData.size.width,
        height: this.deletedNodeData.size.height,

        label:
          (this.deletedNodeData.data as { label?: string })?.label ||
          this.shapeFactory.getDefaultLabel(this.deletedNodeData.type),
        zIndex: this.deletedNodeData.zIndex,
        parent: (this.deletedNodeData.data as { parent?: boolean })?.parent,
      };

      // Create the shape
      const node = this.shapeFactory.createShape(this.deletedNodeData.type, options, graph);

      if (!node) {
        return Promise.resolve(this.createErrorResult<void>('Failed to recreate node'));
      }

      // ID is typically set by X6 upon creation and is read-only.
      // We will use the new node.id when re-creating edges.

      // Add the node to the graph
      graph.addNode(node);

      // Set all data that was stored
      node.setData(this.deletedNodeData.data);
      node.setZIndex(this.deletedNodeData.zIndex);

      // Restore connected edges with all their properties
      for (const edgeData of this.deletedNodeData.connectedEdges) {
        this.logger.debug('Restoring edge with complete properties', {
          edgeId: edgeData.id,
          sourceId: edgeData.source.cell, // Changed id to cell
          targetId: edgeData.target.cell, // Changed id to cell
          hasVertices: edgeData.vertices && edgeData.vertices.length > 0,
          vertexCount: edgeData.vertices?.length || 0,
        });

        // Create a new edge with all the stored properties
        const edgeConfig: Edge.Metadata = {
          // Use Edge.Metadata for better typing
          id: edgeData.id,
          source: {
            cell: edgeData.source.cell === this.deletedNodeData.id ? node.id : edgeData.source.cell,
            port: edgeData.source.port,
          },
          target: {
            cell: edgeData.target.cell === this.deletedNodeData.id ? node.id : edgeData.target.cell,
            port: edgeData.target.port,
          },
          vertices: edgeData.vertices || [],
          attrs: edgeData.attrs || {},
          data: edgeData.data || {},
        };

        // Add router and connector if they exist
        if (edgeData.router) {
          edgeConfig['router'] = edgeData.router;
        }

        if (edgeData.connector) {
          edgeConfig['connector'] = edgeData.connector;
        }

        // Add labels if they exist
        if (edgeData.labels && edgeData.labels.length > 0) {
          edgeConfig['labels'] = edgeData.labels;
        }

        // Create the edge with the complete configuration
        const edge = graph.createEdge(edgeConfig);

        // Add edge to graph
        graph.addEdge(edge);

        // Set z-index if it exists
        if (typeof edgeData.zIndex === 'number') {
          edge.setZIndex(edgeData.zIndex);
        }

        // Explicitly set vertices again to ensure they're preserved
        if (edgeData.vertices && edgeData.vertices.length > 0) {
          edge.setVertices(edgeData.vertices);
        }

        // Ensure edge has dfd-label class but no inline styles
        if (edge.attr('label/text') !== undefined) {
          edge.attr('label/class', 'dfd-label');

          // Remove any inline style - should be in CSS
          if (edge.attr('label/style') !== undefined) {
            edge.attr('label/style', null);
          }
        }
      }

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in DeleteNodeCommand.undo', error);
      return Promise.resolve(this.createErrorResult<void>(error as Error));
    }
  }

  /**
   * Check if this command can be executed
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be executed
   */
  override canExecute(graph: Graph): boolean {
    if (!graph) return false;

    const node = graph.getCellById(this.nodeId);
    return !!node && node.isNode();
  }

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  override canUndo(graph: Graph): boolean {
    return !!graph && !!this.deletedNodeData;
  }
}

/**
 * Command for moving a node in the graph
 */
export class MoveNodeCommand extends BaseCommand<void> {
  readonly name = 'MoveNode';
  private originalPosition: { x: number; y: number } | null = null;

  constructor(
    private nodeId: string,
    private newPosition: { x: number; y: number },
    private logger: LoggerService,
  ) {
    super();
    this.logger.debug('MoveNodeCommand created', { nodeId, newPosition });
  }

  /**
   * Execute the command - moves a node to a new position
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  execute(graph: Graph): Promise<CommandResult<void>> {
    try {
      const node = graph.getCellById(this.nodeId);
      if (!node || !node.isNode()) {
        return Promise.resolve(this.createErrorResult<void>(`Node ${this.nodeId} not found`));
      }

      // Store the original position for undo
      this.originalPosition = node.getPosition();

      this.logger.debug('Executing MoveNodeCommand', {
        nodeId: this.nodeId,
        fromPosition: this.originalPosition,
        toPosition: this.newPosition,
      });

      // Move the node to the new position
      node.setPosition(this.newPosition);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in MoveNodeCommand.execute', error);
      return Promise.resolve(this.createErrorResult<void>(error as Error));
    }
  }

  /**
   * Undo the command - moves the node back to its original position
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.originalPosition) {
        return Promise.resolve(
          this.createErrorResult<void>('Cannot undo - original position was not saved'),
        );
      }

      const node = graph.getCellById(this.nodeId);
      if (!node || !node.isNode()) {
        return Promise.resolve(
          this.createErrorResult<void>(`Cannot undo - node ${this.nodeId} not found`),
        );
      }

      this.logger.debug('Undoing MoveNodeCommand', {
        nodeId: this.nodeId,
        fromPosition: node.getPosition(),
        toPosition: this.originalPosition,
      });

      // Move the node back to its original position
      node.setPosition(this.originalPosition);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in MoveNodeCommand.undo', error);
      return Promise.resolve(this.createErrorResult<void>(error as Error));
    }
  }

  /**
   * Check if this command can be executed
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be executed
   */
  override canExecute(graph: Graph): boolean {
    if (!graph) return false;

    const node = graph.getCellById(this.nodeId);
    return !!node && node.isNode();
  }

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  override canUndo(_graph: Graph): boolean {
    // Prefixed graph with _
    return !!this.originalPosition;
  }
}
