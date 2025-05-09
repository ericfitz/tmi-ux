import { Injectable } from '@angular/core';
import { Graph, Node, NodeView } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { ActorShape } from '../models/actor-shape.model';
import { ProcessShape } from '../models/process-shape.model';
import { StoreShape } from '../models/store-shape.model';
import { SecurityBoundaryShape } from '../models/security-boundary-shape.model';
import { PortDirection } from '../models/dfd-types';
import { DfdNodeService } from './dfd-node.service';

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
      const dfdNode = node as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;
      const ports = dfdNode instanceof ActorShape || 
                 dfdNode instanceof ProcessShape || 
                 dfdNode instanceof StoreShape || 
                 dfdNode instanceof SecurityBoundaryShape 
                 ? dfdNode.getPortsByGroup(direction)
                 : [];
                
      ports.forEach(port => {
        const portId = typeof port.id === 'string' ? port.id : String(port.id);
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

          // Only hide ports that are not in use
          if (!isPortInUse) {
            portNode.setAttribute('visibility', 'hidden');
          }
        }
      });
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
      const dfdNode = node as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;
      const ports = dfdNode instanceof ActorShape || 
                 dfdNode instanceof ProcessShape || 
                 dfdNode instanceof StoreShape || 
                 dfdNode instanceof SecurityBoundaryShape 
                 ? dfdNode.getPortsByGroup(direction)
                 : [];
                
      ports.forEach(port => {
        const portId = typeof port.id === 'string' ? port.id : String(port.id);
        const portNode = nodeView.findPortElem(portId, 'portBody');
        if (portNode) {
          portNode.setAttribute('visibility', 'visible');
        }
      });
    });
  }
}
