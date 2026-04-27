import { describe, expect, it } from 'vitest';
import { isCellLayoutLocked, LOCK_BADGE_ICON_HREF } from './layout-lock.util';

describe('layout-lock.util', () => {
  describe('isCellLayoutLocked', () => {
    function makeCell(data: unknown): { getData: () => unknown } {
      return { getData: () => data };
    }

    it('returns false when cell has no data', () => {
      expect(isCellLayoutLocked(makeCell(null))).toBe(false);
      expect(isCellLayoutLocked(makeCell(undefined))).toBe(false);
    });

    it('returns false when cell has data but no _layoutLocked field', () => {
      expect(isCellLayoutLocked(makeCell({}))).toBe(false);
      expect(isCellLayoutLocked(makeCell({ _arch: { kind: 'aws' } }))).toBe(false);
    });

    it('returns true when cell.data._layoutLocked is true', () => {
      expect(isCellLayoutLocked(makeCell({ _layoutLocked: true }))).toBe(true);
    });

    it('returns false when cell.data._layoutLocked is false', () => {
      expect(isCellLayoutLocked(makeCell({ _layoutLocked: false }))).toBe(false);
    });

    it('returns false when cell is null or undefined', () => {
      expect(isCellLayoutLocked(null)).toBe(false);
      expect(isCellLayoutLocked(undefined)).toBe(false);
    });

    it('returns false when cell has no getData method', () => {
      expect(isCellLayoutLocked({})).toBe(false);
    });
  });

  describe('LOCK_BADGE_ICON_HREF', () => {
    it('is an SVG data URL', () => {
      expect(LOCK_BADGE_ICON_HREF).toMatch(/^data:image\/svg\+xml/);
    });

    it('contains a path element (the lock glyph)', () => {
      expect(LOCK_BADGE_ICON_HREF).toContain('path');
    });
  });
});
