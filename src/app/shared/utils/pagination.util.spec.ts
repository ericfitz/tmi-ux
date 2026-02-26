// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect } from 'vitest';
import {
  calculateOffset,
  calculatePageIndex,
  parsePaginationFromUrl,
  buildPaginationQueryParams,
  adjustPageAfterDeletion,
} from './pagination.util';
import { DEFAULT_PAGE_SIZE } from '../../types/pagination.types';

describe('pagination.util', () => {
  describe('calculateOffset', () => {
    it('should return 0 for first page', () => {
      expect(calculateOffset(0, 25)).toBe(0);
    });

    it('should return pageSize for second page', () => {
      expect(calculateOffset(1, 25)).toBe(25);
    });

    it('should multiply pageIndex by pageSize', () => {
      expect(calculateOffset(3, 10)).toBe(30);
    });

    it('should handle zero pageSize', () => {
      expect(calculateOffset(5, 0)).toBe(0);
    });
  });

  describe('calculatePageIndex', () => {
    it('should return 0 for zero offset', () => {
      expect(calculatePageIndex(0, 25)).toBe(0);
    });

    it('should return 1 for offset equal to pageSize', () => {
      expect(calculatePageIndex(25, 25)).toBe(1);
    });

    it('should floor non-exact divisions', () => {
      expect(calculatePageIndex(30, 25)).toBe(1);
    });

    it('should return 0 for zero pageSize', () => {
      expect(calculatePageIndex(50, 0)).toBe(0);
    });

    it('should return 0 for negative pageSize', () => {
      expect(calculatePageIndex(50, -10)).toBe(0);
    });
  });

  describe('parsePaginationFromUrl', () => {
    it('should parse page and size from URL params', () => {
      const result = parsePaginationFromUrl({ page: '2', size: '50' });
      expect(result.pageIndex).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it('should use defaults when params are missing', () => {
      const result = parsePaginationFromUrl({});
      expect(result.pageIndex).toBe(0);
      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should clamp negative page to 0', () => {
      const result = parsePaginationFromUrl({ page: '-1' });
      expect(result.pageIndex).toBe(0);
    });

    it('should use default for zero pageSize', () => {
      const result = parsePaginationFromUrl({ size: '0' });
      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should use default for negative pageSize', () => {
      const result = parsePaginationFromUrl({ size: '-5' });
      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should handle NaN page param', () => {
      const result = parsePaginationFromUrl({ page: 'abc' });
      expect(result.pageIndex).toBe(0);
    });

    it('should handle NaN size param', () => {
      const result = parsePaginationFromUrl({ size: 'xyz' });
      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should use custom default page size', () => {
      const result = parsePaginationFromUrl({}, 10);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('buildPaginationQueryParams', () => {
    it('should return empty params for default state', () => {
      const result = buildPaginationQueryParams({
        pageIndex: 0,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 100,
      });
      expect(result).toEqual({});
    });

    it('should include page when not on first page', () => {
      const result = buildPaginationQueryParams({
        pageIndex: 3,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 100,
      });
      expect(result['page']).toBe('3');
      expect(result['size']).toBeUndefined();
    });

    it('should include size when not default', () => {
      const result = buildPaginationQueryParams({
        pageIndex: 0,
        pageSize: 50,
        total: 100,
      });
      expect(result['size']).toBe('50');
      expect(result['page']).toBeUndefined();
    });

    it('should include filter when provided', () => {
      const result = buildPaginationQueryParams(
        { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, total: 100 },
        'search term',
      );
      expect(result['filter']).toBe('search term');
    });

    it('should trim filter text', () => {
      const result = buildPaginationQueryParams(
        { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, total: 100 },
        '  trimmed  ',
      );
      expect(result['filter']).toBe('trimmed');
    });

    it('should exclude empty filter', () => {
      const result = buildPaginationQueryParams(
        { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, total: 100 },
        '',
      );
      expect(result['filter']).toBeUndefined();
    });

    it('should exclude whitespace-only filter', () => {
      const result = buildPaginationQueryParams(
        { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, total: 100 },
        '   ',
      );
      expect(result['filter']).toBeUndefined();
    });

    it('should include all params when all differ from defaults', () => {
      const result = buildPaginationQueryParams(
        { pageIndex: 2, pageSize: 50, total: 200 },
        'query',
      );
      expect(result['page']).toBe('2');
      expect(result['size']).toBe('50');
      expect(result['filter']).toBe('query');
    });

    it('should respect custom default page size', () => {
      const result = buildPaginationQueryParams(
        { pageIndex: 0, pageSize: 10, total: 100 },
        undefined,
        10,
      );
      expect(result['size']).toBeUndefined();
    });
  });

  describe('adjustPageAfterDeletion', () => {
    it('should stay on current page when items remain', () => {
      expect(adjustPageAfterDeletion(2, 5, 50)).toBe(2);
    });

    it('should go back one page when last item on page deleted', () => {
      expect(adjustPageAfterDeletion(2, 0, 50)).toBe(1);
    });

    it('should stay on first page when first page is empty', () => {
      expect(adjustPageAfterDeletion(0, 0, 0)).toBe(0);
    });

    it('should stay on first page even with items remaining', () => {
      expect(adjustPageAfterDeletion(0, 3, 3)).toBe(0);
    });

    it('should go to first page when on page 1 and it becomes empty', () => {
      expect(adjustPageAfterDeletion(1, 0, 25)).toBe(0);
    });

    it('should stay on page 0 when total becomes 0', () => {
      expect(adjustPageAfterDeletion(0, 0, 0)).toBe(0);
    });
  });
});
