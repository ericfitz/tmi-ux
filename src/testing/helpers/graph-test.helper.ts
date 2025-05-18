/**
 * Helper functions for testing AntV/X6 graph components
 */

import { Graph, Node, Edge } from '@antv/x6';

/**
 * Check if a graph has a node with the specified ID
 * @param graph The graph to check
 * @param nodeId The ID of the node to check for
 * @returns True if the graph has a node with the specified ID, false otherwise
 */
export function hasNode(graph: Graph, nodeId: string): boolean {
  const node = graph.getCellById(nodeId);
  return node !== null && node.isNode();
}

/**
 * Check if a graph has an edge with the specified ID
 * @param graph The graph to check
 * @param edgeId The ID of the edge to check for
 * @returns True if the graph has an edge with the specified ID, false otherwise
 */
export function hasEdge(graph: Graph, edgeId: string): boolean {
  const edge = graph.getCellById(edgeId);
  return edge !== null && edge.isEdge();
}

/**
 * Get the number of nodes in a graph
 * @param graph The graph to check
 * @returns The number of nodes in the graph
 */
export function getNodeCount(graph: Graph): number {
  return graph.getNodes().length;
}

/**
 * Get the number of edges in a graph
 * @param graph The graph to check
 * @returns The number of edges in the graph
 */
export function getEdgeCount(graph: Graph): number {
  return graph.getEdges().length;
}

/**
 * Check if a graph has a connection from the source node to the target node
 * @param graph The graph to check
 * @param sourceId The ID of the source node
 * @param targetId The ID of the target node
 * @returns True if the graph has a connection from the source node to the target node, false otherwise
 */
export function hasConnection(graph: Graph, sourceId: string, targetId: string): boolean {
  const edges = graph.getEdges();
  return edges.some(
    edge => edge.getSourceCellId() === sourceId && edge.getTargetCellId() === targetId,
  );
}

/**
 * Check if a graph has a node with the specified label
 * @param graph The graph to check
 * @param label The label to check for
 * @returns True if the graph has a node with the specified label, false otherwise
 */
export function hasNodeWithLabel(graph: Graph, label: string): boolean {
  const nodes = graph.getNodes();
  return nodes.some(node => {
    const nodeLabel = node.attr('text/text') || node.attr('label/text');
    return nodeLabel === label;
  });
}

/**
 * Check if a node is selected in the graph
 * @param graph The graph to check
 * @param nodeId The ID of the node to check for selection
 * @returns True if the node is selected, false otherwise
 */
export function isNodeSelected(graph: Graph, nodeId: string): boolean {
  const node = graph.getCellById(nodeId) as Node;
  if (!node || !node.isNode()) {
    return false;
  }

  // In X6, selection is typically indicated by a CSS class or a visual highlight
  // Since we can't directly access the selection state from the Graph API in this context,
  // we'll check if the node has a selection-related property
  return node.getProp('selected') === true;
}

/**
 * Get a node by ID from the graph
 * @param graph The graph to get the node from
 * @param nodeId The ID of the node to get
 * @returns The node with the specified ID, or null if not found
 */
export function getNodeById(graph: Graph, nodeId: string): Node | null {
  const node = graph.getCellById(nodeId);
  return node && node.isNode() ? node : null;
}

/**
 * Get an edge by ID from the graph
 * @param graph The graph to get the edge from
 * @param edgeId The ID of the edge to get
 * @returns The edge with the specified ID, or null if not found
 */
export function getEdgeById(graph: Graph, edgeId: string): Edge | null {
  const edge = graph.getCellById(edgeId);
  return edge && edge.isEdge() ? edge : null;
}
