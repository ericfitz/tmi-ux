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
        expect(
          JSONPathMatcher.matches(
            'tools[0].name',
            '$.tools[*]',
          ),
        ).toBe(true);
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
        tools: [
          { name: 'button-remove' },
          { name: 'boundary' },
        ],
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
        tools: [
          { name: 'button-remove' },
          { name: 'boundary' },
        ],
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
});
