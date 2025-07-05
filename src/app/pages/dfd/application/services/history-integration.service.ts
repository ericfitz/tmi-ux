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
import { NodeData, NodeType } from '../../domain/value-objects/node-data';
import { HistoryService } from './history.service';

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
    private readonly _historyService: HistoryService,
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

    // Set command context on X6 adapter for delete operations
    this._x6GraphAdapter.setCommandContext(
      diagramId,
      userId,
      this._commandBus,
      this._operationTracker,
    );

    // Subscribe to drag completion events for clean history recording
    this._x6GraphAdapter.dragCompleted$.pipe(takeUntil(this._destroy$)).subscribe({
      next: event => this._handleDragCompletion(event, diagramId, userId),
      error: (error: unknown) =>
        this._logger.error('Error in drag completion subscription', { error }),
    });

    // Subscribe to debounced edge vertex changes
    this._x6GraphAdapter.debouncedEdgeVerticesChanged$.pipe(takeUntil(this._destroy$)).subscribe({
      next: event => this._handleDebouncedEdgeVertexChange(event, diagramId, userId),
      error: (error: unknown) =>
        this._logger.error('Error in debounced edge vertex subscription', { error }),
    });

    // Subscribe to debounced node resize events
    this._x6GraphAdapter.debouncedNodeResized$.pipe(takeUntil(this._destroy$)).subscribe({
      next: event => this._handleDebouncedNodeResize(event, diagramId, userId),
      error: (error: unknown) =>
        this._logger.error('Error in debounced node resize subscription', { error }),
    });

    // Subscribe to debounced node data change events (for label edits, etc.)
    this._x6GraphAdapter.debouncedNodeDataChanged$.pipe(takeUntil(this._destroy$)).subscribe({
      next: event => this._handleDebouncedNodeDataChange(event, diagramId, userId),
      error: (error: unknown) =>
        this._logger.error('Error in debounced node data change subscription', { error }),
    });

    // Note: Duplicate subscriptions removed - already subscribed above

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

  // Note: _handleDebouncedNodeMovement removed - drag completion provides superior tracking

  /**
   * Handles debounced node resize events by dispatching UpdateNodeDataCommand
   */
  private _handleDebouncedNodeResize(
    event: {
      nodeId: string;
      width: number;
      height: number;
      oldWidth: number;
      oldHeight: number;
    },
    diagramId: string,
    userId: string,
  ): void {
    try {
      // CRITICAL FIX: Check if undo/redo operation is in progress before processing debounced events
      if (this._historyService.isUndoRedoInProgress()) {
        this._logger.info('Skipping debounced node resize during undo/redo operation', {
          nodeId: event.nodeId,
          newSize: { width: event.width, height: event.height },
          oldSize: { width: event.oldWidth, height: event.oldHeight },
        });
        return;
      }

      this._logger.info('Processing debounced node resize for history', {
        nodeId: event.nodeId,
        newSize: { width: event.width, height: event.height },
        oldSize: { width: event.oldWidth, height: event.oldHeight },
      });

      // Start operation tracking
      const operationId = this._generateOperationId('node_resize', event.nodeId);
      this._operationTracker.startOperation(operationId, OperationType.UPDATE_DATA, {
        entityId: event.nodeId,
        entityType: 'node',
        oldData: { width: event.oldWidth, height: event.oldHeight },
        newData: { width: event.width, height: event.height },
      });

      // Get current node data to preserve other properties
      const currentNodeData = this._getCurrentNodeData(event.nodeId);
      const newNodeData = currentNodeData.withWidth(event.width).withHeight(event.height);

      // Convert NodeData to X6NodeSnapshot
      const currentSnapshot = this._convertNodeDataToSnapshot(currentNodeData);
      const newSnapshot = this._convertNodeDataToSnapshot(newNodeData);

      // Create and dispatch the update node data command
      const command = DiagramCommandFactory.updateNodeData(
        diagramId,
        userId,
        event.nodeId,
        newSnapshot,
        currentSnapshot,
        true, // isLocalUserInitiated = true for history recording
      );

      // Attach the operation ID to the command
      const commandWithOperationId = command as unknown as Record<string, unknown>;
      commandWithOperationId['operationId'] = operationId;

      // Dispatch the command through the command bus
      this._commandBus.execute(command).subscribe({
        next: () => {
          this._logger.info('Node resize update command executed successfully', {
            nodeId: event.nodeId,
            operationId,
          });
          this._operationTracker.completeOperation(operationId);
        },
        error: (error: unknown) => {
          this._logger.error('Failed to execute node resize update command', {
            nodeId: event.nodeId,
            operationId,
            error,
          });
          this._operationTracker.cancelOperation(operationId);
        },
      });
    } catch (error) {
      this._logger.error('Failed to handle debounced node resize', {
        nodeId: event.nodeId,
        error,
      });
    }
  }

  /**
   * Handles debounced node data change events by dispatching UpdateNodeDataCommand
   */
  private _handleDebouncedNodeDataChange(
    event: {
      nodeId: string;
      newData: Record<string, unknown>;
      oldData: Record<string, unknown>;
    },
    diagramId: string,
    userId: string,
  ): void {
    try {
      // CRITICAL FIX: Check if undo/redo operation is in progress before processing debounced events
      if (this._historyService.isUndoRedoInProgress()) {
        this._logger.info('Skipping debounced node data change during undo/redo operation', {
          nodeId: event.nodeId,
          newData: event.newData,
          oldData: event.oldData,
        });
        return;
      }

      this._logger.info('Processing debounced node data change for history', {
        nodeId: event.nodeId,
        newData: event.newData,
        oldData: event.oldData,
      });

      // Start operation tracking
      const operationId = this._generateOperationId('node_data_change', event.nodeId);
      this._operationTracker.startOperation(operationId, OperationType.UPDATE_DATA, {
        entityId: event.nodeId,
        entityType: 'node',
        oldData: event.oldData,
        newData: event.newData,
      });

      // CRITICAL FIX: Use cached snapshot for "current" state instead of reading from domain
      // The domain already has the updated data, but we need the pre-update state for undo
      const cachedSnapshot = this._x6GraphAdapter.getNodeSnapshot(event.nodeId);
      if (!cachedSnapshot) {
        this._logger.warn('No cached snapshot found for node history recording', {
          nodeId: event.nodeId,
        });
        return;
      }

      // Get current node data to preserve other properties for the new snapshot
      const currentNodeData = this._getCurrentNodeData(event.nodeId);
      // Merge new data with existing data, ensuring label is updated if present
      const newNodeData = NodeData.fromJSON({
        ...currentNodeData.toJSON(),
        ...event.newData,
        position: currentNodeData.position, // Position is already in correct format
      });

      // Use cached snapshot as "current" and convert new data to snapshot
      const currentSnapshot = cachedSnapshot;
      const newSnapshot = this._convertNodeDataToSnapshot(newNodeData);

      // DIAGNOSTIC: Log snapshot comparison to debug undo issues
      this._logger.info('DIAGNOSTIC: FIXED - Using pre-change cached snapshot for history', {
        nodeId: event.nodeId,
        cachedLabel: cachedSnapshot.attrs?.['text']?.['text'],
        newLabel: newNodeData.label,
        currentSnapshotLabel: currentSnapshot.attrs?.['text']?.['text'],
        newSnapshotLabel: newSnapshot.attrs?.['text']?.['text'],
        currentSnapshotType: currentSnapshot.type,
        newSnapshotType: newSnapshot.type,
        usingPreChangeCachedSnapshot: true,
        shouldShowDifferentLabels: true,
      });

      // Create and dispatch the update node data command
      const command = DiagramCommandFactory.updateNodeData(
        diagramId,
        userId,
        event.nodeId,
        newSnapshot,
        currentSnapshot,
        true, // isLocalUserInitiated = true for history recording
      );

      // Attach the operation ID to the command
      const commandWithOperationId = command as unknown as Record<string, unknown>;
      commandWithOperationId['operationId'] = operationId;

      // Dispatch the command through the command bus
      this._commandBus.execute(command).subscribe({
        next: () => {
          this._logger.info('Node data update command executed successfully', {
            nodeId: event.nodeId,
            operationId,
          });
          this._operationTracker.completeOperation(operationId);
        },
        error: (error: unknown) => {
          this._logger.error('Failed to execute node data update command', {
            nodeId: event.nodeId,
            operationId,
            error,
          });
          this._operationTracker.cancelOperation(operationId);
        },
      });
    } catch (error) {
      this._logger.error('Failed to handle debounced node data change', {
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
      // CRITICAL FIX: Check if undo/redo operation is in progress before processing debounced events
      if (this._historyService.isUndoRedoInProgress()) {
        this._logger.info('Skipping debounced edge vertex change during undo/redo operation', {
          edgeId: event.edgeId,
          vertexCount: event.vertices.length,
        });
        return;
      }

      this._logger.info('Processing debounced edge vertex change for history', {
        edgeId: event.edgeId,
        vertexCount: event.vertices.length,
      });

      // Start operation tracking
      const operationId = this._generateOperationId('edge_vertices', event.edgeId);
      this._operationTracker.startOperation(operationId, OperationType.EDIT_VERTICES, {
        entityId: event.edgeId,
        entityType: 'edge',
        newData: { vertices: event.vertices },
      });

      // Get current edge data to preserve other properties
      const currentEdgeData = this._getCurrentEdgeData(event.edgeId);
      const newVertices = event.vertices.map(vertex => new Point(vertex.x, vertex.y));
      const newEdgeData = currentEdgeData.withVertices(newVertices);

      // Convert EdgeData to X6EdgeSnapshot
      const currentSnapshot = this._convertEdgeDataToSnapshot(currentEdgeData);
      const newSnapshot = this._convertEdgeDataToSnapshot(newEdgeData);

      // Create and dispatch the update edge data command
      const command = DiagramCommandFactory.updateEdgeData(
        diagramId,
        userId,
        event.edgeId,
        newSnapshot,
        currentSnapshot,
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
   * Handles drag completion events by dispatching UpdateNodePositionCommand with clean before/after state
   */
  private _handleDragCompletion(
    event: {
      nodeId: string;
      initialPosition: Point;
      finalPosition: Point;
      dragDuration: number;
      dragId: string;
    },
    diagramId: string,
    userId: string,
  ): void {
    try {
      // Only record history if the position actually changed
      if (event.initialPosition.equals(event.finalPosition)) {
        this._logger.debug('Drag completed with no position change - skipping history', {
          nodeId: event.nodeId,
          dragId: event.dragId,
          dragDuration: event.dragDuration,
        });
        return;
      }

      this._logger.info('Processing drag completion for clean history recording', {
        nodeId: event.nodeId,
        dragId: event.dragId,
        initialPosition: { x: event.initialPosition.x, y: event.initialPosition.y },
        finalPosition: { x: event.finalPosition.x, y: event.finalPosition.y },
        dragDuration: event.dragDuration,
        positionDelta: {
          dx: event.finalPosition.x - event.initialPosition.x,
          dy: event.finalPosition.y - event.initialPosition.y,
        },
      });

      // Start operation tracking for the completed drag
      const operationId = this._generateOperationId('drag_complete', event.nodeId);
      this._logger.info('Starting operation tracking for drag completion', {
        operationId,
        nodeId: event.nodeId,
        dragId: event.dragId,
        operationType: OperationType.UPDATE_POSITION,
      });

      this._operationTracker.startOperation(operationId, OperationType.UPDATE_POSITION, {
        entityId: event.nodeId,
        entityType: 'node',
        startPosition: { x: event.initialPosition.x, y: event.initialPosition.y },
        currentPosition: { x: event.finalPosition.x, y: event.finalPosition.y },
        metadata: {
          dragId: event.dragId,
          dragDuration: event.dragDuration.toString(),
        },
      });

      // Create and dispatch the update position command with clean initial/final positions
      const command = DiagramCommandFactory.updateNodePosition(
        diagramId,
        userId,
        event.nodeId,
        event.finalPosition,
        event.initialPosition,
        true, // isLocalUserInitiated = true for history recording
      );

      // Attach the operation ID to the command so the history middleware can find it
      const commandWithOperationId = command as unknown as Record<string, unknown>;
      commandWithOperationId['operationId'] = operationId;
      commandWithOperationId['dragId'] = event.dragId; // Include drag ID for correlation

      this._logger.info('Drag completion command created with clean positions', {
        operationId,
        dragId: event.dragId,
        commandId: command.commandId,
        commandType: command.type,
        nodeId: event.nodeId,
        initialPosition: { x: event.initialPosition.x, y: event.initialPosition.y },
        finalPosition: { x: event.finalPosition.x, y: event.finalPosition.y },
      });

      // Dispatch the command through the command bus
      this._commandBus.execute(command).subscribe({
        next: () => {
          this._logger.info('Drag completion command executed successfully', {
            nodeId: event.nodeId,
            dragId: event.dragId,
            operationId,
          });
          // Complete the operation AFTER successful execution
          this._operationTracker.completeOperation(operationId);
        },
        error: (error: unknown) => {
          this._logger.error('Failed to execute drag completion command', {
            nodeId: event.nodeId,
            dragId: event.dragId,
            operationId,
            error,
          });
          this._operationTracker.cancelOperation(operationId);
        },
      });
    } catch (error) {
      this._logger.error('Failed to handle drag completion', {
        nodeId: event.nodeId,
        dragId: event.dragId,
        error,
      });
    }
  }

  /**
   * Gets current node data from the graph
   */
  private _getCurrentNodeData(nodeId: string): NodeData {
    try {
      const graph = this._x6GraphAdapter.getGraph();
      if (!graph) {
        this._logger.warn('No graph available to get node data', { nodeId });
        return this._createDefaultNodeData(nodeId);
      }

      const node = graph.getCellById(nodeId);
      if (!node || !node.isNode()) {
        this._logger.warn('Node not found in graph', { nodeId });
        return this._createDefaultNodeData(nodeId);
      }

      // Extract data directly from the X6 Node object
      const id = node.id;
      const position = node.position();
      const size = node.size();
      const labelAttr = node.attr('text/text');
      const label = typeof labelAttr === 'string' ? labelAttr : ''; // Ensure label is always a string

      // CRITICAL FIX: Improved type detection from X6 cell data
      // Try multiple sources to determine the actual node type
      let detectedType: NodeType | null = null;

      // 1. Try to get type from X6 cell metadata (most reliable)
      if ((node as any).getMetadata) {
        const metadata = (node as any).getMetadata();
        const typeMetadata = metadata.find((m: any) => m.key === 'type');
        if (typeMetadata?.value && this._isValidNodeType(typeMetadata.value)) {
          detectedType = typeMetadata.value as NodeType;
          this._logger.debug('Node type detected from metadata', { nodeId, type: detectedType });
        }
      }

      // 2. Try to get type from node data if metadata didn't work
      if (!detectedType) {
        const rawData: unknown = node.getData();
        if (rawData && typeof rawData === 'object' && 'type' in rawData) {
          const dataType = (rawData as { type: string }).type;
          if (this._isValidNodeType(dataType)) {
            detectedType = dataType;
            this._logger.debug('Node type detected from node data', { nodeId, type: detectedType });
          }
        }
      }

      // 3. Try to infer type from X6 shape as last resort
      if (!detectedType) {
        const shape = node.shape;
        detectedType = this._inferNodeTypeFromShape(shape);
        this._logger.debug('Node type inferred from shape', { nodeId, shape, type: detectedType });
      }

      // 4. Use process as final fallback (guaranteed to be valid)
      const finalType = detectedType || 'process';

      if (!detectedType) {
        this._logger.warn('Could not detect node type, using fallback', {
          nodeId,
          fallbackType: finalType,
          shape: node.shape,
        });
      }

      // Get metadata for the NodeData
      const rawData: unknown = node.getData();
      const metadata =
        rawData && typeof rawData === 'object' && 'metadata' in rawData
          ? (rawData as { metadata: Record<string, string> }).metadata
          : {};

      return NodeData.fromJSON({
        id,
        type: finalType,
        label,
        position: { x: position.x, y: position.y },
        width: size.width,
        height: size.height,
        metadata: Object.entries(metadata || {}).map(([key, value]) => ({ key, value })),
      });
    } catch (error) {
      this._logger.error('Failed to get current node data', { nodeId, error });
      return this._createDefaultNodeData(nodeId);
    }
  }

  /**
   * Creates a default NodeData instance for fallback scenarios
   */
  private _createDefaultNodeData(nodeId: string): NodeData {
    this._logger.warn('Creating default node data for missing node', { nodeId });
    // CRITICAL FIX: Use 'process' as fallback type instead of 'unknown'
    // 'process' is a valid NodeType that will pass validation
    return NodeData.create({
      id: nodeId,
      type: 'process', // Use valid NodeType instead of 'unknown'
      label: 'Process', // Use appropriate default label
      position: new Point(0, 0), // Default position for fallback
      width: 120,
      height: 60,
    });
  }

  /**
   * Checks if the given type is a valid node type
   */
  private _isValidNodeType(type: string): type is NodeType {
    return ['actor', 'process', 'store', 'security-boundary', 'textbox'].includes(type);
  }

  /**
   * Infers node type from X6 shape as a fallback mechanism
   */
  private _inferNodeTypeFromShape(shape: string): NodeType {
    switch (shape) {
      case 'ellipse':
        return 'process';
      case 'store-shape':
        return 'store';
      case 'rect':
        // Could be actor, security-boundary, or textbox - default to process
        return 'process';
      default:
        return 'process'; // Safe fallback
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

  /**
   * Converts NodeData to X6NodeSnapshot
   */
  private _convertNodeDataToSnapshot(nodeData: NodeData): any {
    return {
      id: nodeData.id,
      shape: nodeData.type,
      position: { x: nodeData.position.x, y: nodeData.position.y },
      size: { width: nodeData.width, height: nodeData.height },
      attrs: { text: { text: nodeData.label } },
      metadata: [
        ...Object.entries(nodeData.metadata || {}).map(([key, value]) => ({ key, value })),
        { key: 'type', value: nodeData.type }, // Ensure type is preserved in metadata
      ],
      ports: [],
      zIndex: 1,
      visible: true,
      type: nodeData.type, // Use actual node type instead of hardcoded 'node'
    };
  }

  /**
   * Converts EdgeData to X6EdgeSnapshot
   */
  private _convertEdgeDataToSnapshot(edgeData: EdgeData): any {
    return {
      id: edgeData.id,
      shape: 'edge',
      source: { cell: edgeData.sourceNodeId },
      target: { cell: edgeData.targetNodeId },
      attrs: { text: { text: edgeData.label } },
      metadata: Object.entries(edgeData.metadata || {}).map(([key, value]) => ({ key, value })),
      labels: [],
      vertices: edgeData.vertices.map(v => ({ x: v.x, y: v.y })),
      zIndex: 1,
      visible: true,
      type: 'edge',
    };
  }
}
