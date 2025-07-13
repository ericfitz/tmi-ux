import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Edge } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { CommandBusService } from '../application/services/command-bus.service';
import { DiagramCommandFactory } from '../domain/commands/diagram-commands';
import { EdgeData } from '../domain/value-objects/edge-data';
import { Point } from '../domain/value-objects/point';
import { DiagramEdge } from '../domain/value-objects/diagram-edge';
import { EdgeDataFactory } from '../domain/factories/edge-data.factory';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { X6EdgeSnapshot } from '../types/x6-cell.types';

/**
 * Service responsible for edge handling and operations in DFD diagrams
 */
@Injectable({
  providedIn: 'root',
})
export class DfdEdgeManagerService {
  constructor(
    private logger: LoggerService,
    private commandBus: CommandBusService,
    private edgeDataFactory: EdgeDataFactory,
    private x6GraphAdapter: X6GraphAdapter,
  ) {}

  /**
   * Handle edge added events from the graph adapter
   */
  handleEdgeAdded(edge: Edge, diagramId: string, isInitialized: boolean): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot handle edge added: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    // Check if this edge was created by user interaction (drag-connect)
    // We can identify this by checking if the edge has source and target nodes
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Edge added without valid source or target nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
      });
      // Remove the invalid edge from the graph
      this.x6GraphAdapter.removeEdge(edge.id);
      throw new Error('Edge added without valid source or target nodes');
    }

    // Verify that the source and target nodes actually exist in the graph
    const sourceNode = this.x6GraphAdapter.getNode(sourceNodeId);
    const targetNode = this.x6GraphAdapter.getNode(targetNodeId);

    if (!sourceNode || !targetNode) {
      this.logger.warn('Edge references non-existent nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
        sourceNodeExists: !!sourceNode,
        targetNodeExists: !!targetNode,
      });
      // Remove the invalid edge from the graph
      this.x6GraphAdapter.removeEdge(edge.id);
      throw new Error('Edge references non-existent nodes');
    }

    // Check if this edge already exists in the domain (to avoid duplicate processing)
    const existingEdge = this.x6GraphAdapter.getEdge(edge.id);
    if (existingEdge) {
      const existingEdgeData: unknown = existingEdge.getData();
      if (
        existingEdgeData &&
        typeof existingEdgeData === 'object' &&
        existingEdgeData !== null &&
        'domainEdgeId' in existingEdgeData
      ) {
        this.logger.debug('Edge already has domain representation, skipping', { edgeId: edge.id });
        return new Observable<void>(observer => {
          observer.next();
          observer.complete();
        });
      }
    }

    this.logger.info('Processing user-created edge', {
      edgeId: edge.id,
      sourceNodeId,
      targetNodeId,
    });

    // Extract port information if available
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    // Create domain edge data using EdgeDataFactory
    const domainEdgeData = this.edgeDataFactory.createFromNodes({
      id: edge.id,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      label: 'Data Flow',
    });

    // Create and execute AddEdgeCommand
    const userId = 'current-user'; // TODO: Get from auth service

    const command = DiagramCommandFactory.addEdge(
      diagramId,
      userId,
      edge.id,
      sourceNodeId,
      targetNodeId,
      this.convertEdgeDataToSnapshot(domainEdgeData),
      true, // isLocalUserInitiated
    );

    return new Observable<void>(observer => {
      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Edge created successfully in domain model', {
              edgeId: edge.id,
              sourceNodeId,
              targetNodeId,
            });

            // Update the edge's data to mark it as having a domain representation
            edge.setData({
              ...edge.getData(),
              domainEdgeId: edge.id,
            });

            observer.next();
            observer.complete();
          },
          error: error => {
            this.logger.error('Error creating edge in domain model', error);
            // Remove the visual edge if domain creation failed
            this.x6GraphAdapter.removeEdge(edge.id);
            observer.error(error);
          },
        });
    });
  }

  /**
   * Handle edge vertices changes from the graph adapter
   */
  handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot handle edge vertices changed: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    this.logger.info('Edge vertices changed', {
      edgeId,
      vertexCount: vertices.length,
      vertices,
    });

    // Convert vertices to domain Points
    const domainVertices = vertices.map(v => new Point(v.x, v.y));

    // Get the current edge from the graph to extract other data
    const edge = this.x6GraphAdapter.getEdge(edgeId);
    if (!edge) {
      this.logger.warn('Edge not found for vertices update', { edgeId });
      throw new Error('Edge not found for vertices update');
    }

    // Create updated edge data with new vertices
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Edge missing source or target for vertices update', {
        edgeId,
        sourceNodeId,
        targetNodeId,
      });
      throw new Error('Edge missing source or target for vertices update');
    }

    // Get the current edge data to preserve existing information
    const currentEdgeData: unknown = edge.getData();
    const currentLabel =
      currentEdgeData &&
      typeof currentEdgeData === 'object' &&
      'label' in currentEdgeData &&
      typeof currentEdgeData.label === 'string'
        ? currentEdgeData.label
        : 'Data Flow';

    // Create a new EdgeData instance with updated vertices using EdgeDataFactory
    const vertexCoords = domainVertices.map(v => ({ x: v.x, y: v.y }));
    const updatedEdgeData = this.edgeDataFactory.createFromNodes({
      id: edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      label: currentLabel,
      vertices: vertexCoords,
    });

    // We need the old data for the command, so let's create it from current state
    const oldVerticesData =
      currentEdgeData &&
      typeof currentEdgeData === 'object' &&
      'vertices' in currentEdgeData &&
      Array.isArray(currentEdgeData.vertices)
        ? (currentEdgeData.vertices as Array<{ x: number; y: number }>)
        : [];

    const oldEdgeData = this.edgeDataFactory.createFromNodes({
      id: edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      label: currentLabel || 'Data Flow',
      vertices: oldVerticesData,
    });

    // Create and execute UpdateEdgeSnapshotCommand
    const userId = 'current-user'; // TODO: Get from auth service

    const command = DiagramCommandFactory.updateEdgeData(
      diagramId,
      userId,
      edgeId,
      this.convertEdgeDataToSnapshot(updatedEdgeData),
      this.convertEdgeDataToSnapshot(oldEdgeData),
      true, // isLocalUserInitiated
    );

    return new Observable<void>(observer => {
      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Edge vertices updated successfully in domain model', {
              edgeId,
              vertexCount: domainVertices.length,
            });
            observer.next();
            observer.complete();
          },
          error: error => {
            this.logger.error('Error updating edge vertices in domain model', error);
            observer.error(error);
          },
        });
    });
  }

  /**
   * Add an inverse connection for the specified edge
   */
  addInverseConnection(edge: Edge, diagramId: string): Observable<void> {
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Cannot create inverse connection: edge missing source or target', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
      });
      throw new Error('Cannot create inverse connection: edge missing source or target');
    }

    this.logger.info('Creating inverse connection for edge', {
      originalEdgeId: edge.id,
      originalSource: sourceNodeId,
      originalTarget: targetNodeId,
      originalSourcePort: sourcePortId,
      originalTargetPort: targetPortId,
    });

    // Generate a new UUID for the inverse edge
    const inverseEdgeId = uuidv4();
    const userId = 'current-user'; // TODO: Get from auth service

    // Get the original edge's label for consistency
    const originalLabelRaw = edge.getLabelAt(0)?.attrs?.['text']?.['text'];
    const originalLabel = typeof originalLabelRaw === 'string' ? originalLabelRaw : 'Flow';

    // First create the original edge data, then create the inverse
    const originalEdgeData = this.edgeDataFactory.createFromNodes({
      id: edge.id,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      label: originalLabel,
    });

    // Create inverse edge data using EdgeDataFactory
    const inverseEdgeData = this.edgeDataFactory.createInverse(
      originalEdgeData,
      inverseEdgeId,
      originalLabel,
    );

    // Create and execute AddEdgeCommand for the inverse edge
    const command = DiagramCommandFactory.addEdge(
      diagramId,
      userId,
      inverseEdgeId,
      targetNodeId, // New source (original target)
      sourceNodeId, // New target (original source)
      this.convertEdgeDataToSnapshot(inverseEdgeData),
      true, // isLocalUserInitiated
    );

    return new Observable<void>(observer => {
      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Inverse edge created successfully in domain model', {
              originalEdgeId: edge.id,
              inverseEdgeId,
              newSource: targetNodeId,
              newTarget: sourceNodeId,
              newSourcePort: targetPortId,
              newTargetPort: sourcePortId,
            });

            // Add the inverse edge to the visual graph using the current domain model
            const diagramEdge = new DiagramEdge(inverseEdgeData);
            this.x6GraphAdapter.addEdge(diagramEdge);
            observer.next();
            observer.complete();
          },
          error: error => {
            this.logger.error('Error creating inverse edge in domain model', error);
            observer.error(error);
          },
        });
    });
  }

  /**
   * Convert EdgeData to X6EdgeSnapshot using the domain model's built-in method
   */
  private convertEdgeDataToSnapshot(edgeData: EdgeData): X6EdgeSnapshot {
    return edgeData.toX6Snapshot();
  }
}
