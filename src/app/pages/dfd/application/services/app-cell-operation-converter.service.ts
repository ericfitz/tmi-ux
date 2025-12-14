/**
 * AppCellOperationConverterService - Converts graph cells to operation objects
 *
 * This service is responsible for:
 * - Converting arrays of cells to graph operations by comparing with previous state
 * - Creating node and edge operation objects
 * - Handling create, update, and delete operations
 *
 * Extracted from AppHistoryService to reduce complexity and improve maintainability.
 */

import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { Cell } from '../../../../core/types/websocket-message.types';
import {
  GraphOperation,
  CreateNodeOperation,
  UpdateNodeOperation,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  NodeData,
} from '../../types/graph-operation.types';
import { EdgeInfo } from '../../domain/value-objects/edge-info';
import { normalizeCell } from '../../utils/cell-normalization.util';

@Injectable()
export class AppCellOperationConverterService {
  constructor(private logger: LoggerService) {}

  /**
   * Convert array of cells to graph operations by comparing with previous state
   * @param cells - Current cells
   * @param previousCells - Previous cell state for comparison
   * @param source - Source of the change ('user-interaction' | 'undo-redo')
   * @returns Array of graph operations
   */
  convertCellsToOperations(
    cells: Cell[],
    previousCells: Cell[],
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation[] {
    const operations: GraphOperation[] = [];

    // Handle additions and updates (cells in target state)
    cells.forEach(cell => {
      const previousCell = previousCells.find(c => c.id === cell.id);
      const operation = this.convertCellToOperation(cell, previousCell, source);

      if (operation) {
        operations.push(operation);
      }
    });

    // Handle deletions (cells in previous state but not in target state)
    previousCells.forEach(previousCell => {
      const cell = cells.find(c => c.id === previousCell.id);
      if (!cell) {
        // This cell needs to be deleted
        const deleteOperation = this.createDeleteOperation(previousCell, source);
        if (deleteOperation) {
          operations.push(deleteOperation);
        }
      }
    });

    return operations;
  }

  /**
   * Convert single cell to graph operation
   * @param cell - Current cell
   * @param previousCell - Previous cell state (undefined if new)
   * @param source - Source of the change
   * @returns Graph operation or null if no operation needed
   */
  convertCellToOperation(
    cell: Cell,
    previousCell: Cell | undefined,
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation | null {
    const baseOperation = {
      id: uuidv4(),
      source,
      priority: 'normal' as const,
      timestamp: Date.now(),
    };

    const isNode = cell.shape !== 'edge';

    // Determine operation type based on cell presence
    if (!previousCell) {
      // Cell was added
      if (isNode) {
        return this.createNodeOperation(cell, baseOperation);
      } else {
        return this.createEdgeOperation(cell, baseOperation);
      }
    } else {
      // Cell was updated
      if (isNode) {
        return this.createNodeUpdateOperation(cell, previousCell, baseOperation);
      } else {
        return this.createEdgeUpdateOperation(cell, previousCell, baseOperation);
      }
    }
  }

  /**
   * Create a node creation operation
   */
  createNodeOperation(cell: Cell, baseOperation: Partial<GraphOperation>): CreateNodeOperation {
    // Normalize cell to remove visual-only properties (filter effects, tools)
    const normalizedCell = normalizeCell(cell);

    // Extract label from X6 native attrs structure
    const label =
      normalizedCell.attrs &&
      typeof normalizedCell.attrs === 'object' &&
      'text' in normalizedCell.attrs
        ? (normalizedCell.attrs as any).text?.text
        : undefined;

    const nodeData: NodeData = {
      id: normalizedCell.id,
      nodeType: normalizedCell.shape,
      position: normalizedCell.position,
      size: normalizedCell.size,
      label: typeof label === 'string' ? label : undefined,
      style: normalizedCell.attrs as Record<string, any>,
      properties: {
        ...(normalizedCell as Record<string, any>),
        // Include additional X6 properties that may not be in our explicit fields
        ports: (normalizedCell as any).ports,
        data: (normalizedCell as any).data,
        visible: (normalizedCell as any).visible,
        zIndex: (normalizedCell as any).zIndex,
      },
    };

    return {
      ...baseOperation,
      type: 'create-node',
      nodeData,
    } as CreateNodeOperation;
  }

  /**
   * Create a node update operation
   */
  createNodeUpdateOperation(
    cell: Cell,
    previousCell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): UpdateNodeOperation {
    // Normalize cell to remove visual-only properties (filter effects, tools)
    const normalizedCell = normalizeCell(cell);

    // Extract label from X6 native attrs structure
    const label =
      normalizedCell.attrs &&
      typeof normalizedCell.attrs === 'object' &&
      'text' in normalizedCell.attrs
        ? (normalizedCell.attrs as any).text?.text
        : undefined;

    const nodeData: Partial<NodeData> = {
      id: normalizedCell.id,
      nodeType: normalizedCell.shape,
      position: normalizedCell.position,
      size: normalizedCell.size,
      label: typeof label === 'string' ? label : undefined,
      style: normalizedCell.attrs as Record<string, any>,
      properties: {
        ...(normalizedCell as Record<string, any>),
        // Include additional X6 properties that may not be in our explicit fields
        ports: (normalizedCell as any).ports,
        data: (normalizedCell as any).data,
        visible: (normalizedCell as any).visible,
        zIndex: (normalizedCell as any).zIndex,
      },
    };

    return {
      ...baseOperation,
      type: 'update-node',
      nodeId: normalizedCell.id,
      updates: nodeData,
    } as UpdateNodeOperation;
  }

  /**
   * Create an edge creation operation
   */
  createEdgeOperation(cell: Cell, baseOperation: Partial<GraphOperation>): CreateEdgeOperation {
    // Normalize cell to remove visual-only properties (filter effects, tools)
    const normalizedCell = normalizeCell(cell);

    // Extract source and target node IDs for legacy field support
    const sourceNodeId =
      typeof normalizedCell.source === 'object' && normalizedCell.source !== null
        ? (normalizedCell.source as any).cell
        : '';
    const targetNodeId =
      typeof normalizedCell.target === 'object' && normalizedCell.target !== null
        ? (normalizedCell.target as any).cell
        : '';
    const sourcePortId =
      typeof normalizedCell.source === 'object' && normalizedCell.source !== null
        ? (normalizedCell.source as any).port
        : undefined;
    const targetPortId =
      typeof normalizedCell.target === 'object' && normalizedCell.target !== null
        ? (normalizedCell.target as any).port
        : undefined;

    // Use EdgeInfo.fromJSON to handle both new and legacy format
    const edgeInfo = EdgeInfo.fromJSON({
      id: normalizedCell.id,
      source: normalizedCell.source as any,
      target: normalizedCell.target as any,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      vertices: (normalizedCell as any).vertices || [],
      attrs: normalizedCell.attrs as Record<string, any>,
      labels: (normalizedCell as any).labels || [],
      // Include additional X6 properties
      connector: (normalizedCell as any).connector,
      router: (normalizedCell as any).router,
      zIndex: (normalizedCell as any).zIndex,
      data: (normalizedCell as any).data,
    });

    return {
      ...baseOperation,
      type: 'create-edge',
      edgeInfo,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
    } as CreateEdgeOperation;
  }

  /**
   * Create an edge update operation
   */
  createEdgeUpdateOperation(
    cell: Cell,
    previousCell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): UpdateEdgeOperation {
    // Normalize cell to remove visual-only properties (filter effects, tools)
    const normalizedCell = normalizeCell(cell);

    const edgeInfo: Partial<EdgeInfo> = {
      id: normalizedCell.id,
      source:
        typeof normalizedCell.source === 'object' && normalizedCell.source !== null
          ? (normalizedCell.source as any)
          : undefined,
      target:
        typeof normalizedCell.target === 'object' && normalizedCell.target !== null
          ? (normalizedCell.target as any)
          : undefined,
      vertices: (normalizedCell as any).vertices,
      attrs: normalizedCell.attrs as Record<string, any>,
      labels: (normalizedCell as any).labels || [],
      // Include additional X6 properties
      connector: (normalizedCell as any).connector,
      router: (normalizedCell as any).router,
      zIndex: (normalizedCell as any).zIndex,
      data: (normalizedCell as any).data,
    };

    return {
      ...baseOperation,
      type: 'update-edge',
      edgeId: normalizedCell.id,
      updates: edgeInfo,
    } as UpdateEdgeOperation;
  }

  /**
   * Create a delete operation
   */
  createDeleteOperation(cell: Cell, source: 'user-interaction' | 'undo-redo'): GraphOperation {
    const baseOperation = {
      id: uuidv4(),
      source,
      priority: 'normal' as const,
      timestamp: Date.now(),
    };

    const isNode = cell.shape !== 'edge';

    if (isNode) {
      return {
        ...baseOperation,
        type: 'delete-node',
        nodeId: cell.id,
      } as GraphOperation;
    } else {
      return {
        ...baseOperation,
        type: 'delete-edge',
        edgeId: cell.id,
      } as GraphOperation;
    }
  }
}
