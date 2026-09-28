import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Graph } from '@antv/x6';
import {
  getApplicationMetadata,
  getCellLabel,
  getNodeTypeInfo,
  removeApplicationMetadata,
  setApplicationMetadata,
  setCellLabel,
} from './x6-cell-extensions';

describe('x6-cell-extensions', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph({ container: document.createElement('div'), width: 400, height: 300 });
  });

  afterEach(() => {
    graph.dispose();
  });

  describe('application metadata', () => {
    it('sets, replaces and reads a value', () => {
      const node = graph.addNode({ shape: 'rect', x: 0, y: 0, width: 10, height: 10 });

      setApplicationMetadata(node, 'a', '1');
      setApplicationMetadata(node, 'b', '2');
      setApplicationMetadata(node, 'a', '3');

      expect(getApplicationMetadata(node, 'a')).toBe('3');
      expect(getApplicationMetadata(node, 'b')).toBe('2');
      expect(getApplicationMetadata(node, 'missing')).toBe('');
      expect(node.getData()._metadata).toHaveLength(2);
    });

    it('removes an entry and keeps other data', () => {
      const node = graph.addNode({
        shape: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        data: { other: 'kept', _metadata: [{ key: 'keep', value: 'x' }] },
      });
      setApplicationMetadata(node, 'tmp', 'y');

      removeApplicationMetadata(node, 'tmp');

      expect(node.getData()).toEqual({ other: 'kept', _metadata: [{ key: 'keep', value: 'x' }] });
    });
  });

  describe('labels', () => {
    it('round-trips a node label', () => {
      const node = graph.addNode({ shape: 'rect', x: 0, y: 0, width: 10, height: 10 });
      setCellLabel(node, 'Server');
      expect(getCellLabel(node)).toBe('Server');
    });

    it('round-trips an edge label, preserving position', () => {
      const edge = graph.addEdge({
        source: { x: 0, y: 0 },
        target: { x: 100, y: 0 },
        labels: [{ position: 0.25, attrs: { text: { text: 'old' } } }],
      });

      setCellLabel(edge, 'new');

      expect(getCellLabel(edge)).toBe('new');
      expect(edge.getLabels()[0].position).toBe(0.25);
    });

    it('returns empty string for an unlabeled edge', () => {
      const edge = graph.addEdge({ source: { x: 0, y: 0 }, target: { x: 100, y: 0 } });
      expect(getCellLabel(edge)).toBe('');
    });
  });

  describe('getNodeTypeInfo', () => {
    it('derives type info from the node shape', () => {
      const node = graph.addNode({ shape: 'rect', x: 0, y: 0, width: 10, height: 10 });
      expect(getNodeTypeInfo(node)).toMatchObject({ type: 'rect', defaultZIndex: 10 });
    });

    it('returns null for edges', () => {
      const edge = graph.addEdge({ source: { x: 0, y: 0 }, target: { x: 100, y: 0 } });
      expect(getNodeTypeInfo(edge)).toBeNull();
    });
  });
});
