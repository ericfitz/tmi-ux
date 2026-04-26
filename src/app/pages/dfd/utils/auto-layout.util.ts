/**
 * Auto-layout utility for DFD shapes with architecture icons (#638).
 *
 * Pure, x6-free functions:
 *  - icon-only fit geometry (single iconned shape, no children)
 *  - container fit geometry (shape with children, optionally with icon)
 *  - grid sizing rules (`(rows, cols)` from child count + orientation)
 *  - orientation inference from current graph layout
 *  - child sort by connection-port usage and by current position (drag-end)
 *
 * The dfd component owns x6 wiring; this module owns the math.
 */

export type Orientation = 'horizontal' | 'vertical';

/** Visible-icon dimensions inside the cell. Constant, see #96. */
export const ICON_SIZE = 32;

/** Default geometric constants for auto-layout. Tuned in the design doc. */
export const AUTO_LAYOUT_DEFAULTS = {
  outerPad: 12,
  iconGap: 12,
  gap: 12,
  labelGap: 4,
  labelLineHeightMultiplier: 1.3,
  refY2BottomTrim: 2,
} as const;

export interface ChildBox {
  id: string;
  width: number;
  height: number;
  ports: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  /** Used for drag-end re-sort. Optional otherwise. */
  x?: number;
  y?: number;
}

export interface IconColumn {
  /** True if the cell has an architecture icon (security boundary → false). */
  hasIcon: boolean;
  /**
   * Width that the icon column (horizontal orientation) or icon row
   * (vertical orientation) needs. For horizontal: max(ICON_SIZE, labelWidth).
   * For vertical: same — the icon row is as wide as the wider of icon vs label.
   */
  width: number;
  /**
   * Height needed for icon + label stack. For horizontal: ICON_SIZE + labelGap + labelLineHeight.
   * For vertical: same value.
   */
  height: number;
}

export interface AutoLayoutPadding {
  outer: number;
  iconGap: number;
  gap: number;
}

export interface IconAttrs {
  refX: number;
  refY: number;
  refX2: number;
  refY2: number;
}

export interface LabelAttrs {
  refX: number;
  refY: number;
  refX2: number;
  refY2: number;
  textAnchor: 'middle';
  textVerticalAnchor: 'top' | 'middle' | 'bottom';
}

export interface ContainerLayout {
  containerWidth: number;
  containerHeight: number;
  iconAttrs: IconAttrs | null;
  labelAttrs: LabelAttrs | null;
  childPositions: Array<{ id: string; x: number; y: number }>;
}

export interface IconOnlyFitGeometry {
  width: number;
  height: number;
  iconAttrs: IconAttrs;
  labelAttrs: LabelAttrs;
}

// ---------- grid sizing ----------

/**
 * Compute (rows, cols) for `n` children given an orientation.
 *
 * Horizontal: prefer cols >= rows; expand columns first when square.
 * Vertical:   prefer rows >= cols; expand rows first when square.
 *
 * Worked example (horizontal):
 *   n=1 → 1×1 ; n=2 → 1×2 ; n=3,4 → 2×2 ; n=5,6 → 2×3 ;
 *   n=7..9 → 3×3 ; n=10..12 → 3×4 ; n=13..16 → 4×4 ; ...
 */
export function gridDimensions(
  n: number,
  orientation: Orientation,
): { rows: number; cols: number } {
  if (n <= 0) return { rows: 0, cols: 0 };
  let rows = orientation === 'horizontal' ? 1 : 0;
  let cols = orientation === 'horizontal' ? 0 : 1;
  while (rows * cols < n) {
    if (orientation === 'horizontal') {
      if (cols <= rows) cols++;
      else rows++;
    } else {
      if (rows <= cols) rows++;
      else cols++;
    }
  }
  return { rows, cols };
}

// ---------- orientation inference ----------

interface NodeBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Infer graph orientation from current top-level node positions.
 * Fewer than 2 nodes → 'horizontal'. Equal spans → 'horizontal'.
 */
export function inferOrientation(nodes: NodeBBox[]): Orientation {
  if (nodes.length < 2) return 'horizontal';
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y < minY) minY = n.y;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  return maxX - minX >= maxY - minY ? 'horizontal' : 'vertical';
}

// ---------- sort ----------

/**
 * Bias score per axis: +1 if only the "leading" port is used,
 * -1 if only the "trailing" port is used, 0 otherwise.
 *
 * Vertical leading=top, trailing=bottom. Horizontal leading=left, trailing=right.
 */
function verticalBias(p: ChildBox['ports']): number {
  if (p.top && !p.bottom) return 1;
  if (p.bottom && !p.top) return -1;
  return 0;
}

function horizontalBias(p: ChildBox['ports']): number {
  if (p.left && !p.right) return 1;
  if (p.right && !p.left) return -1;
  return 0;
}

/**
 * Sort children by which connection ports they use. The orientation
 * determines which axis is primary:
 *  - horizontal: primary = vertical bias (top→top of grid, bottom→bottom)
 *                secondary = horizontal bias (left→left col, right→right col)
 *  - vertical:   primary and secondary swapped
 *
 * Stable sort preserves insertion order for ties.
 */
export function sortChildrenByPorts(children: ChildBox[], orientation: Orientation): ChildBox[] {
  const indexed = children.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => {
    const aV = verticalBias(a.c.ports);
    const bV = verticalBias(b.c.ports);
    const aH = horizontalBias(a.c.ports);
    const bH = horizontalBias(b.c.ports);
    if (orientation === 'horizontal') {
      if (bV !== aV) return bV - aV;
      if (bH !== aH) return bH - aH;
    } else {
      if (bH !== aH) return bH - aH;
      if (bV !== aV) return bV - aV;
    }
    return a.i - b.i;
  });
  return indexed.map(({ c }) => c);
}

/**
 * Sort children by current position (used after a drag).
 *
 * Horizontal: row-major (y primary, x secondary).
 * Vertical:   column-major (x primary, y secondary).
 *
 * Children missing x/y fall to the end (stable).
 */
export function sortChildrenByPosition(children: ChildBox[], orientation: Orientation): ChildBox[] {
  const indexed = children.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => {
    const aHasPos = a.c.x !== undefined && a.c.y !== undefined;
    const bHasPos = b.c.x !== undefined && b.c.y !== undefined;
    if (!aHasPos && !bHasPos) return a.i - b.i;
    if (!aHasPos) return 1;
    if (!bHasPos) return -1;
    const ax = a.c.x as number;
    const ay = a.c.y as number;
    const bx = b.c.x as number;
    const by = b.c.y as number;
    if (orientation === 'horizontal') {
      if (ay !== by) return ay - by;
      return ax - bx;
    }
    if (ax !== bx) return ax - bx;
    return ay - by;
  });
  return indexed.map(({ c }) => c);
}

// ---------- icon-only fit ----------

export function iconOnlyFitGeometry(labelLineHeight: number): IconOnlyFitGeometry {
  const width = ICON_SIZE;
  const height = ICON_SIZE + labelLineHeight;
  return {
    width,
    height,
    iconAttrs: { refX: 0, refY: 0, refX2: (width - ICON_SIZE) / 2, refY2: 0 },
    labelAttrs: {
      refX: width / 2,
      refY: height,
      refX2: 0,
      refY2: -AUTO_LAYOUT_DEFAULTS.refY2BottomTrim,
      textAnchor: 'middle',
      textVerticalAnchor: 'bottom',
    },
  };
}

// ---------- container fit ----------

/**
 * Build a container layout for the given pre-sorted children.
 *
 * The caller is responsible for choosing which sort to apply
 * (sortChildrenByPorts on first apply; sortChildrenByPosition after a drag).
 */
export function layoutContainer(
  iconCol: IconColumn,
  sortedChildren: ChildBox[],
  orientation: Orientation,
  padding: AutoLayoutPadding,
  labelLineHeight: number,
): ContainerLayout {
  const { rows, cols } = gridDimensions(sortedChildren.length, orientation);

  const colWidths = computeColWidths(sortedChildren, rows, cols);
  const rowHeights = computeRowHeights(sortedChildren, rows, cols);
  const gridWidth = sumWithGaps(colWidths, padding.gap);
  const gridHeight = sumWithGaps(rowHeights, padding.gap);

  if (orientation === 'horizontal') {
    return layoutHorizontal(
      iconCol,
      sortedChildren,
      rows,
      cols,
      colWidths,
      rowHeights,
      gridWidth,
      gridHeight,
      padding,
      labelLineHeight,
    );
  }
  return layoutVertical(
    iconCol,
    sortedChildren,
    rows,
    cols,
    colWidths,
    rowHeights,
    gridWidth,
    gridHeight,
    padding,
    labelLineHeight,
  );
}

function layoutHorizontal(
  iconCol: IconColumn,
  children: ChildBox[],
  rows: number,
  cols: number,
  colWidths: number[],
  rowHeights: number[],
  gridWidth: number,
  gridHeight: number,
  padding: AutoLayoutPadding,
  labelLineHeight: number,
): ContainerLayout {
  const innerHeight = Math.max(iconCol.height, gridHeight);
  const containerWidth =
    padding.outer * 2 + iconCol.width + (iconCol.width > 0 ? padding.iconGap : 0) + gridWidth;
  const containerHeight = padding.outer * 2 + innerHeight;

  const iconColLeft = padding.outer;
  const iconColTop = padding.outer + (innerHeight - iconCol.height) / 2;

  const gridLeft = padding.outer + iconCol.width + (iconCol.width > 0 ? padding.iconGap : 0);
  const gridTop = padding.outer + (innerHeight - gridHeight) / 2;

  const iconAttrs = iconCol.hasIcon
    ? buildIconAttrs(iconColLeft + iconCol.width / 2, iconColTop)
    : null;
  const labelAttrs = iconCol.hasIcon
    ? buildLabelAttrs(
        iconColLeft + iconCol.width / 2,
        iconColTop + ICON_SIZE + AUTO_LAYOUT_DEFAULTS.labelGap,
        labelLineHeight,
      )
    : null;

  const childPositions = placeChildren(
    children,
    rows,
    cols,
    colWidths,
    rowHeights,
    padding.gap,
    gridLeft,
    gridTop,
  );

  return { containerWidth, containerHeight, iconAttrs, labelAttrs, childPositions };
}

function layoutVertical(
  iconCol: IconColumn,
  children: ChildBox[],
  rows: number,
  cols: number,
  colWidths: number[],
  rowHeights: number[],
  gridWidth: number,
  gridHeight: number,
  padding: AutoLayoutPadding,
  labelLineHeight: number,
): ContainerLayout {
  const innerWidth = Math.max(iconCol.width, gridWidth);
  const containerWidth = padding.outer * 2 + innerWidth;
  const containerHeight =
    padding.outer * 2 + iconCol.height + (iconCol.height > 0 ? padding.iconGap : 0) + gridHeight;

  const iconRowLeft = padding.outer + (innerWidth - iconCol.width) / 2;
  const iconRowTop = padding.outer;

  const gridLeft = padding.outer + (innerWidth - gridWidth) / 2;
  const gridTop = padding.outer + iconCol.height + (iconCol.height > 0 ? padding.iconGap : 0);

  const iconAttrs = iconCol.hasIcon
    ? buildIconAttrs(iconRowLeft + iconCol.width / 2, iconRowTop)
    : null;
  const labelAttrs = iconCol.hasIcon
    ? buildLabelAttrs(
        iconRowLeft + iconCol.width / 2,
        iconRowTop + ICON_SIZE + AUTO_LAYOUT_DEFAULTS.labelGap,
        labelLineHeight,
      )
    : null;

  const childPositions = placeChildren(
    children,
    rows,
    cols,
    colWidths,
    rowHeights,
    padding.gap,
    gridLeft,
    gridTop,
  );

  return { containerWidth, containerHeight, iconAttrs, labelAttrs, childPositions };
}

function placeChildren(
  children: ChildBox[],
  rows: number,
  cols: number,
  colWidths: number[],
  rowHeights: number[],
  gap: number,
  gridLeft: number,
  gridTop: number,
): Array<{ id: string; x: number; y: number }> {
  const positions: Array<{ id: string; x: number; y: number }> = [];
  for (let i = 0; i < children.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (r >= rows) break; // safety; gridDimensions guarantees rows*cols >= n
    const cellLeft = gridLeft + sumRange(colWidths, 0, c) + c * gap;
    const cellTop = gridTop + sumRange(rowHeights, 0, r) + r * gap;
    const child = children[i];
    const x = cellLeft + (colWidths[c] - child.width) / 2;
    const y = cellTop + (rowHeights[r] - child.height) / 2;
    positions.push({ id: child.id, x, y });
  }
  return positions;
}

function buildIconAttrs(centerX: number, topY: number): IconAttrs {
  return {
    refX: centerX - ICON_SIZE / 2,
    refY: topY,
    refX2: 0,
    refY2: 0,
  };
}

function buildLabelAttrs(centerX: number, topY: number, labelLineHeight: number): LabelAttrs {
  return {
    refX: centerX,
    refY: topY + labelLineHeight,
    refX2: 0,
    refY2: -AUTO_LAYOUT_DEFAULTS.refY2BottomTrim,
    textAnchor: 'middle',
    textVerticalAnchor: 'bottom',
  };
}

function computeColWidths(children: ChildBox[], rows: number, cols: number): number[] {
  if (cols === 0) return [];
  const widths = new Array(cols).fill(0);
  for (let i = 0; i < children.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (r >= rows) break;
    if (children[i].width > widths[c]) widths[c] = children[i].width;
  }
  return widths;
}

function computeRowHeights(children: ChildBox[], rows: number, cols: number): number[] {
  if (rows === 0) return [];
  const heights = new Array(rows).fill(0);
  for (let i = 0; i < children.length; i++) {
    const r = Math.floor(i / cols);
    if (r >= rows) break;
    if (children[i].height > heights[r]) heights[r] = children[i].height;
  }
  return heights;
}

function sumWithGaps(values: number[], gap: number): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total + (values.length - 1) * gap;
}

function sumRange(values: number[], start: number, end: number): number {
  let total = 0;
  for (let i = start; i < end; i++) total += values[i];
  return total;
}

/**
 * Compute the line height a label needs for a given font size.
 */
export function labelLineHeightForFontSize(fontSize: number): number {
  return Math.ceil(fontSize * AUTO_LAYOUT_DEFAULTS.labelLineHeightMultiplier);
}
