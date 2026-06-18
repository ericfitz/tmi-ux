/**
 * X6 Core Operations Service
 *
 * This service provides low-level X6 graph operations that can be used by both
 * the InfraX6GraphAdapter and domain services (InfraNodeService, InfraEdgeService) without
 * creating circular dependencies.
 *
 * Key functionality:
 * - Direct X6 node creation, removal, and manipulation
 * - Direct X6 edge creation, removal, and manipulation
 * - Direct X6 cell operations for generic operations
 * - Minimal business logic - focuses on X6 API operations
 * - Type-safe wrappers around X6 methods
 * - Error handling for X6 operations
 * - Logging for debugging X6 operations
 */

import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Configuration for node creation
 */
export interface NodeCreationConfig {
  id: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  zIndex?: number;
  ports?: any[];
  attrs?: any;
  data?: any;
  [key: string]: any; // Allow additional X6 properties
}

/**
 * Configuration for edge creation
 */
export interface EdgeCreationConfig {
  id: string;
  shape?: string;
  source: { cell: string; port?: string } | string;
  target: { cell: string; port?: string } | string;
  labels?: any[];
  vertices?: Array<{ x: number; y: number }>;
  attrs?: any;
  zIndex?: number;
  markup?: any[];
  data?: any;
  [key: string]: any; // Allow additional X6 properties
}

/**
 * Options for core operations
 */
export interface CoreOperationOptions {
  suppressErrors?: boolean;
  logOperation?: boolean;
}

/**
 * Low-level X6 operations service
 * Provides direct X6 API access without business logic
 */
@Injectable({
  providedIn: 'root',
})
// SEM@0c4b0e63a2f170695121de276aae1d8887c94516: service wrapping X6 graph CRUD operations for nodes, edges, and cells with error handling
export class InfraX6CoreOperationsService {
  // SEM@30f828164ac850acd8c5327d89735462337b332b: inject the logger dependency (pure)
  constructor(private logger: LoggerService) {}

  // ===============================
  // Node Operations
  // ===============================

  /**
   * Add a node to the X6 graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: add a node to the X6 graph from a creation config, returning the node or null on error (mutates shared state)
  addNode(
    graph: Graph,
    config: NodeCreationConfig,
    options: CoreOperationOptions = {},
  ): Node | null {
    const { suppressErrors = false, logOperation = true } = options;

    try {
      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Adding node', {
          nodeId: config.id,
          shape: config.shape,
          position: { x: config.x, y: config.y },
        });
      }

      const node = graph.addNode(config);

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Node added successfully', {
          nodeId: config.id,
          cellId: node.id,
        });
      }

      return node;
    } catch (error) {
      this.logger.error('Error adding node', {
        nodeId: config.id,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Remove a node from the X6 graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: delete a node by ID from the X6 graph, returning success or false if not found (mutates shared state)
  removeNode(graph: Graph, nodeId: string, options: CoreOperationOptions = {}): boolean {
    const { suppressErrors = false, logOperation = true } = options;

    try {
      const node = graph.getCellById(nodeId);

      if (!node || !node.isNode()) {
        if (logOperation) {
          this.logger.warn('Node not found for removal', { nodeId });
        }
        return false;
      }

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Removing node', { nodeId });
      }

      graph.removeNode(node);

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Node removed successfully', { nodeId });
      }

      return true;
    } catch (error) {
      this.logger.error('Error removing node', {
        nodeId,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }
      return false;
    }
  }

  // ===============================
  // Edge Operations
  // ===============================

  /**
   * Add an edge to the X6 graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: add an edge to the X6 graph from a creation config, returning the edge or null on error (mutates shared state)
  addEdge(
    graph: Graph,
    config: EdgeCreationConfig,
    options: CoreOperationOptions = {},
  ): Edge | null {
    const { suppressErrors = false, logOperation = true } = options;

    try {
      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Adding edge', {
          edgeId: config.id,
          source: config.source,
          target: config.target,
        });
      }

      const edge = graph.addEdge(config);

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Edge added successfully', {
          edgeId: config.id,
          cellId: edge.id,
        });
      }

      return edge;
    } catch (error) {
      this.logger.error('Error adding edge', {
        edgeId: config.id,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Remove an edge from the X6 graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: delete an edge by ID from the X6 graph, returning success or false if not found (mutates shared state)
  removeEdge(graph: Graph, edgeId: string, options: CoreOperationOptions = {}): boolean {
    const { suppressErrors = false, logOperation = true } = options;

    try {
      const edge = graph.getCellById(edgeId);

      if (!edge || !edge.isEdge()) {
        if (logOperation) {
          this.logger.warn('Edge not found for removal', { edgeId });
        }
        return false;
      }

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Removing edge', { edgeId });
      }

      graph.removeEdge(edge);

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Edge removed successfully', { edgeId });
      }

      return true;
    } catch (error) {
      this.logger.error('Error removing edge', {
        edgeId,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }
      return false;
    }
  }

  // ===============================
  // Generic Cell Operations
  // ===============================

  /**
   * Remove a cell (node or edge) from the X6 graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: delete a cell by ID from the X6 graph regardless of type, returning success (mutates shared state)
  removeCell(graph: Graph, cellId: string, options: CoreOperationOptions = {}): boolean {
    const { suppressErrors = false, logOperation = true } = options;

    try {
      const cell = graph.getCellById(cellId);

      if (!cell) {
        if (logOperation) {
          this.logger.warn('Cell not found for removal', { cellId });
        }
        return false;
      }

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Removing cell', {
          cellId,
          cellType: cell.isNode() ? 'node' : 'edge',
        });
      }

      graph.removeCell(cell);

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Cell removed successfully', { cellId });
      }

      return true;
    } catch (error) {
      this.logger.error('Error removing cell', {
        cellId,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Remove a cell object directly from the X6 graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: delete a cell object reference from the X6 graph, returning success (mutates shared state)
  removeCellObject(graph: Graph, cell: Cell, options: CoreOperationOptions = {}): boolean {
    const { suppressErrors = false, logOperation = true } = options;

    try {
      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Removing cell object', {
          cellId: cell.id,
          cellType: cell.isNode() ? 'node' : 'edge',
        });
      }

      graph.removeCell(cell);

      if (logOperation) {
        this.logger.debugComponent('X6CoreOperations', 'Cell object removed successfully', {
          cellId: cell.id,
        });
      }

      return true;
    } catch (error) {
      this.logger.error('Error removing cell object', {
        cellId: cell.id,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }
      return false;
    }
  }

  // ===============================
  // Utility Operations
  // ===============================

  /**
   * Check if a cell exists in the graph
   */
  // SEM@30f828164ac850acd8c5327d89735462337b332b: check whether a cell with the given ID exists in the graph (pure)
  cellExists(graph: Graph, cellId: string): boolean {
    const cell = graph.getCellById(cellId);
    return !!cell;
  }

  /**
   * Get a cell by ID with type checking
   */
  // SEM@30f828164ac850acd8c5327d89735462337b332b: fetch a cell by ID from the graph, returning null if absent (pure)
  getCell(graph: Graph, cellId: string): Cell | null {
    return graph.getCellById(cellId) || null;
  }

  /**
   * Get a node by ID with type safety
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: fetch a node by ID with type safety, returning null if absent or not a node (pure)
  getNode(graph: Graph, nodeId: string): Node | null {
    const cell = graph.getCellById(nodeId);
    return cell && cell.isNode() ? cell : null;
  }

  /**
   * Get an edge by ID with type safety
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: fetch an edge by ID with type safety, returning null if absent or not an edge (pure)
  getEdge(graph: Graph, edgeId: string): Edge | null {
    const cell = graph.getCellById(edgeId);
    return cell && cell.isEdge() ? cell : null;
  }

  /**
   * Clear all cells from the graph
   */
  // SEM@dbbf1c37e47ee156c049a3311a025acd5d4d111c: delete all cells from the graph (mutates shared state)
  clearGraph(graph: Graph, options: CoreOperationOptions = {}): void {
    const { logOperation = true } = options;

    if (logOperation) {
      this.logger.debugComponent('X6CoreOperations', 'Clearing graph');
    }

    graph.clearCells();

    if (logOperation) {
      this.logger.debugComponent('X6CoreOperations', 'Graph cleared successfully');
    }
  }
}
