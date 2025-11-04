/**
 * Cell normalization utilities for diagram persistence
 *
 * Normalizes cell data before saving to ensure consistency:
 * - Removes visual effect filters (text/filter, body/filter, line/filter, etc.)
 * - Removes the tools property (runtime UI-only state)
 * - Rounds position and size coordinates to integers
 * - For edges: keeps only the first label
 */

import { Cell } from '../../../core/types/websocket-message.types';

/**
 * Normalizes a single cell for persistence
 */
export function normalizeCell(cell: Cell): Cell {
  const normalized: Cell = { ...cell };

  // Remove all filter attributes from attrs
  if (normalized.attrs) {
    const filteredAttrs: Record<string, unknown> = {};
    Object.keys(normalized.attrs).forEach(key => {
      if (!key.endsWith('/filter')) {
        filteredAttrs[key] = normalized.attrs![key];
      }
    });
    normalized.attrs = filteredAttrs;
  }

  // Remove tools property (runtime UI-only state)
  delete normalized['tools'];

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
