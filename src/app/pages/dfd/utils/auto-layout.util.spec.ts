import { describe, expect, it } from 'vitest';

import {
  AUTO_LAYOUT_DEFAULTS,
  ChildBox,
  ICON_SIZE,
  IconColumn,
  gridDimensions,
  iconOnlyFitGeometry,
  inferOrientation,
  labelLineHeightForFontSize,
  layoutContainer,
  sortChildrenByPorts,
  sortChildrenByPosition,
} from './auto-layout.util';

const noPorts = { top: false, right: false, bottom: false, left: false };
const NO_PADDING = { outer: 0, iconGap: 0, gap: 0 } as const;
const DEFAULT_PADDING = {
  outer: AUTO_LAYOUT_DEFAULTS.outerPad,
  iconGap: AUTO_LAYOUT_DEFAULTS.iconGap,
  gap: AUTO_LAYOUT_DEFAULTS.gap,
} as const;

function child(
  id: string,
  width = 100,
  height = 60,
  ports = noPorts,
  x?: number,
  y?: number,
): ChildBox {
  return { id, width, height, ports: { ...ports }, x, y };
}

describe('gridDimensions', () => {
  it('returns 0×0 for n <= 0', () => {
    expect(gridDimensions(0, 'horizontal')).toEqual({ rows: 0, cols: 0 });
    expect(gridDimensions(-1, 'horizontal')).toEqual({ rows: 0, cols: 0 });
  });

  it('matches the worked horizontal sequence from the design doc', () => {
    const expected: Array<[number, number, number]> = [
      [1, 1, 1],
      [2, 1, 2],
      [3, 2, 2],
      [4, 2, 2],
      [5, 2, 3],
      [6, 2, 3],
      [7, 3, 3],
      [9, 3, 3],
      [10, 3, 4],
      [12, 3, 4],
      [13, 4, 4],
      [16, 4, 4],
    ];
    for (const [n, r, c] of expected) {
      expect(gridDimensions(n, 'horizontal')).toEqual({ rows: r, cols: c });
    }
  });

  it('mirrors rows/cols for vertical orientation', () => {
    const expected: Array<[number, number, number]> = [
      [1, 1, 1],
      [2, 2, 1],
      [3, 2, 2],
      [4, 2, 2],
      [5, 3, 2],
      [6, 3, 2],
      [7, 3, 3],
      [9, 3, 3],
      [10, 4, 3],
      [13, 4, 4],
    ];
    for (const [n, r, c] of expected) {
      expect(gridDimensions(n, 'vertical')).toEqual({ rows: r, cols: c });
    }
  });
});

describe('inferOrientation', () => {
  it('returns horizontal for fewer than 2 nodes', () => {
    expect(inferOrientation([])).toBe('horizontal');
    expect(inferOrientation([{ x: 0, y: 0, width: 100, height: 50 }])).toBe('horizontal');
  });

  it('returns horizontal when xSpan > ySpan', () => {
    expect(
      inferOrientation([
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 500, y: 50, width: 50, height: 50 },
      ]),
    ).toBe('horizontal');
  });

  it('returns vertical when ySpan > xSpan', () => {
    expect(
      inferOrientation([
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 50, y: 600, width: 50, height: 50 },
      ]),
    ).toBe('vertical');
  });

  it('breaks ties to horizontal', () => {
    expect(
      inferOrientation([
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 200, y: 200, width: 100, height: 100 },
      ]),
    ).toBe('horizontal');
  });
});

describe('sortChildrenByPorts (horizontal)', () => {
  it('top-port-only sorts before bottom-port-only', () => {
    const result = sortChildrenByPorts(
      [
        child('a', 50, 50, { ...noPorts, bottom: true }),
        child('b', 50, 50, { ...noPorts, top: true }),
      ],
      'horizontal',
    );
    expect(result.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('within same vertical bias, left-port-only sorts before right-port-only', () => {
    const result = sortChildrenByPorts(
      [
        child('a', 50, 50, { ...noPorts, right: true }),
        child('b', 50, 50, { ...noPorts, left: true }),
      ],
      'horizontal',
    );
    expect(result.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('children with no port bias preserve original order', () => {
    const result = sortChildrenByPorts([child('x'), child('y'), child('z')], 'horizontal');
    expect(result.map(c => c.id)).toEqual(['x', 'y', 'z']);
  });

  it('a child using both top+bottom is treated as no vertical bias', () => {
    const result = sortChildrenByPorts(
      [
        child('a', 50, 50, { ...noPorts, top: true, bottom: true }),
        child('b', 50, 50, { ...noPorts, top: true }),
      ],
      'horizontal',
    );
    expect(result.map(c => c.id)).toEqual(['b', 'a']);
  });
});

describe('sortChildrenByPorts (vertical)', () => {
  it('horizontal bias is primary', () => {
    const result = sortChildrenByPorts(
      [
        child('a', 50, 50, { ...noPorts, right: true, top: true }),
        child('b', 50, 50, { ...noPorts, left: true, bottom: true }),
      ],
      'vertical',
    );
    expect(result.map(c => c.id)).toEqual(['b', 'a']);
  });
});

describe('sortChildrenByPosition', () => {
  it('horizontal: sorts row-major (y then x)', () => {
    const result = sortChildrenByPosition(
      [
        child('a', 50, 50, noPorts, 100, 50),
        child('b', 50, 50, noPorts, 0, 50),
        child('c', 50, 50, noPorts, 0, 0),
      ],
      'horizontal',
    );
    expect(result.map(c => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('vertical: sorts column-major (x then y)', () => {
    const result = sortChildrenByPosition(
      [
        child('a', 50, 50, noPorts, 0, 100),
        child('b', 50, 50, noPorts, 50, 0),
        child('c', 50, 50, noPorts, 0, 0),
      ],
      'vertical',
    );
    expect(result.map(c => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('children missing position fall to the end (stable)', () => {
    const result = sortChildrenByPosition(
      [child('a'), child('b', 50, 50, noPorts, 0, 0)],
      'horizontal',
    );
    expect(result.map(c => c.id)).toEqual(['b', 'a']);
  });
});

describe('iconOnlyFitGeometry', () => {
  it('produces 32 × (32 + lineHeight) and bottom-anchored label', () => {
    const lineHeight = 16;
    const geom = iconOnlyFitGeometry(lineHeight);
    expect(geom.width).toBe(ICON_SIZE);
    expect(geom.height).toBe(ICON_SIZE + lineHeight);
    expect(geom.iconAttrs.refY).toBe(0);
    expect(geom.labelAttrs.textVerticalAnchor).toBe('bottom');
  });
});

describe('labelLineHeightForFontSize', () => {
  it('rounds up using the configured multiplier', () => {
    expect(labelLineHeightForFontSize(12)).toBe(
      Math.ceil(12 * AUTO_LAYOUT_DEFAULTS.labelLineHeightMultiplier),
    );
  });
});

describe('layoutContainer (horizontal)', () => {
  const iconCol: IconColumn = { hasIcon: true, width: 40, height: 50 };

  it('sizes the container to fit a single child', () => {
    const layout = layoutContainer(iconCol, [child('c1', 100, 60)], 'horizontal', NO_PADDING, 16);
    expect(layout.containerWidth).toBe(iconCol.width + 100);
    expect(layout.containerHeight).toBe(Math.max(iconCol.height, 60));
    expect(layout.childPositions).toHaveLength(1);
    expect(layout.iconAttrs).not.toBeNull();
    expect(layout.labelAttrs).not.toBeNull();
  });

  it('produces a 2×2 grid for 4 children', () => {
    const children = [child('a'), child('b'), child('c'), child('d')];
    const layout = layoutContainer(iconCol, children, 'horizontal', NO_PADDING, 16);
    expect(layout.childPositions).toHaveLength(4);
    expect(layout.containerWidth).toBe(iconCol.width + 100 * 2);
    expect(layout.containerHeight).toBe(Math.max(iconCol.height, 60 * 2));
  });

  it('omits icon attrs when iconCol has no icon (security boundary case)', () => {
    const noIconCol: IconColumn = { hasIcon: false, width: 0, height: 0 };
    const layout = layoutContainer(noIconCol, [child('c1', 80, 40)], 'horizontal', NO_PADDING, 16);
    expect(layout.iconAttrs).toBeNull();
    expect(layout.labelAttrs).toBeNull();
    expect(layout.containerWidth).toBe(80);
    expect(layout.containerHeight).toBe(40);
  });

  it('respects padding on both axes', () => {
    const layout = layoutContainer(
      iconCol,
      [child('c1', 100, 60)],
      'horizontal',
      DEFAULT_PADDING,
      16,
    );
    expect(layout.containerWidth).toBe(
      DEFAULT_PADDING.outer * 2 + iconCol.width + DEFAULT_PADDING.iconGap + 100,
    );
    expect(layout.containerHeight).toBe(DEFAULT_PADDING.outer * 2 + Math.max(iconCol.height, 60));
  });

  it('handles different child sizes per row/column', () => {
    const layout = layoutContainer(
      iconCol,
      [child('a', 50, 30), child('b', 80, 30), child('c', 50, 60), child('d', 80, 60)],
      'horizontal',
      NO_PADDING,
      16,
    );
    expect(layout.containerWidth).toBe(iconCol.width + 50 + 80);
    expect(layout.containerHeight).toBe(Math.max(iconCol.height, 30 + 60));
  });
});

describe('layoutContainer (vertical)', () => {
  const iconCol: IconColumn = { hasIcon: true, width: 40, height: 50 };

  it('stacks icon row above the children grid', () => {
    const layout = layoutContainer(iconCol, [child('c1', 100, 60)], 'vertical', NO_PADDING, 16);
    expect(layout.containerWidth).toBe(Math.max(iconCol.width, 100));
    expect(layout.containerHeight).toBe(iconCol.height + 60);
  });

  it('produces a 2×2 grid for 4 children', () => {
    const layout = layoutContainer(
      iconCol,
      [child('a'), child('b'), child('c'), child('d')],
      'vertical',
      NO_PADDING,
      16,
    );
    expect(layout.childPositions).toHaveLength(4);
    expect(layout.containerWidth).toBe(Math.max(iconCol.width, 100 * 2));
    expect(layout.containerHeight).toBe(iconCol.height + 60 * 2);
  });
});
