import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { CommandBusService } from '../application/services/command-bus.service';
import { CommandBusInitializerService } from '../application/services/command-bus-initializer.service';
import { CommandResult as DomainCommandResult } from '../application/handlers/diagram-command-handlers';
import { DiagramCommandFactory } from '../domain/commands/diagram-commands';
import { Point } from '../domain/value-objects/point';
import { NodeData } from '../domain/value-objects/node-data';
import { EdgeData } from '../domain/value-objects/edge-data';
import { NodeType } from '../domain/value-objects/node-data';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { DiagramNode } from '../domain/value-objects/diagram-node';
import { DiagramEdge } from '../domain/value-objects/diagram-edge';
import { BaseDomainEvent } from '../domain/events/domain-event';
import { NodeAddedEvent } from '../domain/events/diagram-events';

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
@Injectable()
export class LegacyCommandAdapter {
  private readonly _currentUserId = 'migration-user'; // TODO: Get from auth service
  private readonly _currentDiagramId = 'migration-diagram'; // TODO: Get from current context

  constructor(
    private logger: LoggerService,
    private commandBus: CommandBusService,
    private commandBusInitializer: CommandBusInitializerService,
    private x6GraphAdapter: X6GraphAdapter,
  ) {
    this.logger.info('LegacyCommandAdapter initialized', {
      commandBusInitialized: this.commandBusInitializer.isInitialized,
    });
    this.ensureDefaultDiagram();
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
        map((result: unknown) => {
          const domainResult = result as DomainCommandResult;
          this.logger.info('LegacyCommandAdapter: Node created successfully', { nodeId });

          // Sync domain state to visual graph
          if (domainResult.success) {
            this.syncDomainEventsToGraph(domainResult.events);
          }

          // Try to get the actual X6 node that was created
          let actualNode: Node | undefined = undefined;
          try {
            actualNode = this.x6GraphAdapter.getNode(nodeId) || undefined;
          } catch {
            // If graph adapter fails, create a mock node for compatibility
            actualNode = { id: nodeId } as Node;
          }

          return {
            success: true,
            data: actualNode,
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
      case 'security-boundary':
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
      case 'security-boundary':
        return 'Security Boundary';
      case 'textbox':
        return 'Text';
      default:
        return 'Element';
    }
  }

  /**
   * Ensure a default diagram exists for the migration adapter to work with
   */
  private ensureDefaultDiagram(): void {
    // Import the command factory and create a default diagram
    const command = DiagramCommandFactory.createDiagram(
      this._currentDiagramId,
      this._currentUserId,
      'Migration Diagram',
      'Default diagram for migration testing',
    );

    // Execute the command to create the diagram
    this.commandBus.execute(command).subscribe({
      next: () => {
        this.logger.info('Default diagram created successfully', {
          diagramId: this._currentDiagramId,
        });
      },
      error: error => {
        // If diagram already exists, that's fine
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = String((error as { message: unknown }).message);
          if (errorMessage.includes('already exists')) {
            this.logger.debug('Default diagram already exists', {
              diagramId: this._currentDiagramId,
            });
          } else {
            this.logger.warn('Failed to create default diagram', error);
          }
        } else {
          this.logger.warn('Failed to create default diagram', error);
        }
      },
    });
  }

  /**
   * Sync domain events to the visual graph
   * @param events The domain events to sync
   */
  private syncDomainEventsToGraph(events: BaseDomainEvent[]): void {
    this.logger.debug('LegacyCommandAdapter: Syncing domain events to graph', {
      eventCount: events.length,
    });

    for (const event of events) {
      try {
        switch (event.type) {
          case 'NodeAdded':
            this.handleNodeAddedEvent(event);
            break;
          case 'NodeRemoved':
            this.handleNodeRemovedEvent(event);
            break;
          case 'NodePositionUpdated':
            this.handleNodePositionUpdatedEvent(event);
            break;
          case 'EdgeAdded':
            this.handleEdgeAddedEvent(event);
            break;
          case 'EdgeRemoved':
            this.handleEdgeRemovedEvent(event);
            break;
          default:
            this.logger.debug('LegacyCommandAdapter: Unhandled event type', { type: event.type });
        }
      } catch (error) {
        this.logger.error('LegacyCommandAdapter: Error syncing event to graph', { event, error });
      }
    }
  }

  /**
   * Handle NodeAdded domain event
   */
  private handleNodeAddedEvent(event: BaseDomainEvent): void {
    // Cast to NodeAddedEvent to get proper type safety
    const nodeAddedEvent = event as NodeAddedEvent;
    const nodeData = nodeAddedEvent.nodeData;

    // Create DiagramNode using the complete NodeData from the event
    const diagramNode = new DiagramNode(nodeData);
    this.x6GraphAdapter.addNode(diagramNode);

    this.logger.debug('LegacyCommandAdapter: Added node to graph', {
      nodeId: nodeData.id,
      nodeType: nodeData.type,
      label: nodeData.label,
      position: nodeData.position.toJSON(),
    });
  }

  /**
   * Handle NodeRemoved domain event
   */
  private handleNodeRemovedEvent(event: BaseDomainEvent): void {
    const eventData = event as { nodeId?: string; aggregateId?: string };
    const nodeId = eventData.nodeId || eventData.aggregateId || '';

    this.x6GraphAdapter.removeNode(nodeId);
    this.logger.debug('LegacyCommandAdapter: Removed node from graph', { nodeId });
  }

  /**
   * Handle NodePositionUpdated domain event
   */
  private handleNodePositionUpdatedEvent(event: BaseDomainEvent): void {
    const eventData = event as { nodeId?: string; aggregateId?: string; newPosition?: Point };
    const nodeId = eventData.nodeId || eventData.aggregateId || '';
    const position = eventData.newPosition || new Point(100, 100);

    this.x6GraphAdapter.moveNode(nodeId, position);
    this.logger.debug('LegacyCommandAdapter: Updated node position in graph', { nodeId, position });
  }

  /**
   * Handle EdgeAdded domain event
   */
  private handleEdgeAddedEvent(event: BaseDomainEvent): void {
    const eventData = event as {
      edgeId?: string;
      aggregateId?: string;
      sourceNodeId?: string;
      targetNodeId?: string;
    };
    const edgeId = eventData.edgeId || eventData.aggregateId || '';
    const sourceNodeId = eventData.sourceNodeId || 'source';
    const targetNodeId = eventData.targetNodeId || 'target';

    // Create EdgeData for the diagram edge
    const edgeData = new EdgeData(
      edgeId,
      sourceNodeId,
      targetNodeId,
      undefined, // sourcePort
      undefined, // targetPort
      'Data Flow', // default label
      [], // empty vertices
      {}, // empty metadata
    );

    const diagramEdge = new DiagramEdge(edgeData);
    this.x6GraphAdapter.addEdge(diagramEdge);
    this.logger.debug('LegacyCommandAdapter: Added edge to graph', { edgeId });
  }

  /**
   * Handle EdgeRemoved domain event
   */
  private handleEdgeRemovedEvent(event: BaseDomainEvent): void {
    const eventData = event as { edgeId?: string; aggregateId?: string };
    const edgeId = eventData.edgeId || eventData.aggregateId || '';

    this.x6GraphAdapter.removeEdge(edgeId);
    this.logger.debug('LegacyCommandAdapter: Removed edge from graph', { edgeId });
  }
}
