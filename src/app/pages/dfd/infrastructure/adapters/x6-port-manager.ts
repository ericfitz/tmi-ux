import { Injectable } from '@angular/core';
import { Graph, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * X6 Port Manager
 * Handles port visibility and management for graph nodes
 */
@Injectable({
  providedIn: 'root',
})
export class X6PortManager {
  constructor(private logger: LoggerService) {}

  /**
   * Setup port visibility behavior for connection interactions
   */
  setupPortVisibility(graph: Graph): void {
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
  }

  /**
   * Show all ports on all nodes
   */
  showAllPorts(graph: Graph): void {
    graph.getNodes().forEach(node => {
      const ports = node.getPorts();
      ports.forEach(port => {
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      });
    });
  }

  /**
   * Hide all unconnected ports on all nodes
   */
  hideUnconnectedPorts(graph: Graph): void {
    graph.getNodes().forEach(node => {
      this.updateNodePortVisibility(graph, node);
    });
  }

  /**
   * Update port visibility for a specific node based on connection state
   */
  updateNodePortVisibility(graph: Graph, node: Node): void {
    const ports = node.getPorts();
    ports.forEach(port => {
      if (this.isPortConnected(graph, node.id, port.id!)) {
        // Keep connected ports visible
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      } else {
        // Hide unconnected ports
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
      }
    });
  }

  /**
   * Ensure that the ports connected by a specific edge remain visible
   */
  ensureConnectedPortsVisible(graph: Graph, edge: Edge): void {
    const sourceCellId = edge.getSourceCellId();
    const targetCellId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    this.logger.info('Ensuring connected ports are visible for edge', {
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
        // Verify port exists before setting visibility
        const ports = sourceNode.getPorts();
        const portExists = ports.some(port => port.id === sourcePortId);

        if (portExists) {
          sourceNode.setPortProp(sourcePortId, 'attrs/circle/style/visibility', 'visible');
          this.logger.info('Made source port visible', {
            edgeId: edge.id,
            sourceNodeId: sourceCellId,
            sourcePortId,
            portExists: true,
          });
        } else {
          this.logger.warn('Source port does not exist on node', {
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
        // Verify port exists before setting visibility
        const ports = targetNode.getPorts();
        const portExists = ports.some(port => port.id === targetPortId);

        if (portExists) {
          targetNode.setPortProp(targetPortId, 'attrs/circle/style/visibility', 'visible');
          this.logger.info('Made target port visible', {
            edgeId: edge.id,
            targetNodeId: targetCellId,
            targetPortId,
            portExists: true,
          });
        } else {
          this.logger.warn('Target port does not exist on node', {
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
   * Handle connection changes by updating port visibility
   */
  onConnectionChange(graph: Graph): void {
    // Update port visibility for all nodes to reflect new connection states
    graph.getNodes().forEach(node => {
      this.updateNodePortVisibility(graph, node);
    });
  }

  /**
   * Check if a port is connected to any edge
   */
  isPortConnected(graph: Graph, nodeId: string, portId: string): boolean {
    const edges = graph.getEdges();
    return edges.some(edge => {
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      return (
        (sourceNodeId === nodeId && sourcePortId === portId) ||
        (targetNodeId === nodeId && targetPortId === portId)
      );
    });
  }

  /**
   * Setup port tooltips
   */
  setupPortTooltips(graph: Graph): void {
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
  }
}
