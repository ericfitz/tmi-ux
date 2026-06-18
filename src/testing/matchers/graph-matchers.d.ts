/// <reference types="chai" />

declare namespace Chai {
  interface Assertion {
    /**
     * Asserts that the graph has a node with the specified ID
     * @param nodeId The ID of the node to check for
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: Chai assertion that a graph contains a node with the given ID (pure)
    haveNode(nodeId: string): Assertion;

    /**
     * Asserts that the graph has an edge with the specified ID
     * @param edgeId The ID of the edge to check for
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that the graph contains an edge by ID (pure)
    haveEdge(edgeId: string): Assertion;

    /**
     * Asserts that the graph has the specified number of nodes
     * @param count The expected number of nodes
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that the graph contains exactly the expected node count (pure)
    haveNodeCount(count: number): Assertion;

    /**
     * Asserts that the graph has the specified number of edges
     * @param count The expected number of edges
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that the graph contains exactly the expected edge count (pure)
    haveEdgeCount(count: number): Assertion;

    /**
     * Asserts that the graph has a connection from the source node to the target node
     * @param sourceId The ID of the source node
     * @param targetId The ID of the target node
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that the graph has a directed edge between two nodes (pure)
    haveConnection(sourceId: string, targetId: string): Assertion;

    /**
     * Asserts that the graph has a node with the specified label
     * @param label The label to check for
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that the graph contains a node matching the given label (pure)
    haveNodeWithLabel(label: string): Assertion;

    /**
     * Asserts that the graph has a selected node with the specified ID
     * @param nodeId The ID of the node to check for selection
     */
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that the graph has a node marked selected by ID (pure)
    haveSelectedNode(nodeId: string): Assertion;
  }
}
