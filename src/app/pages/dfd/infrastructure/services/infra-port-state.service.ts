/**
 * Port State Manager Service
 *
 * This service manages port visibility state and connection tracking for DFD nodes.
 * It centralizes port-related logic and coordinates with history management.
 *
 * Key functionality:
 * - Manages port visibility state for all nodes in the graph
 * - Tracks port connection states and updates visibility accordingly
 * - Coordinates with InfraEdgeQueryService to determine port connectivity
 * - Provides history suppression for port visibility changes
 * - Implements port state caching for performance optimization
 * - Handles mouse enter/leave events for dynamic port visibility
 * - Provides methods to show/hide ports based on connection status
 * - Manages port state synchronization across node operations
 * - Supports bulk port operations for graph-wide updates
 * - Integrates with GraphHistoryCoordinator for proper undo/redo behavior
 * - Provides debugging and logging for port state management
 * - Handles port state restoration during diagram loading
 */

import { Injectable } from '@angular/core';
import { Node, Edge, Graph } from '@antv/x6';
import { PortConnectionState } from '../../utils/x6-cell-extensions';
import { InfraEdgeQueryService } from './infra-edge-query.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { AppOperationStateManager } from '../../application/services/app-operation-state-manager.service';

/**
 * Service responsible for managing port visibility state and connection tracking.
 * Centralizes all port-related logic that was previously scattered across the InfraX6GraphAdapter.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: manage port visibility and connection-state tracking for DFD graph nodes (mutates shared state)
export class InfraPortStateService {
  private readonly _portStates = new Map<string, PortConnectionState>();
  private _historyCoordinator: AppOperationStateManager | null = null;

  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: inject edge-query and logger dependencies (pure)
  constructor(
    private readonly _edgeQueryService: InfraEdgeQueryService,
    private readonly _logger: LoggerService,
  ) {}

  /**
   * Set the history coordinator for proper history suppression during port operations
   */
  // SEM@8902c3506b8553f7ac8aaedab9ff2ba264e06c93: register the operation-state manager for history suppression during port ops (mutates shared state)
  setHistoryCoordinator(historyCoordinator: AppOperationStateManager): void {
    this._historyCoordinator = historyCoordinator;
  }

  /**
   * Execute port visibility operation with proper history suppression
   */
  // SEM@13bb9d4f1414f961a4cc60bec30b4d4c95249431: run a port visibility callback inside history suppression if coordinator is available
  private _executePortOperation(graph: Graph, operationName: string, operation: () => void): void {
    if (this._historyCoordinator) {
      this._historyCoordinator.executeVisualEffect(graph, operation);
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
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: set a port's visibility, wrapped in history suppression (mutates shared state)
  private _setPortVisibility(
    graph: Graph,
    node: any,
    portId: string,
    visibility: 'visible' | 'hidden',
    operationName: string,
  ): void {
    this._executePortOperation(graph, operationName, () => {
      this._setPortElementVisibility(node, portId, visibility);
    });
  }

  /**
   * Set visibility on both the port circle and port label text elements.
   * This must be called inside an executePortOperation wrapper.
   */
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: apply visibility to a port's circle and label elements on the node (mutates shared state)
  private _setPortElementVisibility(
    node: any,
    portId: string,
    visibility: 'visible' | 'hidden',
  ): void {
    node.setPortProp(portId, 'attrs/circle/style/visibility', visibility);
    node.setPortProp(portId, 'attrs/text/style/visibility', visibility);
  }

  /**
   * Update port visibility for a specific node based on connection status
   */
  // SEM@6d6dbe91dde90d5e20a40442e6bc1b9b3ff66f04: update all ports on a node, showing connected and hiding unconnected (mutates shared state)
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
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: show connected ports and hide unconnected ones for a node, updating the cache (mutates shared state)
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
        this._setPortElementVisibility(node, port.id!, 'visible');
        connectedPorts.add(port.id!);
        visiblePorts.add(port.id!);
      } else {
        // Hide unconnected ports
        this._setPortElementVisibility(node, port.id!, 'hidden');
      }
    });

    // Update port state cache
    this._portStates.set(node.id, {
      nodeId: node.id,
      connectedPorts,
      visiblePorts,
      lastUpdated: new Date(),
    });

    // this._logger.debugComponent('DfdPortStateManager', 'Updated node port visibility', {
    //   nodeId: node.id,
    //   totalPorts: ports.length,
    //   connectedPorts: connectedPorts.size,
    //   visiblePorts: visiblePorts.size,
    // });
  }

  /**
   * Show all ports on all nodes (used during edge creation)
   */
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: show every port on every graph node, e.g. during edge creation (mutates shared state)
  showAllPorts(graph: Graph): void {
    if (!graph) {
      return;
    }

    this._executePortOperation(graph, 'show-all-ports', () => {
      const nodes = graph.getNodes();
      nodes.forEach(node => {
        const ports = node.getPorts();
        ports.forEach(port => {
          this._setPortElementVisibility(node, port.id!, 'visible');
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

      // this._logger.debugComponent('DfdPortStateManager', 'Showed all ports on all nodes', {
      //   nodeCount: nodes.length,
      // });
    });
  }

  /**
   * Hide only unconnected ports on all nodes
   */
  // SEM@411aabf9dba17a2fbd7e5cd5eb1cb12028dfc550: hide all unconnected ports across every node in the graph (mutates shared state)
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

      // this._logger.debugComponent('DfdPortStateManager', 'Hid unconnected ports on all nodes', {
      //   nodeCount: nodes.length,
      // });
    });
  }

  /**
   * Ensure that the ports connected by a specific edge remain visible
   */
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: ensure the source and target ports of an edge remain visible (mutates shared state)
  ensureConnectedPortsVisible(graph: Graph, edge: Edge): void {
    if (!graph || !edge) {
      return;
    }

    this._executePortOperation(graph, `ensure-connected-ports-visible-${edge.id}`, () => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      this._logger.debugComponent(
        'DfdPortStateManager',
        'Ensuring connected ports are visible for edge',
        {
          edgeId: edge.id,
          sourceCellId,
          targetCellId,
          sourcePortId,
          targetPortId,
        },
      );

      // Make sure source port is visible
      if (sourceCellId && sourcePortId) {
        const sourceNode = graph.getCellById(sourceCellId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          const ports = sourceNode.getPorts();
          const portExists = ports.some(port => port.id === sourcePortId);

          if (portExists) {
            this._setPortElementVisibility(sourceNode, sourcePortId, 'visible');
            this._updatePortStateCache(sourceNode.id, sourcePortId, true, true);

            // this._logger.debugComponent('DfdPortStateManager', 'Made source port visible', {
            //   edgeId: edge.id,
            //   sourceNodeId: sourceCellId,
            //   sourcePortId,
            // });
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
            this._setPortElementVisibility(targetNode, targetPortId, 'visible');
            this._updatePortStateCache(targetNode.id, targetPortId, true, true);

            // this._logger.debugComponent('DfdPortStateManager', 'Made target port visible', {
            //   edgeId: edge.id,
            //   targetNodeId: targetCellId,
            //   targetPortId,
            // });
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a port has at least one connected edge (reads graph state)
  isPortConnected(graph: Graph, nodeId: string, portId: string): boolean {
    if (!graph) {
      return false;
    }
    return this._edgeQueryService.isPortConnected(graph, nodeId, portId);
  }

  /**
   * Get port connection state for a specific node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch cached connection state for a node's ports, or null if absent (pure)
  getPortConnectionState(nodeId: string): PortConnectionState | null {
    return this._portStates.get(nodeId) || null;
  }

  /**
   * Handle connection changes by updating port visibility for all affected nodes
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: refresh port visibility for all nodes after an edge connection change (mutates shared state)
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

      this._logger.debugComponent(
        'DfdPortStateManager',
        'Updated port visibility after connection change',
        {
          nodeCount: nodes.length,
        },
      );
    });
  }

  /**
   * Clear all cached port states
   */
  // SEM@cd1e8083a933e71b69d89d729371e93ca3104dcd: delete all cached port-connection state entries (mutates shared state)
  clearPortStates(): void {
    this._portStates.clear();
    this._logger.debugComponent('DfdPortStateManager', 'Cleared all port state cache');
  }

  /**
   * Get all cached port states (for debugging)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return a snapshot copy of all cached port-connection states for debugging (pure)
  getAllPortStates(): Map<string, PortConnectionState> {
    return new Map(this._portStates);
  }

  /**
   * Setup port visibility behavior for connection interactions
   */
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: register hover event handlers to show/hide ports on mouse enter and leave
  setupPortVisibility(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Show ports on node hover
    graph.on('node:mouseenter', ({ node }) => {
      const ports = node.getPorts();
      this._executePortOperation(graph, `show-ports-hover-${node.id}`, () => {
        ports.forEach(port => {
          this._setPortElementVisibility(node, port.id!, 'visible');
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
            this._setPortElementVisibility(node, port.id!, 'hidden');
          }
        });
      });
    });

    this._logger.debugComponent('DfdPortStateManager', 'Port visibility behavior setup completed');
  }

  /**
   * Show all ports for a specific node (called by InfraX6SelectionAdapter during hover)
   * Now properly wrapped with history suppression for consistency
   */
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: show all ports on a single node within history suppression (mutates shared state)
  showNodePorts(graph: Graph, node: any): void {
    if (!graph || !node) return;

    const ports = node.getPorts();
    if (!ports) return;

    this._executePortOperation(graph, `show-node-ports-${node.id}`, () => {
      ports.forEach((port: any) => {
        this._setPortElementVisibility(node, port.id, 'visible');
      });
    });
  }

  /**
   * Hide unconnected ports for a specific node (called by InfraX6SelectionAdapter during hover leave)
   * Now properly wrapped with history suppression for consistency
   */
  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: hide unconnected ports on a single node within history suppression (mutates shared state)
  hideUnconnectedNodePorts(graph: Graph, node: any): void {
    if (!graph || !node) return;

    const ports = node.getPorts();
    if (!ports) return;

    this._executePortOperation(graph, `hide-unconnected-ports-${node.id}`, () => {
      ports.forEach((port: any) => {
        // Only hide ports that are not connected
        if (!this.isPortConnected(graph, node.id, port.id)) {
          this._setPortElementVisibility(node, port.id, 'hidden');
        }
      });
    });
  }

  /**
   * Update port state cache for a specific node and port
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: upsert a port's connected and visible flags in the node's cached state (mutates shared state)
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
