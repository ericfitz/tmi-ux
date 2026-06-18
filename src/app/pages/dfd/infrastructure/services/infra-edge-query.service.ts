/**
 * Edge Query Service
 *
 * This service provides specialized edge query operations for the X6 graph.
 * It handles edge lookups, filtering, and relationship queries efficiently.
 *
 * Key functionality:
 * - Provides read-only edge query operations for graph analysis
 * - Finds edges connected to specific nodes or ports
 * - Performs efficient edge filtering and searching operations
 * - Analyzes port connection states and relationships
 * - Supports edge validation and connectivity checking
 * - Provides edge grouping and categorization functionality
 * - Handles complex edge relationship queries
 * - Supports edge path finding and traversal operations
 * - Provides edge statistics and analysis capabilities
 * - Integrates with port state management for visibility decisions
 * - Offers performance-optimized edge lookup algorithms
 * - Supports edge metadata and property queries
 */

import { Injectable } from '@angular/core';
import { Edge, Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Edge Query Service
 *
 * Provides specialized edge query operations for the X6 graph adapter.
 * Handles edge lookups, filtering, and relationship queries.
 *
 * Key principles:
 * - Read-only operations for edge queries
 * - Efficient edge filtering and searching
 * - Port connection analysis
 */
@Injectable({
  providedIn: 'root',
})
// SEM@0c4b0e63a2f170695121de276aae1d8887c94516: query graph edges by node, port, and metadata; compute node edge statistics
export class InfraEdgeQueryService {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: inject logger service (mutates shared state)
  constructor(private readonly _logger: LoggerService) {}

  /**
   * Find edges connected to a specific node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: filter graph edges to those connected to a given node (pure)
  findEdgesConnectedToNode(graph: any, nodeId: string): Edge[] {
    if (!graph || !nodeId) {
      return [];
    }
    const edges = graph.getEdges();
    return edges.filter((edge: Edge) => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      return sourceCellId === nodeId || targetCellId === nodeId;
    });
  }

  /**
   * Find edges connected to a specific port
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: filter graph edges to those connected to a specific node port (pure)
  findEdgesConnectedToPort(graph: any, nodeId: string, portId: string): Edge[] {
    if (!graph || !nodeId || !portId) {
      return [];
    }
    const edges = graph.getEdges();
    return edges.filter((edge: Edge) => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      return (
        (sourceCellId === nodeId && sourcePortId === portId) ||
        (targetCellId === nodeId && targetPortId === portId)
      );
    });
  }

  /**
   * Check if a specific port is connected to any edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a specific port has any connected edges (pure)
  isPortConnected(graph: any, nodeId: string, portId: string): boolean {
    const connectedEdges = this.findEdgesConnectedToPort(graph, nodeId, portId);
    return connectedEdges.length > 0;
  }

  /**
   * Get all connected ports for a node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: list all connected ports for a node with edge ID and direction (pure)
  getConnectedPorts(
    graph: any,
    nodeId: string,
  ): Array<{ portId: string; edgeId: string; direction: 'source' | 'target' }> {
    const edges = this.findEdgesConnectedToNode(graph, nodeId);
    const connectedPorts: Array<{
      portId: string;
      edgeId: string;
      direction: 'source' | 'target';
    }> = [];

    edges.forEach(edge => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      if (sourceCellId === nodeId && sourcePortId) {
        connectedPorts.push({
          portId: sourcePortId,
          edgeId: edge.id,
          direction: 'source',
        });
      }

      if (targetCellId === nodeId && targetPortId) {
        connectedPorts.push({
          portId: targetPortId,
          edgeId: edge.id,
          direction: 'target',
        });
      }
    });

    return connectedPorts;
  }

  /**
   * Find edges between two specific nodes
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: filter graph edges connecting two specific nodes in either direction (pure)
  findEdgesBetweenNodes(graph: any, sourceNodeId: string, targetNodeId: string): Edge[] {
    if (!graph || !sourceNodeId || !targetNodeId) {
      return [];
    }
    const edges = graph.getEdges();
    return edges.filter((edge: Edge) => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      return (
        (sourceCellId === sourceNodeId && targetCellId === targetNodeId) ||
        (sourceCellId === targetNodeId && targetCellId === sourceNodeId)
      );
    });
  }

  /**
   * Get edge statistics for a node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute incoming, outgoing, and port connection counts for a node (pure)
  getNodeEdgeStatistics(
    graph: any,
    nodeId: string,
  ): {
    totalEdges: number;
    incomingEdges: number;
    outgoingEdges: number;
    connectedPorts: number;
    unconnectedPorts: number;
  } {
    if (!graph || !nodeId) {
      return {
        totalEdges: 0,
        incomingEdges: 0,
        outgoingEdges: 0,
        connectedPorts: 0,
        unconnectedPorts: 0,
      };
    }

    const node = graph.getCellById(nodeId) as Node;
    if (!node || !node.isNode()) {
      return {
        totalEdges: 0,
        incomingEdges: 0,
        outgoingEdges: 0,
        connectedPorts: 0,
        unconnectedPorts: 0,
      };
    }

    const edges = this.findEdgesConnectedToNode(graph, nodeId);
    const connectedPorts = this.getConnectedPorts(graph, nodeId);
    const allPorts = node.getPorts();

    let incomingEdges = 0;
    let outgoingEdges = 0;

    edges.forEach(edge => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();

      if (sourceCellId === nodeId) {
        outgoingEdges++;
      }
      if (targetCellId === nodeId) {
        incomingEdges++;
      }
    });

    return {
      totalEdges: edges.length,
      incomingEdges,
      outgoingEdges,
      connectedPorts: connectedPorts.length,
      unconnectedPorts: allPorts.length - connectedPorts.length,
    };
  }

  /**
   * Find edges by metadata criteria
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: filter graph edges whose metadata matches all given key-value criteria (pure)
  findEdgesByMetadata(graph: any, criteria: Record<string, string>): Edge[] {
    const edges = graph.getEdges();
    return edges.filter((edge: Edge) => {
      const metadata = (edge as any).getMetadata ? (edge as any).getMetadata() : [];

      return Object.entries(criteria).every(([key, value]) => {
        const metadataEntry = metadata.find((m: any) => m.key === key);
        return metadataEntry && metadataEntry.value === value;
      });
    });
  }

  /**
   * Find edge between specific ports on nodes
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: search for an edge connecting two nodes, optionally constrained to specific ports (pure)
  findEdgeBetweenPorts(
    graph: any,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: string,
    targetPortId?: string,
  ): Edge | null {
    const edges = graph.getEdges();

    for (const edge of edges) {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const edgeSourcePortId = edge.getSourcePortId();
      const edgeTargetPortId = edge.getTargetPortId();

      // Check if nodes match
      if (sourceCellId === sourceNodeId && targetCellId === targetNodeId) {
        // If ports are specified, check them too
        if (sourcePortId && targetPortId) {
          if (edgeSourcePortId === sourcePortId && edgeTargetPortId === targetPortId) {
            return edge;
          }
        } else if (sourcePortId) {
          if (edgeSourcePortId === sourcePortId) {
            return edge;
          }
        } else if (targetPortId) {
          if (edgeTargetPortId === targetPortId) {
            return edge;
          }
        } else {
          // No port specification, just return first matching edge
          return edge;
        }
      }
    }

    return null;
  }

  /**
   * Validate edge connection integrity
   */
  // SEM@cd1e8083a933e71b69d89d729371e93ca3104dcd: validate all graph edges have existing source and target nodes and ports (pure)
  validateEdgeConnections(graph: any): Array<{
    edgeId: string;
    issues: string[];
  }> {
    if (!graph) {
      return [];
    }
    const edges = graph.getEdges();
    const validationResults: Array<{ edgeId: string; issues: string[] }> = [];

    edges.forEach((edge: Edge) => {
      const issues: string[] = [];
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      // Check if source node exists
      if (sourceCellId) {
        const sourceNode = graph.getCellById(sourceCellId);
        if (!sourceNode || !sourceNode.isNode()) {
          issues.push(`Source node ${sourceCellId} not found or not a node`);
        } else if (sourcePortId) {
          // Check if source port exists
          const sourcePorts = sourceNode.getPorts();
          const sourcePortExists = sourcePorts.some((port: any) => port.id === sourcePortId);
          if (!sourcePortExists) {
            issues.push(`Source port ${sourcePortId} not found on node ${sourceCellId}`);
          }
        }
      } else {
        issues.push('Missing source node ID');
      }

      // Check if target node exists
      if (targetCellId) {
        const targetNode = graph.getCellById(targetCellId);
        if (!targetNode || !targetNode.isNode()) {
          issues.push(`Target node ${targetCellId} not found or not a node`);
        } else if (targetPortId) {
          // Check if target port exists
          const targetPorts = targetNode.getPorts();
          const targetPortExists = targetPorts.some((port: any) => port.id === targetPortId);
          if (!targetPortExists) {
            issues.push(`Target port ${targetPortId} not found on node ${targetCellId}`);
          }
        }
      } else {
        issues.push('Missing target node ID');
      }

      if (issues.length > 0) {
        validationResults.push({
          edgeId: edge.id,
          issues,
        });
      }
    });

    if (validationResults.length > 0) {
      this._logger.warn('Edge connection validation found issues', {
        totalEdges: edges.length,
        edgesWithIssues: validationResults.length,
        issues: validationResults,
      });
    } else {
      this._logger.debugComponent('DfdEdgeQuery', 'Edge connection validation passed', {
        totalEdges: edges.length,
      });
    }

    return validationResults;
  }

  /**
   * Get edge connection summary for debugging
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: aggregate graph edge connection statistics and details for debugging (pure)
  getConnectionSummary(graph: any): {
    totalEdges: number;
    edgesWithPorts: number;
    edgesWithoutPorts: number;
    uniqueConnections: number;
    connectionDetails: Array<{
      edgeId: string;
      sourceNodeId: string;
      targetNodeId: string;
      sourcePortId?: string;
      targetPortId?: string;
    }>;
  } {
    if (!graph) {
      return {
        totalEdges: 0,
        edgesWithPorts: 0,
        edgesWithoutPorts: 0,
        uniqueConnections: 0,
        connectionDetails: [],
      };
    }
    const edges = graph.getEdges();
    const connectionDetails: Array<{
      edgeId: string;
      sourceNodeId: string;
      targetNodeId: string;
      sourcePortId?: string;
      targetPortId?: string;
    }> = [];

    let edgesWithPorts = 0;
    let edgesWithoutPorts = 0;
    const uniqueConnections = new Set<string>();

    edges.forEach((edge: Edge) => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      const hasSourcePort = !!sourcePortId;
      const hasTargetPort = !!targetPortId;

      if (hasSourcePort && hasTargetPort) {
        edgesWithPorts++;
      } else {
        edgesWithoutPorts++;
      }

      // Create unique connection identifier
      const connectionKey = `${sourceCellId}:${sourcePortId || 'none'}->${targetCellId}:${targetPortId || 'none'}`;
      uniqueConnections.add(connectionKey);

      connectionDetails.push({
        edgeId: edge.id,
        sourceNodeId: sourceCellId,
        targetNodeId: targetCellId,
        sourcePortId,
        targetPortId,
      });
    });

    return {
      totalEdges: edges.length,
      edgesWithPorts,
      edgesWithoutPorts,
      uniqueConnections: uniqueConnections.size,
      connectionDetails,
    };
  }
}
