import { Injectable } from '@angular/core';
import { Node, Edge, Graph } from '@antv/x6';
import { PortConnectionState } from '../../utils/x6-cell-extensions';
import { EdgeQueryService } from './edge-query.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { GraphHistoryCoordinator } from '../../services/graph-history-coordinator.service';

/**
 * Service responsible for managing port visibility state and connection tracking.
 * Centralizes all port-related logic that was previously scattered across the X6GraphAdapter.
 */
@Injectable({
  providedIn: 'root',
})
export class PortStateManagerService {
  private readonly _portStates = new Map<string, PortConnectionState>();
  private _historyCoordinator: GraphHistoryCoordinator | null = null;

  constructor(
    private readonly _edgeQueryService: EdgeQueryService,
    private readonly _logger: LoggerService,
  ) {}

  /**
   * Set the history coordinator for proper history suppression during port operations
   */
  setHistoryCoordinator(historyCoordinator: GraphHistoryCoordinator): void {
    this._historyCoordinator = historyCoordinator;
  }

  /**
   * Execute port visibility operation with proper history suppression
   */
  private _executePortOperation(
    graph: Graph,
    operationName: string,
    operation: () => void
  ): void {
    if (this._historyCoordinator) {
      this._historyCoordinator.executeVisualEffect(
        graph,
        operationName,
        operation
      );
    } else {
      // Fallback: execute directly if no history coordinator available
      this._logger.warn('No history coordinator available for port operation', { operationName });
      operation();
    }
  }

  /**
   * Safely set port visibility with history suppression
   * This ensures ALL port visibility changes go through proper history management
   */
  private _setPortVisibility(
    graph: Graph,
    node: any,
    portId: string,
    visibility: 'visible' | 'hidden',
    operationName: string
  ): void {
    this._executePortOperation(graph, operationName, () => {
      node.setPortProp(portId, 'attrs/circle/style/visibility', visibility);
    });
  }

  /**
   * Update port visibility for a specific node based on connection status
   */
  updateNodePortVisibility(graph: Graph, node: Node): void {
    if (!graph || !node) {
      return;
    }

    const ports = node.getPorts();
    if (!ports || ports.length === 0) {
      return;
    }

    this._executePortOperation(graph, `update-port-visibility-${node.id}`, () => {
      this._updateNodePortVisibilityInternal(graph, node);
    });
  }

  /**
   * Internal method to update port visibility without additional history suppression
   */
  private _updateNodePortVisibilityInternal(graph: Graph, node: Node): void {
    const ports = node.getPorts();
    if (!ports || ports.length === 0) {
      return;
    }

    const connectedPorts = new Set<string>();
    const visiblePorts = new Set<string>();

    ports.forEach(port => {
      const isConnected = this._edgeQueryService.isPortConnected(graph, node.id, port.id!);

      if (isConnected) {
        // Keep connected ports visible
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
        connectedPorts.add(port.id!);
        visiblePorts.add(port.id!);
      } else {
        // Hide unconnected ports
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
      }
    });

    // Update port state cache
    this._portStates.set(node.id, {
      nodeId: node.id,
      connectedPorts,
      visiblePorts,
      lastUpdated: new Date(),
    });

    this._logger.debug('Updated node port visibility', {
      nodeId: node.id,
      totalPorts: ports.length,
      connectedPorts: connectedPorts.size,
      visiblePorts: visiblePorts.size,
    });
  }

  /**
   * Show all ports on all nodes (used during edge creation)
   */
  showAllPorts(graph: Graph): void {
    if (!graph) {
      return;
    }

    this._executePortOperation(graph, 'show-all-ports', () => {
      const nodes = graph.getNodes();
      nodes.forEach(node => {
        const ports = node.getPorts();
        ports.forEach(port => {
          node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
        });

        // Update state cache
        const visiblePorts = new Set(ports.map(p => p.id!));
        const existingState = this._portStates.get(node.id);
        this._portStates.set(node.id, {
          nodeId: node.id,
          connectedPorts: existingState?.connectedPorts || new Set(),
          visiblePorts,
          lastUpdated: new Date(),
        });
      });

      this._logger.debug('Showed all ports on all nodes', {
        nodeCount: nodes.length,
      });
    });
  }

  /**
   * Hide only unconnected ports on all nodes
   */
  hideUnconnectedPorts(graph: Graph): void {
    if (!graph) {
      return;
    }

    this._executePortOperation(graph, 'hide-unconnected-ports', () => {
      const nodes = graph.getNodes();
      nodes.forEach(node => {
        // Call the internal update method to avoid double-wrapping with history suppression
        this._updateNodePortVisibilityInternal(graph, node);
      });

      this._logger.debug('Hid unconnected ports on all nodes', {
        nodeCount: nodes.length,
      });
    });
  }

  /**
   * Ensure that the ports connected by a specific edge remain visible
   */
  ensureConnectedPortsVisible(graph: Graph, edge: Edge): void {
    if (!graph || !edge) {
      return;
    }

    this._executePortOperation(graph, `ensure-connected-ports-visible-${edge.id}`, () => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      this._logger.debug('Ensuring connected ports are visible for edge', {
        edgeId: edge.id,
        sourceCellId,
        targetCellId,
        sourcePortId,
        targetPortId,
      });

      // Make sure source port is visible
      if (sourceCellId && sourcePortId) {
        const sourceNode = graph.getCellById(sourceCellId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          const ports = sourceNode.getPorts();
          const portExists = ports.some(port => port.id === sourcePortId);

          if (portExists) {
            sourceNode.setPortProp(sourcePortId, 'attrs/circle/style/visibility', 'visible');
            this._updatePortStateCache(sourceNode.id, sourcePortId, true, true);

            this._logger.debug('Made source port visible', {
              edgeId: edge.id,
              sourceNodeId: sourceCellId,
              sourcePortId,
            });
          } else {
            this._logger.warn('Source port does not exist on node', {
              edgeId: edge.id,
              sourceNodeId: sourceCellId,
              sourcePortId,
              availablePorts: ports.map(p => p.id),
            });
          }
        }
      }

      // Make sure target port is visible
      if (targetCellId && targetPortId) {
        const targetNode = graph.getCellById(targetCellId) as Node;
        if (targetNode && targetNode.isNode()) {
          const ports = targetNode.getPorts();
          const portExists = ports.some(port => port.id === targetPortId);

          if (portExists) {
            targetNode.setPortProp(targetPortId, 'attrs/circle/style/visibility', 'visible');
            this._updatePortStateCache(targetNode.id, targetPortId, true, true);

            this._logger.debug('Made target port visible', {
              edgeId: edge.id,
              targetNodeId: targetCellId,
              targetPortId,
            });
          } else {
            this._logger.warn('Target port does not exist on node', {
              edgeId: edge.id,
              targetNodeId: targetCellId,
              targetPortId,
              availablePorts: ports.map(p => p.id),
            });
          }
        }
      }
    });
  }

  /**
   * Check if a specific port is connected to any edge
   */
  isPortConnected(graph: Graph, nodeId: string, portId: string): boolean {
    if (!graph) {
      return false;
    }
    return this._edgeQueryService.isPortConnected(graph, nodeId, portId);
  }

  /**
   * Get port connection state for a specific node
   */
  getPortConnectionState(nodeId: string): PortConnectionState | null {
    return this._portStates.get(nodeId) || null;
  }

  /**
   * Handle connection changes by updating port visibility for all affected nodes
   */
  onConnectionChange(graph: Graph): void {
    if (!graph) {
      return;
    }

    this._executePortOperation(graph, 'connection-change', () => {
      // Update port visibility for all nodes to reflect new connection states
      const nodes = graph.getNodes();
      nodes.forEach(node => {
        // Call the internal method to avoid double-wrapping with history suppression
        this._updateNodePortVisibilityInternal(graph, node);
      });

      this._logger.debug('Updated port visibility after connection change', {
        nodeCount: nodes.length,
      });
    });
  }

  /**
   * Clear all cached port states
   */
  clearPortStates(): void {
    this._portStates.clear();
    this._logger.debug('Cleared all port state cache');
  }

  /**
   * Get all cached port states (for debugging)
   */
  getAllPortStates(): Map<string, PortConnectionState> {
    return new Map(this._portStates);
  }

  /**
   * Setup port visibility behavior for connection interactions
   */
  setupPortVisibility(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Show ports on node hover
    graph.on('node:mouseenter', ({ node }) => {
      const ports = node.getPorts();
      this._executePortOperation(graph, `show-ports-hover-${node.id}`, () => {
        ports.forEach(port => {
          node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
        });
      });
    });

    // Hide ports on node leave (unless connecting or connected)
    graph.on('node:mouseleave', ({ node }) => {
      const ports = node.getPorts();
      this._executePortOperation(graph, `hide-ports-hover-leave-${node.id}`, () => {
        ports.forEach(port => {
          // Only hide ports that are not connected
          if (!this.isPortConnected(graph, node.id, port.id!)) {
            node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
          }
        });
      });
    });

    this._logger.debug('Port visibility behavior setup completed');
  }

  /**
   * Show all ports for a specific node (called by X6SelectionAdapter during hover)
   * Now properly wrapped with history suppression for consistency
   */
  showNodePorts(graph: Graph, node: any): void {
    if (!graph || !node) return;
    
    const ports = node.getPorts();
    if (!ports) return;
    
    this._executePortOperation(graph, `show-node-ports-${node.id}`, () => {
      ports.forEach((port: any) => {
        node.setPortProp(port.id, 'attrs/circle/style/visibility', 'visible');
      });
    });
  }

  /**
   * Hide unconnected ports for a specific node (called by X6SelectionAdapter during hover leave)
   * Now properly wrapped with history suppression for consistency
   */
  hideUnconnectedNodePorts(graph: Graph, node: any): void {
    if (!graph || !node) return;
    
    const ports = node.getPorts();
    if (!ports) return;
    
    this._executePortOperation(graph, `hide-unconnected-ports-${node.id}`, () => {
      ports.forEach((port: any) => {
        // Only hide ports that are not connected
        if (!this.isPortConnected(graph, node.id, port.id)) {
          node.setPortProp(port.id, 'attrs/circle/style/visibility', 'hidden');
        }
      });
    });
  }

  /**
   * Update port state cache for a specific node and port
   */
  private _updatePortStateCache(
    nodeId: string,
    portId: string,
    isConnected: boolean,
    isVisible: boolean,
  ): void {
    const existingState = this._portStates.get(nodeId);

    if (!existingState) {
      this._portStates.set(nodeId, {
        nodeId,
        connectedPorts: isConnected ? new Set([portId]) : new Set(),
        visiblePorts: isVisible ? new Set([portId]) : new Set(),
        lastUpdated: new Date(),
      });
      return;
    }

    // Update existing state
    if (isConnected) {
      existingState.connectedPorts.add(portId);
    } else {
      existingState.connectedPorts.delete(portId);
    }

    if (isVisible) {
      existingState.visiblePorts.add(portId);
    } else {
      existingState.visiblePorts.delete(portId);
    }

    existingState.lastUpdated = new Date();
  }
}
