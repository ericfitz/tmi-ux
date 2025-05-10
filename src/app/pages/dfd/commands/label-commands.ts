import { Graph, Edge } from '@antv/x6'; // Removed Node
import { BaseCommand, CommandResult } from './command.interface';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Command for editing a node's label
 */
export class EditNodeLabelCommand extends BaseCommand<string> {
  readonly name = 'EditNodeLabel';
  private originalLabel: string | null = null;

  constructor(
    private nodeId: string,
    private newLabel: string,
    private logger: LoggerService,
  ) {
    super();
    this.logger.debug('EditNodeLabelCommand created', { nodeId, newLabel });
  }

  /**
   * Execute the command - updates the node's label
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult containing the new label
   */
  execute(graph: Graph): Promise<CommandResult<string>> {
    try {
      const node = graph.getCellById(this.nodeId);
      if (!node || !node.isNode()) {
        return Promise.resolve(this.createErrorResult<string>(`Node ${this.nodeId} not found`));
      }

      // Store the original label for undo
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const nodeData = node.getData() || {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.originalLabel = (nodeData.label as string) || '';

      this.logger.debug('Executing EditNodeLabelCommand', {
        nodeId: this.nodeId,
        originalLabel: this.originalLabel,
        newLabel: this.newLabel,
      });

      // Update the node's label in both the DOM and data
      node.attr('text/text', this.newLabel);

      // Also update the data object
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      nodeData.label = this.newLabel;
      node.setData(nodeData);

      return Promise.resolve(this.createSuccessResult(this.newLabel));
    } catch (error) {
      this.logger.error('Error in EditNodeLabelCommand.execute', error);
      return Promise.resolve(this.createErrorResult<string>(error as Error));
    }
  }

  /**
   * Undo the command - restores the original label
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (this.originalLabel === null) {
        return Promise.resolve(
          this.createErrorResult<string>('Cannot undo - original label was not saved'),
        );
      }

      const node = graph.getCellById(this.nodeId);
      if (!node || !node.isNode()) {
        return Promise.resolve(
          this.createErrorResult<string>(`Cannot undo - node ${this.nodeId} not found`),
        );
      }

      this.logger.debug('Undoing EditNodeLabelCommand', {
        nodeId: this.nodeId,
        fromLabel: this.newLabel,
        toLabel: this.originalLabel,
      });

      // Restore the original label in both the DOM and data
      node.attr('text/text', this.originalLabel);

      // Also restore in the data object
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const nodeData = node.getData() || {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      nodeData.label = this.originalLabel;
      node.setData(nodeData);

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in EditNodeLabelCommand.undo', error);
      return Promise.resolve(this.createErrorResult<string>(error as Error));
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
    if (!graph) return false;

    const node = graph.getCellById(this.nodeId);
    return !!node && node.isNode() && this.originalLabel !== null;
  }
}

/**
 * Command for editing an edge's label
 */
export class EditEdgeLabelCommand extends BaseCommand<string> {
  readonly name = 'EditEdgeLabel';
  private originalLabel: string | null = null;
  private originalEdgeData: {
    id: string;
    source: { cell: string; port?: string };
    target: { cell: string; port?: string };
    vertices: Array<{ x: number; y: number }>;
    attrs: Record<string, unknown>;
    zIndex: number;
    data: unknown;
    router?: { name: string; args?: Record<string, unknown> };
    connector?: { name: string; args?: Record<string, unknown> };
    labels?: Array<Record<string, unknown>>;
  } | null = null;

  constructor(
    private edgeId: string,
    private newLabel: string,
    private logger: LoggerService,
  ) {
    super();
    this.logger.debug('EditEdgeLabelCommand created', { edgeId, newLabel });
  }

  /**
   * Execute the command - updates the edge's label
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult containing the new label
   */
  execute(graph: Graph): Promise<CommandResult<string>> {
    try {
      const edge = graph.getCellById(this.edgeId) as Edge;
      if (!edge || !edge.isEdge()) {
        return Promise.resolve(this.createErrorResult<string>(`Edge ${this.edgeId} not found`));
      }

      // Store the complete edge data for undo to preserve all properties
      this.originalEdgeData = {
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
        zIndex: edge.getZIndex() || 0,
        data: edge.getData(),
        router: edge.getRouter() as { name: string; args?: Record<string, unknown> } | undefined,
        connector: edge.getConnector() as
          | { name: string; args?: Record<string, unknown> }
          | undefined,
        labels: edge.getLabels() as Array<Record<string, unknown>>,
      };

      // Also store the original label for simpler access
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const edgeData = edge.getData() || {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.originalLabel = (edgeData.label as string) || '';

      this.logger.debug('Executing EditEdgeLabelCommand', {
        edgeId: this.edgeId,
        originalLabel: this.originalLabel,
        newLabel: this.newLabel,
        originalVertices: this.originalEdgeData?.vertices,
      });

      // Update the edge's label text while preserving other attributes
      // Only update the text attribute, not the entire label object
      edge.attr('label/text', this.newLabel);

      // Ensure edge has dfd-label class
      edge.attr('label/class', 'dfd-label');

      // Keep the CSS class in the DOM but don't set inline styles
      if (edge.attr('label/style') !== undefined) {
        this.logger.debug('Removing inline style from label', {
          edgeId: this.edgeId,
          previousStyle: edge.attr('label/style'),
        });
        // Remove any inline styles - should be in CSS
        edge.attr('label/style', null);
      }

      // Update the label in the data object for consistency
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      edgeData.label = this.newLabel;
      edge.setData(edgeData);

      // Update the label in the labels array if it exists
      const labels = edge.getLabels();
      if (labels && labels.length > 0) {
        // Create updated labels while preserving all other properties
        const updatedLabels = labels.map(label => ({
          ...label,
          attrs: {
            ...label.attrs,
            text: {
              ...((label.attrs?.['text'] as Record<string, unknown>) || {}),
              text: this.newLabel,
            },
          },
        }));

        // Set the updated labels
        edge.setLabels(updatedLabels);
      }

      // Ensure vertices are preserved
      const vertices = this.originalEdgeData?.vertices;
      if (vertices && vertices.length > 0) {
        this.logger.debug('Preserving edge vertices during label edit', {
          edgeId: this.edgeId,
          vertices,
        });

        // Explicitly set vertices to preserve them
        edge.setVertices(vertices);
      }

      return Promise.resolve(this.createSuccessResult(this.newLabel));
    } catch (error) {
      this.logger.error('Error in EditEdgeLabelCommand.execute', error);
      return Promise.resolve(this.createErrorResult<string>(error as Error));
    }
  }

  /**
   * Undo the command - restores the original edge state completely
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult> {
    try {
      if (!this.originalEdgeData) {
        return Promise.resolve(
          this.createErrorResult<string>('Cannot undo - original edge data was not saved'),
        );
      }

      const edge = graph.getCellById(this.edgeId) as Edge;
      if (!edge || !edge.isEdge()) {
        return Promise.resolve(
          this.createErrorResult<string>(`Cannot undo - edge ${this.edgeId} not found`),
        );
      }

      this.logger.debug('Undoing EditEdgeLabelCommand', {
        edgeId: this.edgeId,
        fromLabel: this.newLabel,
        toLabel: this.originalLabel,
        restoreVertices: this.originalEdgeData.vertices,
      });

      // Restore the complete edge state

      // Restore edge source and target
      if (this.originalEdgeData.source && this.originalEdgeData.target) {
        edge.setSource({
          cell: this.originalEdgeData.source.cell,
          port: this.originalEdgeData.source.port,
        });
        edge.setTarget({
          cell: this.originalEdgeData.target.cell,
          port: this.originalEdgeData.target.port,
        });
      }

      // Restore edge vertices
      if (this.originalEdgeData.vertices && this.originalEdgeData.vertices.length > 0) {
        edge.setVertices(this.originalEdgeData.vertices);
      }

      // Restore edge Z-index
      if (typeof this.originalEdgeData.zIndex === 'number') {
        edge.setZIndex(this.originalEdgeData.zIndex);
      }

      // Restore edge router and connector
      if (this.originalEdgeData.router) {
        edge.setRouter(this.originalEdgeData.router.name, this.originalEdgeData.router.args);
      }

      if (this.originalEdgeData.connector) {
        edge.setConnector(
          this.originalEdgeData.connector.name,
          this.originalEdgeData.connector.args,
        );
      }

      // Restore labels if they exist
      if (this.originalEdgeData.labels && this.originalEdgeData.labels.length > 0) {
        edge.setLabels(this.originalEdgeData.labels);
      }

      // Restore edge attributes while preserving CSS classes
      const originalAttrs = this.originalEdgeData.attrs;
      for (const key in originalAttrs) {
        if (key !== 'label/class') {
          // Keep CSS classes from current state
          // Disable ESLint for this specific line as we need to use any for compatibility

          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
          edge.attr(key, originalAttrs[key] as any);
        }
      }

      // Specifically restore the label text
      if (this.originalLabel !== null) {
        edge.attr('label/text', this.originalLabel);
      }

      // Restore the original data
      if (this.originalEdgeData.data) {
        edge.setData(this.originalEdgeData.data);
      }

      return Promise.resolve(this.createSuccessResult());
    } catch (error) {
      this.logger.error('Error in EditEdgeLabelCommand.undo', error);
      return Promise.resolve(this.createErrorResult<string>(error as Error));
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
    return !!edge && edge.isEdge() && this.originalLabel !== null;
  }
}
