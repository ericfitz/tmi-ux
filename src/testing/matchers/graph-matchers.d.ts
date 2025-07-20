/// <reference types="chai" />

declare namespace Chai {
  interface Assertion {
    /**
     * Asserts that the graph has a node with the specified ID
     * @param nodeId The ID of the node to check for
     */
    haveNode(nodeId: string): Assertion;

    /**
     * Asserts that the graph has an edge with the specified ID
     * @param edgeId The ID of the edge to check for
     */
    haveEdge(edgeId: string): Assertion;

    /**
     * Asserts that the graph has the specified number of nodes
     * @param count The expected number of nodes
     */
    haveNodeCount(count: number): Assertion;

    /**
     * Asserts that the graph has the specified number of edges
     * @param count The expected number of edges
     */
    haveEdgeCount(count: number): Assertion;

    /**
     * Asserts that the graph has a connection from the source node to the target node
     * @param sourceId The ID of the source node
     * @param targetId The ID of the target node
     */
    haveConnection(sourceId: string, targetId: string): Assertion;

    /**
     * Asserts that the graph has a node with the specified label
     * @param label The label to check for
     */
    haveNodeWithLabel(label: string): Assertion;

    /**
     * Asserts that the graph has a selected node with the specified ID
     * @param nodeId The ID of the node to check for selection
     */
    haveSelectedNode(nodeId: string): Assertion;
  }
}
