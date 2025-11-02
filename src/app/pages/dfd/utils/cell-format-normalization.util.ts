/**
 * Cell format normalization utilities
 *
 * Normalizes cells from nested format (position/size objects) to X6 native flat format (x,y,width,height).
 * Accepts both formats as input, outputs X6 native flat format for consistency.
 *
 * The API accepts both formats for backward compatibility but always returns flat format.
 * This utility ensures all cells loaded from the API are in X6's native format.
 */

import { Cell } from '../../../core/types/websocket-message.types';

/**
 * Normalizes a single cell from nested format to flat format
 * - If cell has position object {x, y}, converts to flat x, y properties
 * - If cell has size object {width, height}, converts to flat width, height properties
 * - If cell already has flat format, leaves it unchanged
 * - Removes the position/size objects after conversion to avoid duplication
 *
 * @param cell - Cell in either nested or flat format
 * @returns Cell in X6 native flat format
 */
export function normalizeCellFormat(cell: Cell): Cell {
  // Create a shallow copy to avoid mutating the original
  const normalized = { ...cell };

  // Convert nested position {x, y} to flat x, y properties
  if (normalized.position && typeof normalized.position === 'object') {
    const position = normalized.position as { x: number; y: number };
    normalized['x'] = position.x;
    normalized['y'] = position.y;
    // Remove position object to avoid format duplication
    delete normalized.position;
  }

  // Convert nested size {width, height} to flat width, height properties
  if (normalized.size && typeof normalized.size === 'object') {
    const size = normalized.size as { width: number; height: number };
    normalized['width'] = size.width;
    normalized['height'] = size.height;
    // Remove size object to avoid format duplication
    delete normalized.size;
  }

  return normalized;
}

/**
 * Normalizes an array of cells from nested format to flat format
 * Useful when loading diagram cells from the API
 *
 * @param cells - Array of cells in either nested or flat format
 * @returns Array of cells in X6 native flat format
 */
export function normalizeCellsFormat(cells: Cell[]): Cell[] {
  if (!Array.isArray(cells)) {
    return [];
  }
  return cells.map(cell => normalizeCellFormat(cell));
}
