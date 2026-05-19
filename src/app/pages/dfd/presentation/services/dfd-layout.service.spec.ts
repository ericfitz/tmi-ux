import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DfdLayoutService } from './dfd-layout.service';
import { LayoutCell, LayoutGraph } from '../../types/layout-cell.types';
import { DFD_STYLING } from '../../constants/styling-constants';

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
  // Edge-cell members used by buildChildBox / clearVerticesOfConnectedEdges.
  sourceCellId?: string;
  targetCellId?: string;
  sourcePortId?: string;
  targetPortId?: string;
}

interface FakeCell extends LayoutCell {
  __data: Record<string, unknown>;
  __size: { width: number; height: number };
  __pos: { x: number; y: number };
  __attrs: Record<string, unknown>;
  __vertices: unknown[];
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
    __vertices: [],
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
      return 0;
    },
    isVisible: function () {
      return true;
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
    getSourceCellId: function () {
      return overrides.sourceCellId;
    },
    getTargetCellId: function () {
      return overrides.targetCellId;
    },
    getSourcePortId: function () {
      return overrides.sourcePortId;
    },
    getTargetPortId: function () {
      return overrides.targetPortId;
    },
    setVertices: function (vertices: unknown[]): void {
      cell.__vertices = vertices;
    },
  };
  return cell;
}

function fakeGraph(
  nodes: LayoutCell[] = [],
  edges: LayoutCell[] = [],
  connectedEdges: (cell: LayoutCell) => LayoutCell[] = () => [],
): LayoutGraph {
  const byId = new Map<string, LayoutCell>();
  for (const n of nodes) byId.set(n.id, n);
  for (const e of edges) byId.set(e.id, e);
  return {
    getNodes: () => nodes,
    getEdges: () => edges,
    getCellById: (id: string) => byId.get(id) ?? null,
    getConnectedEdges: (cell: LayoutCell) => connectedEdges(cell),
  };
}

describe('DfdLayoutService', () => {
  let service: DfdLayoutService;
  let userPrefs: { getPreferences: ReturnType<typeof vi.fn> };

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
    service = new DfdLayoutService(userPrefs as any);
  });

  describe('applyIconOnlyFit', () => {
    it('returns false for a shape that is not icon-hideable', () => {
      const cell = fakeCell({ shape: 'text-box', data: { _arch: { placement: 'top-left' } } });
      expect(service.applyIconOnlyFit(cell)).toBe(false);
    });

    it('returns false when showShapeBordersWithIcons is true', () => {
      setPrefs({ showShapeBordersWithIcons: true });
      const cell = fakeCell({ shape: 'process', data: { _arch: { placement: 'top-left' } } });
      expect(service.applyIconOnlyFit(cell)).toBe(false);
    });

    it('returns false when the cell is not at default size and not at a prior auto-fit size', () => {
      const cell = fakeCell({ shape: 'process', size: { width: 999, height: 999 } });
      expect(service.applyIconOnlyFit(cell)).toBe(false);
    });

    it('resizes and tags the cell when it is at default size', () => {
      const cfg = (DFD_STYLING.NODES as Record<string, any>)['PROCESS'];
      const cell = fakeCell({
        shape: 'process',
        size: { width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
      });
      const changed = service.applyIconOnlyFit(cell);
      expect(changed).toBe(true);
      const autoFit = cell.getData()['_archAutoFit'] as { kind: string };
      expect(autoFit.kind).toBe('icon-only');
      expect(cell.getSize().width).toBeGreaterThan(0);
    });
  });

  describe('applyAutoLayout', () => {
    it('returns false when autoLayoutEnabled is off', () => {
      setPrefs({ autoLayoutEnabled: false });
      const cell = fakeCell({ shape: 'process' });
      expect(service.applyAutoLayout(cell, fakeGraph())).toBe(false);
    });

    it('returns false for a layout-locked cell', () => {
      const cell = fakeCell({ shape: 'process', data: { _layoutLocked: true } });
      expect(service.applyAutoLayout(cell, fakeGraph())).toBe(false);
    });

    it('returns false for a leaf cell with no _arch data', () => {
      const cell = fakeCell({ shape: 'process', data: {} });
      expect(service.applyAutoLayout(cell, fakeGraph())).toBe(false);
    });

    it('delegates to icon-only fit for an iconned leaf at default size', () => {
      const cfg = (DFD_STYLING.NODES as Record<string, any>)['PROCESS'];
      const cell = fakeCell({
        shape: 'process',
        data: { _arch: { placement: 'top-left' } },
        size: { width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
      });
      expect(service.applyAutoLayout(cell, fakeGraph())).toBe(true);
    });
  });

  describe('applyContainerFit', () => {
    it('returns false for a shape not in the icon-eligible set', () => {
      const cell = fakeCell({ shape: 'text-box' });
      const child = fakeCell({ id: 'child-1', shape: 'process' });
      expect(service.applyContainerFit(cell, [child], fakeGraph([cell, child]), 'ports')).toBe(
        false,
      );
    });

    it('returns false when the cell has been manually resized', () => {
      const cell = fakeCell({ shape: 'security-boundary', size: { width: 12345, height: 6789 } });
      const child = fakeCell({ id: 'child-1', shape: 'process' });
      expect(service.applyContainerFit(cell, [child], fakeGraph([cell, child]), 'ports')).toBe(
        false,
      );
    });

    it('resizes and tags a container at default size with embedded children', () => {
      const cfg = (DFD_STYLING.NODES as Record<string, any>)['SECURITY_BOUNDARY'];
      const cell = fakeCell({
        id: 'boundary-1',
        shape: 'security-boundary',
        size: { width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
      });
      const child = fakeCell({ id: 'child-1', shape: 'process', size: { width: 60, height: 40 } });
      const graph = fakeGraph([cell, child]);
      const changed = service.applyContainerFit(cell, [child], graph, 'ports');
      expect(changed).toBe(true);
      const autoFit = cell.getData()['_archAutoFit'] as { kind: string };
      expect(autoFit.kind).toBe('container');
    });

    it('sorts children by position when sortBy is "position"', () => {
      const cfg = (DFD_STYLING.NODES as Record<string, any>)['SECURITY_BOUNDARY'];
      const cell = fakeCell({
        id: 'boundary-1',
        shape: 'security-boundary',
        position: { x: 0, y: 0 },
        size: { width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
      });
      const childA = fakeCell({
        id: 'child-a',
        shape: 'process',
        position: { x: 300, y: 0 },
        size: { width: 60, height: 40 },
      });
      const childB = fakeCell({
        id: 'child-b',
        shape: 'process',
        position: { x: 0, y: 0 },
        size: { width: 60, height: 40 },
      });
      const graph = fakeGraph([cell, childA, childB]);
      const changed = service.applyContainerFit(cell, [childA, childB], graph, 'position');
      expect(changed).toBe(true);
      const autoFit = cell.getData()['_archAutoFit'] as { kind: string };
      expect(autoFit.kind).toBe('container');
      // Children are repacked into the grid; the lower-x child ends up at the
      // smaller absolute x after a position-based sort.
      expect(childB.getPosition().x).toBeLessThanOrEqual(childA.getPosition().x);
    });
  });

  describe('cascadeContainerLayout', () => {
    it('stops at the first ancestor without a container auto-fit flag', () => {
      const ancestor = fakeCell({ id: 'anc', shape: 'process', data: {} });
      const start = fakeCell({ id: 'start', shape: 'process', parent: ancestor });
      // Should not throw and should not modify the ancestor.
      service.cascadeContainerLayout(start, fakeGraph([ancestor, start]));
      expect(ancestor.getData()['_archAutoFit']).toBeUndefined();
    });

    it('is a no-op when the start cell has no parent', () => {
      const start = fakeCell({ id: 'start', shape: 'process', parent: null });
      expect(() => service.cascadeContainerLayout(start, fakeGraph([start]))).not.toThrow();
    });

    it('re-applies container fit to a container-fit ancestor at default size', () => {
      const cfg = (DFD_STYLING.NODES as Record<string, any>)['SECURITY_BOUNDARY'];
      const start = fakeCell({ id: 'start', shape: 'process', size: { width: 60, height: 40 } });
      const parent = fakeCell({
        id: 'parent',
        shape: 'security-boundary',
        size: { width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
        data: {
          _archAutoFit: { kind: 'container', width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
        },
        children: [start],
        parent: null,
      });
      // Re-point the start cell at the parent now that parent exists.
      (start as any).getParent = (): LayoutCell => parent;
      const graph = fakeGraph([parent, start]);
      service.cascadeContainerLayout(start, graph);
      const autoFit = parent.getData()['_archAutoFit'] as { kind: string };
      expect(autoFit.kind).toBe('container');
      // Container fit recomputes the parent's size to wrap its single child.
      expect(parent.getSize().width).toBeGreaterThan(0);
    });
  });

  describe('applyAutoLayoutToAllEligibleCells', () => {
    it('does nothing when the graph has no eligible cells', () => {
      const plain = fakeCell({ id: 'plain', shape: 'process', data: {} });
      const graph = fakeGraph([plain]);
      expect(() => service.applyAutoLayoutToAllEligibleCells(graph)).not.toThrow();
      expect(plain.getData()['_archAutoFit']).toBeUndefined();
    });

    it('applies auto-layout to an iconned cell at default size', () => {
      const cfg = (DFD_STYLING.NODES as Record<string, any>)['PROCESS'];
      const iconned = fakeCell({
        id: 'iconned',
        shape: 'process',
        data: { _arch: { placement: 'top-left' } },
        size: { width: cfg.DEFAULT_WIDTH, height: cfg.DEFAULT_HEIGHT },
      });
      const graph = fakeGraph([iconned]);
      service.applyAutoLayoutToAllEligibleCells(graph);
      expect(iconned.getData()['_archAutoFit']).toBeDefined();
    });
  });

  describe('buildChildBox', () => {
    it('builds a child box reading size, position, and connected ports', () => {
      const child = fakeCell({
        id: 'child-1',
        shape: 'process',
        size: { width: 70, height: 50 },
        position: { x: 10, y: 20 },
      });
      const edge = fakeCell({
        id: 'edge-1',
        isEdge: true,
        isNode: false,
        sourceCellId: 'child-1',
        sourcePortId: 'right',
      });
      const graph = fakeGraph([child], [edge], () => [edge]);
      const box = service.buildChildBox(graph, child);
      expect(box.id).toBe('child-1');
      expect(box.width).toBe(70);
      expect(box.height).toBe(50);
      expect(box.x).toBe(10);
      expect(box.y).toBe(20);
      expect(box.ports.right).toBe(true);
      expect(box.ports.left).toBe(false);
    });

    it('marks no ports when the child has no connected edges', () => {
      const child = fakeCell({ id: 'child-1', shape: 'process' });
      const box = service.buildChildBox(fakeGraph([child]), child);
      expect(box.ports).toEqual({ top: false, right: false, bottom: false, left: false });
    });
  });

  describe('resolveLayoutOrientation', () => {
    it('returns horizontal when the preference is explicitly horizontal', () => {
      setPrefs({ autoLayoutOrientation: 'horizontal' });
      expect(service.resolveLayoutOrientation(fakeGraph())).toBe('horizontal');
    });

    it('returns vertical when the preference is explicitly vertical', () => {
      setPrefs({ autoLayoutOrientation: 'vertical' });
      expect(service.resolveLayoutOrientation(fakeGraph())).toBe('vertical');
    });

    it('infers an orientation from top-level node geometry when preference is automatic', () => {
      const a = fakeCell({ id: 'a', shape: 'process', position: { x: 0, y: 0 } });
      const b = fakeCell({ id: 'b', shape: 'process', position: { x: 400, y: 0 } });
      const result = service.resolveLayoutOrientation(fakeGraph([a, b]));
      expect(['horizontal', 'vertical']).toContain(result);
    });
  });

  describe('clearVerticesOfConnectedEdges', () => {
    it('clears vertices on every connected edge', () => {
      const node = fakeCell({ id: 'node-1', shape: 'process' });
      const edge = fakeCell({ id: 'edge-1', isEdge: true, isNode: false });
      edge.setVertices([{ x: 1, y: 1 }]);
      const graph = fakeGraph([node], [edge], () => [edge]);
      service.clearVerticesOfConnectedEdges(graph, node);
      expect(edge.__vertices).toEqual([]);
    });

    it('is a no-op when the node has no connected edges', () => {
      const node = fakeCell({ id: 'node-1', shape: 'process' });
      expect(() => service.clearVerticesOfConnectedEdges(fakeGraph([node]), node)).not.toThrow();
    });
  });

  // setAbsoluteIconAttrs / setAbsoluteLabelAttrs are private attr-writers,
  // covered indirectly through applyIconOnlyFit and applyContainerFit.
});
