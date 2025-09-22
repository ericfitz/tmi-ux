/**
 * Base class for operation executors
 * Provides common functionality and patterns for all graph operation executors
 */

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Graph, Cell, Node, Edge } from '@antv/x6';

import { LoggerService } from '../../../../../core/services/logger.service';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  OperationExecutor
} from '../../types/graph-operation.types';

/**
 * Abstract base executor providing common functionality
 */
@Injectable()
export abstract class BaseOperationExecutor implements OperationExecutor {
  abstract readonly priority: number;

  constructor(protected logger: LoggerService) {}

  abstract canExecute(operation: GraphOperation): boolean;
  abstract execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;

  /**
   * Create a successful operation result
   */
  protected createSuccessResult(
    operation: GraphOperation,
    affectedCellIds: string[],
    metadata?: Record<string, any>
  ): OperationResult {
    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
      affectedCellIds,
      timestamp: Date.now(),
      metadata: metadata || {}
    };
  }

  /**
   * Create a failed operation result
   */
  protected createFailureResult(
    operation: GraphOperation,
    error: string,
    affectedCellIds: string[] = []
  ): OperationResult {
    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      affectedCellIds,
      timestamp: Date.now(),
      error,
      metadata: {}
    };
  }

  /**
   * Safely get a cell from the graph
   */
  protected getCell(graph: Graph | null, cellId: string): Cell | null {
    if (!graph) {
      return null;
    }
    return graph.getCellById(cellId);
  }

  /**
   * Safely get a node from the graph
   */
  protected getNode(graph: Graph | null, nodeId: string): Node | null {
    const cell = this.getCell(graph, nodeId);
    return cell?.isNode() ? cell : null;
  }

  /**
   * Safely get an edge from the graph
   */
  protected getEdge(graph: Graph | null, edgeId: string): Edge | null {
    const cell = this.getCell(graph, edgeId);
    return cell?.isEdge() ? cell : null;
  }

  /**
   * Check if graph is available and ready
   */
  protected validateGraph(graph: Graph | null, operation: GraphOperation): Observable<Graph> {
    if (!graph) {
      const error = `Graph not available for operation ${operation.type}`;
      this.logger.error(error, { operationId: operation.id });
      return throwError(() => new Error(error));
    }
    return of(graph);
  }

  /**
   * Generate a unique cell ID
   */
  protected generateCellId(): string {
    return `cell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log operation start
   */
  protected logOperationStart(operation: GraphOperation): void {
    this.logger.debug(`Starting ${operation.type} operation`, {
      operationId: operation.id,
      source: operation.source,
      priority: operation.priority
    });
  }

  /**
   * Log operation completion
   */
  protected logOperationComplete(operation: GraphOperation, result: OperationResult): void {
    this.logger.debug(`Completed ${operation.type} operation`, {
      operationId: operation.id,
      success: result.success,
      affectedCells: result.affectedCellIds.length,
      error: result.error
    });
  }
}