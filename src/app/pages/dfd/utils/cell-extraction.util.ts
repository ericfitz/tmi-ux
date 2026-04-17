/**
 * Cell extraction utility for DFD diagram persistence
 *
 * Extracts cells from an X6 graph instance using direct cell API methods
 * (cell.getAttrs(), cell.position(), etc.) instead of graph.toJSON().
 *
 * graph.toJSON() strips attrs that match registered shape defaults, which
 * causes user-set colors identical to defaults to be lost. This utility
 * reads from the cell instance store directly, preserving all attrs.
 *
 * Output format: X6 v2 nested format with position {x, y} and size {width, height}.
 * Compatible with normalizeCells() and sanitizeCellForApi().
 */

import { Graph } from '@antv/x6';
import { Cell } from '../../../core/types/websocket-message.types';
import { CANONICAL_EDGE_SHAPE } from './cell-property-filter.util';

/**
 * Extract all cells from an X6 graph with complete attrs.
 *
 * Uses cell.getAttrs() which returns the instance store as-is,
 * unlike graph.toJSON() which omits attrs matching shape defaults.
 *
 * @param graph The X6 graph instance
 * @returns Array of cells in X6 v2 nested format
 */
export function extractCellsFromGraph(graph: Graph): Cell[] {
  const graphCells = graph.getCells();
  const cells: Cell[] = [];

  for (const cell of graphCells) {
    try {
      if (cell.isNode()) {
        cells.push(extractNode(cell, graphCells));
      } else if (cell.isEdge()) {
        cells.push(extractEdge(cell));
      }
    } catch {
      // Skip cells that fail to extract — logged at call site
    }
  }

  return cells;
}

/**
 * Extract a node cell with complete attrs and nested position/size format.
 */
function extractNode(cell: any, allCells: any[]): Cell {
  const attrs = cell.getAttrs() || {};
  const pos = cell.position();
  const sz = cell.size();

  const nodeCell: Cell = {
    id: cell.id,
    shape: cell.shape,
    position: { x: pos.x, y: pos.y },
    size: { width: sz.width, height: sz.height },
    zIndex: cell.getZIndex(),
    visible: true,
    attrs: {
      body: { ...(attrs.body || {}) },
      text: { ...(attrs.text || {}) },
    },
    ports: cleanPortsForSave(cell.getProp('ports')),
    data: convertCellData(cell.getData()),
  };

  // Parent reference for embedded nodes
  const parent = cell.getParent();
  if (parent && parent.isNode()) {
    nodeCell['parent'] = parent.id;
  }

  // Children references
  const children = allCells.filter(c => c.isNode() && c.getParent()?.id === cell.id);
  if (children.length > 0) {
    nodeCell['children'] = children.map((c: any) => c.id);
  }

  return nodeCell;
}

/**
 * Extract an edge cell with source/target/vertices.
 */
function extractEdge(cell: any): Cell {
  const source = cell.getSource();
  const target = cell.getTarget();
  const attrs = cell.getAttrs() || {};

  const edgeCell: Cell = {
    id: cell.id,
    shape: CANONICAL_EDGE_SHAPE,
    source: {
      cell: source?.cell,
      port: source?.port,
    },
    target: {
      cell: target?.cell,
      port: target?.port,
    },
    vertices: cell.getVertices(),
    zIndex: cell.getZIndex(),
    attrs: {
      line: { ...(attrs.line || {}) },
    },
    data: convertCellData(cell.getData()),
  };

  // Labels
  const labels = cell.getLabels ? cell.getLabels() : [];
  if (labels && labels.length > 0) {
    edgeCell['labels'] = labels;
  }

  return edgeCell;
}

/**
 * Convert cell data to hybrid format for API persistence.
 * Mirrors the logic from AppDiagramService.convertCellDataToArray().
 */
function convertCellData(cellData: any): any {
  if (!cellData) {
    return { _metadata: [] };
  }
  const { metadata, _metadata, ...rest } = cellData;
  let meta = _metadata;
  if (!meta && metadata) {
    if (Array.isArray(metadata)) {
      meta = metadata;
    } else if (typeof metadata === 'object') {
      meta = Object.entries(metadata).map(([key, value]) => ({ key, value: String(value) }));
    }
  }
  return { ...rest, _metadata: meta ?? [] };
}

/**
 * Strip runtime-only port state before saving.
 * Removes visibility toggles that are runtime-only state.
 */
function cleanPortsForSave(ports: any): any {
  if (!ports || !ports.items) {
    return undefined;
  }

  return {
    ...ports,
    items: ports.items.map((port: any) => {
      const cleaned = { ...port };
      // Remove runtime visibility state
      if (cleaned.attrs?.circle) {
        const { style, ...rest } = cleaned.attrs.circle;
        if (Object.keys(rest).length > 0) {
          cleaned.attrs = { ...cleaned.attrs, circle: rest };
        }
      }
      return cleaned;
    }),
  };
}
