import { Injectable } from '@angular/core';
import { Node, Edge, Graph } from '@antv/x6';
import { PortConnectionState } from '../../utils/x6-cell-extensions';
import { EdgeQueryService } from './edge-query.service';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Service responsible for managing port visibility state and connection tracking.
 * Centralizes all port-related logic that was previously scattered across the X6GraphAdapter.
 */
@Injectable({
  providedIn: 'root',
})
export class PortStateManagerService {
  private readonly _portStates = new Map<string, PortConnectionState>();

  constructor(
    private readonly _edgeQueryService: EdgeQueryService,
    private readonly _logger: LoggerService,
  ) {}

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
  }

  /**
   * Hide only unconnected ports on all nodes
   */
  hideUnconnectedPorts(graph: Graph): void {
    if (!graph) {
      return;
    }

    const nodes = graph.getNodes();
    nodes.forEach(node => {
      this.updateNodePortVisibility(graph, node);
    });

    this._logger.debug('Hid unconnected ports on all nodes', {
      nodeCount: nodes.length,
    });
  }

  /**
   * Ensure that the ports connected by a specific edge remain visible
   */
  ensureConnectedPortsVisible(graph: Graph, edge: Edge): void {
    if (!graph || !edge) {
      return;
    }

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

    // Update port visibility for all nodes to reflect new connection states
    const nodes = graph.getNodes();
    nodes.forEach(node => {
      this.updateNodePortVisibility(graph, node);
    });

    this._logger.debug('Updated port visibility after connection change', {
      nodeCount: nodes.length,
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
      ports.forEach(port => {
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      });
    });

    // Hide ports on node leave (unless connecting or connected)
    graph.on('node:mouseleave', ({ node }) => {
      const ports = node.getPorts();
      ports.forEach(port => {
        // Only hide ports that are not connected
        if (!this.isPortConnected(graph, node.id, port.id!)) {
          node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
        }
      });
    });

    this._logger.debug('Port visibility behavior setup completed');
  }

  /**
   * Setup port tooltips
   */
  setupPortTooltips(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Create tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'dfd-port-tooltip';
    tooltipEl.style.display = 'none';
    graph.container.appendChild(tooltipEl);

    // Handle port mouseenter
    graph.on(
      'node:port:mouseenter',
      ({ node, port, e }: { node: Node; port: { id: string }; e: MouseEvent }) => {
        if (!port || !node) {
          return;
        }

        // Get the port label
        type PortObject = {
          id?: string;
          attrs?: Record<string, { text?: string }>;
        };

        const portObj = node ? ((node as any).getPort(String(port.id)) as PortObject) : null;
        if (!portObj) {
          return;
        }

        // Get the port label text
        let labelText = '';
        if (portObj?.attrs && 'text' in portObj.attrs) {
          const textAttr = portObj.attrs['text'];
          labelText = typeof textAttr['text'] === 'string' ? textAttr['text'] : '';
        }

        // If no label, use the port ID as fallback
        if (!labelText) {
          labelText = String(port.id);
        }

        // Set tooltip content and position
        tooltipEl.textContent = labelText;
        tooltipEl.style.left = `${e.clientX + 10}px`;
        tooltipEl.style.top = `${e.clientY - 30}px`;
        tooltipEl.style.display = 'block';
      },
    );

    // Handle port mouseleave
    graph.on('node:port:mouseleave', () => {
      tooltipEl.style.display = 'none';
    });

    // Hide tooltip on other events
    graph.on('blank:mousedown node:mousedown edge:mousedown', () => {
      tooltipEl.style.display = 'none';
    });

    this._logger.debug('Port tooltips setup completed');
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
