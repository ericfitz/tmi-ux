import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { DfdStylingService } from './dfd-styling.service';
import { LayoutCell, LayoutGraph } from '../../types/layout-cell.types';
import { DFD_STYLING, DFD_STYLING_HELPERS } from '../../constants/styling-constants';
import { LABEL_POSITION_ATTRS } from '../../types/label-position.types';
import { StyleChangeEvent } from '../../presentation/components/style-panel/style-panel.component';

/**
 * Mutable in-memory fake satisfying the `LayoutCell` structural surface used by
 * `DfdStylingService`. `getData`/`setData` back a `__data` field;
 * `getAttrs`/`getAttrByPath`/`setAttrByPath` back a nested `__attrs` map.
 */
interface FakeCellOptions {
  id?: string;
  shape?: string;
  data?: Record<string, unknown>;
  attrs?: Record<string, unknown>;
  isNode?: boolean;
  isEdge?: boolean;
}

interface FakeCell extends LayoutCell {
  __data: Record<string, unknown>;
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
      return { width: 120, height: 80 };
    },
    resize: function (): void {
      /* unused */
    },
    getPosition: function () {
      return { x: 0, y: 0 };
    },
    setPosition: function (): void {
      /* unused */
    },
    getChildren: function () {
      return null;
    },
    getParent: function () {
      return null;
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
      return [];
    },
  };
  return cell;
}

function fakeGraph(cells: LayoutCell[] = []): LayoutGraph {
  const byId = new Map<string, LayoutCell>();
  for (const c of cells) byId.set(c.id, c);
  return {
    getNodes: () => cells.filter(c => c.isNode()),
    getEdges: () => cells.filter(c => c.isEdge()),
    getCellById: (id: string) => byId.get(id) ?? null,
  };
}

describe('DfdStylingService', () => {
  let service: DfdStylingService;

  beforeEach(() => {
    service = new DfdStylingService();
  });

  describe('buildStylePanelCells', () => {
    it('returns an empty array when the graph has no nodes', () => {
      const graph = {
        getNodes: () => [],
        getEdges: () => [],
        getCellById: () => null,
      } as LayoutGraph;
      expect(service.buildStylePanelCells(graph)).toEqual([]);
    });

    it('returns an empty array when no cell ids are selected', () => {
      const node = fakeCell({ id: 'n1' });
      const graph = fakeGraph([node]);
      expect(service.buildStylePanelCells(graph)).toEqual([]);
    });

    it('builds a CellStyleInfo for a selected node from its body attrs', () => {
      const node = fakeCell({
        id: 'n1',
        shape: 'process',
        data: { nodeType: 'process', customStyles: true },
        attrs: {
          body: { stroke: '#111111', fill: '#eeeeee', fillOpacity: 0.5 },
          text: { refX: '50%', refY: '50%', textAnchor: 'middle', textVerticalAnchor: 'middle' },
        },
      });
      const graph = fakeGraph([node]);

      const result = service.buildStylePanelCells(graph, ['n1']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        cellId: 'n1',
        isNode: true,
        isEdge: false,
        nodeType: 'process',
        strokeColor: '#111111',
        fillColor: '#eeeeee',
        fillOpacity: 0.5,
        hasCustomStyles: true,
        labelPosition: { vertical: 'middle', horizontal: 'center' },
        hasArchIcon: false,
      });
    });

    it('builds a CellStyleInfo for a selected edge from its line attrs', () => {
      const edge = fakeCell({
        id: 'e1',
        shape: 'edge',
        isNode: false,
        isEdge: true,
        attrs: { line: { stroke: '#abcabc' } },
      });
      const graph = fakeGraph([edge]);

      const result = service.buildStylePanelCells(graph, ['e1']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        cellId: 'e1',
        isNode: false,
        isEdge: true,
        nodeType: null,
        strokeColor: '#abcabc',
        fillColor: null,
        fillOpacity: null,
        labelPosition: null,
      });
    });

    it('skips selected ids not present in the graph', () => {
      const node = fakeCell({ id: 'n1' });
      const graph = fakeGraph([node]);
      const result = service.buildStylePanelCells(graph, ['n1', 'missing']);
      expect(result).toHaveLength(1);
      expect(result[0].cellId).toBe('n1');
    });

    it('reports hasArchIcon true when the node carries _arch data', () => {
      const node = fakeCell({
        id: 'n1',
        data: { nodeType: 'process', _arch: { provider: 'aws' } },
      });
      const graph = fakeGraph([node]);
      const result = service.buildStylePanelCells(graph, ['n1']);
      expect(result[0].hasArchIcon).toBe(true);
    });
  });

  describe('buildIconPickerCells', () => {
    it('returns an empty array when the graph has no nodes', () => {
      const graph = {
        getNodes: () => [],
        getEdges: () => [],
        getCellById: () => null,
      } as LayoutGraph;
      expect(service.buildIconPickerCells(graph)).toEqual([]);
    });

    it('returns an empty array when no cell ids are selected', () => {
      const node = fakeCell({ id: 'n1' });
      const graph = fakeGraph([node]);
      expect(service.buildIconPickerCells(graph)).toEqual([]);
    });

    it('builds an IconPickerCellInfo for each selected node', () => {
      const arch = { provider: 'aws', service: 'lambda' };
      const node = fakeCell({ id: 'n1', shape: 'process', data: { _arch: arch } });
      const graph = fakeGraph([node]);

      const result = service.buildIconPickerCells(graph, ['n1']);

      expect(result).toEqual([{ cellId: 'n1', nodeType: 'process', arch }]);
    });

    it('excludes selected cells that are not nodes', () => {
      const edge = fakeCell({ id: 'e1', isNode: false, isEdge: true });
      const node = fakeCell({ id: 'n1', shape: 'store' });
      const graph = fakeGraph([node, edge]);

      const result = service.buildIconPickerCells(graph, ['n1', 'e1']);

      expect(result).toEqual([{ cellId: 'n1', nodeType: 'store', arch: null }]);
    });
  });

  describe('applyNodeStyleChange', () => {
    it('mutates body attrs and returns an update-node operation for a color change', () => {
      const node = fakeCell({
        id: 'n1',
        data: { nodeType: 'process' },
        attrs: { body: { stroke: '#000', fill: '#fff', fillOpacity: 1 } },
      });
      const event: StyleChangeEvent = {
        property: 'fillColor',
        value: '#ff0000',
        applicableCellIds: ['n1'],
      };

      const op = service.applyNodeStyleChange(node, event);

      expect(getByPath(node.__attrs, 'body/fill')).toBe('#ff0000');
      expect(node.__data['customStyles']).toBe(true);
      expect(op).not.toBeNull();
      expect(op!.type).toBe('update-node');
      expect((op as any).nodeId).toBe('n1');
      expect((op as any).updates.style).toEqual({ fill: '#ff0000' });
      expect((op as any).updates.properties).toEqual({ customStyles: true });
      // previousState captures the unchanged body fields. (The `fill` field is
      // re-read from the live body attrs after mutation — a verbatim-preserved
      // quirk of the original component code.)
      expect((op as any).previousState.style.stroke).toBe('#000');
      expect((op as any).previousState.style.fillOpacity).toBe(1);
      expect((op as any).previousState.properties).toEqual({ customStyles: false });
    });

    it('maps a strokeColor change to the body/stroke attr path', () => {
      const node = fakeCell({
        id: 'n1',
        data: { nodeType: 'process' },
        attrs: { body: { stroke: '#000', fill: '#fff', fillOpacity: 1 } },
      });
      const event: StyleChangeEvent = {
        property: 'strokeColor',
        value: '#123456',
        applicableCellIds: ['n1'],
      };

      const op = service.applyNodeStyleChange(node, event);

      expect(getByPath(node.__attrs, 'body/stroke')).toBe('#123456');
      expect(node.__data['customStyles']).toBe(true);
      expect(op).not.toBeNull();
      expect(op!.type).toBe('update-node');
      expect((op as any).updates.style).toEqual({ stroke: '#123456' });
      expect((op as any).updates.properties).toEqual({ customStyles: true });
      // previousState captures the unchanged body fields. (The `stroke` field is
      // re-read from the live body attrs after mutation — a verbatim-preserved
      // quirk of the original component code.)
      expect((op as any).previousState.style.fill).toBe('#fff');
      expect((op as any).previousState.style.fillOpacity).toBe(1);
      expect((op as any).previousState.properties).toEqual({ customStyles: false });
    });

    it('maps a numeric fillOpacity change to the body/fillOpacity attr path', () => {
      const node = fakeCell({
        id: 'n1',
        data: { nodeType: 'process' },
        attrs: { body: { stroke: '#000', fill: '#fff', fillOpacity: 1 } },
      });
      const event: StyleChangeEvent = {
        property: 'fillOpacity',
        value: 0.25,
        applicableCellIds: ['n1'],
      };

      const op = service.applyNodeStyleChange(node, event);

      expect(getByPath(node.__attrs, 'body/fillOpacity')).toBe(0.25);
      expect(node.__data['customStyles']).toBe(true);
      expect(op).not.toBeNull();
      expect(op!.type).toBe('update-node');
      expect((op as any).updates.style).toEqual({ fillOpacity: 0.25 });
      expect((op as any).updates.properties).toEqual({ customStyles: true });
      // previousState captures the unchanged body fields. (The `fillOpacity`
      // field is re-read from the live body attrs after mutation — a
      // verbatim-preserved quirk of the original component code.)
      expect((op as any).previousState.style.stroke).toBe('#000');
      expect((op as any).previousState.style.fill).toBe('#fff');
      expect((op as any).previousState.properties).toEqual({ customStyles: false });
    });

    it('applies a label position change and returns an update-node operation', () => {
      const node = fakeCell({
        id: 'n1',
        data: { nodeType: 'process' },
        attrs: { text: { refX: '50%', refY: '50%', textAnchor: 'middle' } },
      });
      const event: StyleChangeEvent = {
        property: 'labelPosition',
        value: 'top-left',
        applicableCellIds: ['n1'],
      };

      const op = service.applyNodeStyleChange(node, event);

      const expected = LABEL_POSITION_ATTRS['top-left'];
      expect(getByPath(node.__attrs, 'text/refX')).toBe(expected.refX);
      expect(getByPath(node.__attrs, 'text/textVerticalAnchor')).toBe(expected.textVerticalAnchor);
      expect(node.__data['customStyles']).toBe(true);
      expect(op).not.toBeNull();
      expect(op!.type).toBe('update-node');
      expect((op as any).updates.style).toMatchObject({
        refX: expected.refX,
        refY: expected.refY,
      });
    });

    it('returns null and does not mutate for an unknown label position key', () => {
      const node = fakeCell({ id: 'n1', attrs: { text: {} } });
      const event: StyleChangeEvent = {
        property: 'labelPosition',
        value: 'nowhere',
        applicableCellIds: ['n1'],
      };

      const op = service.applyNodeStyleChange(node, event);

      expect(op).toBeNull();
      expect(getByPath(node.__attrs, 'text/refX')).toBeUndefined();
    });
  });

  describe('applyEdgeStyleChange', () => {
    it('mutates the line stroke and returns an update-edge operation', () => {
      const edge = fakeCell({
        id: 'e1',
        isNode: false,
        isEdge: true,
        attrs: { line: { stroke: '#000000' } },
      });
      const event: StyleChangeEvent = {
        property: 'strokeColor',
        value: '#00ff00',
        applicableCellIds: ['e1'],
      };

      const op = service.applyEdgeStyleChange(edge, event);

      expect(getByPath(edge.__attrs, 'line/stroke')).toBe('#00ff00');
      expect(op.type).toBe('update-edge');
      expect((op as any).edgeId).toBe('e1');
      expect((op as any).updates.style).toEqual({ stroke: '#00ff00' });
      // previousState.style.stroke is re-read from the live line attrs after
      // mutation — a verbatim-preserved quirk of the original component code.
      expect((op as any).previousState.style).toHaveProperty('stroke');
    });
  });

  describe('clearCustomFormatting', () => {
    it('resets a node to default fill/stroke and returns an update-node operation', () => {
      const node = fakeCell({
        id: 'n1',
        shape: 'process',
        data: { nodeType: 'process', customStyles: true },
        attrs: { body: { stroke: '#abc', fill: '#def', fillOpacity: 0.3 } },
      });

      const op = service.clearCustomFormatting(node);

      const defaultFill = DFD_STYLING_HELPERS.getDefaultFill('process');
      const defaultStroke = DFD_STYLING_HELPERS.getDefaultStroke('process');
      expect(getByPath(node.__attrs, 'body/fill')).toBe(defaultFill);
      expect(getByPath(node.__attrs, 'body/stroke')).toBe(defaultStroke);
      expect(getByPath(node.__attrs, 'body/fillOpacity')).toBe(1);
      expect(node.__data['customStyles']).toBeUndefined();
      expect(op).not.toBeNull();
      expect(op!.type).toBe('update-node');
      expect((op as any).updates.style.fill).toBe(defaultFill);
    });

    it('uses refY 55% for store nodes', () => {
      const node = fakeCell({
        id: 'n1',
        shape: 'store',
        data: { nodeType: 'store' },
        attrs: { body: {} },
      });

      service.clearCustomFormatting(node);

      expect(getByPath(node.__attrs, 'text/refY')).toBe('55%');
    });

    it('resets an edge to the default stroke and returns an update-edge operation', () => {
      const edge = fakeCell({
        id: 'e1',
        isNode: false,
        isEdge: true,
        attrs: { line: { stroke: '#abc' } },
      });

      const op = service.clearCustomFormatting(edge);

      expect(getByPath(edge.__attrs, 'line/stroke')).toBe(DFD_STYLING.EDGES.DEFAULT_STROKE);
      expect(op).not.toBeNull();
      expect(op!.type).toBe('update-edge');
      expect((op as any).updates.style.stroke).toBe(DFD_STYLING.EDGES.DEFAULT_STROKE);
    });

    it('returns null for a cell that is neither a node nor an edge', () => {
      const cell = fakeCell({ id: 'c1', isNode: false, isEdge: false });
      expect(service.clearCustomFormatting(cell)).toBeNull();
    });
  });
});
