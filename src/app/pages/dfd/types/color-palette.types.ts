/**
 * Color Palette Types
 *
 * Matches the API schema for diagram color palettes.
 * Colors use lowercase 6-digit hex (#rrggbb) to match server convention.
 */

/**
 * A single entry in a diagram's custom color palette.
 * Position is 1-indexed and stable — it identifies the slot, not display order.
 */
export interface ColorPaletteEntry {
  /** Display order position (1-8) */
  position: number;
  /** Hex color (#RGB or #RRGGBB). Server normalizes to lowercase 6-digit. */
  color: string;
}

/** Maximum number of diagram-specific colors */
export const MAX_DIAGRAM_COLORS = 8;

/** Placeholder color for new diagram color slots */
export const PLACEHOLDER_COLOR = '#9e9e9e';

/**
 * Normalize a hex color to lowercase 6-digit format to match server convention.
 * Handles #RGB -> #rrggbb expansion and case normalization.
 */
export function normalizeHexColor(color: string): string {
  const lower = color.toLowerCase();
  // Expand 3-digit to 6-digit: #abc -> #aabbcc
  if (/^#[0-9a-f]{3}$/.test(lower)) {
    return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
  }
  return lower;
}

/**
 * Get the next available position (1-8) for a new palette entry.
 * Returns null if all 8 positions are occupied.
 */
export function nextAvailablePosition(entries: ColorPaletteEntry[]): number | null {
  const usedPositions = new Set(entries.map(e => e.position));
  for (let i = 1; i <= MAX_DIAGRAM_COLORS; i++) {
    if (!usedPositions.has(i)) return i;
  }
  return null;
}
