import { Injectable } from '@angular/core';
import { Graph, Node, NodeView } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { PortDirection } from '../models/dfd-types';
import { DfdNodeService } from './dfd-node.service';

/**
 * Type for port objects returned by getPortsByGroup
 */
type PortInfo = {
  id: string;
  [key: string]: unknown;
};

/**
 * Service for managing ports in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdPortService {
  constructor(
    private logger: LoggerService,
    private nodeService: DfdNodeService,
  ) {}

  /**
   * Hides all unused ports on all nodes in the graph
   * @param graph The X6 graph instance
   */
  hideUnusedPortsOnAllNodes(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Get all nodes in the graph
    const nodes = graph.getNodes();

    // For each node, hide all ports that aren't connected to an edge
    nodes.forEach(node => {
      if (this.nodeService.isDfdNode(node)) {
        const nodeView = graph.findViewByCell(node);
        if (nodeView && nodeView instanceof NodeView) {
          this.hideUnusedPortsOnNode(graph, node, nodeView as NodeView);
        }
      }
    });
  }

  /**
   * Hides unused ports on a specific node
   * @param graph The X6 graph instance
   * @param node The node to hide ports on
   * @param nodeView The node view
   */
  private hideUnusedPortsOnNode(graph: Graph, node: Node, nodeView: NodeView): void {
    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];

    directions.forEach(direction => {
      // Use a type assertion for the node with getPortsByGroup method
      const dfdNode = node as Node & { getPortsByGroup: (group: string) => PortInfo[] };
      const constructorName = node.constructor.name;

      // Check if the node has the getPortsByGroup method
      if (typeof dfdNode.getPortsByGroup !== 'function') {
        return;
      }

      const ports =
        constructorName === 'ActorShape' ||
        constructorName === 'ProcessShape' ||
        constructorName === 'StoreShape' ||
        constructorName === 'SecurityBoundaryShape'
          ? dfdNode.getPortsByGroup(direction)
          : [];

      // Process each port
      for (const port of ports) {
        if (port && port.id) {
          const portId = port.id;
          const portNode = nodeView.findPortElem(portId, 'portBody');
          if (portNode) {
            // Check if this port has any connected edges
            const connectedEdges = graph.getConnectedEdges(node, {
              outgoing: true,
              incoming: true,
            });

            const isPortInUse = connectedEdges.some(edge => {
              const sourcePort = edge.getSourcePortId();
              const targetPort = edge.getTargetPortId();
              return sourcePort === portId || targetPort === portId;
            });

            // Use CSS classes instead of inline attributes for port visibility
            if (!isPortInUse) {
              // Remove the connected class for unused ports
              portNode.classList.remove('port-connected');
            } else {
              // Add the connected class for ports with edges
              portNode.classList.add('port-connected');
              // Keep the z-index attribute for stacking order
              portNode.setAttribute('z-index', '1000');
            }
          }
        }
      }
    });
  }

  /**
   * Shows all ports on all nodes
   * @param graph The X6 graph instance
   */
  showAllPorts(graph: Graph): void {
    if (!graph) {
      return;
    }

    const nodes = graph.getNodes();
    nodes.forEach(node => {
      if (this.nodeService.isDfdNode(node)) {
        const nodeView = graph.findViewByCell(node);
        if (nodeView && nodeView instanceof NodeView) {
          this.showAllPortsOnNode(node, nodeView as NodeView);
        }
      }
    });
  }

  /**
   * Shows all ports on a specific node
   * @param node The node to show ports on
   * @param nodeView The node view
   */
  private showAllPortsOnNode(node: Node, nodeView: NodeView): void {
    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];

    directions.forEach(direction => {
      // Use a type assertion for the node with getPortsByGroup method
      const dfdNode = node as Node & { getPortsByGroup: (group: string) => PortInfo[] };
      const constructorName = node.constructor.name;

      // Check if the node has the getPortsByGroup method
      if (typeof dfdNode.getPortsByGroup !== 'function') {
        return;
      }

      const ports =
        constructorName === 'ActorShape' ||
        constructorName === 'ProcessShape' ||
        constructorName === 'StoreShape' ||
        constructorName === 'SecurityBoundaryShape'
          ? dfdNode.getPortsByGroup(direction)
          : [];

      // Process each port
      for (const port of ports) {
        if (port && port.id) {
          const portId = port.id;
          const portNode = nodeView.findPortElem(portId, 'portBody');
          if (portNode) {
            // Use CSS class for visibility
            portNode.classList.add('port-connected');
            // Ensure port is above other elements by setting a high z-index
            portNode.setAttribute('z-index', '1000');
          }
        }
      }
    });
  }
}
