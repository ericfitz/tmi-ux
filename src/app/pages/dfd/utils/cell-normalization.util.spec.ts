import { describe, it, expect } from 'vitest';
import { normalizeCell, normalizeCells } from './cell-normalization.util';
import { Cell } from '../../../core/types/websocket-message.types';

describe('cell-normalization.util', () => {
  describe('normalizeCell', () => {
    describe('filter property removal', () => {
      it('should remove body/filter from node attrs', () => {
        const cell: Cell = {
          id: 'node1',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#000000',
              filter: 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))',
            },
            text: {
              text: 'Process',
              fontSize: 14,
            },
          },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.attrs).toBeDefined();
        expect((normalized.attrs as any).body).toBeDefined();
        expect((normalized.attrs as any).body.fill).toBe('#ffffff');
        expect((normalized.attrs as any).body.stroke).toBe('#000000');
        expect((normalized.attrs as any).body.filter).toBeUndefined();
        expect((normalized.attrs as any).text.text).toBe('Process');
      });

      it('should remove text/filter from text-box attrs', () => {
        const cell: Cell = {
          id: 'node2',
          shape: 'text-box',
          position: { x: 200, y: 200 },
          size: { width: 100, height: 40 },
          attrs: {
            text: {
              text: 'Note',
              fontSize: 12,
              filter: 'drop-shadow(0 0 8px rgba(0, 255, 0, 0.8))',
            },
          },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.attrs).toBeDefined();
        expect((normalized.attrs as any).text).toBeDefined();
        expect((normalized.attrs as any).text.text).toBe('Note');
        expect((normalized.attrs as any).text.fontSize).toBe(12);
        expect((normalized.attrs as any).text.filter).toBeUndefined();
      });

      it('should remove line/filter from edge attrs', () => {
        const cell: Cell = {
          id: 'edge1',
          shape: 'edge',
          source: { cell: 'node1' },
          target: { cell: 'node2' },
          attrs: {
            line: {
              stroke: '#333333',
              strokeWidth: 2,
              filter: 'drop-shadow(0 0 8px rgba(0, 0, 255, 0.8))',
            },
          },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.attrs).toBeDefined();
        expect((normalized.attrs as any).line).toBeDefined();
        expect((normalized.attrs as any).line.stroke).toBe('#333333');
        expect((normalized.attrs as any).line.strokeWidth).toBe(2);
        expect((normalized.attrs as any).line.filter).toBeUndefined();
      });

      it('should remove filters from multiple nested attrs', () => {
        const cell: Cell = {
          id: 'node3',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          attrs: {
            body: {
              fill: '#ffffff',
              filter: 'drop-shadow(0 0 8px red)',
            },
            text: {
              text: 'Label',
              filter: 'drop-shadow(0 0 8px blue)',
            },
            label: {
              text: 'Another label',
              filter: 'drop-shadow(0 0 8px green)',
            },
          },
        };

        const normalized = normalizeCell(cell);

        expect((normalized.attrs as any).body.filter).toBeUndefined();
        expect((normalized.attrs as any).body.fill).toBe('#ffffff');
        expect((normalized.attrs as any).text.filter).toBeUndefined();
        expect((normalized.attrs as any).text.text).toBe('Label');
        expect((normalized.attrs as any).label.filter).toBeUndefined();
        expect((normalized.attrs as any).label.text).toBe('Another label');
      });

      it('should handle attrs without filter properties', () => {
        const cell: Cell = {
          id: 'node4',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#000000',
            },
            text: {
              text: 'Clean',
            },
          },
        };

        const normalized = normalizeCell(cell);

        expect((normalized.attrs as any).body.fill).toBe('#ffffff');
        expect((normalized.attrs as any).body.stroke).toBe('#000000');
        expect((normalized.attrs as any).text.text).toBe('Clean');
      });

      it('should preserve non-object attrs values', () => {
        const cell: Cell = {
          id: 'node5',
          shape: 'custom',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          attrs: {
            body: {
              fill: '#ffffff',
            },
            simpleString: 'value',
            simpleNumber: 42,
            simpleBoolean: true,
            simpleNull: null,
          },
        };

        const normalized = normalizeCell(cell);

        expect((normalized.attrs as any).simpleString).toBe('value');
        expect((normalized.attrs as any).simpleNumber).toBe(42);
        expect((normalized.attrs as any).simpleBoolean).toBe(true);
        expect((normalized.attrs as any).simpleNull).toBeNull();
      });

      it('should handle cells without attrs', () => {
        const cell: Cell = {
          id: 'node6',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.id).toBe('node6');
        expect(normalized.shape).toBe('process');
      });

      it('should handle empty attrs object', () => {
        const cell: Cell = {
          id: 'node7',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          attrs: {},
        };

        const normalized = normalizeCell(cell);

        expect(normalized.attrs).toEqual({});
      });
    });

    describe('tools property removal', () => {
      it('should remove top-level tools property', () => {
        const cell: Cell = {
          id: 'node8',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          tools: [
            {
              name: 'button-remove',
              args: { x: 0, y: 0 },
            },
          ],
        } as any;

        const normalized = normalizeCell(cell);

        expect((normalized as any).tools).toBeUndefined();
      });

      it('should handle cells without tools property', () => {
        const cell: Cell = {
          id: 'node9',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
        };

        const normalized = normalizeCell(cell);

        expect((normalized as any).tools).toBeUndefined();
      });
    });

    describe('coordinate rounding', () => {
      it('should round position coordinates to integers', () => {
        const cell: Cell = {
          id: 'node10',
          shape: 'process',
          position: { x: 100.7, y: 200.3 },
          size: { width: 120, height: 60 },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.position?.x).toBe(101);
        expect(normalized.position?.y).toBe(200);
      });

      it('should round size dimensions to integers', () => {
        const cell: Cell = {
          id: 'node11',
          shape: 'process',
          position: { x: 100, y: 200 },
          size: { width: 120.8, height: 60.2 },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.size?.width).toBe(121);
        expect(normalized.size?.height).toBe(60);
      });

      it('should handle cells without position or size', () => {
        const cell: Cell = {
          id: 'edge2',
          shape: 'edge',
          source: { cell: 'node1' },
          target: { cell: 'node2' },
        };

        const normalized = normalizeCell(cell);

        expect(normalized.id).toBe('edge2');
        expect(normalized.shape).toBe('edge');
      });
    });

    describe('edge label filtering', () => {
      it('should keep only the first label for edges', () => {
        const cell: Cell = {
          id: 'edge3',
          shape: 'edge',
          source: { cell: 'node1' },
          target: { cell: 'node2' },
          labels: [
            { attrs: { text: { text: 'First' } } },
            { attrs: { text: { text: 'Second' } } },
            { attrs: { text: { text: 'Third' } } },
          ],
        } as any;

        const normalized = normalizeCell(cell);

        expect((normalized as any).labels).toHaveLength(1);
        expect((normalized as any).labels[0].attrs.text.text).toBe('First');
      });

      it('should preserve single label for edges', () => {
        const cell: Cell = {
          id: 'edge4',
          shape: 'edge',
          source: { cell: 'node1' },
          target: { cell: 'node2' },
          labels: [{ attrs: { text: { text: 'Only' } } }],
        } as any;

        const normalized = normalizeCell(cell);

        expect((normalized as any).labels).toHaveLength(1);
        expect((normalized as any).labels[0].attrs.text.text).toBe('Only');
      });

      it('should handle edges with empty labels array', () => {
        const cell: Cell = {
          id: 'edge5',
          shape: 'edge',
          source: { cell: 'node1' },
          target: { cell: 'node2' },
          labels: [],
        } as any;

        const normalized = normalizeCell(cell);

        expect((normalized as any).labels).toEqual([]);
      });

      it('should not affect non-edge shapes with labels', () => {
        const cell: Cell = {
          id: 'node12',
          shape: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          labels: [{ attrs: { text: { text: 'First' } } }, { attrs: { text: { text: 'Second' } } }],
        } as any;

        const normalized = normalizeCell(cell);

        expect((normalized as any).labels).toHaveLength(2);
      });
    });

    describe('comprehensive normalization', () => {
      it('should apply all normalizations together', () => {
        const cell: Cell = {
          id: 'node13',
          shape: 'process',
          position: { x: 100.7, y: 200.3 },
          size: { width: 120.8, height: 60.2 },
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#000000',
              filter: 'drop-shadow(0 0 8px red)',
            },
            text: {
              text: 'Process',
              filter: 'drop-shadow(0 0 8px blue)',
            },
          },
          tools: [{ name: 'button-remove' }],
        } as any;

        const normalized = normalizeCell(cell);

        // Check filter removal
        expect((normalized.attrs as any).body.filter).toBeUndefined();
        expect((normalized.attrs as any).text.filter).toBeUndefined();

        // Check tools removal
        expect((normalized as any).tools).toBeUndefined();

        // Check coordinate rounding
        expect(normalized.position?.x).toBe(101);
        expect(normalized.position?.y).toBe(200);
        expect(normalized.size?.width).toBe(121);
        expect(normalized.size?.height).toBe(60);

        // Check preserved properties
        expect((normalized.attrs as any).body.fill).toBe('#ffffff');
        expect((normalized.attrs as any).body.stroke).toBe('#000000');
        expect((normalized.attrs as any).text.text).toBe('Process');
      });
    });
  });

  describe('normalizeCells', () => {
    it('should normalize array of cells', () => {
      const cells: Cell[] = [
        {
          id: 'node1',
          shape: 'process',
          position: { x: 100.5, y: 200.5 },
          size: { width: 120, height: 60 },
          attrs: {
            body: {
              fill: '#ffffff',
              filter: 'drop-shadow(0 0 8px red)',
            },
          },
        },
        {
          id: 'node2',
          shape: 'process',
          position: { x: 300.5, y: 400.5 },
          size: { width: 120, height: 60 },
          attrs: {
            body: {
              fill: '#eeeeee',
              filter: 'drop-shadow(0 0 8px blue)',
            },
          },
        },
      ];

      const normalized = normalizeCells(cells);

      expect(normalized).toHaveLength(2);

      // Check first cell
      expect((normalized[0].attrs as any).body.filter).toBeUndefined();
      expect(normalized[0].position?.x).toBe(101);
      expect(normalized[0].position?.y).toBe(201);

      // Check second cell
      expect((normalized[1].attrs as any).body.filter).toBeUndefined();
      expect(normalized[1].position?.x).toBe(301);
      expect(normalized[1].position?.y).toBe(401);
    });

    it('should handle empty array', () => {
      const cells: Cell[] = [];
      const normalized = normalizeCells(cells);

      expect(normalized).toEqual([]);
    });
  });
});
