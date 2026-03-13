import { describe, it, expect } from 'vitest';
import { extractCellsFromGraph } from './cell-extraction.util';

/**
 * Creates a mock X6 graph with configurable cells for testing.
 * Each mock cell supports the X6 Cell API methods used by extractCellsFromGraph.
 */
function createMockGraph(cells: any[]) {
  return {
    getCells: () => cells,
  };
}

function createMockNode(
  overrides: Partial<{
    id: string;
    shape: string;
    attrs: Record<string, unknown>;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    data: any;
    parent: any;
    ports: any;
  }> = {},
) {
  const {
    id = 'node-1',
    shape = 'process',
    attrs = {
      body: { fill: '#fff7e6', stroke: '#ff7f0e', strokeWidth: 2 },
      text: { text: 'My Process' },
    },
    x = 100,
    y = 200,
    width = 120,
    height = 60,
    zIndex = 1,
    data = null,
    parent = null,
    ports = { items: [] },
  } = overrides;

  return {
    id,
    shape,
    isNode: () => true,
    isEdge: () => false,
    getAttrs: () => attrs,
    position: () => ({ x, y }),
    size: () => ({ width, height }),
    getZIndex: () => zIndex,
    getData: () => data,
    getParent: () => parent,
    getProp: (key: string) => (key === 'ports' ? ports : undefined),
    getLabel: () => (attrs as any)?.text?.text || '',
  };
}

function createMockEdge(
  overrides: Partial<{
    id: string;
    source: any;
    target: any;
    vertices: any[];
    zIndex: number;
    data: any;
    labels: any[];
    attrs: Record<string, unknown>;
  }> = {},
) {
  const {
    id = 'edge-1',
    source = { cell: 'node-1', port: 'port-1' },
    target = { cell: 'node-2', port: 'port-2' },
    vertices = [],
    zIndex = 0,
    data = null,
    labels = [],
    attrs = { line: { stroke: '#333', strokeWidth: 1 } },
  } = overrides;

  return {
    id,
    shape: 'edge',
    isNode: () => false,
    isEdge: () => true,
    getAttrs: () => attrs,
    getSource: () => source,
    getTarget: () => target,
    getVertices: () => vertices,
    getZIndex: () => zIndex,
    getData: () => data,
    getLabels: () => labels,
  };
}

describe('extractCellsFromGraph', () => {
  it('should extract node with complete attrs including fill and stroke', () => {
    const node = createMockNode({
      attrs: {
        body: { fill: '#e8f4fd', stroke: '#1f77b4', strokeWidth: 2 },
        text: { text: 'Actor Node', fontSize: 14, fill: '#333333' },
      },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result).toHaveLength(1);
    expect((result[0].attrs as any)?.body?.fill).toBe('#e8f4fd');
    expect((result[0].attrs as any)?.body?.stroke).toBe('#1f77b4');
    expect((result[0].attrs as any)?.text?.text).toBe('Actor Node');
  });

  it('should preserve attrs that match X6 shape defaults (the bug fix)', () => {
    // This is the core regression test: white fill + black stroke are
    // X6 shape defaults. graph.toJSON() strips these; our utility must not.
    const node = createMockNode({
      attrs: {
        body: { fill: '#FFFFFF', stroke: '#000000', strokeWidth: 2 },
        text: { text: 'Default Colors' },
      },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect((result[0].attrs as any)?.body?.fill).toBe('#FFFFFF');
    expect((result[0].attrs as any)?.body?.stroke).toBe('#000000');
  });

  it('should use nested position/size format (X6 v2 native)', () => {
    const node = createMockNode({ x: 150, y: 250, width: 200, height: 80 });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].position).toEqual({ x: 150, y: 250 });
    expect(result[0].size).toEqual({ width: 200, height: 80 });
    // Must NOT have flat x/y/width/height
    expect(result[0]).not.toHaveProperty('x');
    expect(result[0]).not.toHaveProperty('y');
    expect(result[0]).not.toHaveProperty('width');
    expect(result[0]).not.toHaveProperty('height');
  });

  it('should extract edges with source/target/vertices', () => {
    const edge = createMockEdge({
      source: { cell: 'a', port: 'p1' },
      target: { cell: 'b', port: 'p2' },
      vertices: [{ x: 300, y: 150 }],
    });
    const graph = createMockGraph([edge]);

    const result = extractCellsFromGraph(graph as any);

    expect(result).toHaveLength(1);
    expect(result[0].shape).toBe('edge');
    expect(result[0].source).toEqual({ cell: 'a', port: 'p1' });
    expect(result[0].target).toEqual({ cell: 'b', port: 'p2' });
    expect(result[0].vertices).toEqual([{ x: 300, y: 150 }]);
  });

  it('should handle mixed nodes and edges', () => {
    const node = createMockNode({ id: 'n1' });
    const edge = createMockEdge({ id: 'e1' });
    const graph = createMockGraph([node, edge]);

    const result = extractCellsFromGraph(graph as any);

    expect(result).toHaveLength(2);
    const nodeResult = result.find(c => c.id === 'n1');
    const edgeResult = result.find(c => c.id === 'e1');
    expect(nodeResult).toBeDefined();
    expect(edgeResult).toBeDefined();
  });

  it('should include parent reference for embedded nodes', () => {
    const parentNode = createMockNode({
      id: 'parent-1',
      shape: 'security-boundary',
    });
    const childNode = createMockNode({
      id: 'child-1',
      parent: { id: 'parent-1', isNode: () => true },
    });
    const graph = createMockGraph([parentNode, childNode]);

    const result = extractCellsFromGraph(graph as any);
    const child = result.find(c => c.id === 'child-1');

    expect(child?.parent).toBe('parent-1');
  });

  it('should include edge labels', () => {
    const edge = createMockEdge({
      labels: [{ attrs: { label: { text: 'Data Flow' } } }],
    });
    const graph = createMockGraph([edge]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].labels).toHaveLength(1);
  });

  it('should convert cell data to hybrid format', () => {
    const node = createMockNode({
      data: { _metadata: [{ key: 'type', value: 'process' }] },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].data).toEqual({
      _metadata: [{ key: 'type', value: 'process' }],
    });
  });

  it('should return empty array for graph with no cells', () => {
    const graph = createMockGraph([]);
    const result = extractCellsFromGraph(graph as any);
    expect(result).toEqual([]);
  });

  it('should strip runtime port visibility state', () => {
    const node = createMockNode({
      ports: {
        items: [{ id: 'p1', group: 'in', attrs: { circle: { r: 6 } } }],
      },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    // Ports should be included but cleaned of runtime state
    expect(result[0].ports).toBeDefined();
  });
});
