/**
 * Base class for operation executors
 * Provides common functionality and patterns for all graph operation executors
 */

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Graph, Cell, Node, Edge } from '@antv/x6';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  OperationExecutor,
} from '../../types/graph-operation.types';

/**
 * Abstract base executor providing common functionality
 */
@Injectable()
// SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: abstract base for graph operation executors providing shared result and lookup helpers
export abstract class BaseOperationExecutor implements OperationExecutor {
  abstract readonly priority: number;

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: inject the logger service for subclass use (pure)
  constructor(protected logger: LoggerService) {}

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: report whether this executor handles the given graph operation (pure)
  abstract canExecute(operation: GraphOperation): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: execute a graph operation within the given context and return a result observable
  abstract execute(
    operation: GraphOperation,
    context: OperationContext,
  ): Observable<OperationResult>;

  /**
   * Create a successful operation result
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a successful operation result for the given operation and affected cells (pure)
  protected createSuccessResult(
    operation: GraphOperation,
    affectedCellIds: string[],
    metadata?: Record<string, any>,
  ): OperationResult {
    return {
      success: true,
      operationId: operation.id,
      operationType: operation.type,
      affectedCellIds,
      timestamp: Date.now(),
      metadata: metadata || {},
    };
  }

  /**
   * Create a failed operation result
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a failed operation result with an error message for the given operation (pure)
  protected createFailureResult(
    operation: GraphOperation,
    error: string,
    affectedCellIds: string[] = [],
  ): OperationResult {
    return {
      success: false,
      operationId: operation.id,
      operationType: operation.type,
      affectedCellIds,
      timestamp: Date.now(),
      error,
      metadata: {},
    };
  }

  /**
   * Safely get a cell from the graph
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a graph cell by ID, returning null if graph is unavailable (pure)
  protected getCell(graph: Graph | null, cellId: string): Cell | null {
    if (!graph) {
      return null;
    }
    return graph.getCellById(cellId);
  }

  /**
   * Safely get a node from the graph
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a graph node by ID, returning null if not found or not a node (pure)
  protected getNode(graph: Graph | null, nodeId: string): Node | null {
    const cell = this.getCell(graph, nodeId);
    return cell?.isNode() ? cell : null;
  }

  /**
   * Safely get an edge from the graph
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a graph edge by ID, returning null if not found or not an edge (pure)
  protected getEdge(graph: Graph | null, edgeId: string): Edge | null {
    const cell = this.getCell(graph, edgeId);
    return cell?.isEdge() ? cell : null;
  }

  /**
   * Check if graph is available and ready
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate the graph is available for an operation, erroring if null (pure)
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
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a unique cell ID using timestamp and random suffix (pure)
  protected generateCellId(): string {
    return `cell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log operation start
   */
  // SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: log the start of a graph operation with its metadata
  protected logOperationStart(operation: GraphOperation): void {
    this.logger.debugComponent('BaseOperationExecutor', `Starting ${operation.type} operation`, {
      operationId: operation.id,
      source: operation.source,
      priority: operation.priority,
    });
  }

  /**
   * Log operation completion
   */
  // SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: log completion of a graph operation with success status and affected cell count
  protected logOperationComplete(operation: GraphOperation, result: OperationResult): void {
    this.logger.debugComponent('BaseOperationExecutor', `Completed ${operation.type} operation`, {
      operationId: operation.id,
      success: result.success,
      affectedCells: result.affectedCellIds.length,
      error: result.error,
    });
  }
}
