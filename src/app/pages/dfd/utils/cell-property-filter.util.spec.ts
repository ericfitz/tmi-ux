/**
 * Tests for Cell Property Filter Utility
 */

import { describe, it, expect } from 'vitest';
import {
  JSONPathMatcher,
  extractPropertyPaths,
  shouldTriggerHistoryOrPersistence,
  sanitizeCell,
  sanitizeCells,
  isPropertyExcludedFromTriggers,
  isPropertySanitized,
  sanitizeCellForApi,
  sanitizeCellsForApi,
  EXCLUDE_FROM_HISTORY_TRIGGERS,
  SANITIZE_FROM_CELLS,
} from './cell-property-filter.util';
import { Cell } from '../../../core/types/websocket-message.types';

describe('Cell Property Filter Utility', () => {
  describe('JSONPathMatcher', () => {
    describe('matches()', () => {
      it('should match simple property paths', () => {
        expect(JSONPathMatcher.matches('attrs.body.filter', '$.attrs.body.filter')).toBe(true);
        expect(JSONPathMatcher.matches('attrs.text.filter', '$.attrs.text.filter')).toBe(true);
        expect(JSONPathMatcher.matches('zIndex', '$.zIndex')).toBe(true);
      });

      it('should not match different property paths', () => {
        expect(JSONPathMatcher.matches('attrs.body.fill', '$.attrs.body.filter')).toBe(false);
        expect(JSONPathMatcher.matches('attrs.line.stroke', '$.attrs.body.filter')).toBe(false);
      });

      it('should match array wildcard patterns', () => {
        expect(
          JSONPathMatcher.matches(
            'ports.items[0].attrs.circle.style.visibility',
            '$.ports.items[*].attrs.circle.style.visibility',
          ),
        ).toBe(true);
        expect(
          JSONPathMatcher.matches(
            'ports.items[5].attrs.circle.style.visibility',
            '$.ports.items[*].attrs.circle.style.visibility',
          ),
        ).toBe(true);
        expect(JSONPathMatcher.matches('tools[0].name', '$.tools[*]')).toBe(true);
      });

      it('should match object wildcard patterns', () => {
        expect(
          JSONPathMatcher.matches(
            'ports.groups.top.attrs.circle.style.visibility',
            '$.ports.groups.*.attrs.circle.style.visibility',
          ),
        ).toBe(true);
        expect(
          JSONPathMatcher.matches(
            'ports.groups.bottom.attrs.circle.style.visibility',
            '$.ports.groups.*.attrs.circle.style.visibility',
          ),
        ).toBe(true);
      });

      it('should handle paths without leading $. prefix', () => {
        expect(JSONPathMatcher.matches('zIndex', 'zIndex')).toBe(true);
        expect(JSONPathMatcher.matches('attrs.body.filter', 'attrs.body.filter')).toBe(true);
      });
    });

    describe('matchesAny()', () => {
      it('should return true if any pattern matches', () => {
        const patterns = ['$.attrs.body.filter', '$.attrs.text.filter', '$.zIndex'];
        expect(JSONPathMatcher.matchesAny('attrs.body.filter', patterns)).toBe(true);
        expect(JSONPathMatcher.matchesAny('zIndex', patterns)).toBe(true);
      });

      it('should return false if no patterns match', () => {
        const patterns = ['$.attrs.body.filter', '$.attrs.text.filter'];
        expect(JSONPathMatcher.matchesAny('attrs.body.stroke', patterns)).toBe(false);
        expect(JSONPathMatcher.matchesAny('position.x', patterns)).toBe(false);
      });
    });
  });

  describe('extractPropertyPaths()', () => {
    it('should extract simple property paths', () => {
      const obj = {
        id: 'node1',
        zIndex: 10,
      };
      const paths = extractPropertyPaths(obj);
      expect(paths.has('id')).toBe(true);
      expect(paths.has('zIndex')).toBe(true);
    });

    it('should extract nested property paths (all paths)', () => {
      const obj = {
        attrs: {
          body: {
            filter: 'blur(5px)',
            fill: '#fff',
          },
        },
      };
      const paths = extractPropertyPaths(obj, '', false); // All paths including intermediates
      expect(paths.has('attrs')).toBe(true);
      expect(paths.has('attrs.body')).toBe(true);
      expect(paths.has('attrs.body.filter')).toBe(true);
      expect(paths.has('attrs.body.fill')).toBe(true);
    });

    it('should extract only leaf paths when requested', () => {
      const obj = {
        attrs: {
          body: {
            filter: 'blur(5px)',
            fill: '#fff',
          },
        },
      };
      const paths = extractPropertyPaths(obj, '', true); // Only leaf paths
      expect(paths.has('attrs')).toBe(false);
      expect(paths.has('attrs.body')).toBe(false);
      expect(paths.has('attrs.body.filter')).toBe(true); // Leaf
      expect(paths.has('attrs.body.fill')).toBe(true); // Leaf
    });

    it('should extract array paths with indices (all paths)', () => {
      const obj = {
        tools: [{ name: 'button-remove' }, { name: 'boundary' }],
      };
      const paths = extractPropertyPaths(obj, '', false);
      expect(paths.has('tools')).toBe(true);
      expect(paths.has('tools[0]')).toBe(false); // Not added for objects in arrays
      expect(paths.has('tools[0].name')).toBe(true);
      expect(paths.has('tools[1]')).toBe(false); // Not added for objects in arrays
      expect(paths.has('tools[1].name')).toBe(true);
    });

    it('should extract complex nested paths', () => {
      const obj = {
        ports: {
          items: [
            {
              attrs: {
                circle: {
                  style: {
                    visibility: 'visible',
                  },
                },
              },
            },
          ],
        },
      };
      const paths = extractPropertyPaths(obj);
      expect(paths.has('ports.items[0].attrs.circle.style.visibility')).toBe(true);
    });
  });

  describe('shouldTriggerHistoryOrPersistence()', () => {
    it('should return false if only excluded properties changed', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'rect',
        attrs: {
          body: {
            filter: 'none',
            fill: '#fff',
          },
        },
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'rect',
        attrs: {
          body: {
            filter: 'blur(5px)', // Only filter changed (excluded)
            fill: '#fff',
          },
        },
      };

      expect(shouldTriggerHistoryOrPersistence(previousCell, currentCell)).toBe(false);
    });

    it('should return false if only zIndex changed', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'rect',
        zIndex: 1,
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'rect',
        zIndex: 5, // Only zIndex changed (excluded)
      };

      expect(shouldTriggerHistoryOrPersistence(previousCell, currentCell)).toBe(false);
    });

    it('should return false if only tools property changed', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'rect',
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'rect',
        tools: [{ name: 'button-remove' }], // Tools added (excluded)
      };

      expect(shouldTriggerHistoryOrPersistence(previousCell, currentCell)).toBe(false);
    });

    it('should return true if any non-excluded property changed', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'rect',
        attrs: {
          body: {
            filter: 'none',
            fill: '#fff',
          },
        },
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'rect',
        attrs: {
          body: {
            filter: 'blur(5px)', // Excluded change
            fill: '#000', // Non-excluded change (fill color)
          },
        },
      };

      expect(shouldTriggerHistoryOrPersistence(previousCell, currentCell)).toBe(true);
    });

    it('should return true if position changed', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'rect',
        position: { x: 100, y: 100 },
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'rect',
        position: { x: 200, y: 100 }, // Position changed (not excluded)
      };

      expect(shouldTriggerHistoryOrPersistence(previousCell, currentCell)).toBe(true);
    });

    it('should return false if no changes detected', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        position: { x: 100, y: 100 },
      };

      expect(shouldTriggerHistoryOrPersistence(cell, cell)).toBe(false);
    });

    it('should return false if only port visibility changed', () => {
      const previousCell: Cell = {
        id: 'node1',
        shape: 'rect',
        ports: {
          items: [
            {
              id: 'port1',
              attrs: {
                circle: {
                  style: {
                    visibility: 'hidden',
                  },
                },
              },
            },
          ],
        },
      };

      const currentCell: Cell = {
        id: 'node1',
        shape: 'rect',
        ports: {
          items: [
            {
              id: 'port1',
              attrs: {
                circle: {
                  style: {
                    visibility: 'visible', // Port visibility changed (excluded)
                  },
                },
              },
            },
          ],
        },
      };

      expect(shouldTriggerHistoryOrPersistence(previousCell, currentCell)).toBe(false);
    });
  });

  describe('sanitizeCell()', () => {
    it('should remove visual effect filter properties', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        attrs: {
          body: {
            filter: 'blur(5px)',
            fill: '#fff',
            stroke: '#000',
          },
          text: {
            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))',
            text: 'Label',
          },
        },
      };

      const sanitized = sanitizeCell(cell);

      expect(sanitized.attrs?.body?.filter).toBeUndefined();
      expect(sanitized.attrs?.text?.filter).toBeUndefined();
      expect(sanitized.attrs?.body?.fill).toBe('#fff');
      expect(sanitized.attrs?.body?.stroke).toBe('#000');
      expect(sanitized.attrs?.text?.text).toBe('Label');
    });

    it('should remove zIndex property', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        zIndex: 10,
        position: { x: 100, y: 100 },
      };

      const sanitized = sanitizeCell(cell);

      expect(sanitized.zIndex).toBeUndefined();
      expect(sanitized.position).toEqual({ x: 100, y: 100 });
    });

    it('should remove tools property', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        tools: [{ name: 'button-remove' }, { name: 'boundary' }],
      };

      const sanitized = sanitizeCell(cell);

      expect(sanitized.tools).toBeUndefined();
      expect(sanitized.id).toBe('node1');
    });

    it('should remove port visibility properties', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        ports: {
          items: [
            {
              id: 'port1',
              group: 'top',
              attrs: {
                circle: {
                  r: 5,
                  style: {
                    visibility: 'visible',
                  },
                },
              },
            },
          ],
        },
      };

      const sanitized = sanitizeCell(cell);

      expect(sanitized.ports?.items?.[0]?.attrs?.circle?.r).toBe(5);
      expect(sanitized.ports?.items?.[0]?.attrs?.circle?.style?.visibility).toBeUndefined();
    });

    it('should preserve all non-excluded properties', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        attrs: {
          body: {
            fill: '#fff',
            stroke: '#000',
            strokeWidth: 2,
          },
          label: {
            text: 'My Node',
          },
        },
        data: {
          customProp: 'value',
        },
      };

      const sanitized = sanitizeCell(cell);

      expect(sanitized.id).toBe('node1');
      expect(sanitized.shape).toBe('rect');
      expect(sanitized.position).toEqual({ x: 100, y: 100 });
      expect(sanitized.size).toEqual({ width: 120, height: 60 });
      expect(sanitized.attrs?.body?.fill).toBe('#fff');
      expect(sanitized.attrs?.body?.stroke).toBe('#000');
      expect(sanitized.attrs?.body?.strokeWidth).toBe(2);
      expect(sanitized.attrs?.label?.text).toBe('My Node');
      expect(sanitized.data?.customProp).toBe('value');
    });

    it('should not mutate the original cell', () => {
      const cell: Cell = {
        id: 'node1',
        shape: 'rect',
        zIndex: 10,
        attrs: {
          body: {
            filter: 'blur(5px)',
          },
        },
      };

      const sanitized = sanitizeCell(cell);

      // Original should still have excluded properties
      expect(cell.zIndex).toBe(10);
      expect(cell.attrs?.body?.filter).toBe('blur(5px)');

      // Sanitized should not
      expect(sanitized.zIndex).toBeUndefined();
      expect(sanitized.attrs?.body?.filter).toBeUndefined();
    });
  });

  describe('sanitizeCells()', () => {
    it('should sanitize all cells in an array', () => {
      const cells: Cell[] = [
        {
          id: 'node1',
          shape: 'rect',
          zIndex: 1,
          tools: [{ name: 'button-remove' }],
        },
        {
          id: 'node2',
          shape: 'rect',
          zIndex: 2,
          attrs: {
            body: {
              filter: 'blur(5px)',
            },
          },
        },
      ];

      const sanitized = sanitizeCells(cells);

      expect(sanitized).toHaveLength(2);
      expect(sanitized[0].zIndex).toBeUndefined();
      expect(sanitized[0].tools).toBeUndefined();
      expect(sanitized[1].zIndex).toBeUndefined();
      expect(sanitized[1].attrs?.body?.filter).toBeUndefined();
    });
  });

  describe('isPropertyExcludedFromTriggers()', () => {
    it('should return true for excluded property paths', () => {
      expect(isPropertyExcludedFromTriggers('attrs.body.filter')).toBe(true);
      expect(isPropertyExcludedFromTriggers('attrs.text.filter')).toBe(true);
      expect(isPropertyExcludedFromTriggers('attrs.line.filter')).toBe(true);
      expect(isPropertyExcludedFromTriggers('zIndex')).toBe(true);
      expect(isPropertyExcludedFromTriggers('tools')).toBe(true);
    });

    it('should return false for non-excluded property paths', () => {
      expect(isPropertyExcludedFromTriggers('attrs.body.fill')).toBe(false);
      expect(isPropertyExcludedFromTriggers('position.x')).toBe(false);
      expect(isPropertyExcludedFromTriggers('size.width')).toBe(false);
    });
  });

  describe('isPropertySanitized()', () => {
    it('should return true for sanitized property paths', () => {
      expect(isPropertySanitized('attrs.body.filter')).toBe(true);
      expect(isPropertySanitized('attrs.text.filter')).toBe(true);
      expect(isPropertySanitized('zIndex')).toBe(true);
      expect(isPropertySanitized('tools')).toBe(true);
    });

    it('should return false for non-sanitized property paths', () => {
      expect(isPropertySanitized('attrs.body.fill')).toBe(false);
      expect(isPropertySanitized('position.x')).toBe(false);
    });
  });

  describe('Configuration constants', () => {
    it('EXCLUDE_FROM_HISTORY_TRIGGERS should contain expected patterns', () => {
      const patterns = Array.from(EXCLUDE_FROM_HISTORY_TRIGGERS);
      // Uses wildcard pattern for all filter properties in attrs
      expect(patterns).toContain('$.attrs.*.filter');
      expect(patterns).toContain('$.zIndex');
      expect(patterns).toContain('$.tools');
      expect(patterns).toContain('$.tools[*]');
      // Port visibility patterns
      expect(patterns).toContain('$.ports.items[*].attrs.circle.style.visibility');
      expect(patterns).toContain('$.ports.groups.*.attrs.circle.style.visibility');
    });

    it('SANITIZE_FROM_CELLS should contain expected patterns', () => {
      const patterns = Array.from(SANITIZE_FROM_CELLS);
      // Uses wildcard pattern for all filter properties in attrs
      expect(patterns).toContain('$.attrs.*.filter');
      expect(patterns).toContain('$.zIndex');
      expect(patterns).toContain('$.tools');
      // Port visibility patterns
      expect(patterns).toContain('$.ports.items[*].attrs.circle.style.visibility');
      expect(patterns).toContain('$.ports.groups.*.attrs.circle.style.visibility');
    });
  });

  // ===========================================================================
  // API Schema Compliance Filtering Tests
  // ===========================================================================

  describe('sanitizeCellForApi()', () => {
    describe('node filtering', () => {
      it('should keep allowed node properties', () => {
        const node: Cell = {
          id: 'node-1',
          shape: 'process',
          position: { x: 100, y: 200 },
          size: { width: 120, height: 80 },
          angle: 45,
          parent: 'boundary-1',
          data: { _metadata: [] },
          attrs: {
            body: { fill: '#ffffff', stroke: '#333333' },
            text: { text: 'Process', fontSize: 14 },
          },
          ports: { items: [{ id: 'port-1', group: 'in' }] },
        };

        const sanitized = sanitizeCellForApi(node);

        expect(sanitized.id).toBe('node-1');
        expect(sanitized.shape).toBe('process');
        expect(sanitized.position).toEqual({ x: 100, y: 200 });
        expect(sanitized.size).toEqual({ width: 120, height: 80 });
        expect(sanitized.angle).toBe(45);
        expect(sanitized.parent).toBe('boundary-1');
        expect(sanitized.data).toEqual({ _metadata: [] });
        expect(sanitized.attrs).toEqual({
          body: { fill: '#ffffff', stroke: '#333333' },
          text: { text: 'Process', fontSize: 14 },
        });
        expect(sanitized.ports).toEqual({ items: [{ id: 'port-1', group: 'in' }] });
      });

      it('should silently remove known transient properties', () => {
        const node: Cell = {
          id: 'node-1',
          shape: 'process',
          children: ['child-1', 'child-2'],
          tools: [{ name: 'button-remove' }],
          type: 'node',
          selected: true,
          highlighted: true,
          visible: true,
          zIndex: 10,
          markup: [{ tagName: 'rect' }],
        } as Cell;

        const sanitized = sanitizeCellForApi(node);

        expect((sanitized as any).children).toBeUndefined();
        expect((sanitized as any).tools).toBeUndefined();
        expect((sanitized as any).type).toBeUndefined();
        expect((sanitized as any).selected).toBeUndefined();
        expect((sanitized as any).highlighted).toBeUndefined();
        expect((sanitized as any).visible).toBeUndefined();
        expect((sanitized as any).zIndex).toBeUndefined();
        expect((sanitized as any).markup).toBeUndefined();
      });

      it('should warn about unknown properties', () => {
        const warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
        const logger = {
          warn: (msg: string, ctx?: Record<string, unknown>) =>
            warnings.push({ message: msg, context: ctx }),
        };

        const node: Cell = {
          id: 'node-1',
          shape: 'process',
          unknownProp: 'value',
          anotherUnknown: 123,
        } as Cell;

        sanitizeCellForApi(node, logger);

        expect(warnings).toHaveLength(2);
        expect(warnings[0].message).toContain('unknownProp');
        expect(warnings[1].message).toContain('anotherUnknown');
      });

      it('should filter node attrs to match NodeAttrs schema', () => {
        const node: Cell = {
          id: 'node-1',
          shape: 'process',
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#333333',
              filter: 'blur(5px)', // Known transient - silently removed
              customProp: 'value', // Unknown - should warn
            },
            text: {
              text: 'Label',
              fontSize: 14,
              fill: '#000000',
              fontFamily: 'Arial',
            },
            unknownSelector: {
              // Unknown selector - should warn
              prop: 'value',
            },
          },
        };

        const warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
        const logger = {
          warn: (msg: string, ctx?: Record<string, unknown>) =>
            warnings.push({ message: msg, context: ctx }),
        };

        const sanitized = sanitizeCellForApi(node, logger);

        // Allowed properties should be preserved
        expect(sanitized.attrs?.body?.fill).toBe('#ffffff');
        expect(sanitized.attrs?.body?.stroke).toBe('#333333');
        expect(sanitized.attrs?.text?.text).toBe('Label');
        expect(sanitized.attrs?.text?.fontSize).toBe(14);

        // Filter should be silently removed (no warning)
        expect(sanitized.attrs?.body?.filter).toBeUndefined();

        // Unknown properties should be removed with warning
        expect((sanitized.attrs?.body as any)?.customProp).toBeUndefined();
        expect((sanitized.attrs as any)?.unknownSelector).toBeUndefined();

        // Should have warnings for customProp and unknownSelector
        expect(warnings.some(w => w.message.includes('customProp'))).toBe(true);
        expect(warnings.some(w => w.message.includes('unknownSelector'))).toBe(true);
        // Should NOT have warning for filter
        expect(warnings.some(w => w.message.includes('filter'))).toBe(false);
      });
    });

    describe('edge filtering', () => {
      it('should keep allowed edge properties', () => {
        const edge: Cell = {
          id: 'edge-1',
          shape: 'edge',
          source: { cell: 'node-1', port: 'port-out' },
          target: { cell: 'node-2', port: 'port-in' },
          labels: [{ attrs: { text: { text: 'Flow' } }, position: 0.5 }],
          vertices: [{ x: 150, y: 150 }],
          router: { name: 'manhattan' },
          connector: { name: 'rounded' },
          attrs: {
            line: { stroke: '#666', strokeWidth: 2 },
          },
        };

        const sanitized = sanitizeCellForApi(edge);

        expect(sanitized.id).toBe('edge-1');
        expect(sanitized.shape).toBe('edge');
        expect(sanitized.source).toEqual({ cell: 'node-1', port: 'port-out' });
        expect(sanitized.target).toEqual({ cell: 'node-2', port: 'port-in' });
        expect((sanitized as any).labels).toEqual([
          { attrs: { text: { text: 'Flow' } }, position: 0.5 },
        ]);
        expect((sanitized as any).vertices).toEqual([{ x: 150, y: 150 }]);
        expect((sanitized as any).router).toEqual({ name: 'manhattan' });
        expect((sanitized as any).connector).toEqual({ name: 'rounded' });
      });

      it('should ensure edge shape is set to "edge"', () => {
        const edge: Cell = {
          id: 'edge-1',
          shape: 'edge',
          source: { cell: 'node-1' },
          target: { cell: 'node-2' },
        };

        const sanitized = sanitizeCellForApi(edge);

        expect(sanitized.shape).toBe('edge');
      });

      it('should filter edge attrs to match EdgeAttrs schema', () => {
        const edge: Cell = {
          id: 'edge-1',
          shape: 'edge',
          source: { cell: 'node-1' },
          target: { cell: 'node-2' },
          attrs: {
            line: {
              stroke: '#666666',
              strokeWidth: 2,
              strokeDasharray: '5,5',
              targetMarker: { name: 'classic', size: 8 },
              sourceMarker: { name: 'circle', size: 4 },
              filter: 'blur(2px)', // Known transient - silently removed
              customProp: 'value', // Unknown - should warn
            },
            unknownSelector: {
              // Unknown selector - should warn
              prop: 'value',
            },
          },
        };

        const warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
        const logger = {
          warn: (msg: string, ctx?: Record<string, unknown>) =>
            warnings.push({ message: msg, context: ctx }),
        };

        const sanitized = sanitizeCellForApi(edge, logger);

        // Allowed properties should be preserved
        expect(sanitized.attrs?.line?.stroke).toBe('#666666');
        expect(sanitized.attrs?.line?.strokeWidth).toBe(2);
        expect(sanitized.attrs?.line?.strokeDasharray).toBe('5,5');
        expect(sanitized.attrs?.line?.targetMarker).toEqual({ name: 'classic', size: 8 });
        expect(sanitized.attrs?.line?.sourceMarker).toEqual({ name: 'circle', size: 4 });

        // Filter should be silently removed
        expect(sanitized.attrs?.line?.filter).toBeUndefined();

        // Unknown properties should be removed with warning
        expect((sanitized.attrs?.line as any)?.customProp).toBeUndefined();
        expect((sanitized.attrs as any)?.unknownSelector).toBeUndefined();

        // Should have warnings for customProp and unknownSelector
        expect(warnings.some(w => w.message.includes('customProp'))).toBe(true);
        expect(warnings.some(w => w.message.includes('unknownSelector'))).toBe(true);
      });

      it('should filter marker properties in edge attrs', () => {
        const edge: Cell = {
          id: 'edge-1',
          shape: 'edge',
          source: { cell: 'node-1' },
          target: { cell: 'node-2' },
          attrs: {
            line: {
              targetMarker: {
                name: 'classic',
                size: 8,
                unknownMarkerProp: 'value', // Should warn
              },
            },
          },
        };

        const warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
        const logger = {
          warn: (msg: string, ctx?: Record<string, unknown>) =>
            warnings.push({ message: msg, context: ctx }),
        };

        const sanitized = sanitizeCellForApi(edge, logger);

        expect(sanitized.attrs?.line?.targetMarker).toEqual({ name: 'classic', size: 8 });
        expect(warnings.some(w => w.message.includes('unknownMarkerProp'))).toBe(true);
      });
    });
  });

  describe('sanitizeCellsForApi()', () => {
    it('should sanitize all cells in an array', () => {
      const cells: Cell[] = [
        {
          id: 'node-1',
          shape: 'process',
          zIndex: 10,
          tools: [{ name: 'remove' }],
        },
        {
          id: 'edge-1',
          shape: 'edge',
          source: { cell: 'node-1' },
          target: { cell: 'node-2' },
          children: ['orphan'],
        },
      ];

      const sanitized = sanitizeCellsForApi(cells);

      expect(sanitized).toHaveLength(2);
      expect((sanitized[0] as any).zIndex).toBeUndefined();
      expect((sanitized[0] as any).tools).toBeUndefined();
      expect((sanitized[1] as any).children).toBeUndefined();
      expect(sanitized[1].shape).toBe('edge');
    });

    it('should convert children arrays to parent references', () => {
      const cells: Cell[] = [
        {
          id: 'boundary-1',
          shape: 'security-boundary',
          children: ['node-1', 'node-2'],
        } as Cell,
        {
          id: 'node-1',
          shape: 'process',
          // No parent set
        },
        {
          id: 'node-2',
          shape: 'store',
          // No parent set
        },
        {
          id: 'node-3',
          shape: 'actor',
          parent: 'existing-parent', // Already has parent - should not be overwritten
        },
      ];

      const sanitized = sanitizeCellsForApi(cells);

      // Boundary should not have children property
      expect((sanitized[0] as any).children).toBeUndefined();

      // Child nodes should have parent set
      expect(sanitized[1].parent).toBe('boundary-1');
      expect(sanitized[2].parent).toBe('boundary-1');

      // Node with existing parent should keep it
      expect(sanitized[3].parent).toBe('existing-parent');
    });

    it('should handle cells without children arrays', () => {
      const cells: Cell[] = [
        {
          id: 'node-1',
          shape: 'process',
        },
        {
          id: 'node-2',
          shape: 'store',
          parent: 'boundary-1',
        },
      ];

      const sanitized = sanitizeCellsForApi(cells);

      expect(sanitized[0].parent).toBeUndefined();
      expect(sanitized[1].parent).toBe('boundary-1');
    });

    it('should pass logger to individual cell sanitization', () => {
      const warnings: Array<{ message: string; context?: Record<string, unknown> }> = [];
      const logger = {
        warn: (msg: string, ctx?: Record<string, unknown>) =>
          warnings.push({ message: msg, context: ctx }),
      };

      const cells: Cell[] = [
        {
          id: 'node-1',
          shape: 'process',
          unknownProp: 'value',
        } as Cell,
      ];

      sanitizeCellsForApi(cells, logger);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('unknownProp'))).toBe(true);
    });
  });
});
