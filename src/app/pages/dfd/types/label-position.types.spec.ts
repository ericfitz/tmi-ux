import { describe, it, expect } from 'vitest';
import {
  LABEL_POSITION_ATTRS,
  getLabelPositionKey,
  getLabelPositionFromAttrs,
  LabelPosition,
} from './label-position.types';

describe('label-position.types', () => {
  describe('LABEL_POSITION_ATTRS', () => {
    it('should define all 9 positions', () => {
      const keys = Object.keys(LABEL_POSITION_ATTRS);
      expect(keys).toHaveLength(9);
      expect(keys).toContain('top-left');
      expect(keys).toContain('top-center');
      expect(keys).toContain('top-right');
      expect(keys).toContain('middle-left');
      expect(keys).toContain('middle-center');
      expect(keys).toContain('middle-right');
      expect(keys).toContain('bottom-left');
      expect(keys).toContain('bottom-center');
      expect(keys).toContain('bottom-right');
    });

    it('should use 5% padding for edge positions', () => {
      expect(LABEL_POSITION_ATTRS['top-left'].refX).toBe('5%');
      expect(LABEL_POSITION_ATTRS['top-left'].refY).toBe('5%');
      expect(LABEL_POSITION_ATTRS['bottom-right'].refX).toBe('95%');
      expect(LABEL_POSITION_ATTRS['bottom-right'].refY).toBe('95%');
    });

    it('should use 50% for center positions', () => {
      expect(LABEL_POSITION_ATTRS['middle-center'].refX).toBe('50%');
      expect(LABEL_POSITION_ATTRS['middle-center'].refY).toBe('50%');
    });

    it('should map textAnchor correctly for horizontal positions', () => {
      expect(LABEL_POSITION_ATTRS['top-left'].textAnchor).toBe('start');
      expect(LABEL_POSITION_ATTRS['top-center'].textAnchor).toBe('middle');
      expect(LABEL_POSITION_ATTRS['top-right'].textAnchor).toBe('end');
    });

    it('should map textVerticalAnchor correctly for vertical positions', () => {
      expect(LABEL_POSITION_ATTRS['top-center'].textVerticalAnchor).toBe('top');
      expect(LABEL_POSITION_ATTRS['middle-center'].textVerticalAnchor).toBe('middle');
      expect(LABEL_POSITION_ATTRS['bottom-center'].textVerticalAnchor).toBe('bottom');
    });
  });

  describe('getLabelPositionKey', () => {
    it('should build key from position object', () => {
      const position: LabelPosition = { vertical: 'top', horizontal: 'center' };
      expect(getLabelPositionKey(position)).toBe('top-center');
    });

    it('should handle all combinations', () => {
      expect(getLabelPositionKey({ vertical: 'bottom', horizontal: 'right' })).toBe('bottom-right');
      expect(getLabelPositionKey({ vertical: 'middle', horizontal: 'left' })).toBe('middle-left');
    });
  });

  describe('getLabelPositionFromAttrs', () => {
    it('should reverse-map standard position attrs', () => {
      const result = getLabelPositionFromAttrs({
        refX: '50%',
        refY: '5%',
        textAnchor: 'middle',
        textVerticalAnchor: 'top',
      });
      expect(result).toEqual({ vertical: 'top', horizontal: 'center' });
    });

    it('should reverse-map all 9 positions correctly', () => {
      for (const [key, attrs] of Object.entries(LABEL_POSITION_ATTRS)) {
        const result = getLabelPositionFromAttrs(attrs);
        expect(result).not.toBeNull();
        expect(getLabelPositionKey(result!)).toBe(key);
      }
    });

    it('should return null for unknown attr combinations', () => {
      const result = getLabelPositionFromAttrs({
        refX: '30%',
        refY: '70%',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
      });
      expect(result).toBeNull();
    });

    it('should default to middle-center when attrs are missing', () => {
      const result = getLabelPositionFromAttrs({});
      expect(result).toEqual({ vertical: 'middle', horizontal: 'center' });
    });

    it('should treat store shape refY 55% as 50% for middle positions', () => {
      const result = getLabelPositionFromAttrs({
        refX: '50%',
        refY: '55%',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
      });
      expect(result).toEqual({ vertical: 'middle', horizontal: 'center' });
    });

    it('should treat store shape refY 55% as 50% for left/right positions', () => {
      const result = getLabelPositionFromAttrs({
        refX: '5%',
        refY: '55%',
        textAnchor: 'start',
        textVerticalAnchor: 'middle',
      });
      expect(result).toEqual({ vertical: 'middle', horizontal: 'left' });
    });
  });
});
