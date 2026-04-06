/**
 * Icon Placement Types
 *
 * Types, constants, and utilities for architecture icon positioning in DFD shapes.
 * Mirrors the label position system (label-position.types.ts) with a 3x3 grid.
 */

export type IconHorizontalPosition = 'left' | 'center' | 'right';
export type IconVerticalPosition = 'top' | 'middle' | 'bottom';

export interface IconPlacement {
  horizontal: IconHorizontalPosition;
  vertical: IconVerticalPosition;
}

export interface IconPlacementAttrs {
  refX: string;
  refY: string;
}

/**
 * Maps an icon placement key (e.g. 'middle-center') to X6 image positioning attrs.
 * Uses 15%/85% padding to keep icons from touching node boundaries.
 */
export const ICON_PLACEMENT_ATTRS: Record<string, IconPlacementAttrs> = {
  'top-left': { refX: '15%', refY: '15%' },
  'top-center': { refX: '50%', refY: '15%' },
  'top-right': { refX: '85%', refY: '15%' },
  'middle-left': { refX: '15%', refY: '50%' },
  'middle-center': { refX: '50%', refY: '50%' },
  'middle-right': { refX: '85%', refY: '50%' },
  'bottom-left': { refX: '15%', refY: '85%' },
  'bottom-center': { refX: '50%', refY: '85%' },
  'bottom-right': { refX: '85%', refY: '85%' },
};

/** All vertical positions in display order */
export const ICON_VERTICAL_POSITIONS: IconVerticalPosition[] = ['top', 'middle', 'bottom'];

/** All horizontal positions in display order */
export const ICON_HORIZONTAL_POSITIONS: IconHorizontalPosition[] = ['left', 'center', 'right'];

/** Icon size in pixels (square) */
export const ICON_SIZE = 32;

/**
 * Build a placement key from an IconPlacement.
 */
export function getIconPlacementKey(placement: IconPlacement): string {
  return `${placement.vertical}-${placement.horizontal}`;
}

/**
 * Parse a placement key (e.g. 'top-left') into an IconPlacement.
 * Returns null if the key is invalid.
 */
export function getIconPlacementFromKey(key: string): IconPlacement | null {
  if (!key || !ICON_PLACEMENT_ATTRS[key]) {
    return null;
  }
  const [vertical, horizontal] = key.split('-') as [IconVerticalPosition, IconHorizontalPosition];
  return { vertical, horizontal };
}
