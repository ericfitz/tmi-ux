/**
 * Executor for diagram loading operations
 * Handles loading complete diagrams into the graph
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { DFD_STYLING } from '../../constants/styling-constants';
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
import { BaseOperationExecutor } from './base-operation-executor';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  LoadDiagramOperation,
} from '../../types/graph-operation.types';

@Injectable()
// SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: executor that loads a full diagram (nodes and edges) into the graph
export class LoadDiagramExecutor extends BaseOperationExecutor {
  readonly priority = 150; // High priority for diagram loading

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register the logger dependency for LoadDiagramExecutor (pure)
  constructor(logger: LoggerService) {
    super(logger);
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether an operation is a load-diagram type (pure)
  canExecute(operation: GraphOperation): boolean {
    return operation.type === 'load-diagram';
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate the graph then dispatch a load-diagram operation, returning an observable result (mutates shared state)
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

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: load diagram nodes and edges into the graph, optionally clearing existing cells first (mutates shared state)
  private executeLoadDiagram(
    operation: LoadDiagramOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { diagramData, clearExisting } = operation;

      this.logger.debugComponent('LoadDiagramExecutor', 'Starting diagram load', {
        operationId: operation.id,
        clearExisting,
        nodeCount: diagramData.nodes?.length || 0,
        edgeCount: diagramData.edges?.length || 0,
      });

      // Clear existing diagram if requested
      if (clearExisting) {
        graph.clearCells();
        this.logger.debugComponent('LoadDiagramExecutor', 'Cleared existing diagram');
      }

      const loadedCellIds: string[] = [];
      const loadErrors: string[] = [];

      // Load nodes first, then edges
      this._loadNodes(graph, diagramData.nodes, loadedCellIds, loadErrors);
      this._loadEdges(graph, diagramData.edges, loadedCellIds, loadErrors);

      // Apply diagram-level properties
      if (diagramData.properties) {
        this.logger.debugComponent('LoadDiagramExecutor', 'Applied diagram properties', {
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

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: add node data items to the graph, recording IDs and errors in the supplied accumulators (mutates shared state)
  private _loadNodes(
    graph: any,
    nodes: any[] | undefined,
    loadedCellIds: string[],
    loadErrors: string[],
  ): void {
    if (!nodes || nodes.length === 0) return;

    this.logger.debugComponent('LoadDiagramExecutor', 'Loading nodes', { count: nodes.length });

    nodes.forEach((nodeData: any) => {
      try {
        const nodeConfig = this.createNodeConfig(nodeData);
        const node = graph.addNode(nodeConfig);
        loadedCellIds.push(node.id);
      } catch (error) {
        const errorMsg = `Failed to load node ${nodeData.id}: ${String(error)}`;
        loadErrors.push(errorMsg);
        this.logger.warn(errorMsg, { nodeId: nodeData.id, error });
      }
    });
  }

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: add edge data items to the graph after validating endpoint nodes exist (mutates shared state)
  private _loadEdges(
    graph: any,
    edges: any[] | undefined,
    loadedCellIds: string[],
    loadErrors: string[],
  ): void {
    if (!edges || edges.length === 0) return;

    this.logger.debugComponent('LoadDiagramExecutor', 'Loading edges', { count: edges.length });

    edges.forEach((edgeData: any) => {
      try {
        if (!graph.getCellById(edgeData.source.cell)) {
          throw new Error(`Source node not found: ${edgeData.source.cell}`);
        }
        if (!graph.getCellById(edgeData.target.cell)) {
          throw new Error(`Target node not found: ${edgeData.target.cell}`);
        }

        const edgeConfig = this.createEdgeConfig(edgeData);
        const edge = graph.addEdge(edgeConfig);
        loadedCellIds.push(edge.id);
      } catch (error) {
        const errorMsg = `Failed to load edge ${edgeData.id}: ${String(error)}`;
        loadErrors.push(errorMsg);
        this.logger.warn(errorMsg, { edgeId: edgeData.id, error });
      }
    });
  }

  // SEM@e5ece2b788db1f1a17ccf71d0c23c1585b5606ba: build an X6 node config object from raw node data with default styling (pure)
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
          fill: DFD_STYLING.NODES.FILL,
          stroke: DFD_STYLING.NODES.STROKE,
          strokeWidth: DFD_STYLING.NODES.STROKE_WIDTH,
        },
        text: {
          text:
            nodeData.label || nodeData.attrs?.text?.text || nodeData.attrs?.label?.text || 'Node',
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
        },
      },
      data: nodeData.data || {},
      zIndex: nodeData.zIndex || 1,
    };
  }

  // SEM@ee583904417fd0db6ebd1a851011d104aa8a87b4: build an X6 edge config object from raw edge data with default styling (pure)
  private createEdgeConfig(edgeData: any): any {
    return {
      id: edgeData.id,
      shape: edgeData.shape || CANONICAL_EDGE_SHAPE,
      source: edgeData.source,
      target: edgeData.target,
      attrs: edgeData.attrs || {
        line: {
          stroke: DFD_STYLING.EDGES.STROKE,
          strokeWidth: 1,
        },
      },
      labels: edgeData.labels || [],
      data: edgeData.data || {},
      zIndex: edgeData.zIndex || 0,
    };
  }
}
