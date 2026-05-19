import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DfdIconService } from './dfd-icon.service';
import { LayoutCell, LayoutGraph } from '../../types/layout-cell.types';

/**
 * Mutable in-memory fake satisfying the `LayoutCell` structural surface.
 *
 * `getData`/`setData` back a `__data` field, `getSize`/`resize` back a
 * `__size` field, `getPosition`/`setPosition` back a `__pos` field, and
 * `getAttrs`/`setAttrByPath` back a nested `__attrs` map.
 */
interface FakeCellOptions {
  id?: string;
  shape?: string;
  data?: Record<string, unknown>;
  size?: { width: number; height: number };
  position?: { x: number; y: number };
  children?: LayoutCell[] | null;
  parent?: LayoutCell | null;
  attrs?: Record<string, unknown>;
  ports?: unknown[];
  isNode?: boolean;
  isEdge?: boolean;
  visible?: boolean;
  zIndex?: number;
}

interface FakeCell extends LayoutCell {
  __data: Record<string, unknown>;
  __size: { width: number; height: number };
  __pos: { x: number; y: number };
  __attrs: Record<string, unknown>;
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('/');
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof node[key] !== 'object' || node[key] === null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

function getByPath(target: Record<string, unknown>, path: string): unknown {
  const parts = path.split('/');
  let node: unknown = target;
  for (const key of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function fakeCell(overrides: FakeCellOptions = {}): FakeCell {
  const cell: FakeCell = {
    id: overrides.id ?? 'cell-1',
    shape: overrides.shape ?? 'process',
    __data: overrides.data ?? {},
    __size: overrides.size ?? { width: 120, height: 80 },
    __pos: overrides.position ?? { x: 0, y: 0 },
    __attrs: overrides.attrs ?? {},
    getData: function <T = Record<string, unknown>>(): T {
      return cell.__data as T;
    },
    setData: function (
      data: Record<string, unknown>,
      _options?: { silent?: boolean; overwrite?: boolean },
    ): void {
      cell.__data = data;
    },
    getSize: function () {
      return cell.__size;
    },
    resize: function (width: number, height: number): void {
      cell.__size = { width, height };
    },
    getPosition: function () {
      return cell.__pos;
    },
    setPosition: function (x: number, y: number): void {
      cell.__pos = { x, y };
    },
    getChildren: function () {
      return overrides.children ?? null;
    },
    getParent: function () {
      return overrides.parent ?? null;
    },
    getAttrs: function () {
      return cell.__attrs;
    },
    getAttrByPath: function (path: string) {
      return getByPath(cell.__attrs, path);
    },
    setAttrByPath: function (path: string, value: unknown): void {
      setByPath(cell.__attrs, path, value);
    },
    getZIndex: function () {
      return overrides.zIndex ?? 0;
    },
    isVisible: function () {
      return overrides.visible ?? true;
    },
    isNode: function () {
      return overrides.isNode ?? true;
    },
    isEdge: function () {
      return overrides.isEdge ?? false;
    },
    getPorts: function () {
      return overrides.ports ?? [];
    },
  };
  return cell;
}

function fakeGraph(nodes: LayoutCell[] = []): LayoutGraph {
  const byId = new Map<string, LayoutCell>();
  for (const n of nodes) byId.set(n.id, n);
  return {
    getNodes: () => nodes,
    getEdges: () => [],
    getCellById: (id: string) => byId.get(id) ?? null,
  };
}

describe('DfdIconService', () => {
  let service: DfdIconService;
  let userPrefs: { getPreferences: ReturnType<typeof vi.fn> };
  let architectureIcon: { getIconPath: ReturnType<typeof vi.fn> };
  let dfdLayout: { applyAutoLayout: ReturnType<typeof vi.fn> };

  function setPrefs(overrides: Record<string, unknown> = {}): void {
    userPrefs.getPreferences.mockReturnValue({
      autoLayoutEnabled: true,
      showShapeBordersWithIcons: false,
      autoLayoutOrientation: 'automatic',
      ...overrides,
    });
  }

  beforeEach(() => {
    userPrefs = { getPreferences: vi.fn() };
    setPrefs();
    architectureIcon = { getIconPath: vi.fn().mockReturnValue('/icons/x.svg') };
    dfdLayout = { applyAutoLayout: vi.fn().mockReturnValue(false) };
    service = new DfdIconService(userPrefs as any, architectureIcon as any, dfdLayout as any);
  });

  describe('captureCellStateForHistory', () => {
    it('captures every tracked cell field as a plain JSON snapshot', () => {
      const cell = {
        id: 'n1',
        shape: 'process',
        getPosition: () => ({ x: 10, y: 20 }),
        getSize: () => ({ width: 100, height: 60 }),
        getAttrs: () => ({ body: { fill: '#fff' } }),
        getPorts: () => [{ id: 'p1' }],
        getData: () => ({ _arch: { name: 'x' } }),
        isVisible: () => true,
        getZIndex: () => 3,
        getParent: () => null,
      } as unknown as LayoutCell;
      const snapshot = service.captureCellStateForHistory(cell) as Record<string, unknown>;
      expect(snapshot).toEqual({
        id: 'n1',
        shape: 'process',
        position: { x: 10, y: 20 },
        size: { width: 100, height: 60 },
        attrs: { body: { fill: '#fff' } },
        ports: [{ id: 'p1' }],
        data: { _arch: { name: 'x' } },
        visible: true,
        zIndex: 3,
        parent: undefined,
      });
    });

    it('records the parent id when the cell is embedded in a node', () => {
      const parent = { id: 'container', isNode: () => true } as unknown as LayoutCell;
      const cell = {
        id: 'n1',
        shape: 'process',
        getPosition: () => ({ x: 10, y: 20 }),
        getSize: () => ({ width: 100, height: 60 }),
        getAttrs: () => ({ body: { fill: '#fff' } }),
        getPorts: () => [{ id: 'p1' }],
        getData: () => ({ _arch: { name: 'x' } }),
        isVisible: () => true,
        getZIndex: () => 3,
        getParent: () => parent,
      } as unknown as LayoutCell;
      const snapshot = service.captureCellStateForHistory(cell) as Record<string, unknown>;
      expect(snapshot['parent']).toBe('container');
    });

    it('drops the parent id when the parent is not a node', () => {
      const parent = { id: 'edge-parent', isNode: () => false } as unknown as LayoutCell;
      const cell = {
        id: 'n1',
        shape: 'process',
        getPosition: () => ({ x: 0, y: 0 }),
        getSize: () => ({ width: 1, height: 1 }),
        getAttrs: () => ({}),
        getPorts: () => [],
        getData: () => ({}),
        isVisible: () => true,
        getZIndex: () => 0,
        getParent: () => parent,
      } as unknown as LayoutCell;
      const snapshot = service.captureCellStateForHistory(cell) as Record<string, unknown>;
      expect(snapshot['parent']).toBeUndefined();
    });
  });

  describe('applyIconToCell', () => {
    it('writes the full icon and label attr block from the resolved path', () => {
      architectureIcon.getIconPath.mockReturnValue('/icons/server.svg');
      const cell = fakeCell({ shape: 'process' });
      service.applyIconToCell(cell, { placement: { horizontal: 'left', vertical: 'top' } } as any);
      expect(architectureIcon.getIconPath).toHaveBeenCalled();
      // Icon block: top-left placement maps to refX/refY '15%', size 32,
      // refX2/refY2 = -ICON_SIZE / 2 = -16.
      expect(getByPath(cell.__attrs, 'icon/href')).toBe('/icons/server.svg');
      expect(getByPath(cell.__attrs, 'icon/width')).toBe(32);
      expect(getByPath(cell.__attrs, 'icon/height')).toBe(32);
      expect(getByPath(cell.__attrs, 'icon/refX')).toBe('15%');
      expect(getByPath(cell.__attrs, 'icon/refY')).toBe('15%');
      expect(getByPath(cell.__attrs, 'icon/refX2')).toBe(-16);
      expect(getByPath(cell.__attrs, 'icon/refY2')).toBe(-16);
      // Label block: locked to the icon — refX/refY '15%', refX2 = 0,
      // refY2 = ICON_SIZE / 2 + LABEL_ICON_PADDING = 16 + 6 = 22.
      expect(getByPath(cell.__attrs, 'text/refX')).toBe('15%');
      expect(getByPath(cell.__attrs, 'text/refY')).toBe('15%');
      expect(getByPath(cell.__attrs, 'text/refX2')).toBe(0);
      expect(getByPath(cell.__attrs, 'text/refY2')).toBe(22);
      expect(getByPath(cell.__attrs, 'text/textAnchor')).toBe('middle');
      expect(getByPath(cell.__attrs, 'text/textVerticalAnchor')).toBe('top');
    });
  });

  describe('restoreBorder', () => {
    it('writes stroke and fill back onto the body selector for a known shape', () => {
      const cell = fakeCell({ shape: 'process' });
      service.restoreBorder(cell);
      expect(getByPath(cell.__attrs, 'body/stroke')).toBeDefined();
      expect(getByPath(cell.__attrs, 'body/fill')).toBeDefined();
    });

    it('no-ops for an unknown shape', () => {
      const cell = fakeCell({ shape: 'not-a-real-shape' });
      service.restoreBorder(cell);
      expect(cell.__attrs).toEqual({});
    });
  });

  describe('applyBorderPreference', () => {
    it('hides the border when borders are off and the shape is icon-hideable', () => {
      setPrefs({ showShapeBordersWithIcons: false });
      const cell = fakeCell({ shape: 'process' });
      service.applyBorderPreference(cell);
      expect(getByPath(cell.__attrs, 'body/stroke')).toBe('transparent');
      expect(getByPath(cell.__attrs, 'body/fill')).toBe('transparent');
    });

    it('leaves the border untouched when borders are on', () => {
      setPrefs({ showShapeBordersWithIcons: true });
      const cell = fakeCell({ shape: 'process' });
      service.applyBorderPreference(cell);
      expect(cell.__attrs).toEqual({});
    });
  });

  describe('applyLockBadge', () => {
    it('shows the lock badge for a locked, lock-eligible cell', () => {
      const cell = fakeCell({ shape: 'process', data: { _layoutLocked: true } });
      service.applyLockBadge(cell);
      expect(getByPath(cell.__attrs, 'lockBadge/display')).toBe('block');
      expect(getByPath(cell.__attrs, 'lockBadge/href')).toBeDefined();
    });

    it('hides the lock badge for an unlocked cell', () => {
      const cell = fakeCell({ shape: 'process', data: {} });
      service.applyLockBadge(cell);
      expect(getByPath(cell.__attrs, 'lockBadge/display')).toBe('none');
    });

    it('no-ops for a non-lock-eligible shape', () => {
      const cell = fakeCell({ shape: 'text-box', data: { _layoutLocked: true } });
      service.applyLockBadge(cell);
      expect(cell.__attrs).toEqual({});
    });
  });

  describe('revertAutoFit', () => {
    it('returns false when the cell has no recorded auto-fit', () => {
      const cell = fakeCell({ shape: 'process', data: {} });
      expect(service.revertAutoFit(cell)).toBe(false);
    });

    it('resizes back to the shape default and re-applies the icon when still at auto-fit size', () => {
      const cell = fakeCell({
        shape: 'process',
        size: { width: 32, height: 50 },
        data: {
          _archAutoFit: { kind: 'icon-only', width: 32, height: 50 },
          _arch: { placement: { horizontal: 'left', vertical: 'top' } },
        },
      });
      const result = service.revertAutoFit(cell);
      expect(result).toBe(true);
      // icon re-applied via applyIconToCell
      expect(architectureIcon.getIconPath).toHaveBeenCalled();
      // _archAutoFit flag cleared
      expect(cell.__data['_archAutoFit']).toBeUndefined();
    });

    it('clears the flag without resizing when the user has manually resized the cell', () => {
      const cell = fakeCell({
        shape: 'process',
        size: { width: 200, height: 200 },
        data: { _archAutoFit: { kind: 'icon-only', width: 32, height: 50 } },
      });
      const result = service.revertAutoFit(cell);
      expect(result).toBe(true);
      expect(cell.__size).toEqual({ width: 200, height: 200 });
      expect(architectureIcon.getIconPath).not.toHaveBeenCalled();
      expect(cell.__data['_archAutoFit']).toBeUndefined();
    });
  });

  describe('revertAutoFitOnAllAutoFitCells', () => {
    it('reverts only the nodes carrying an _archAutoFit flag', () => {
      const tagged = fakeCell({
        id: 'a',
        shape: 'process',
        size: { width: 200, height: 200 },
        data: { _archAutoFit: { kind: 'icon-only', width: 32, height: 50 } },
      });
      const plain = fakeCell({ id: 'b', shape: 'process', data: {} });
      service.revertAutoFitOnAllAutoFitCells(fakeGraph([tagged, plain]));
      expect(tagged.__data['_archAutoFit']).toBeUndefined();
      expect(plain.__data).toEqual({});
    });

    it('skips a layout-locked node even when it carries an _archAutoFit flag', () => {
      const locked = fakeCell({
        id: 'a',
        shape: 'process',
        size: { width: 200, height: 200 },
        data: {
          _archAutoFit: { kind: 'icon-only', width: 32, height: 50 },
          _layoutLocked: true,
        },
      });
      service.revertAutoFitOnAllAutoFitCells(fakeGraph([locked]));
      // The lock guard short-circuits before revertAutoFit, so the flag stays.
      expect(locked.__data['_archAutoFit']).toEqual({
        kind: 'icon-only',
        width: 32,
        height: 50,
      });
    });
  });

  describe('applyIconsOnLoad', () => {
    it('applies icons, runs auto-layout, and syncs lock badges across every node', () => {
      const iconned = fakeCell({
        id: 'a',
        shape: 'process',
        data: { _arch: { placement: { horizontal: 'left', vertical: 'top' } } },
      });
      const plain = fakeCell({ id: 'b', shape: 'process', data: {} });
      const locked = fakeCell({
        id: 'c',
        shape: 'process',
        data: { _layoutLocked: true },
      });
      const graph = fakeGraph([iconned, plain, locked]);
      service.applyIconsOnLoad(graph);
      expect(architectureIcon.getIconPath).toHaveBeenCalledTimes(1);
      expect(dfdLayout.applyAutoLayout).toHaveBeenCalledTimes(3);
      expect(dfdLayout.applyAutoLayout).toHaveBeenCalledWith(iconned, graph);
      // applyLockBadge runs for every node: shown on the locked node, hidden
      // on the unlocked ones.
      expect(getByPath(locked.__attrs, 'lockBadge/display')).toBe('block');
      expect(getByPath(plain.__attrs, 'lockBadge/display')).toBe('none');
    });
  });

  describe('reapplyBorderPreferenceToAllIconnedCells', () => {
    it('restores borders on iconned cells when showBorders is true', () => {
      const iconned = fakeCell({
        id: 'a',
        shape: 'process',
        data: { _arch: { placement: { horizontal: 'left', vertical: 'top' } } },
      });
      service.reapplyBorderPreferenceToAllIconnedCells(fakeGraph([iconned]), true);
      expect(getByPath(iconned.__attrs, 'body/stroke')).toBeDefined();
    });

    it('hides borders on iconned cells when showBorders is false', () => {
      setPrefs({ showShapeBordersWithIcons: false });
      const iconned = fakeCell({
        id: 'a',
        shape: 'process',
        data: { _arch: { placement: { horizontal: 'left', vertical: 'top' } } },
      });
      service.reapplyBorderPreferenceToAllIconnedCells(fakeGraph([iconned]), false);
      expect(getByPath(iconned.__attrs, 'body/stroke')).toBe('transparent');
    });

    it('skips non-iconned cells', () => {
      const plain = fakeCell({ id: 'b', shape: 'process', data: {} });
      service.reapplyBorderPreferenceToAllIconnedCells(fakeGraph([plain]), true);
      expect(plain.__attrs).toEqual({});
    });
  });

  describe('restoreLabelDefaults', () => {
    it('restores label attrs for a shape with known defaults', () => {
      const cell = fakeCell({ shape: 'process' });
      service.restoreLabelDefaults(cell);
      // process defaults: refX/refY '50%'. refX2/refY2 are reset to 0 — those
      // zeros clear any icon-driven placement offset.
      expect(getByPath(cell.__attrs, 'text/refX')).toBe('50%');
      expect(getByPath(cell.__attrs, 'text/refY')).toBe('50%');
      expect(getByPath(cell.__attrs, 'text/refX2')).toBe(0);
      expect(getByPath(cell.__attrs, 'text/refY2')).toBe(0);
      expect(getByPath(cell.__attrs, 'text/textAnchor')).toBe('middle');
      expect(getByPath(cell.__attrs, 'text/textVerticalAnchor')).toBe('middle');
    });

    it('no-ops for a shape without label defaults', () => {
      const cell = fakeCell({ shape: 'not-a-real-shape' });
      service.restoreLabelDefaults(cell);
      expect(cell.__attrs).toEqual({});
    });
  });
});
