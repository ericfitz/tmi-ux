/**
 * Cell format normalization utilities
 *
 * Normalizes cells from X6 v1 legacy flat format (x,y,width,height) to X6 v2 native nested format (position/size objects).
 * Accepts both formats as input, outputs X6 v2 native nested format for consistency.
 *
 * The API accepts both formats for backward compatibility but prefers nested format.
 * This utility ensures all cells loaded from the API are in X6 v2's native format.
 */

import { Cell } from '../../../core/types/websocket-message.types';

/**
 * Normalizes a single cell from flat format to nested format
 * - If cell has flat x, y properties, converts to nested position {x, y} object
 * - If cell has flat width, height properties, converts to nested size {width, height} object
 * - If cell already has nested format, leaves it unchanged
 * - Removes the flat x/y/width/height properties after conversion to avoid duplication
 * - Rounds all coordinates to nearest integer
 *
 * @param cell - Cell in either flat (X6 v1) or nested (X6 v2) format
 * @returns Cell in X6 v2 native nested format with rounded coordinates
 */
export function normalizeCellFormat(cell: Cell): Cell {
  // Create a shallow copy to avoid mutating the original
  const normalized = { ...cell };

  // Convert flat x, y properties to nested position {x, y} object
  if (normalized['x'] !== undefined && normalized['y'] !== undefined && !normalized.position) {
    normalized.position = {
      x: Math.round(normalized['x']),
      y: Math.round(normalized['y']),
    };
    // Remove flat properties to avoid format duplication
    delete normalized['x'];
    delete normalized['y'];
  } else if (normalized.position) {
    // If position already exists, ensure it's rounded
    normalized.position = {
      x: Math.round(normalized.position.x),
      y: Math.round(normalized.position.y),
    };
  }

  // Convert flat width, height properties to nested size {width, height} object
  if (normalized['width'] !== undefined && normalized['height'] !== undefined && !normalized.size) {
    normalized.size = {
      width: Math.round(normalized['width']),
      height: Math.round(normalized['height']),
    };
    // Remove flat properties to avoid format duplication
    delete normalized['width'];
    delete normalized['height'];
  } else if (normalized.size) {
    // If size already exists, ensure it's rounded
    normalized.size = {
      width: Math.round(normalized.size.width),
      height: Math.round(normalized.size.height),
    };
  }

  return normalized;
}

/**
 * Normalizes an array of cells from flat format to nested format
 * Useful when loading diagram cells from the API
 *
 * @param cells - Array of cells in either flat (X6 v1) or nested (X6 v2) format
 * @returns Array of cells in X6 v2 native nested format
 */
export function normalizeCellsFormat(cells: Cell[]): Cell[] {
  if (!Array.isArray(cells)) {
    return [];
  }
  return cells.map(cell => normalizeCellFormat(cell));
}
