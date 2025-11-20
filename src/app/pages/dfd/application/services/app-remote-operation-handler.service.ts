/**
 * AppRemoteOperationHandler - Handles remote diagram operations from collaboration
 *
 * This service is responsible for:
 * - Subscribing to remote operation events from WebSocket
 * - Converting CellOperation (WebSocket format) to GraphOperation (internal format)
 * - Routing operations through GraphOperationManager with proper source flag
 * - Ensuring remote operations don't trigger history recording or re-broadcasting
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Graph } from '@antv/x6';

import { LoggerService } from '../../../../core/services/logger.service';
import { AppStateService } from './app-state.service';
import { AppGraphOperationManager } from './app-graph-operation-manager.service';
import { AppOperationStateManager } from './app-operation-state-manager.service';
import { CellOperation, Cell as WSCell } from '../../../../core/types/websocket-message.types';
import {
  GraphOperation,
  OperationContext,
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  DeleteEdgeOperation,
  NodeData,
} from '../../types/graph-operation.types';
import { EdgeInfo } from '../../domain/value-objects/edge-info';

@Injectable()
export class AppRemoteOperationHandler implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private _subscriptions = new Subscription();
  private _initialized = false;
  private _graph: Graph | null = null;
  private _operationContext: OperationContext | null = null;

  // Statistics
  private _stats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
  };

  constructor(
    private readonly logger: LoggerService,
    private readonly appStateService: AppStateService,
    private readonly graphOperationManager: AppGraphOperationManager,
    private readonly historyCoordinator: AppOperationStateManager,
  ) {
    this.logger.debug('AppRemoteOperationHandler constructed');
  }

  /**
   * Initialize the handler with graph and operation context
   */
  initialize(graph: Graph, operationContext: OperationContext): void {
    if (this._initialized) {
      this.logger.warn('AppRemoteOperationHandler already initialized');
      return;
    }

    this._graph = graph;
    this._operationContext = operationContext;

    // Subscribe to batched remote operation events from AppStateService
    this._subscriptions.add(
      this.appStateService.applyBatchedOperationsEvents$.pipe(takeUntil(this._destroy$)).subscribe({
        next: event => {
          this._handleBatchedRemoteOperations(event.operations, event.userId, event.operationId);
        },
        error: error => {
          this.logger.error('Error in batched remote operation event stream', { error });
        },
      }),
    );

    // Keep legacy individual operation subscription for compatibility
    this._subscriptions.add(
      this.appStateService.applyOperationEvents$.pipe(takeUntil(this._destroy$)).subscribe({
        next: event => {
          this._handleRemoteOperation(event.operation, event.userId, event.operationId);
        },
        error: error => {
          this.logger.error('Error in remote operation event stream', { error });
        },
      }),
    );

    this._initialized = true;
    this.logger.info('AppRemoteOperationHandler initialized');
  }

  /**
   * Get handler statistics
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
    };
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
    this.logger.debug('AppRemoteOperationHandler destroyed');
  }

  /**
   * Handle batched remote operations (from a single diagram_operation message)
   */
  private _handleBatchedRemoteOperations(
    cellOperations: CellOperation[],
    userId: string,
    operationId: string,
  ): void {
    if (!this._graph || !this._operationContext) {
      this.logger.error('Cannot handle batched remote operations - not initialized');
      return;
    }

    this.logger.info('Handling batched remote operations', {
      operationCount: cellOperations.length,
      userId,
      operationId,
    });

    // Process each cell operation in the batch sequentially
    for (const cellOperation of cellOperations) {
      this._handleRemoteOperation(cellOperation, userId, `${operationId}-${cellOperation.id}`);
    }
  }

  /**
   * Handle a remote operation event
   */
  private _handleRemoteOperation(
    cellOperation: CellOperation,
    userId: string,
    operationId: string,
  ): void {
    if (!this._graph || !this._operationContext) {
      this.logger.error('Cannot handle remote operation - not initialized');
      return;
    }

    this._stats.totalOperations++;

    this.logger.debug('Handling remote operation', {
      cellId: cellOperation.id,
      operation: cellOperation.operation,
      userId,
      operationId,
    });

    try {
      // Convert CellOperation to GraphOperation
      const graphOperation = this._convertCellOperationToGraphOperation(
        cellOperation,
        userId,
        operationId,
      );

      if (!graphOperation) {
        this.logger.warn('Could not convert cell operation to graph operation', {
          cellOperation,
        });
        this._stats.failedOperations++;
        return;
      }

      // Execute the operation through the operation manager
      // Wrap with executeRemoteOperation to set isApplyingRemoteChange flag
      // This prevents the broadcaster from re-broadcasting this remote operation
      const operationContext = this._operationContext; // Already verified not null above
      this.historyCoordinator.executeRemoteOperation(this._graph, () => {
        this.graphOperationManager.execute(graphOperation, operationContext).subscribe({
          next: result => {
            if (result.success) {
              this._stats.successfulOperations++;
              this.logger.debug('Remote operation executed successfully', {
                operationId,
                affectedCells: result.affectedCellIds?.length || 0,
              });
            } else {
              this._stats.failedOperations++;
              this.logger.error('Remote operation execution failed', {
                operationId,
                error: result.error,
              });
            }
          },
          error: error => {
            this._stats.failedOperations++;
            this.logger.error('Error executing remote operation', {
              operationId,
              error,
            });
          },
        });
      });
    } catch (error) {
      this._stats.failedOperations++;
      this.logger.error('Exception handling remote operation', {
        cellOperation,
        error,
      });
    }
  }

  /**
   * Convert CellOperation (WebSocket format) to GraphOperation (internal format)
   */
  private _convertCellOperationToGraphOperation(
    cellOp: CellOperation,
    userId: string,
    operationId: string,
  ): GraphOperation | null {
    const baseOperation = {
      id: operationId,
      source: 'remote-collaboration' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      userId,
    };

    // Determine if this is a node or edge based on cell data
    if (!cellOp.data) {
      // Deletion without data
      if (cellOp.operation === 'remove') {
        // We need to check the graph to determine if it's a node or edge
        const cell = this._graph?.getCellById(cellOp.id);
        if (cell?.isNode()) {
          return {
            ...baseOperation,
            type: 'delete-node',
            nodeId: cellOp.id,
          } as DeleteNodeOperation;
        } else if (cell?.isEdge()) {
          return {
            ...baseOperation,
            type: 'delete-edge',
            edgeId: cellOp.id,
          } as DeleteEdgeOperation;
        } else {
          this.logger.warn('Cannot determine cell type for deletion', { cellId: cellOp.id });
          return null;
        }
      }
      this.logger.warn('Cell operation missing data', { cellOp });
      return null;
    }

    const cellData = cellOp.data;
    const isNode = cellData.shape !== 'edge';

    if (isNode) {
      return this._convertToCellNodeOperation(cellOp, cellData, baseOperation);
    } else {
      return this._convertToCellEdgeOperation(cellOp, cellData, baseOperation);
    }
  }

  /**
   * Convert cell operation to node operation
   */
  private _convertToCellNodeOperation(
    cellOp: CellOperation,
    cellData: WSCell,
    baseOperation: Partial<GraphOperation>,
  ): GraphOperation | null {
    // Extract label from X6 native attrs structure
    const label =
      cellData.attrs && typeof cellData.attrs === 'object' && 'text' in cellData.attrs
        ? (cellData.attrs as any).text?.text
        : undefined;

    const nodeData: NodeData = {
      id: cellData.id,
      nodeType: cellData.shape,
      position: cellData.position,
      size: cellData.size,
      label: typeof label === 'string' ? label : undefined,
      style: cellData.attrs as Record<string, any>,
      properties: cellData as Record<string, any>,
    };

    switch (cellOp.operation) {
      case 'add':
        return {
          ...baseOperation,
          type: 'create-node',
          nodeData,
        } as CreateNodeOperation;

      case 'update':
        return {
          ...baseOperation,
          type: 'update-node',
          nodeId: cellData.id,
          updates: nodeData,
        } as UpdateNodeOperation;

      case 'remove':
        return {
          ...baseOperation,
          type: 'delete-node',
          nodeId: cellData.id,
          nodeData,
        } as DeleteNodeOperation;

      default:
        this.logger.warn('Unknown cell operation type', { operation: cellOp.operation });
        return null;
    }
  }

  /**
   * Convert cell operation to edge operation
   */
  private _convertToCellEdgeOperation(
    cellOp: CellOperation,
    cellData: WSCell,
    baseOperation: Partial<GraphOperation>,
  ): GraphOperation | null {
    // Extract source and target node IDs for legacy field support
    const sourceNodeId =
      typeof cellData.source === 'object' && cellData.source !== null
        ? (cellData.source as any).cell
        : '';
    const targetNodeId =
      typeof cellData.target === 'object' && cellData.target !== null
        ? (cellData.target as any).cell
        : '';
    const sourcePortId =
      typeof cellData.source === 'object' && cellData.source !== null
        ? (cellData.source as any).port
        : undefined;
    const targetPortId =
      typeof cellData.target === 'object' && cellData.target !== null
        ? (cellData.target as any).port
        : undefined;

    // Use EdgeInfo.fromJSON to handle both new and legacy format
    const edgeInfo = EdgeInfo.fromJSON({
      id: cellData.id,
      source: cellData.source as any,
      target: cellData.target as any,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      vertices: (cellData as any).vertices || [],
      attrs: cellData.attrs as Record<string, any>,
    });

    switch (cellOp.operation) {
      case 'add':
        return {
          ...baseOperation,
          type: 'create-edge',
          edgeInfo,
          sourceNodeId,
          targetNodeId,
          sourcePortId,
          targetPortId,
        } as CreateEdgeOperation;

      case 'update':
        return {
          ...baseOperation,
          type: 'update-edge',
          edgeId: cellData.id,
          updates: edgeInfo,
        } as UpdateEdgeOperation;

      case 'remove':
        return {
          ...baseOperation,
          type: 'delete-edge',
          edgeId: cellData.id,
          edgeInfo,
        } as DeleteEdgeOperation;

      default:
        this.logger.warn('Unknown cell operation type', { operation: cellOp.operation });
        return null;
    }
  }
}
