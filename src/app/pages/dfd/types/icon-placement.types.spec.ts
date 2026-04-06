import { describe, it, expect } from 'vitest';
import {
  getIconPlacementKey,
  getIconPlacementFromKey,
  ICON_PLACEMENT_ATTRS,
  ICON_VERTICAL_POSITIONS,
  ICON_HORIZONTAL_POSITIONS,
  IconPlacement,
} from './icon-placement.types';

describe('Icon Placement Types', () => {
  describe('getIconPlacementKey', () => {
    it('should create key from placement', () => {
      const placement: IconPlacement = { vertical: 'middle', horizontal: 'center' };
      expect(getIconPlacementKey(placement)).toBe('middle-center');
    });

    it('should handle all positions', () => {
      expect(getIconPlacementKey({ vertical: 'top', horizontal: 'left' })).toBe('top-left');
      expect(getIconPlacementKey({ vertical: 'bottom', horizontal: 'right' })).toBe('bottom-right');
    });
  });

  describe('getIconPlacementFromKey', () => {
    it('should parse key into placement', () => {
      expect(getIconPlacementFromKey('top-left')).toEqual({
        vertical: 'top',
        horizontal: 'left',
      });
      expect(getIconPlacementFromKey('middle-center')).toEqual({
        vertical: 'middle',
        horizontal: 'center',
      });
    });

    it('should return null for invalid key', () => {
      expect(getIconPlacementFromKey('invalid')).toBeNull();
      expect(getIconPlacementFromKey('')).toBeNull();
    });
  });

  describe('ICON_PLACEMENT_ATTRS', () => {
    it('should have 9 positions', () => {
      expect(Object.keys(ICON_PLACEMENT_ATTRS)).toHaveLength(9);
    });

    it('should have refX and refY for each position', () => {
      for (const attrs of Object.values(ICON_PLACEMENT_ATTRS)) {
        expect(attrs.refX).toBeDefined();
        expect(attrs.refY).toBeDefined();
      }
    });
  });

  describe('position arrays', () => {
    it('should have 3 vertical positions', () => {
      expect(ICON_VERTICAL_POSITIONS).toEqual(['top', 'middle', 'bottom']);
    });

    it('should have 3 horizontal positions', () => {
      expect(ICON_HORIZONTAL_POSITIONS).toEqual(['left', 'center', 'right']);
    });
  });
});
