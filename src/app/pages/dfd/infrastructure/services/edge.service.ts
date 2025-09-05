import { Injectable } from '@angular/core';
import { Edge, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { EdgeInfo } from '../../domain/value-objects/edge-info';
import { PortStateManagerService } from './port-state-manager.service';
import { X6CoreOperationsService } from './x6-core-operations.service';
import { GraphHistoryCoordinator } from '../../services/graph-history-coordinator.service';

/**
 * Consolidated Edge Service
 *
 * Provides unified edge operations for the X6 graph adapter.
 * Handles edge creation, modification, and X6-specific operations.
 *
 * Key principles:
 * - Use X6 native properties for X6 state
 * - Use EdgeInfo.update() for domain model updates
 * - Provide consistent edge attribute handling
 */
@Injectable()
export class EdgeService {
  constructor(
    private readonly _logger: LoggerService,
    private readonly _portStateManager: PortStateManagerService,
    private readonly _x6CoreOps: X6CoreOperationsService,
    private readonly _historyCoordinator: GraphHistoryCoordinator,
  ) {}

  /**
   * Create an edge in the X6 graph from EdgeInfo
   */
  createEdge(
    graph: any,
    edgeInfo: EdgeInfo,
    options: {
      ensureVisualRendering?: boolean;
      updatePortVisibility?: boolean;
      suppressHistory?: boolean;
    } = {},
  ): Edge {
    const { ensureVisualRendering = true, updatePortVisibility = true, suppressHistory = false } = options;

    this._logger.info('Creating edge from EdgeInfo', {
      edgeId: edgeInfo.id,
      source: edgeInfo.source,
      target: edgeInfo.target,
      hasSourcePort: !!edgeInfo.source?.port,
      hasTargetPort: !!edgeInfo.target?.port,
    });

    // Verify nodes exist before creating edge
    this._verifyEdgeNodes(graph, edgeInfo);

    // Ensure proper edge attributes for visual rendering
    const attrs = ensureVisualRendering
      ? this._ensureEdgeAttrs(edgeInfo.attrs as any)
      : (edgeInfo.attrs as any);

    const edgeParams = {
      id: edgeInfo.id,
      source: edgeInfo.source,
      target: edgeInfo.target,
      shape: edgeInfo.shape,
      markup: edgeInfo.markup || this._getEdgeMarkup(),
      attrs,
      labels: edgeInfo.labels,
      vertices: edgeInfo.vertices,
      zIndex: edgeInfo.zIndex,
      visible: edgeInfo.visible,
      data: edgeInfo.data,
      router: edgeInfo.router,
      connector: edgeInfo.connector,
      defaultLabel: edgeInfo.defaultLabel,
      tools: edgeInfo.tools,
    };

    let x6Edge: Edge | null;

    if (suppressHistory) {
      // Execute without history for remote operations
      x6Edge = this._historyCoordinator.executeRemoteOperation(graph, () => {
        return this._x6CoreOps.addEdge(graph, edgeParams);
      });
    } else {
      // Add edge directly to X6 graph
      x6Edge = this._x6CoreOps.addEdge(graph, edgeParams);
    }

    if (!x6Edge) {
      throw new Error(`Failed to create edge with ID: ${edgeInfo.id}`);
    }

    // Set metadata using X6 cell extensions
    if (edgeInfo.data && (x6Edge as any).setMetadata) {
      (x6Edge as any).setMetadata(edgeInfo.data);
    }

    // Update port visibility if requested using dedicated port manager
    if (updatePortVisibility) {
      this._portStateManager.ensureConnectedPortsVisible(graph, x6Edge);
    }

    this._logger.debugComponent('DfdEdgeService', 'Edge created successfully', {
      edgeId: edgeInfo.id,
      edgeCreated: !!x6Edge,
      metadataSet: !!(edgeInfo.data && (x6Edge as any).setMetadata),
    });

    return x6Edge;
  }

  /**
   * Update an existing edge using EdgeInfo.update() method
   */
  updateEdge(
    edge: Edge,
    updates: Parameters<EdgeInfo['update']>[0],
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
      this._portStateManager.onConnectionChange(graph);
    }

    if (updates.vertices !== undefined) {
      edge.setVertices(updates.vertices);
    }

    if (updates.labels !== undefined) {
      // Direct labels array update for complex label configurations
      edge.setLabels(updates.labels);
    }

    if (updates.label !== undefined) {
      // Use X6 cell extensions for unified label handling
      if ((edge as any).setLabel) {
        (edge as any).setLabel(updates.label);
      } else {
        this._logger.warn('Edge does not support setLabel method', { edgeId: edge.id });
      }
    }

    if (updates.attrs !== undefined) {
      const attrs = ensureVisualRendering
        ? this._ensureEdgeAttrs(updates.attrs as any)
        : (updates.attrs as any);
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

    this._logger.debugComponent('DfdEdgeService', 'Edge updated successfully', {
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

      this._x6CoreOps.removeCellObject(graph, edge);

      // Update port visibility for affected nodes after removal
      // This ensures the service works independently, while the event handler
      // in x6-graph.adapter.ts will handle the same when used in the full context
      if (sourceNodeId) {
        const sourceNode = graph.getCellById(sourceNodeId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          this._portStateManager.updateNodePortVisibility(graph, sourceNode);
        }
      }

      if (targetNodeId) {
        const targetNode = graph.getCellById(targetNodeId) as Node;
        if (targetNode && targetNode.isNode()) {
          this._portStateManager.updateNodePortVisibility(graph, targetNode);
        }
      }

      this._logger.debugComponent('DfdEdgeService', 'Edge removed successfully', { edgeId });
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
   * Ensure edge has proper attrs structure for visual rendering
   */
  private _ensureEdgeAttrs(attrs: Edge.Properties['attrs']): Edge.Properties['attrs'] {
    // If attrs is empty or missing critical styling, provide defaults
    const hasWrapAttrs = attrs?.['wrap'] && typeof attrs['wrap'] === 'object';
    const hasLineAttrs = attrs?.['line'] && typeof attrs['line'] === 'object';

    if (!hasWrapAttrs || !hasLineAttrs) {
      this._logger.debugComponent(
        'DfdEdgeService',
        'Adding missing edge attrs for visual rendering',
        {
          hasWrapAttrs,
          hasLineAttrs,
          originalAttrs: attrs,
        },
      );

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
  private _verifyEdgeNodes(graph: any, edgeInfo: EdgeInfo): void {
    const sourceNodeId = edgeInfo.source?.cell;
    const targetNodeId = edgeInfo.target?.cell;
    const sourcePortId = edgeInfo.source?.port;
    const targetPortId = edgeInfo.target?.port;

    if (sourceNodeId) {
      const sourceNode = graph.getCellById(sourceNodeId);
      if (sourceNode && sourceNode.isNode()) {
        const sourcePorts = sourceNode.getPorts();
        const sourcePortExists = sourcePorts.some((port: any) => port.id === sourcePortId);
        this._logger.debugComponent('DfdEdgeService', 'Source node verification', {
          edgeId: edgeInfo.id,
          sourceNodeId,
          sourcePortId,
          sourceNodeExists: true,
          sourcePortExists,
          sourceNodePorts: sourcePorts.map((port: any) => ({ id: port.id, group: port.group })),
        });
      } else {
        this._logger.warn('Source node not found or not a node', {
          edgeId: edgeInfo.id,
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
        this._logger.debugComponent('DfdEdgeService', 'Target node verification', {
          edgeId: edgeInfo.id,
          targetNodeId,
          targetPortId,
          targetNodeExists: true,
          targetPortExists,
          targetNodePorts: targetPorts.map((port: any) => ({ id: port.id, group: port.group })),
        });
      } else {
        this._logger.warn('Target node not found or not a node', {
          edgeId: edgeInfo.id,
          targetNodeId,
          targetNodeExists: !!targetNode,
          isNode: targetNode?.isNode(),
        });
      }
    }
  }
}
