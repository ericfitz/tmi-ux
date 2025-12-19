/**
 * Cell normalization utilities for diagram persistence
 *
 * Normalizes cell data before saving to ensure consistency:
 * - Sanitizes cells using comprehensive property filter (removes visual effects, tools, etc.)
 * - Rounds position and size coordinates to integers
 * - For edges: keeps only the first label
 *
 * This utility expects cells in X6 v2 native nested format (position/size objects).
 * Use cell-format-normalization.util.ts to convert legacy flat format before using this.
 */

import { Cell } from '../../../core/types/websocket-message.types';
import { sanitizeCell } from './cell-property-filter.util';

/**
 * Normalizes a single cell for persistence
 * Expects cell in X6 v2 nested format with position {x, y} and size {width, height}
 */
export function normalizeCell(cell: Cell): Cell {
  // First, sanitize the cell using the comprehensive property filter
  // This removes all excluded properties (visual effects, tools, zIndex, port visibility, etc.)
  let normalized = sanitizeCell(cell);

  // Round position coordinates to nearest integer
  if (normalized.position) {
    normalized.position = {
      x: Math.round(normalized.position.x),
      y: Math.round(normalized.position.y),
    };
  }

  // Round size dimensions to nearest integer
  if (normalized.size) {
    normalized.size = {
      width: Math.round(normalized.size.width),
      height: Math.round(normalized.size.height),
    };
  }

  // For edges: keep only the first label
  if (normalized.shape === 'edge' && Array.isArray(normalized['labels'])) {
    if (normalized['labels'].length > 0) {
      normalized['labels'] = [normalized['labels'][0]];
    }
  }

  return normalized;
}

/**
 * Normalizes an array of cells for persistence
 */
export function normalizeCells(cells: Cell[]): Cell[] {
  return cells.map(cell => normalizeCell(cell));
}
