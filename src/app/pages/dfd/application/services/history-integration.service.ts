import { Injectable, OnDestroy, Inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphAdapter } from '../../infrastructure/adapters/x6-graph.adapter';
import { ICommandBus } from '../interfaces/command-bus.interface';
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { OperationStateTracker } from '../../infrastructure/services/operation-state-tracker.service';
import { OperationType } from '../../domain/history/history.types';
import { Point } from '../../domain/value-objects/point';
import { EdgeData } from '../../domain/value-objects/edge-data';

/**
 * Service that integrates debounced X6 graph events with the history system.
 * Subscribes to debounced observables and dispatches appropriate commands through the command bus.
 */
@Injectable({
  providedIn: 'root',
})
export class HistoryIntegrationService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private _isInitialized = false;

  constructor(
    private readonly _logger: LoggerService,
    private readonly _x6GraphAdapter: X6GraphAdapter,
    @Inject('ICommandBus') private readonly _commandBus: ICommandBus,
    private readonly _operationTracker: OperationStateTracker,
  ) {}

  /**
   * Initializes the history integration by subscribing to debounced observables
   */
  initialize(diagramId: string, userId: string): void {
    if (this._isInitialized) {
      this._logger.warn('History integration already initialized');
      return;
    }

    this._logger.info('Initializing history integration service', { diagramId, userId });

    // Subscribe to debounced node movement events
    this._x6GraphAdapter.debouncedNodeMoved$.pipe(takeUntil(this._destroy$)).subscribe({
      next: event => this._handleDebouncedNodeMovement(event, diagramId, userId),
      error: (error: unknown) =>
        this._logger.error('Error in debounced node movement subscription', { error }),
    });

    // Subscribe to debounced edge vertex changes
    this._x6GraphAdapter.debouncedEdgeVerticesChanged$.pipe(takeUntil(this._destroy$)).subscribe({
      next: event => this._handleDebouncedEdgeVertexChange(event, diagramId, userId),
      error: (error: unknown) =>
        this._logger.error('Error in debounced edge vertex subscription', { error }),
    });

    this._isInitialized = true;
    this._logger.info('History integration service initialized successfully');
  }

  /**
   * Cleanup when service is destroyed
   */
  ngOnDestroy(): void {
    this._logger.info('Destroying history integration service');
    this._destroy$.next();
    this._destroy$.complete();
    this._isInitialized = false;
  }

  /**
   * Handles debounced node movement events by dispatching UpdateNodePositionCommand
   */
  private _handleDebouncedNodeMovement(
    event: {
      nodeId: string;
      position: { x: number; y: number };
      previous: { x: number; y: number };
    },
    diagramId: string,
    userId: string,
  ): void {
    try {
      this._logger.info('Processing debounced node movement for history', {
        nodeId: event.nodeId,
        newPosition: event.position,
        oldPosition: event.previous,
      });

      // Start operation tracking
      const operationId = this._generateOperationId('node_move', event.nodeId);
      this._logger.info('DIAGNOSTIC: Starting operation tracking', {
        operationId,
        nodeId: event.nodeId,
        operationType: OperationType.UPDATE_POSITION,
      });
      this._operationTracker.startOperation(operationId, OperationType.UPDATE_POSITION, {
        entityId: event.nodeId,
        entityType: 'node',
        startPosition: event.previous,
        currentPosition: event.position,
      });

      // Create and dispatch the update position command
      const command = DiagramCommandFactory.updateNodePosition(
        diagramId,
        userId,
        event.nodeId,
        new Point(event.position.x, event.position.y),
        new Point(event.previous.x, event.previous.y),
        true, // isLocalUserInitiated = true for history recording
      );

      // CRITICAL FIX: Attach the operation ID to the command so the history middleware can find it
      const commandWithOperationId = command as unknown as Record<string, unknown>;
      commandWithOperationId['operationId'] = operationId;

      // DIAGNOSTIC LOGGING - Show the command ID vs operation ID mismatch
      this._logger.info('DIAGNOSTIC: Command created with attached operation ID', {
        operationId,
        commandId: command.commandId,
        commandType: command.type,
        nodeId: event.nodeId,
        attachedOperationId: commandWithOperationId['operationId'],
      });

      // Dispatch the command through the command bus
      this._commandBus.execute(command).subscribe({
        next: () => {
          this._logger.info('Node position update command executed successfully', {
            nodeId: event.nodeId,
            operationId,
          });
          // Complete the operation AFTER successful execution
          this._operationTracker.completeOperation(operationId);
        },
        error: (error: unknown) => {
          this._logger.error('Failed to execute node position update command', {
            nodeId: event.nodeId,
            operationId,
            error,
          });
          this._operationTracker.cancelOperation(operationId);
        },
      });
    } catch (error) {
      this._logger.error('Failed to handle debounced node movement', {
        nodeId: event.nodeId,
        error,
      });
    }
  }

  /**
   * Handles debounced edge vertex changes by dispatching UpdateEdgeDataCommand
   */
  private _handleDebouncedEdgeVertexChange(
    event: { edgeId: string; vertices: Array<{ x: number; y: number }> },
    diagramId: string,
    userId: string,
  ): void {
    try {
      this._logger.info('Processing debounced edge vertex change for history', {
        edgeId: event.edgeId,
        vertexCount: event.vertices.length,
      });

      // Start operation tracking
      const operationId = this._generateOperationId('edge_vertices', event.edgeId);
      this._operationTracker.startOperation(operationId, OperationType.EDIT_VERTICES, {
        entityId: event.edgeId,
        entityType: 'edge',
        currentData: { vertices: event.vertices },
      });

      // Get current edge data to preserve other properties
      const currentEdgeData = this._getCurrentEdgeData(event.edgeId);
      const newVertices = event.vertices.map(vertex => new Point(vertex.x, vertex.y));
      const newEdgeData = currentEdgeData.withVertices(newVertices);

      // Create and dispatch the update edge data command
      const command = DiagramCommandFactory.updateEdgeData(
        diagramId,
        userId,
        event.edgeId,
        newEdgeData,
        currentEdgeData,
        true, // isLocalUserInitiated = true for history recording
      );

      // CRITICAL FIX: Attach the operation ID to the command so the history middleware can find it
      const commandWithOperationId = command as unknown as Record<string, unknown>;
      commandWithOperationId['operationId'] = operationId;

      // Dispatch the command through the command bus
      this._commandBus.execute(command).subscribe({
        next: () => {
          this._logger.info('Edge vertex update command executed successfully', {
            edgeId: event.edgeId,
            operationId,
          });
          // Complete the operation AFTER successful execution
          this._operationTracker.completeOperation(operationId);
        },
        error: (error: unknown) => {
          this._logger.error('Failed to execute edge vertex update command', {
            edgeId: event.edgeId,
            operationId,
            error,
          });
          this._operationTracker.cancelOperation(operationId);
        },
      });
    } catch (error) {
      this._logger.error('Failed to handle debounced edge vertex change', {
        edgeId: event.edgeId,
        error,
      });
    }
  }

  /**
   * Gets current edge data from the graph
   */
  private _getCurrentEdgeData(edgeId: string): EdgeData {
    try {
      const graph = this._x6GraphAdapter.getGraph();
      if (!graph) {
        this._logger.warn('No graph available to get edge data', { edgeId });
        return this._createDefaultEdgeData(edgeId);
      }

      const edge = graph.getCellById(edgeId);
      if (!edge || !edge.isEdge()) {
        this._logger.warn('Edge not found in graph', { edgeId });
        return this._createDefaultEdgeData(edgeId);
      }

      // Get basic edge information from X6 edge
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      if (!sourceNodeId || !targetNodeId) {
        this._logger.warn('Edge missing source or target node', {
          edgeId,
          sourceNodeId,
          targetNodeId,
        });
        return this._createDefaultEdgeData(edgeId);
      }

      // Get current vertices from the edge
      const currentVertices = edge.getVertices();
      const vertices = currentVertices.map((vertex: unknown) => {
        if (vertex && typeof vertex === 'object' && 'x' in vertex && 'y' in vertex) {
          const typedVertex = vertex as { x: number; y: number };
          return { x: typedVertex.x, y: typedVertex.y };
        }
        return { x: 0, y: 0 }; // Default fallback
      });

      // Try to get existing edge data, or create basic edge data
      const edgeData: unknown = edge.getData();
      let label = 'Data Flow'; // Default label
      let metadata: Record<string, string> = {};

      if (edgeData && typeof edgeData === 'object') {
        const plainData = edgeData as Record<string, unknown>;
        if (typeof plainData['label'] === 'string') {
          label = plainData['label'];
        }
        if (plainData['metadata'] && typeof plainData['metadata'] === 'object') {
          metadata = plainData['metadata'] as Record<string, string>;
        }
      }

      return EdgeData.fromJSON({
        id: edgeId,
        sourceNodeId,
        targetNodeId,
        sourcePortId,
        targetPortId,
        label,
        vertices,
        metadata,
      });
    } catch (error) {
      this._logger.error('Failed to get current edge data', { edgeId, error });
      return this._createDefaultEdgeData(edgeId);
    }
  }

  /**
   * Creates a default EdgeData instance for fallback scenarios
   */
  private _createDefaultEdgeData(edgeId: string): EdgeData {
    this._logger.warn('Creating default edge data for missing edge', { edgeId });
    return EdgeData.createSimple(edgeId, 'unknown-source', 'unknown-target', 'Data Flow');
  }

  /**
   * Generates a unique operation ID
   */
  private _generateOperationId(type: string, entityId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `${type}_${entityId}_${timestamp}_${random}`;
  }
}
