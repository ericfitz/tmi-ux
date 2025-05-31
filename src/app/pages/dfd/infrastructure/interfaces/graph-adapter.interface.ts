import { Observable } from 'rxjs';
import { Graph, Node, Edge } from '@antv/x6';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';
import { Point } from '../../domain/value-objects/point';

/**
 * Interface for X6 graph adapter that provides abstraction over X6 Graph operations
 * while maintaining direct access to X6's native capabilities.
 */
export interface IGraphAdapter {
  /**
   * Initialize the graph with the given container element
   */
  initialize(container: HTMLElement): void;

  /**
   * Get the underlying X6 Graph instance for direct access when needed
   */
  getGraph(): Graph;

  /**
   * Add a node to the graph
   */
  addNode(node: DiagramNode): Node;

  /**
   * Remove a node from the graph
   */
  removeNode(nodeId: string): void;

  /**
   * Move a node to a new position
   */
  moveNode(nodeId: string, position: Point): void;

  /**
   * Add an edge to the graph
   */
  addEdge(edge: DiagramEdge): Edge;

  /**
   * Remove an edge from the graph
   */
  removeEdge(edgeId: string): void;

  /**
   * Get all nodes in the graph
   */
  getNodes(): Node[];

  /**
   * Get all edges in the graph
   */
  getEdges(): Edge[];

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): Node | null;

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): Edge | null;

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void;

  /**
   * Fit the graph to the viewport
   */
  fitToContent(): void;

  /**
   * Center the graph in the viewport
   */
  centerContent(): void;

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
   * Dispose of the graph and clean up resources
   */
  dispose(): void;
}
