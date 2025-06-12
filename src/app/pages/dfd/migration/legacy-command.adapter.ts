import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { CommandBusService } from '../application/services/command-bus.service';
import { DiagramCommandFactory } from '../domain/commands/diagram-commands';
import { Point } from '../domain/value-objects/point';
import { NodeData } from '../domain/value-objects/node-data';
import { EdgeData } from '../domain/value-objects/edge-data';
import { NodeType } from '../domain/value-objects/node-data';

// Type alias for backward compatibility during migration - extends NodeType to include legacy values
type ShapeType = NodeType | 'securityBoundary';

/**
 * Result interface for command operations (legacy compatibility)
 */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Adapter that provides the legacy DfdCommandService interface while using the new clean architecture
 * This allows gradual migration without breaking existing component code
 */
@Injectable({
  providedIn: 'root',
})
export class LegacyCommandAdapter {
  private readonly _currentUserId = 'migration-user'; // TODO: Get from auth service
  private readonly _currentDiagramId = 'migration-diagram'; // TODO: Get from current context

  constructor(
    private logger: LoggerService,
    private commandBus: CommandBusService,
  ) {
    this.logger.info('LegacyCommandAdapter initialized');
  }

  /**
   * Create a new node with the specified shape type (legacy interface)
   * @param shapeType The type of shape to create
   * @param position The position for the new node
   * @param containerElement Optional container element for sizing calculations
   * @returns Observable that emits the command result
   */
  createNode(
    shapeType: ShapeType,
    position: { x: number; y: number },
    _containerElement?: HTMLElement,
  ): Observable<CommandResult<Node>> {
    this.logger.info('LegacyCommandAdapter: Creating node with command', { shapeType, position });

    try {
      const nodeId = this.generateNodeId();
      const nodeData = new NodeData(
        nodeId,
        this.mapShapeTypeToNodeType(shapeType),
        this.getDefaultLabelForType(shapeType),
        new Point(position.x, position.y),
        120, // default width
        80, // default height
        {}, // empty metadata
      );

      const command = DiagramCommandFactory.addNode(
        this._currentDiagramId,
        this._currentUserId,
        nodeId,
        new Point(position.x, position.y),
        nodeData,
      );

      return this.commandBus.execute(command).pipe(
        map(_result => {
          this.logger.info('LegacyCommandAdapter: Node created successfully', { nodeId });
          // For legacy compatibility, we need to return a mock Node object
          // In a real implementation, this would be the actual X6 Node
          const mockNode = { id: nodeId } as Node;
          return {
            success: true,
            data: mockNode,
          };
        }),
        catchError((error: unknown) => {
          this.logger.error('LegacyCommandAdapter: Error creating node', error);
          return of({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }),
      );
    } catch (error) {
      this.logger.error('LegacyCommandAdapter: Error creating node', error);
      return of({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Creates a node at a random position (legacy interface)
   * @param shapeType The type of shape to create
   * @param containerElement The container element for sizing calculations
   * @returns Observable that emits the command result
   */
  createRandomNode(
    shapeType: ShapeType,
    containerElement?: HTMLElement,
  ): Observable<CommandResult<Node>> {
    // Generate a random position within the visible area
    let width = 800;
    let height = 600;

    if (containerElement) {
      width = containerElement.clientWidth;
      height = containerElement.clientHeight;
    }

    // Calculate a random position with some padding
    const padding = 100;
    const x = Math.floor(Math.random() * (width - 2 * padding)) + padding;
    const y = Math.floor(Math.random() * (height - 2 * padding)) + padding;

    return this.createNode(shapeType, { x, y }, containerElement);
  }

  /**
   * Delete a node (legacy interface)
   * @param nodeId The ID of the node to delete
   * @returns Observable that emits the command result
   */
  deleteNode(nodeId: string): Observable<CommandResult<void>> {
    this.logger.info('LegacyCommandAdapter: Deleting node with command', { nodeId });

    try {
      const command = DiagramCommandFactory.removeNode(
        this._currentDiagramId,
        this._currentUserId,
        nodeId,
      );

      return this.commandBus.execute(command).pipe(
        map(() => {
          this.logger.info('LegacyCommandAdapter: Node deleted successfully', { nodeId });
          return {
            success: true,
          };
        }),
        catchError((error: unknown) => {
          this.logger.error('LegacyCommandAdapter: Error deleting node', error);
          return of({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }),
      );
    } catch (error) {
      this.logger.error('LegacyCommandAdapter: Error deleting node', error);
      return of({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Move a node to a new position (legacy interface)
   * @param nodeId The ID of the node to move
   * @param newPosition The new position for the node
   * @returns Observable that emits the command result
   */
  moveNode(nodeId: string, newPosition: { x: number; y: number }): Observable<CommandResult<void>> {
    this.logger.info('LegacyCommandAdapter: Moving node with command', { nodeId, newPosition });

    try {
      // For the old position, we'll use a placeholder since we don't have access to current state
      const oldPosition = new Point(0, 0); // TODO: Get actual old position from state
      const command = DiagramCommandFactory.updateNodePosition(
        this._currentDiagramId,
        this._currentUserId,
        nodeId,
        new Point(newPosition.x, newPosition.y),
        oldPosition,
      );

      return this.commandBus.execute(command).pipe(
        map(() => {
          this.logger.info('LegacyCommandAdapter: Node moved successfully', { nodeId });
          return {
            success: true,
          };
        }),
        catchError((error: unknown) => {
          this.logger.error('LegacyCommandAdapter: Error moving node', error);
          return of({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }),
      );
    } catch (error) {
      this.logger.error('LegacyCommandAdapter: Error moving node', error);
      return of({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Edit a node's label (legacy interface)
   * @param nodeId The ID of the node to edit
   * @param newLabel The new label for the node
   * @returns Observable that emits the command result
   */
  editNodeLabel(nodeId: string, newLabel: string): Observable<CommandResult<string>> {
    this.logger.info('LegacyCommandAdapter: Editing node label with command', { nodeId, newLabel });

    try {
      // For now, we'll create placeholder old and new data
      // In a real implementation, we'd get the current node data from the aggregate
      const oldData = new NodeData(nodeId, 'actor', 'Old Label', new Point(0, 0), 120, 80, {});
      const newData = new NodeData(nodeId, 'actor', newLabel, new Point(0, 0), 120, 80, {});

      const command = DiagramCommandFactory.updateNodeData(
        this._currentDiagramId,
        this._currentUserId,
        nodeId,
        newData,
        oldData,
      );

      return this.commandBus.execute(command).pipe(
        map(() => {
          this.logger.info('LegacyCommandAdapter: Node label edited successfully', { nodeId });
          return {
            success: true,
            data: newLabel,
          };
        }),
        catchError((error: unknown) => {
          this.logger.error('LegacyCommandAdapter: Error editing node label', error);
          return of({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }),
      );
    } catch (error) {
      this.logger.error('LegacyCommandAdapter: Error editing node label', error);
      return of({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Create an edge between nodes (legacy interface)
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
    this.logger.info('LegacyCommandAdapter: Creating edge with command', params);

    try {
      const edgeId = this.generateEdgeId();
      const vertices = params.vertices?.map(v => new Point(v.x, v.y)) || [];

      const edgeData = new EdgeData(
        edgeId,
        params.source.id,
        params.target.id,
        params.source.port,
        params.target.port,
        'Data Flow', // default label
        vertices,
        {}, // empty metadata
      );

      const command = DiagramCommandFactory.addEdge(
        this._currentDiagramId,
        this._currentUserId,
        edgeId,
        params.source.id,
        params.target.id,
        edgeData,
      );

      return this.commandBus.execute(command).pipe(
        map(() => {
          this.logger.info('LegacyCommandAdapter: Edge created successfully', { edgeId });
          // For legacy compatibility, we need to return a mock Edge object
          const mockEdge = { id: edgeId } as Edge;
          return {
            success: true,
            data: mockEdge,
          };
        }),
        catchError((error: unknown) => {
          this.logger.error('LegacyCommandAdapter: Error creating edge', error);
          return of({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }),
      );
    } catch (error) {
      this.logger.error('LegacyCommandAdapter: Error creating edge', error);
      return of({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Delete an edge (legacy interface)
   * @param edgeId The ID of the edge to delete
   * @returns Observable that emits the command result
   */
  deleteEdge(edgeId: string): Observable<CommandResult<void>> {
    this.logger.info('LegacyCommandAdapter: Deleting edge with command', { edgeId });

    try {
      const command = DiagramCommandFactory.removeEdge(
        this._currentDiagramId,
        this._currentUserId,
        edgeId,
      );

      return this.commandBus.execute(command).pipe(
        map(() => {
          this.logger.info('LegacyCommandAdapter: Edge deleted successfully', { edgeId });
          return {
            success: true,
          };
        }),
        catchError((error: unknown) => {
          this.logger.error('LegacyCommandAdapter: Error deleting edge', error);
          return of({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }),
      );
    } catch (error) {
      this.logger.error('LegacyCommandAdapter: Error deleting edge', error);
      return of({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Performs an undo operation if available (legacy interface)
   * @returns Observable that emits the command result
   */
  undo(): Observable<CommandResult> {
    this.logger.info('LegacyCommandAdapter: Undo operation requested');

    // For now, return a placeholder since undo/redo is not implemented in the new architecture yet
    return of({
      success: false,
      error: new Error('Undo operation not yet implemented in new architecture'),
    });
  }

  /**
   * Performs a redo operation if available (legacy interface)
   * @returns Observable that emits the command result
   */
  redo(): Observable<CommandResult> {
    this.logger.info('LegacyCommandAdapter: Redo operation requested');

    // For now, return a placeholder since undo/redo is not implemented in the new architecture yet
    return of({
      success: false,
      error: new Error('Redo operation not yet implemented in new architecture'),
    });
  }

  /**
   * Clears all command history (legacy interface)
   */
  clearHistory(): void {
    this.logger.info('LegacyCommandAdapter: Clear history requested');
    // For now, this is a no-op since history is not implemented in the new architecture yet
  }

  /**
   * Generate a unique node ID
   */
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique edge ID
   */
  private generateEdgeId(): string {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map legacy ShapeType to domain NodeType
   */
  private mapShapeTypeToNodeType(shapeType: ShapeType): NodeType {
    switch (shapeType) {
      case 'actor':
        return 'actor';
      case 'process':
        return 'process';
      case 'store':
        return 'store';
      case 'securityBoundary':
        return 'security-boundary';
      case 'textbox':
        return 'textbox';
      default:
        return 'actor'; // fallback
    }
  }

  /**
   * Get default label for a shape type
   */
  private getDefaultLabelForType(shapeType: ShapeType): string {
    switch (shapeType) {
      case 'actor':
        return 'Actor';
      case 'process':
        return 'Process';
      case 'store':
        return 'Data Store';
      case 'securityBoundary':
        return 'Security Boundary';
      case 'textbox':
        return 'Text';
      default:
        return 'Element';
    }
  }
}
