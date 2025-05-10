import { Graph, Edge } from '@antv/x6';
import { BaseCommand, CommandResult } from './command.interface'; // Removed EdgeCommandParams
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Command for adding an edge to the graph
 */
export class AddEdgeCommand extends BaseCommand<Edge> {
  readonly name = 'AddEdge';
  private createdEdgeId: string | null = null;

  constructor(
    private params: {
      source: { id: string; port?: string };
      target: { id: string; port?: string };
      vertices?: Array<{ x: number; y: number }>;
      attrs?: Record<string, unknown>;
      data?: Record<string, unknown>;
      router?: { name: string; args?: Record<string, unknown> };
      connector?: { name: string; args?: Record<string, unknown> };
    },
    private logger: LoggerService,
  ) {
    super();
    this.logger.debug('AddEdgeCommand created', { params });
  }

  /**
   * Execute the command - adds an edge to the graph
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult containing the created edge
   */
  execute(graph: Graph): Promise<CommandResult<Edge>> {
    try {
      this.logger.debug('Executing AddEdgeCommand', { params: this.params });

      // Check that source and target nodes exist
      const sourceCell = graph.getCellById(this.params.source.id);
      const targetCell = graph.getCellById(this.params.target.id);

      if (!sourceCell || !sourceCell.isNode()) {
        return Promise.resolve(
          this.createErrorResult<Edge>(`Source node ${this.params.source.id} not found`),
        );
      }

      if (!targetCell || !targetCell.isNode()) {
        return Promise.resolve(
          this.createErrorResult<Edge>(`Target node ${this.params.target.id} not found`),
        );
      }

      // Create the edge
      const edge = graph.createEdge({
        source: { cell: this.params.source.id, port: this.params.source.port },
        target: { cell: this.params.target.id, port: this.params.target.port },
        vertices: this.params.vertices,
        attrs: this.params.attrs,
        data: this.params.data,
        router: this.params.router,
        connector: this.params.connector,
      });

      // Add the edge to the graph
      graph.addEdge(edge);

      // Save the created edge ID for undo
      this.createdEdgeId = edge.id;

      return Promise.resolve(this.createSuccessResult(edge));
    } catch (error) {
      this.logger.error('Error in AddEdgeCommand.execute', error);
      return Promise.resolve(this.createErrorResult<Edge>(error as Error));
    }
  }

  /**
   * Undo the command - removes the edge from the graph
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.createdEdgeId) {
        return Promise.resolve(this.createErrorResult<void>('Cannot undo - no edge was created'));
      }

      const edgeToRemove = graph.getCellById(this.createdEdgeId);
      if (!edgeToRemove || !edgeToRemove.isEdge()) {
        return Promise.resolve(
          this.createErrorResult<void>(`Cannot undo - edge ${this.createdEdgeId} not found`),
        );
      }

      this.logger.debug('Undoing AddEdgeCommand', { edgeId: this.createdEdgeId });

      // Remove the edge from the graph
      graph.removeEdge(this.createdEdgeId);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in AddEdgeCommand.undo', error);
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

    // Check that source and target nodes exist
    const sourceCell = graph.getCellById(this.params.source.id);
    const targetCell = graph.getCellById(this.params.target.id);

    return !!sourceCell && sourceCell.isNode() && !!targetCell && targetCell.isNode();
  }

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  override canUndo(graph: Graph): boolean {
    return !!graph && !!this.createdEdgeId;
  }
}

/**
 * Command for deleting an edge from the graph
 */
export class DeleteEdgeCommand extends BaseCommand<void> {
  readonly name = 'DeleteEdge';
  private deletedEdgeData: {
    id: string;
    source: { cell: string; port?: string };
    target: { cell: string; port?: string };
    vertices: Array<{ x: number; y: number }>;
    attrs: Record<string, unknown>;
    data: unknown;
    router?: { name: string; args?: Record<string, unknown> };
    connector?: { name: string; args?: Record<string, unknown> };
  } | null = null;

  constructor(
    private edgeId: string,
    private logger: LoggerService,
  ) {
    super();
    this.logger.debug('DeleteEdgeCommand created', { edgeId });
  }

  /**
   * Execute the command - deletes an edge from the graph
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  execute(graph: Graph): Promise<CommandResult<void>> {
    try {
      const edgeToDelete = graph.getCellById(this.edgeId);
      if (!edgeToDelete || !edgeToDelete.isEdge()) {
        return Promise.resolve(this.createErrorResult<void>(`Edge ${this.edgeId} not found`));
      }

      // Store the edge data for undo
      const edge = edgeToDelete;

      this.deletedEdgeData = {
        id: edge.id,
        source: {
          cell: edge.getSourceCellId() || '',
          port: edge.getSourcePortId(),
        },
        target: {
          cell: edge.getTargetCellId() || '',
          port: edge.getTargetPortId(),
        },
        vertices: edge.getVertices() as Array<{ x: number; y: number }>,
        attrs: edge.getAttrs() as Record<string, unknown>,
        data: edge.getData(),
        router: edge.getRouter() as { name: string; args?: Record<string, unknown> } | undefined,
        connector: edge.getConnector() as
          | { name: string; args?: Record<string, unknown> }
          | undefined,
      };

      this.logger.debug('Executing DeleteEdgeCommand', {
        edgeId: this.edgeId,
        source: this.deletedEdgeData?.source,
        target: this.deletedEdgeData?.target,
      });

      // Remove the edge from the graph
      graph.removeEdge(this.edgeId);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in DeleteEdgeCommand.execute', error);
      return Promise.resolve(this.createErrorResult<void>(error as Error));
    }
  }

  /**
   * Undo the command - restores the deleted edge
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.deletedEdgeData) {
        return Promise.resolve(
          this.createErrorResult<void>('Cannot undo - no edge data was saved'),
        );
      }

      this.logger.debug('Undoing DeleteEdgeCommand', {
        edgeId: this.deletedEdgeData.id,
      });

      // Check that source and target nodes still exist
      const sourceCell = graph.getCellById(this.deletedEdgeData.source.cell);
      const targetCell = graph.getCellById(this.deletedEdgeData.target.cell);

      if (!sourceCell || !sourceCell.isNode()) {
        return Promise.resolve(
          this.createErrorResult<void>(`Source node ${this.deletedEdgeData.source.cell} not found`),
        );
      }

      if (!targetCell || !targetCell.isNode()) {
        return Promise.resolve(
          this.createErrorResult<void>(`Target node ${this.deletedEdgeData.target.cell} not found`),
        );
      }

      // Re-create the edge with the stored data
      const edge = graph.createEdge({
        id: this.deletedEdgeData.id,
        source: this.deletedEdgeData.source,
        target: this.deletedEdgeData.target,
        vertices: this.deletedEdgeData.vertices,
        attrs: this.deletedEdgeData.attrs,
        data: this.deletedEdgeData.data,
        router: this.deletedEdgeData.router,
        connector: this.deletedEdgeData.connector,
      });

      // Add the edge to the graph
      graph.addEdge(edge);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in DeleteEdgeCommand.undo', error);
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

    const edge = graph.getCellById(this.edgeId);
    return !!edge && edge.isEdge();
  }

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  override canUndo(graph: Graph): boolean {
    if (!graph || !this.deletedEdgeData) return false;

    // Check that source and target nodes still exist
    const sourceCell = graph.getCellById(this.deletedEdgeData.source.cell);
    const targetCell = graph.getCellById(this.deletedEdgeData.target.cell);

    return !!sourceCell && sourceCell.isNode() && !!targetCell && targetCell.isNode();
  }
}

/**
 * Command for modifying an edge's vertices (control points)
 */
export class UpdateEdgeVerticesCommand extends BaseCommand<void> {
  readonly name = 'UpdateEdgeVertices';
  private originalVertices: Array<{ x: number; y: number }> | null = null;

  constructor(
    private edgeId: string,
    private newVertices: Array<{ x: number; y: number }>,
    private logger: LoggerService,
  ) {
    super();
    this.logger.debug('UpdateEdgeVerticesCommand created', { edgeId, newVertices });
  }

  /**
   * Execute the command - updates the edge's vertices
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  execute(graph: Graph): Promise<CommandResult<void>> {
    try {
      const edge = graph.getCellById(this.edgeId);
      if (!edge || !edge.isEdge()) {
        return Promise.resolve(this.createErrorResult<void>(`Edge ${this.edgeId} not found`));
      }

      // Store the original vertices for undo
      this.originalVertices = edge.getVertices();

      this.logger.debug('Executing UpdateEdgeVerticesCommand', {
        edgeId: this.edgeId,
        originalVertices: this.originalVertices,
        newVertices: this.newVertices,
      });

      // Update the edge's vertices
      edge.setVertices(this.newVertices);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in UpdateEdgeVerticesCommand.execute', error);
      return Promise.resolve(this.createErrorResult<void>(error as Error));
    }
  }

  /**
   * Undo the command - restores the original vertices
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.originalVertices) {
        return Promise.resolve(
          this.createErrorResult<void>('Cannot undo - original vertices were not saved'),
        );
      }

      const edge = graph.getCellById(this.edgeId);
      if (!edge || !edge.isEdge()) {
        return Promise.resolve(
          this.createErrorResult<void>(`Cannot undo - edge ${this.edgeId} not found`),
        );
      }

      this.logger.debug('Undoing UpdateEdgeVerticesCommand', {
        edgeId: this.edgeId,
        fromVertices: edge.getVertices(),
        toVertices: this.originalVertices,
      });

      // Restore the original vertices
      edge.setVertices(this.originalVertices);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in UpdateEdgeVerticesCommand.undo', error);
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

    const edge = graph.getCellById(this.edgeId);
    return !!edge && edge.isEdge();
  }

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  override canUndo(graph: Graph): boolean {
    if (!graph) return false;

    const edge = graph.getCellById(this.edgeId);
    return !!edge && edge.isEdge() && !!this.originalVertices;
  }
}
