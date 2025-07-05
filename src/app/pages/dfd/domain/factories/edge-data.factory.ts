import { Injectable } from '@angular/core';
import { EdgeData, MetadataEntry } from '../value-objects/edge-data';
import { X6EdgeSnapshot } from '../../types/x6-cell.types';

/**
 * Parameters for creating edge data
 */
export interface EdgeCreationParams {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePortId?: string;
  targetPortId?: string;
  label?: string;
  vertices?: Array<{ x: number; y: number }>;
  metadata?: MetadataEntry[];
}

/**
 * Centralized factory for creating EdgeData instances
 * Eliminates duplicate edge creation logic across the application
 */
@Injectable({
  providedIn: 'root',
})
export class EdgeDataFactory {
  /**
   * Creates EdgeData from standard parameters
   */
  createFromNodes(params: EdgeCreationParams): EdgeData {
    const source = params.sourcePortId
      ? { cell: params.sourceNodeId, port: params.sourcePortId }
      : params.sourceNodeId;

    const target = params.targetPortId
      ? { cell: params.targetNodeId, port: params.targetPortId }
      : params.targetNodeId;

    const attrs = params.label ? { text: { text: params.label } } : { text: { text: 'Data Flow' } };

    return new EdgeData(
      params.id,
      'edge',
      source,
      target,
      attrs,
      [], // labels (empty, using attrs for label)
      params.vertices || [],
      1, // zIndex
      true, // visible
      params.metadata || [],
    );
  }

  /**
   * Creates an inverse edge by swapping source and target
   */
  createInverse(originalEdge: EdgeData, newId: string, label?: string): EdgeData {
    // Swap source and target
    const inverseSource = originalEdge.target;
    const inverseTarget = originalEdge.source;
    const inverseAttrs = { text: { text: label || originalEdge.label || 'Flow' } };

    return new EdgeData(
      newId,
      'edge',
      inverseSource,
      inverseTarget,
      inverseAttrs,
      [], // labels (empty, using attrs for label)
      [], // vertices (empty for new edge)
      1, // zIndex
      true, // visible
      [], // metadata (empty for new edge)
    );
  }

  /**
   * Creates EdgeData from X6 snapshot (for undo/redo operations)
   */
  createFromSnapshot(snapshot: X6EdgeSnapshot): EdgeData {
    return new EdgeData(
      snapshot.id,
      snapshot.shape || 'edge',
      snapshot.source,
      snapshot.target,
      snapshot.attrs || {},
      snapshot.labels || [],
      snapshot.vertices || [],
      snapshot.zIndex || 1,
      snapshot.visible !== false,
      snapshot.metadata || [],
    );
  }

  /**
   * Creates a default EdgeData for fallback scenarios
   */
  createDefault(id: string, sourceNodeId: string, targetNodeId: string): EdgeData {
    return this.createFromNodes({
      id,
      sourceNodeId,
      targetNodeId,
      label: 'Data Flow',
    });
  }

  /**
   * Creates EdgeData from legacy format for backward compatibility
   */
  createFromLegacy(data: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourcePortId?: string;
    targetPortId?: string;
    label?: string;
    vertices?: Array<{ x: number; y: number }>;
    metadata?: Record<string, string>;
  }): EdgeData {
    const metadataEntries = data.metadata
      ? Object.entries(data.metadata).map(([key, value]) => ({ key, value }))
      : [];

    return this.createFromNodes({
      id: data.id,
      sourceNodeId: data.sourceNodeId,
      targetNodeId: data.targetNodeId,
      sourcePortId: data.sourcePortId,
      targetPortId: data.targetPortId,
      label: data.label,
      vertices: data.vertices,
      metadata: metadataEntries,
    });
  }
}
