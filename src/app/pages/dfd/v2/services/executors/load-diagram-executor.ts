/**
 * Executor for diagram loading operations
 * Handles loading complete diagrams into the graph
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { LoggerService } from '../../../../../core/services/logger.service';
import { BaseOperationExecutor } from './base-operation-executor';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  LoadDiagramOperation,
} from '../../types/graph-operation.types';

@Injectable()
export class LoadDiagramExecutor extends BaseOperationExecutor {
  readonly priority = 150; // High priority for diagram loading

  constructor(logger: LoggerService) {
    super(logger);
  }

  canExecute(operation: GraphOperation): boolean {
    return operation.type === 'load-diagram';
  }

  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    const loadOperation = operation as LoadDiagramOperation;
    this.logOperationStart(operation);

    return this.validateGraph(context.graph, operation).pipe(
      switchMap(_graph => this.executeLoadDiagram(loadOperation, context)),
      map(result => {
        this.logOperationComplete(operation, result);
        return result;
      }),
      catchError(error => {
        const errorMessage = `Failed to load diagram: ${error}`;
        this.logger.error(errorMessage, { operationId: operation.id, error });
        return of(this.createFailureResult(operation, errorMessage));
      }),
    );
  }

  private executeLoadDiagram(
    operation: LoadDiagramOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { diagramData, clearExisting } = operation;

      this.logger.debug('Starting diagram load', {
        operationId: operation.id,
        clearExisting,
        nodeCount: diagramData.nodes?.length || 0,
        edgeCount: diagramData.edges?.length || 0,
      });

      // Clear existing diagram if requested
      if (clearExisting) {
        graph.clearCells();
        this.logger.debug('Cleared existing diagram');
      }

      const loadedCellIds: string[] = [];
      const loadErrors: string[] = [];

      // Load nodes first
      if (diagramData.nodes && diagramData.nodes.length > 0) {
        this.logger.debug('Loading nodes', { count: diagramData.nodes.length });

        diagramData.nodes.forEach((nodeData: any) => {
          try {
            const nodeConfig = this.createNodeConfig(nodeData);
            const node = graph.addNode(nodeConfig);
            loadedCellIds.push(node.id);

            // Apply additional styling if present
            if (nodeData.cssClass) {
              // Note: addCssClass might not exist on X6 nodes, skip for now
              // node.addCssClass(nodeData.cssClass);
            }
          } catch (error) {
            const errorMsg = `Failed to load node ${nodeData.id}: ${String(error)}`;
            loadErrors.push(errorMsg);
            this.logger.warn(errorMsg, { nodeId: nodeData.id, error });
          }
        });
      }

      // Load edges after nodes
      if (diagramData.edges && diagramData.edges.length > 0) {
        this.logger.debug('Loading edges', { count: diagramData.edges.length });

        diagramData.edges.forEach((edgeData: any) => {
          try {
            // Verify source and target nodes exist
            if (!graph.getCellById(edgeData.source.cell)) {
              throw new Error(`Source node not found: ${edgeData.source.cell}`);
            }
            if (!graph.getCellById(edgeData.target.cell)) {
              throw new Error(`Target node not found: ${edgeData.target.cell}`);
            }

            const edgeConfig = this.createEdgeConfig(edgeData);
            const edge = graph.addEdge(edgeConfig);
            loadedCellIds.push(edge.id);

            // Apply additional styling if present
            if (edgeData.cssClass) {
              // Note: addCssClass might not exist on X6 edges, skip for now
              // edge.addCssClass(edgeData.cssClass);
            }
          } catch (error) {
            const errorMsg = `Failed to load edge ${edgeData.id}: ${String(error)}`;
            loadErrors.push(errorMsg);
            this.logger.warn(errorMsg, { edgeId: edgeData.id, error });
          }
        });
      }

      // Apply diagram-level properties
      if (diagramData.properties) {
        // Could store diagram properties in graph metadata
        this.logger.debug('Applied diagram properties', {
          properties: Object.keys(diagramData.properties),
        });
      }

      const success = loadErrors.length === 0;
      const metadata = {
        loadedCellCount: loadedCellIds.length,
        requestedNodeCount: diagramData.nodes?.length || 0,
        requestedEdgeCount: diagramData.edges?.length || 0,
        loadErrors: loadErrors,
        clearExisting,
        diagramProperties: diagramData.properties || {},
      };

      if (success) {
        this.logger.info('Diagram loaded successfully', {
          operationId: operation.id,
          loadedCellCount: loadedCellIds.length,
          nodeCount: diagramData.nodes?.length || 0,
          edgeCount: diagramData.edges?.length || 0,
        });

        return of(this.createSuccessResult(operation, loadedCellIds, metadata));
      } else {
        const error = `Diagram loaded with ${loadErrors.length} errors`;
        this.logger.warn('Diagram loaded with errors', {
          operationId: operation.id,
          errorCount: loadErrors.length,
          loadedCellCount: loadedCellIds.length,
        });

        return of({
          success: false,
          operationId: operation.id,
          operationType: operation.type,
          affectedCellIds: loadedCellIds,
          timestamp: Date.now(),
          error,
          metadata,
        });
      }
    } catch (error) {
      const errorMessage = `Critical error during diagram load: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, error });
      return of(this.createFailureResult(operation, errorMessage));
    }
  }

  private createNodeConfig(nodeData: any): any {
    return {
      id: nodeData.id,
      shape: nodeData.shape || 'rect',
      x: nodeData.x || 0,
      y: nodeData.y || 0,
      width: nodeData.width || 120,
      height: nodeData.height || 60,
      attrs: nodeData.attrs || {
        body: {
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 1,
        },
        label: {
          text: nodeData.label || nodeData.attrs?.label?.text || 'Node',
          fontSize: 14,
          fill: '#000000',
        },
      },
      data: nodeData.data || {},
      zIndex: nodeData.zIndex || 1,
    };
  }

  private createEdgeConfig(edgeData: any): any {
    return {
      id: edgeData.id,
      shape: edgeData.shape || 'edge',
      source: edgeData.source,
      target: edgeData.target,
      attrs: edgeData.attrs || {
        line: {
          stroke: '#000000',
          strokeWidth: 1,
        },
      },
      labels: edgeData.labels || [],
      data: edgeData.data || {},
      zIndex: edgeData.zIndex || 0,
    };
  }
}
