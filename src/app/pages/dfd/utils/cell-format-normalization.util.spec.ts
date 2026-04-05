/**
 * Tests for cell format normalization utilities
 *
 * Covers: shape normalization, position/size format conversion
 */

import { describe, it, expect } from 'vitest';
import { normalizeCellFormat } from './cell-format-normalization.util';
import { CANONICAL_EDGE_SHAPE } from './cell-property-filter.util';
import { Cell } from '../../../core/types/websocket-message.types';

describe('cell-format-normalization.util', () => {
  describe('normalizeCellFormat', () => {
    describe('shape normalization', () => {
      it("should normalize 'edge' to CANONICAL_EDGE_SHAPE ('flow')", () => {
        const cell: Cell = {
          id: 'edge-1',
          shape: 'edge',
          source: 'node-1',
          target: 'node-2',
        };

        const result = normalizeCellFormat(cell);

        expect(result.shape).toBe(CANONICAL_EDGE_SHAPE);
        expect(result.shape).toBe('flow');
      });

      it("should normalize 'textbox' to 'text-box'", () => {
        const cell: Cell = {
          id: 'tb-1',
          shape: 'textbox',
          position: { x: 100, y: 200 },
          size: { width: 120, height: 60 },
        };

        const result = normalizeCellFormat(cell);

        expect(result.shape).toBe('text-box');
      });

      it("should leave 'flow' unchanged", () => {
        const cell: Cell = {
          id: 'edge-1',
          shape: 'flow',
          source: 'node-1',
          target: 'node-2',
        };

        const result = normalizeCellFormat(cell);

        expect(result.shape).toBe('flow');
      });

      it("should leave 'text-box' unchanged", () => {
        const cell: Cell = {
          id: 'tb-1',
          shape: 'text-box',
          position: { x: 100, y: 200 },
          size: { width: 120, height: 60 },
        };

        const result = normalizeCellFormat(cell);

        expect(result.shape).toBe('text-box');
      });

      it("should leave 'process' unchanged", () => {
        const cell: Cell = {
          id: 'proc-1',
          shape: 'process',
          position: { x: 100, y: 200 },
          size: { width: 120, height: 60 },
        };

        const result = normalizeCellFormat(cell);

        expect(result.shape).toBe('process');
      });
    });
  });
});
