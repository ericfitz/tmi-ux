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
   * Sets the visibility of a port element using direct SVG attributes
   * @param portElement The port element to modify
   * @param visible Whether the port should be visible
   */
  private setPortVisibility(portElement: Element, visible: boolean): void {
    if (visible) {
      portElement.setAttribute('visibility', 'visible');
      portElement.setAttribute('opacity', '1');
    } else {
      portElement.setAttribute('visibility', 'hidden');
      portElement.setAttribute('opacity', '0');
    }
  }

  /**
   * Shows all ports on a specific node using direct SVG attribute manipulation
   * @param graph The X6 graph instance
   * @param node The node to show ports on
   */
  showPortsOnNode(graph: Graph, node: Node): void {
    if (!graph || !node) {
      return;
    }

    const nodeView = graph.findViewByCell(node);
    if (!nodeView || !(nodeView instanceof NodeView)) {
      return;
    }

    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];

    directions.forEach(direction => {
      const dfdNode = node as Node & { getPortsByGroup: (group: string) => PortInfo[] };
      const constructorName = node.constructor.name;

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

      ports.forEach(port => {
        if (port && port.id) {
          const portId = typeof port.id === 'string' ? port.id : String(port.id);
          const portBodyElement = nodeView.findPortElem(portId, 'portBody');
          if (portBodyElement) {
            this.setPortVisibility(portBodyElement, true);
          }
        }
      });
    });
  }

  /**
   * Hides unused ports on a specific node using direct SVG attribute manipulation
   * @param graph The X6 graph instance
   * @param node The node to hide unused ports on
   */
  hideUnusedPortsOnNode(graph: Graph, node: Node): void {
    if (!graph || !node) {
      return;
    }

    const nodeView = graph.findViewByCell(node);
    if (!nodeView || !(nodeView instanceof NodeView)) {
      return;
    }

    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];

    directions.forEach(direction => {
      const dfdNode = node as Node & { getPortsByGroup: (group: string) => PortInfo[] };
      const constructorName = node.constructor.name;

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

      ports.forEach(port => {
        if (port && port.id) {
          const portId = typeof port.id === 'string' ? port.id : String(port.id);
          const portBodyElement = nodeView.findPortElem(portId, 'portBody');
          if (portBodyElement) {
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

            // Only hide if not connected
            if (!isPortInUse) {
              this.setPortVisibility(portBodyElement, false);
            }
          }
        }
      });
    });
  }

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
        this.hideUnusedPortsOnNode(graph, node);
      }
    });
  }

  /**
   * Updates the visibility state of a specific port
   * @param graph The X6 graph instance
   * @param node The node containing the port
   * @param portId The ID of the port
   * @param state The visibility state to apply ('visible', 'connected', or null to hide)
   */
  updatePortVisibility(
    graph: Graph,
    node: Node,
    portId: string,
    state: 'visible' | 'connected' | null,
  ): void {
    if (!graph || !node || !portId) {
      return;
    }

    const nodeView = graph.findViewByCell(node);
    if (!nodeView || !(nodeView instanceof NodeView)) {
      return;
    }

    const portBodyElement = nodeView.findPortElem(portId, 'portBody');
    if (!portBodyElement) {
      return;
    }

    // Get the parent <g> element which has the class 'x6-port'
    const portGroupElement = portBodyElement.closest('g.x6-port') as HTMLElement;
    if (!portGroupElement) {
      this.logger.warn('Could not find parent port group element for port', {
        nodeId: node.id,
        portId,
      });
      return;
    }

    // Remove all state classes from the portBodyElement first
    portBodyElement.classList.remove('port-visible', 'port-connected');

    // Apply the requested state to the portBodyElement directly
    if (state === 'visible') {
      portBodyElement.classList.add('port-visible');
    } else if (state === 'connected') {
      portBodyElement.classList.add('port-connected');
    } else {
      // Let CSS handle the hidden state via default styling
      // No classes needed for hidden state
    }

    // Log the port visibility change
    this.logger.debug('Port visibility updated', {
      nodeId: node.id,
      portId,
      state,
      classes: portBodyElement.className,
      visibility: portBodyElement.getAttribute('visibility'),
      opacity: portBodyElement.getAttribute('opacity'),
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
          this.showAllPortsOnNode(graph, node, nodeView as NodeView);
        }
      }
    });
  }

  /**
   * Shows all ports on a specific node
   * @param graph The X6 graph instance
   * @param node The node to show ports on
   * @param nodeView The node view
   */
  private showAllPortsOnNode(graph: Graph, node: Node, _nodeView: NodeView): void {
    // Use the new public method
    this.showPortsOnNode(graph, node);
  }
}
