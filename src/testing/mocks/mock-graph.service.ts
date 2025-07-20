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
export class MockGraphService {
  private _graph: Graph | null = null;
  private _nodes: Node[] = [];
  private _edges: Edge[] = [];
  private _selectedCells = new BehaviorSubject<Cell[]>([]);

  /**
   * Get the graph instance
   */
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
  removeNode(nodeId: string): void {
    const graph = this.getGraph();
    graph.removeNode(nodeId);
    this._nodes = this._nodes.filter(node => node.id !== nodeId);
  }

  /**
   * Remove an edge from the graph
   * @param edgeId The ID of the edge to remove
   */
  removeEdge(edgeId: string): void {
    const graph = this.getGraph();
    graph.removeEdge(edgeId);
    this._edges = this._edges.filter(edge => edge.id !== edgeId);
  }

  /**
   * Get all nodes in the graph
   * @returns Array of nodes
   */
  getNodes(): Node[] {
    return this._nodes;
  }

  /**
   * Get all edges in the graph
   * @returns Array of edges
   */
  getEdges(): Edge[] {
    return this._edges;
  }

  /**
   * Get a node by ID
   * @param nodeId The ID of the node to get
   * @returns The node with the specified ID, or undefined if not found
   */
  getNodeById(nodeId: string): Node | undefined {
    return this._nodes.find(node => node.id === nodeId);
  }

  /**
   * Get an edge by ID
   * @param edgeId The ID of the edge to get
   * @returns The edge with the specified ID, or undefined if not found
   */
  getEdgeById(edgeId: string): Edge | undefined {
    return this._edges.find(edge => edge.id === edgeId);
  }

  /**
   * Select a cell in the graph
   * @param cellId The ID of the cell to select
   */
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
  getSelectedCells$(): Observable<Cell[]> {
    return this._selectedCells.asObservable();
  }

  /**
   * Clear the graph
   */
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
