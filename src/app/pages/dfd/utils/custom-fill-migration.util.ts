/**
 * Custom Fill Migration Utility
 *
 * Diagrams saved before the `customFill` node flag existed marked every
 * style-panel change (including stroke-only) with `customStyles`. This helper
 * infers `customFill` for such nodes from their current fill so embedding
 * shading is only suppressed for nodes whose fill the user actually chose.
 */

import type { Cell } from '@antv/x6';

/** Embedding-derived appearance, as computed by `InfraEmbeddingService`. */
export interface EmbeddingShading {
  fillColor: (depth: number) => string;
  opacity: (depth: number) => number;
}

/** Deepest embedding level considered when matching embedding shades. */
const MAX_INFERRED_EMBEDDING_DEPTH = 10;

/**
 * Normalize a CSS color (hex, rgb(), or keyword) to a comparable key.
 */
export function normalizeColor(color: unknown): string {
  if (typeof color !== 'string') {
    return '';
  }
  const value = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map(c => c + c)
            .join('')
        : hex[1];
    const r = parseInt(digits.slice(0, 2), 16);
    const g = parseInt(digits.slice(2, 4), 16);
    const b = parseInt(digits.slice(4, 6), 16);
    return `rgb(${r},${g},${b})`;
  }
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(value);
  if (rgb) {
    return `rgb(${Number(rgb[1])},${Number(rgb[2])},${Number(rgb[3])})`;
  }
  return value;
}

/**
 * Infer whether a node's current fill/opacity were chosen by the user rather
 * than being the shape default or an embedding shade.
 */
export function inferCustomFill(
  nodeType: string,
  fill: unknown,
  fillOpacity: unknown,
  shading: EmbeddingShading,
): boolean {
  const defaultFill = nodeType === 'text-box' ? 'transparent' : '#FFFFFF';
  const knownFills = new Set<string>([normalizeColor(defaultFill)]);
  const knownOpacities = new Set<number>([1]);
  for (let depth = 1; depth <= MAX_INFERRED_EMBEDDING_DEPTH; depth++) {
    knownFills.add(normalizeColor(shading.fillColor(depth)));
    knownOpacities.add(shading.opacity(depth));
  }

  if (typeof fill === 'string' && fill.trim() !== '' && !knownFills.has(normalizeColor(fill))) {
    return true;
  }

  if (typeof fillOpacity === 'number') {
    const matchesKnown = [...knownOpacities].some(o => Math.abs(o - fillOpacity) < 1e-9);
    if (!matchesKnown) {
      return true;
    }
  }

  return false;
}

/**
 * Set `customFill` on every node that has `customStyles` but no `customFill`
 * yet. Non-node cells are ignored. Idempotent: nodes that already carry a
 * `customFill` value are left untouched. Returns the number of nodes updated.
 */
export function migrateCustomFillFlags(cells: Cell[], shading: EmbeddingShading): number {
  let migrated = 0;
  for (const cell of cells) {
    if (!cell.isNode()) {
      continue;
    }
    const data: Record<string, unknown> = cell.getData() ?? {};
    if (!data['customStyles'] || data['customFill'] !== undefined) {
      continue;
    }
    const nodeType = (data['nodeType'] as string | undefined) || cell.shape || 'process';
    const body: Record<string, unknown> = cell.getAttrByPath('body') ?? {};
    const customFill = inferCustomFill(nodeType, body['fill'], body['fillOpacity'], shading);
    cell.setData({ ...data, customFill }, { silent: true });
    migrated++;
  }
  return migrated;
}
