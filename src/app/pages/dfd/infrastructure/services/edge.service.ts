import { Injectable } from '@angular/core';
import { Edge, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6EdgeSnapshot } from '../../types/x6-cell.types';
import { EdgeData } from '../../domain/value-objects/edge-data';

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
  constructor(private readonly _logger: LoggerService) {}

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

    // Update port visibility if requested
    if (updatePortVisibility) {
      this._updatePortVisibilityAfterEdgeCreation(graph, x6Edge);
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

    // Store original connections for port visibility updates
    const originalSource = updatePortVisibility ? edge.getSource() : null;
    const originalTarget = updatePortVisibility ? edge.getTarget() : null;

    // Apply X6 native property updates directly
    if (updates.source !== undefined) {
      edge.setSource(updates.source);
    }

    if (updates.target !== undefined) {
      edge.setTarget(updates.target);
    }

    // Update port visibility if connections changed
    if (
      updatePortVisibility &&
      graph &&
      (updates.source !== undefined || updates.target !== undefined)
    ) {
      this._updatePortVisibilityAfterEdgeUpdate(edge, originalSource, originalTarget, graph);
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
      // Update port visibility before removing edge
      this._updatePortVisibilityBeforeEdgeRemoval(graph, edge);

      graph.removeEdge(edge);

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

  /**
   * Update port visibility for connected nodes after edge creation
   */
  private _updatePortVisibilityAfterEdgeCreation(graph: any, edge: Edge): void {
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    this._logger.debug('Updating port visibility after edge creation', {
      edgeId: edge.id,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
    });

    // Make source port visible
    if (sourceNodeId && sourcePortId) {
      const sourceNode = graph.getCellById(sourceNodeId) as Node;
      if (sourceNode && sourceNode.isNode()) {
        const ports = sourceNode.getPorts();
        const portExists = ports.some((port: any) => port.id === sourcePortId);

        if (portExists) {
          sourceNode.setPortProp(sourcePortId, 'attrs/circle/style/visibility', 'visible');
          this._logger.debug('Made source port visible', {
            edgeId: edge.id,
            sourceNodeId,
            sourcePortId,
          });
        }
      }
    }

    // Make target port visible
    if (targetNodeId && targetPortId) {
      const targetNode = graph.getCellById(targetNodeId) as Node;
      if (targetNode && targetNode.isNode()) {
        const ports = targetNode.getPorts();
        const portExists = ports.some((port: any) => port.id === targetPortId);

        if (portExists) {
          targetNode.setPortProp(targetPortId, 'attrs/circle/style/visibility', 'visible');
          this._logger.debug('Made target port visible', {
            edgeId: edge.id,
            targetNodeId,
            targetPortId,
          });
        }
      }
    }
  }

  /**
   * Update port visibility for connected nodes before edge removal
   */
  private _updatePortVisibilityBeforeEdgeRemoval(graph: any, edge: Edge): void {
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    // Update port visibility for source and target nodes
    // We need to check if ports will still be connected after this edge is removed
    if (sourceNodeId && sourcePortId) {
      const sourceNode = graph.getCellById(sourceNodeId) as Node;
      if (sourceNode && sourceNode.isNode()) {
        this._updateNodePortVisibilityAfterEdgeRemoval(graph, sourceNode, sourcePortId, edge);
      }
    }

    if (targetNodeId && targetPortId) {
      const targetNode = graph.getCellById(targetNodeId) as Node;
      if (targetNode && targetNode.isNode()) {
        this._updateNodePortVisibilityAfterEdgeRemoval(graph, targetNode, targetPortId, edge);
      }
    }
  }

  /**
   * Update port visibility for a specific node and port after edge removal
   */
  private _updateNodePortVisibilityAfterEdgeRemoval(
    graph: any,
    node: Node,
    portId: string,
    edgeToRemove: Edge,
  ): void {
    // Check if this port will still be connected to any other edges after removing the specified edge
    const edges = graph.getEdges();
    const willStillBeConnected = edges.some((edge: Edge) => {
      // Skip the edge we're about to remove
      if (edge.id === edgeToRemove.id) {
        return false;
      }

      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      // Check if this edge connects to the specific port on this node
      return (
        (sourceCellId === node.id && sourcePortId === portId) ||
        (targetCellId === node.id && targetPortId === portId)
      );
    });

    // Set port visibility based on whether it will still be connected
    const visibility = willStillBeConnected ? 'visible' : 'hidden';
    node.setPortProp(portId, 'attrs/circle/style/visibility', visibility);

    this._logger.debug('Updated port visibility after edge removal', {
      nodeId: node.id,
      portId,
      edgeToRemoveId: edgeToRemove.id,
      willStillBeConnected,
      visibility,
    });
  }

  /**
   * Update port visibility for a specific node based on connection status
   */
  private _updateNodePortVisibility(graph: any, node: Node): void {
    const ports = node.getPorts();
    ports.forEach((port: any) => {
      // Check if this port is connected to any edge
      if (this._isPortConnected(graph, node, port.id)) {
        // Keep connected ports visible
        node.setPortProp(port.id, 'attrs/circle/style/visibility', 'visible');
      } else {
        // Hide unconnected ports
        node.setPortProp(port.id, 'attrs/circle/style/visibility', 'hidden');
      }
    });
  }

  /**
   * Check if a specific port is connected to any edge
   */
  private _isPortConnected(graph: any, node: Node, portId: string): boolean {
    const edges = graph.getEdges();
    return edges.some((edge: Edge) => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      // Check if this edge connects to the specific port on this node
      return (
        (sourceCellId === node.id && sourcePortId === portId) ||
        (targetCellId === node.id && targetPortId === portId)
      );
    });
  }

  /**
   * Update port visibility after edge connection update
   */
  private _updatePortVisibilityAfterEdgeUpdate(
    edge: Edge,
    originalSource: any,
    originalTarget: any,
    graph: any,
  ): void {
    if (!graph) {
      this._logger.warn('Cannot update port visibility: graph not found', { edgeId: edge.id });
      return;
    }

    // Handle old source port visibility
    if (originalSource?.cell && originalSource?.port) {
      const oldSourceNode = graph.getCellById(originalSource.cell) as Node;
      if (oldSourceNode && oldSourceNode.isNode()) {
        this._updateNodePortVisibilityAfterEdgeRemoval(
          graph,
          oldSourceNode,
          originalSource.port,
          edge,
        );
      }
    }

    // Handle old target port visibility
    if (originalTarget?.cell && originalTarget?.port) {
      const oldTargetNode = graph.getCellById(originalTarget.cell) as Node;
      if (oldTargetNode && oldTargetNode.isNode()) {
        this._updateNodePortVisibilityAfterEdgeRemoval(
          graph,
          oldTargetNode,
          originalTarget.port,
          edge,
        );
      }
    }

    // Handle new connections
    this._updatePortVisibilityAfterEdgeCreation(graph, edge);

    this._logger.debug('Updated port visibility after edge connection change', {
      edgeId: edge.id,
      originalSource,
      originalTarget,
      newSource: edge.getSource(),
      newTarget: edge.getTarget(),
    });
  }
}
