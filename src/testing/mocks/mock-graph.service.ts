/**
 * Mock service for AntV/X6 graph
 */

import { Graph, Node, Edge, Cell, Model } from '@antv/x6';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Interface for node configuration
 */
interface NodeMetadata {
  [key: string]: unknown;
  id?: string;
}

/**
 * Interface for edge configuration
 */
interface EdgeMetadata {
  [key: string]: unknown;
  id?: string;
  source?: string;
  target?: string;
}

/**
 * Mock implementation of a graph service for testing
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: in-memory graph service stub for controlling diagram state in tests (mutates shared state)
export class MockGraphService {
  private _graph: Graph | null = null;
  private _nodes: Node[] = [];
  private _edges: Edge[] = [];
  private _selectedCells = new BehaviorSubject<Cell[]>([]);

  /**
   * Get the graph instance
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch or lazily build the backing AntV/X6 graph instance (mutates shared state)
  getGraph(): Graph {
    if (!this._graph) {
      // Create a minimal mock graph
      this._graph = new Graph({
        container: document.createElement('div'),
        width: 800,
        height: 600,
        model: new Model(),
      });
    }
    return this._graph;
  }

  /**
   * Add a node to the graph
   * @param nodeConfig The node configuration
   * @returns The created node
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: add a node with the given config to the mock graph (mutates shared state)
  addNode(nodeConfig: NodeMetadata): Node {
    const graph = this.getGraph();
    const node = graph.addNode(nodeConfig);
    this._nodes.push(node);
    return node;
  }

  /**
   * Add an edge to the graph
   * @param edgeConfig The edge configuration
   * @returns The created edge
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: add an edge with the given config to the mock graph (mutates shared state)
  addEdge(edgeConfig: EdgeMetadata): Edge {
    const graph = this.getGraph();
    const edge = graph.addEdge(edgeConfig);
    this._edges.push(edge);
    return edge;
  }

  /**
   * Remove a node from the graph
   * @param nodeId The ID of the node to remove
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: delete a node by ID from the mock graph (mutates shared state)
  removeNode(nodeId: string): void {
    const graph = this.getGraph();
    graph.removeNode(nodeId);
    this._nodes = this._nodes.filter(node => node.id !== nodeId);
  }

  /**
   * Remove an edge from the graph
   * @param edgeId The ID of the edge to remove
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: delete an edge by ID from the mock graph (mutates shared state)
  removeEdge(edgeId: string): void {
    const graph = this.getGraph();
    graph.removeEdge(edgeId);
    this._edges = this._edges.filter(edge => edge.id !== edgeId);
  }

  /**
   * Get all nodes in the graph
   * @returns Array of nodes
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch all nodes currently tracked in the mock graph (pure)
  getNodes(): Node[] {
    return this._nodes;
  }

  /**
   * Get all edges in the graph
   * @returns Array of edges
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return all edges in the mock graph (pure)
  getEdges(): Edge[] {
    return this._edges;
  }

  /**
   * Get a node by ID
   * @param nodeId The ID of the node to get
   * @returns The node with the specified ID, or undefined if not found
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a mock graph node by its ID, or undefined if absent (pure)
  getNodeById(nodeId: string): Node | undefined {
    return this._nodes.find(node => node.id === nodeId);
  }

  /**
   * Get an edge by ID
   * @param edgeId The ID of the edge to get
   * @returns The edge with the specified ID, or undefined if not found
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a mock graph edge by its ID, or undefined if absent (pure)
  getEdgeById(edgeId: string): Edge | undefined {
    return this._edges.find(edge => edge.id === edgeId);
  }

  /**
   * Select a cell in the graph
   * @param cellId The ID of the cell to select
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: add a cell to the mock selection set and mark it selected (mutates shared state)
  selectCell(cellId: string): void {
    const graph = this.getGraph();
    const cell = graph.getCellById(cellId);
    if (cell) {
      const currentSelection = this._selectedCells.value;
      this._selectedCells.next([...currentSelection, cell]);

      // Set the selected property on the cell
      cell.setProp('selected', true);
    }
  }

  /**
   * Deselect a cell in the graph
   * @param cellId The ID of the cell to deselect
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove a cell from the mock selection set and clear its selected flag (mutates shared state)
  deselectCell(cellId: string): void {
    const graph = this.getGraph();
    const cell = graph.getCellById(cellId);
    if (cell) {
      const currentSelection = this._selectedCells.value;
      this._selectedCells.next(currentSelection.filter(c => c.id !== cellId));

      // Remove the selected property from the cell
      cell.removeProp('selected');
    }
  }

  /**
   * Get the currently selected cells
   * @returns Observable of selected cells
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return an observable stream of currently selected cells (pure)
  getSelectedCells$(): Observable<Cell[]> {
    return this._selectedCells.asObservable();
  }

  /**
   * Clear the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove all nodes, edges, and selections from the mock graph (mutates shared state)
  clear(): void {
    const graph = this.getGraph();
    graph.clearCells();
    this._nodes = [];
    this._edges = [];
    this._selectedCells.next([]);
  }

  /**
   * Dispose of the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: destroy the mock graph instance and reset all internal state (mutates shared state)
  dispose(): void {
    if (this._graph) {
      this._graph.dispose();
      this._graph = null;
    }
    this._nodes = [];
    this._edges = [];
    this._selectedCells.next([]);
  }
}
