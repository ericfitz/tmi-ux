import { Observable } from 'rxjs';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';
import { Point } from '../../domain/value-objects/point';

/**
 * Interface for X6 graph adapter that provides abstraction over X6 Graph operations
 * while maintaining direct access to X6's native capabilities.
 */
export interface IGraphAdapter {
  /**
   * Observable for node addition events
   */
  nodeAdded$: Observable<Node>;

  /**
   * Observable for node removal events
   */
  nodeRemoved$: Observable<{ nodeId: string; node: Node }>;

  /**
   * Observable for node movement events
   */
  nodeMoved$: Observable<{ nodeId: string; position: Point; previous: Point }>;

  /**
   * Observable for edge addition events
   */
  edgeAdded$: Observable<Edge>;

  /**
   * Observable for edge removal events
   */
  edgeRemoved$: Observable<{ edgeId: string; edge: Edge }>;

  /**
   * Observable for selection changes
   */
  selectionChanged$: Observable<{ selected: string[]; deselected: string[] }>;

  /**
   * Observable for cell deletion requests from the button-remove tool.
   * The presentation layer subscribes to gate deletion with confirmation dialogs.
   */
  cellDeletionRequested$: Observable<Cell>;

  /**
   * Initialize the graph with the given container element
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: initialize the graph adapter with a DOM container element (mutates shared state)
  initialize(container: HTMLElement): void;

  /**
   * Get the underlying X6 Graph instance for direct access when needed
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch the underlying X6 Graph instance for direct access (pure)
  getGraph(): Graph;

  /**
   * Add a node to the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: add a diagram node to the graph and return the created node (mutates shared state)
  addNode(node: DiagramNode): Node;

  /**
   * Remove a node from the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: delete a diagram node from the graph by ID (mutates shared state)
  removeNode(nodeId: string): void;

  /**
   * Move a node to a new position
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: reposition a diagram node to a new point (mutates shared state)
  moveNode(nodeId: string, position: Point): void;

  /**
   * Add an edge to the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: add a diagram edge to the graph and return the created edge (mutates shared state)
  addEdge(edge: DiagramEdge): Edge;

  /**
   * Remove an edge from the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: delete a diagram edge from the graph by ID (mutates shared state)
  removeEdge(edgeId: string): void;

  /**
   * Get all nodes in the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: list all diagram nodes currently in the graph (pure)
  getNodes(): Node[];

  /**
   * Get all edges in the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: list all diagram edges currently in the graph (pure)
  getEdges(): Edge[];

  /**
   * Get a node by ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a single diagram node by ID, or null if absent (pure)
  getNode(nodeId: string): Node | null;

  /**
   * Get an edge by ID
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a single diagram edge by ID, or null if absent (pure)
  getEdge(edgeId: string): Edge | null;

  /**
   * Clear all nodes and edges from the graph
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove all nodes and edges from the graph (mutates shared state)
  clear(): void;

  /**
   * Fit the graph to the viewport
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: scale and pan the viewport to fit all graph content (mutates shared state)
  fitToContent(): void;

  /**
   * Center the graph in the viewport
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: pan the viewport to center all graph content (mutates shared state)
  centerContent(): void;

  /**
   * Dispose of the graph and clean up resources
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: destroy the graph adapter and release all resources (mutates shared state)
  dispose(): void;

  /**
   * Start label editing for a cell (public method to access private _addLabelEditor)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: activate inline label editor for a graph cell on mouse event (mutates shared state)
  startLabelEditing(cell: Cell, event: MouseEvent): void;
}
