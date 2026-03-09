/**
 * Label Position Types
 *
 * Types, constants, and utilities for node label positioning in DFD diagrams.
 * Maps a 3x3 grid of positions (top/middle/bottom × left/center/right)
 * to X6 text attributes (refX, refY, textAnchor, textVerticalAnchor).
 */

export type LabelHorizontalPosition = 'left' | 'center' | 'right';
export type LabelVerticalPosition = 'top' | 'middle' | 'bottom';

export interface LabelPosition {
  horizontal: LabelHorizontalPosition;
  vertical: LabelVerticalPosition;
}

export interface LabelPositionAttrs {
  refX: string;
  refY: string;
  textAnchor: 'start' | 'middle' | 'end';
  textVerticalAnchor: 'top' | 'middle' | 'bottom';
}

/**
 * Maps a label position key (e.g. 'top-center') to the four X6 text attrs.
 * Uses 5%/95% padding to keep text from touching node boundaries.
 */
export const LABEL_POSITION_ATTRS: Record<string, LabelPositionAttrs> = {
  'top-left': { refX: '5%', refY: '5%', textAnchor: 'start', textVerticalAnchor: 'top' },
  'top-center': { refX: '50%', refY: '5%', textAnchor: 'middle', textVerticalAnchor: 'top' },
  'top-right': { refX: '95%', refY: '5%', textAnchor: 'end', textVerticalAnchor: 'top' },
  'middle-left': { refX: '5%', refY: '50%', textAnchor: 'start', textVerticalAnchor: 'middle' },
  'middle-center': {
    refX: '50%',
    refY: '50%',
    textAnchor: 'middle',
    textVerticalAnchor: 'middle',
  },
  'middle-right': { refX: '95%', refY: '50%', textAnchor: 'end', textVerticalAnchor: 'middle' },
  'bottom-left': { refX: '5%', refY: '95%', textAnchor: 'start', textVerticalAnchor: 'bottom' },
  'bottom-center': {
    refX: '50%',
    refY: '95%',
    textAnchor: 'middle',
    textVerticalAnchor: 'bottom',
  },
  'bottom-right': { refX: '95%', refY: '95%', textAnchor: 'end', textVerticalAnchor: 'bottom' },
};

/** All vertical positions in display order */
export const VERTICAL_POSITIONS: LabelVerticalPosition[] = ['top', 'middle', 'bottom'];

/** All horizontal positions in display order */
export const HORIZONTAL_POSITIONS: LabelHorizontalPosition[] = ['left', 'center', 'right'];

/**
 * Build a position key string from a LabelPosition.
 */
export function getLabelPositionKey(position: LabelPosition): string {
  return `${position.vertical}-${position.horizontal}`;
}

/**
 * Reverse-map X6 text attrs to a LabelPosition.
 * Returns null if the attrs don't match any standard position.
 *
 * Handles the store shape's special refY: '55%' by treating it as '50%'
 * for the purpose of position detection.
 */
export function getLabelPositionFromAttrs(attrs: Record<string, unknown>): LabelPosition | null {
  const refX = typeof attrs['refX'] === 'string' ? attrs['refX'] : '50%';
  // Store shapes use refY: '55%' as their default center; treat as '50%'
  let refY = typeof attrs['refY'] === 'string' ? attrs['refY'] : '50%';
  if (refY === '55%') {
    refY = '50%';
  }
  const textAnchor = typeof attrs['textAnchor'] === 'string' ? attrs['textAnchor'] : 'middle';
  const textVerticalAnchor =
    typeof attrs['textVerticalAnchor'] === 'string' ? attrs['textVerticalAnchor'] : 'middle';

  for (const [key, posAttrs] of Object.entries(LABEL_POSITION_ATTRS)) {
    if (
      posAttrs.refX === refX &&
      posAttrs.refY === refY &&
      posAttrs.textAnchor === textAnchor &&
      posAttrs.textVerticalAnchor === textVerticalAnchor
    ) {
      const [vertical, horizontal] = key.split('-') as [
        LabelVerticalPosition,
        LabelHorizontalPosition,
      ];
      return { vertical, horizontal };
    }
  }

  return null;
}
