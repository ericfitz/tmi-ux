/**
 * X6 Core Operations Service
 *
 * This service provides low-level X6 graph operations that can be used by both
 * the X6GraphAdapter and domain services (NodeService, EdgeService) without
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
import { LoggerService } from '../../../core/services/logger.service';

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
export class X6CoreOperationsService {
  constructor(private logger: LoggerService) {}

  // ===============================
  // Node Operations
  // ===============================

  /**
   * Add a node to the X6 graph
   */
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
  cellExists(graph: Graph, cellId: string): boolean {
    const cell = graph.getCellById(cellId);
    return !!cell;
  }

  /**
   * Get a cell by ID with type checking
   */
  getCell(graph: Graph, cellId: string): Cell | null {
    return graph.getCellById(cellId) || null;
  }

  /**
   * Get a node by ID with type safety
   */
  getNode(graph: Graph, nodeId: string): Node | null {
    const cell = graph.getCellById(nodeId);
    return cell && cell.isNode() ? cell : null;
  }

  /**
   * Get an edge by ID with type safety
   */
  getEdge(graph: Graph, edgeId: string): Edge | null {
    const cell = graph.getCellById(edgeId);
    return cell && cell.isEdge() ? cell : null;
  }

  /**
   * Clear all cells from the graph
   */
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
