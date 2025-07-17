import { Injectable } from '@angular/core';
import { Edge, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6EdgeSnapshot } from '../../types/x6-cell.types';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { PortStateManagerService } from './port-state-manager.service';
import { X6PortManager } from '../adapters/x6-port-manager';

/**
 * Consolidated Edge Service
 *
 * Provides unified edge operations for the X6 graph adapter.
 * Handles edge creation, modification, and X6-specific operations.
 *
 * Key principles:
 * - Use X6 native properties for X6 state
 * - Use EdgeData.update() for domain model updates
 * - Provide consistent edge attribute handling
 */
@Injectable({
  providedIn: 'root',
})
export class EdgeService {
  constructor(
    private readonly _logger: LoggerService,
    private readonly _portStateManager: PortStateManagerService,
    private readonly _portManager: X6PortManager,
  ) {}

  /**
   * Create an edge in the X6 graph from EdgeData or X6EdgeSnapshot
   */
  createEdge(
    graph: any,
    edgeInput: EdgeData | X6EdgeSnapshot,
    options: {
      ensureVisualRendering?: boolean;
      updatePortVisibility?: boolean;
    } = {},
  ): Edge {
    const { ensureVisualRendering = true, updatePortVisibility = true } = options;

    // Determine if input is EdgeData or X6EdgeSnapshot
    const isEdgeData = edgeInput instanceof EdgeData;
    const snapshot = isEdgeData ? edgeInput.toX6Snapshot() : edgeInput;

    this._logger.info('Creating edge from input', {
      edgeId: snapshot.id,
      inputType: isEdgeData ? 'EdgeData' : 'X6EdgeSnapshot',
      source: snapshot.source,
      target: snapshot.target,
      hasSourcePort: !!snapshot.source?.port,
      hasTargetPort: !!snapshot.target?.port,
    });

    // Verify nodes exist before creating edge
    this._verifyEdgeNodes(graph, snapshot);

    // Ensure proper edge attributes for visual rendering
    const attrs = ensureVisualRendering ? this._ensureEdgeAttrs(snapshot.attrs) : snapshot.attrs;

    const edgeParams = {
      id: snapshot.id,
      source: snapshot.source,
      target: snapshot.target,
      shape: snapshot.shape,
      markup: this._getEdgeMarkup(),
      attrs,
      labels: snapshot.labels,
      vertices: snapshot.vertices,
      zIndex: snapshot.zIndex,
      visible: snapshot.visible,
    };

    const x6Edge = graph.addEdge(edgeParams);

    // Set metadata using X6 cell extensions
    if (snapshot.data && x6Edge.setMetadata) {
      x6Edge.setMetadata(snapshot.data);
    }

    // Update port visibility if requested using dedicated port manager
    if (updatePortVisibility) {
      this._portManager.ensureConnectedPortsVisible(graph, x6Edge);
    }

    this._logger.debug('Edge created successfully', {
      edgeId: snapshot.id,
      edgeCreated: !!x6Edge,
      metadataSet: !!(snapshot.data && x6Edge.setMetadata),
    });

    return x6Edge;
  }

  /**
   * Update an existing edge using EdgeData.update() method
   */
  updateEdge(
    edge: Edge,
    updates: Parameters<EdgeData['update']>[0],
    options: {
      ensureVisualRendering?: boolean;
      updatePortVisibility?: boolean;
      graph?: any;
    } = {},
  ): void {
    const { ensureVisualRendering = true, updatePortVisibility = true, graph } = options;

    this._logger.info('Updating edge with consolidated update method', {
      edgeId: edge.id,
      updates,
      options,
    });

    // Apply X6 native property updates directly
    if (updates.source !== undefined) {
      edge.setSource(updates.source);
    }

    if (updates.target !== undefined) {
      edge.setTarget(updates.target);
    }

    // Update port visibility if connections changed using dedicated port manager
    if (
      updatePortVisibility &&
      graph &&
      (updates.source !== undefined || updates.target !== undefined)
    ) {
      this._portManager.onConnectionChange(graph);
    }

    if (updates.vertices !== undefined) {
      edge.setVertices(updates.vertices);
    }

    if (updates.labels !== undefined) {
      edge.setLabels(updates.labels);
    }

    if (updates.label !== undefined) {
      // Use X6 cell extensions for unified label handling
      if ((edge as any).setUnifiedLabel) {
        (edge as any).setUnifiedLabel(updates.label);
      } else {
        // Fallback to setting labels array
        edge.setLabels([
          {
            position: 0.5,
            attrs: {
              text: {
                text: updates.label,
                fontSize: 12,
                fill: '#333',
                fontFamily: '"Roboto Condensed", Arial, sans-serif',
                textAnchor: 'middle',
                dominantBaseline: 'middle',
              },
              rect: {
                fill: '#ffffff',
                stroke: 'none',
              },
            },
          },
        ]);
      }
    }

    if (updates.attrs !== undefined) {
      const attrs = ensureVisualRendering ? this._ensureEdgeAttrs(updates.attrs) : updates.attrs;
      edge.setAttrs(attrs);
    }

    if (updates.zIndex !== undefined) {
      edge.setZIndex(updates.zIndex);
    }

    if (updates.visible !== undefined) {
      edge.setVisible(updates.visible);
    }

    // Handle metadata updates using X6 cell extensions
    if (updates.metadata !== undefined) {
      if ((edge as any).setMetadata) {
        if (Array.isArray(updates.metadata)) {
          (edge as any).setMetadata(updates.metadata);
        } else {
          // Convert Record to array format
          const metadataArray = Object.entries(updates.metadata).map(([key, value]) => ({
            key,
            value,
          }));
          (edge as any).setMetadata(metadataArray);
        }
      }
    }

    this._logger.debug('Edge updated successfully', {
      edgeId: edge.id,
      updatedProperties: Object.keys(updates),
    });
  }

  /**
   * Remove an edge from the graph
   */
  removeEdge(graph: any, edgeId: string): boolean {
    const edge = graph.getCellById(edgeId) as Edge;

    if (edge && edge.isEdge()) {
      // Update port visibility before removing edge using dedicated port manager
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();

      graph.removeEdge(edge);

      // Update port visibility for affected nodes after removal
      if (sourceNodeId) {
        const sourceNode = graph.getCellById(sourceNodeId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          this._portManager.updateNodePortVisibility(graph, sourceNode);
        }
      }

      if (targetNodeId) {
        const targetNode = graph.getCellById(targetNodeId) as Node;
        if (targetNode && targetNode.isNode()) {
          this._portManager.updateNodePortVisibility(graph, targetNode);
        }
      }

      this._logger.debug('Edge removed successfully', { edgeId });
      return true;
    }

    this._logger.warn('Edge not found or not an edge', { edgeId });
    return false;
  }

  /**
   * Get edge by ID with type safety
   */
  getEdge(graph: any, edgeId: string): Edge | null {
    const cell = graph.getCellById(edgeId);
    return cell && cell.isEdge() ? cell : null;
  }

  /**
   * Get all edges from the graph
   */
  getEdges(graph: any): Edge[] {
    return graph.getEdges();
  }

  /**
   * Create edge snapshot from X6 edge with proper port information
   */
  createEdgeSnapshot(edge: Edge): X6EdgeSnapshot {
    // Get metadata using X6 cell extensions
    const metadata = (edge as any).getMetadata ? (edge as any).getMetadata() : [];
    const metadataArray = Array.isArray(metadata)
      ? metadata
      : Object.entries(metadata).map(([key, value]) => ({ key, value }));

    const snapshot: X6EdgeSnapshot = {
      id: edge.id,
      source: edge.getSource(),
      target: edge.getTarget(),
      shape: edge.shape,
      attrs: edge.getAttrs(),
      vertices: edge.getVertices(),
      labels: edge.getLabels(),
      zIndex: edge.getZIndex() || 1,
      visible: edge.isVisible(),
      data: metadataArray,
    };

    this._logger.debug('Created edge snapshot with port information', {
      edgeId: edge.id,
      source: snapshot.source,
      target: snapshot.target,
      sourcePortId: edge.getSourcePortId(),
      targetPortId: edge.getTargetPortId(),
      hasSourcePort: !!snapshot.source?.port,
      hasTargetPort: !!snapshot.target?.port,
    });

    return snapshot;
  }

  /**
   * Ensure edge has proper attrs structure for visual rendering
   */
  private _ensureEdgeAttrs(attrs: Edge.Properties['attrs']): Edge.Properties['attrs'] {
    // If attrs is empty or missing critical styling, provide defaults
    const hasWrapAttrs = attrs?.['wrap'] && typeof attrs['wrap'] === 'object';
    const hasLineAttrs = attrs?.['line'] && typeof attrs['line'] === 'object';

    if (!hasWrapAttrs || !hasLineAttrs) {
      this._logger.debug('Adding missing edge attrs for visual rendering', {
        hasWrapAttrs,
        hasLineAttrs,
        originalAttrs: attrs,
      });

      return {
        ...attrs,
        wrap: {
          connection: true,
          strokeWidth: 10,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          stroke: 'transparent',
          fill: 'none',
          ...(attrs?.['wrap'] || {}),
        },
        line: {
          connection: true,
          stroke: '#000000',
          strokeWidth: 2,
          fill: 'none',
          targetMarker: {
            name: 'classic',
            size: 8,
            fill: '#000000',
            stroke: '#000000',
          },
          ...(attrs?.['line'] || {}),
        },
      };
    }

    return attrs;
  }

  /**
   * Get standard edge markup for consistent rendering
   */
  private _getEdgeMarkup(): any[] {
    return [
      {
        tagName: 'path',
        selector: 'wrap',
        attrs: {
          fill: 'none',
          cursor: 'pointer',
          stroke: 'transparent',
          strokeLinecap: 'round',
        },
      },
      {
        tagName: 'path',
        selector: 'line',
        attrs: {
          fill: 'none',
          pointerEvents: 'none',
        },
      },
    ];
  }

  /**
   * Verify that source and target nodes exist for edge creation
   */
  private _verifyEdgeNodes(graph: any, snapshot: X6EdgeSnapshot): void {
    const sourceNodeId = snapshot.source?.cell;
    const targetNodeId = snapshot.target?.cell;
    const sourcePortId = snapshot.source?.port;
    const targetPortId = snapshot.target?.port;

    if (sourceNodeId) {
      const sourceNode = graph.getCellById(sourceNodeId);
      if (sourceNode && sourceNode.isNode()) {
        const sourcePorts = sourceNode.getPorts();
        const sourcePortExists = sourcePorts.some((port: any) => port.id === sourcePortId);
        this._logger.debug('Source node verification', {
          edgeId: snapshot.id,
          sourceNodeId,
          sourcePortId,
          sourceNodeExists: true,
          sourcePortExists,
          sourceNodePorts: sourcePorts.map((port: any) => ({ id: port.id, group: port.group })),
        });
      } else {
        this._logger.warn('Source node not found or not a node', {
          edgeId: snapshot.id,
          sourceNodeId,
          sourceNodeExists: !!sourceNode,
          isNode: sourceNode?.isNode(),
        });
      }
    }

    if (targetNodeId) {
      const targetNode = graph.getCellById(targetNodeId);
      if (targetNode && targetNode.isNode()) {
        const targetPorts = targetNode.getPorts();
        const targetPortExists = targetPorts.some((port: any) => port.id === targetPortId);
        this._logger.debug('Target node verification', {
          edgeId: snapshot.id,
          targetNodeId,
          targetPortId,
          targetNodeExists: true,
          targetPortExists,
          targetNodePorts: targetPorts.map((port: any) => ({ id: port.id, group: port.group })),
        });
      } else {
        this._logger.warn('Target node not found or not a node', {
          edgeId: snapshot.id,
          targetNodeId,
          targetNodeExists: !!targetNode,
          isNode: targetNode?.isNode(),
        });
      }
    }
  }
}
