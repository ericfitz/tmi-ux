/**
 * Icon Placement Types
 *
 * Types, constants, and utilities for architecture icon positioning in DFD shapes.
 * Mirrors the label position system (label-position.types.ts) with a 3x3 grid.
 */

// SEM@dc084b634928b55911a21b811b60f0cd404fa989: enumerate valid horizontal positions for a diagram icon (pure)
export type IconHorizontalPosition = 'left' | 'center' | 'right';
// SEM@dc084b634928b55911a21b811b60f0cd404fa989: enumerate valid vertical positions for a diagram icon (pure)
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

/** Vertical gap (in pixels) between the icon's bottom edge and the label's top edge */
export const LABEL_ICON_PADDING = 6;

/**
 * Label attrs derived from an icon's placement. The label is always horizontally
 * centered on the icon and sits below it with LABEL_ICON_PADDING gap, regardless
 * of which 3x3 placement cell the icon occupies.
 */
export interface LabelAttrsForIcon {
  refX: string;
  refY: string;
  refX2: number;
  refY2: number;
  textAnchor: 'middle';
  textVerticalAnchor: 'top';
}

// SEM@b014e6403262ba7b21b0a0dc67becd79d03bd878: compute X6 label text attrs centered below an icon placement (pure)
export function getLabelAttrsForIconPlacement(placement: IconPlacement): LabelAttrsForIcon {
  const key = getIconPlacementKey(placement);
  const iconAttrs = ICON_PLACEMENT_ATTRS[key];
  return {
    refX: iconAttrs.refX,
    refY: iconAttrs.refY,
    refX2: 0,
    refY2: ICON_SIZE / 2 + LABEL_ICON_PADDING,
    textAnchor: 'middle',
    textVerticalAnchor: 'top',
  };
}

/**
 * Default label attrs by shape, used to restore label position after the
 * architecture icon is removed. Mirrors the text attrs declared in
 * infra-x6-shape-definitions.ts.
 */
export interface DefaultLabelAttrs {
  refX: string;
  refY: string;
}

export const DEFAULT_LABEL_ATTRS_BY_SHAPE: Record<string, DefaultLabelAttrs> = {
  // store has refY=55% to clear the cylinder's top ellipse
  store: { refX: '50%', refY: '55%' },
  actor: { refX: '50%', refY: '50%' },
  process: { refX: '50%', refY: '50%' },
  'security-boundary': { refX: '50%', refY: '50%' },
};

/**
 * Build a placement key from an IconPlacement.
 */
// SEM@dc084b634928b55911a21b811b60f0cd404fa989: convert an icon placement to its string lookup key (pure)
export function getIconPlacementKey(placement: IconPlacement): string {
  return `${placement.vertical}-${placement.horizontal}`;
}

/**
 * Parse a placement key (e.g. 'top-left') into an IconPlacement.
 * Returns null if the key is invalid.
 */
// SEM@dc084b634928b55911a21b811b60f0cd404fa989: parse a placement key string into an icon placement, or null if invalid (pure)
export function getIconPlacementFromKey(key: string): IconPlacement | null {
  if (!key || !ICON_PLACEMENT_ATTRS[key]) {
    return null;
  }
  const [vertical, horizontal] = key.split('-') as [IconVerticalPosition, IconHorizontalPosition];
  return { vertical, horizontal };
}
