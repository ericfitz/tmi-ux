// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect } from 'vitest';
import { PageEvent } from '@angular/material/paginator';
import { TablePaginationManager, createSubtablePagination } from './table-pagination.util';
import {
  DEFAULT_SUBTABLE_PAGE_SIZE,
  SUBTABLE_PAGE_SIZE_OPTIONS,
} from '../../types/pagination.types';

describe('table-pagination.util', () => {
  describe('TablePaginationManager', () => {
    describe('constructor', () => {
      it('should initialize with default subtable options', () => {
        const manager = new TablePaginationManager();
        expect(manager.pageIndex).toBe(0);
        expect(manager.pageSize).toBe(DEFAULT_SUBTABLE_PAGE_SIZE);
        expect(manager.total).toBe(0);
        expect(manager.pageSizeOptions).toEqual(SUBTABLE_PAGE_SIZE_OPTIONS);
      });

      it('should accept custom page size options and default', () => {
        const manager = new TablePaginationManager([10, 20, 50], 20);
        expect(manager.pageSize).toBe(20);
        expect(manager.pageSizeOptions).toEqual([10, 20, 50]);
      });
    });

    describe('getRequestParams', () => {
      it('should return limit and offset for first page', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        const params = manager.getRequestParams();
        expect(params.limit).toBe(10);
        expect(params.offset).toBe(0);
      });

      it('should calculate offset based on page index', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        manager.pageIndex = 3;
        const params = manager.getRequestParams();
        expect(params.limit).toBe(10);
        expect(params.offset).toBe(30);
      });
    });

    describe('updateFromResponse', () => {
      it('should update total from response', () => {
        const manager = new TablePaginationManager();
        manager.updateFromResponse(['a', 'b', 'c'], 50);
        expect(manager.total).toBe(50);
        expect(manager.itemCount).toBe(3);
      });
    });

    describe('onPageChange', () => {
      it('should update page index and size from event', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        const event = { pageIndex: 2, pageSize: 25, length: 100 } as PageEvent;
        manager.onPageChange(event);
        expect(manager.pageIndex).toBe(2);
        expect(manager.pageSize).toBe(25);
      });

      it('should return true when page changed', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        const event = { pageIndex: 1, pageSize: 10, length: 100 } as PageEvent;
        expect(manager.onPageChange(event)).toBe(true);
      });

      it('should return false when page did not change', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        const event = { pageIndex: 0, pageSize: 10, length: 100 } as PageEvent;
        expect(manager.onPageChange(event)).toBe(false);
      });

      it('should return true when page size changed', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        const event = { pageIndex: 0, pageSize: 25, length: 100 } as PageEvent;
        expect(manager.onPageChange(event)).toBe(true);
      });
    });

    describe('resetToFirstPage', () => {
      it('should set page index to 0', () => {
        const manager = new TablePaginationManager();
        manager.pageIndex = 5;
        manager.resetToFirstPage();
        expect(manager.pageIndex).toBe(0);
      });
    });

    describe('adjustAfterDeletion', () => {
      it('should go back one page when last item on page deleted', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        manager.pageIndex = 2;
        manager.total = 21;
        manager.updateFromResponse(['single-item'], 21);

        const changed = manager.adjustAfterDeletion();
        expect(changed).toBe(true);
        expect(manager.pageIndex).toBe(1);
        expect(manager.total).toBe(20);
      });

      it('should stay on same page when items remain', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        manager.pageIndex = 1;
        manager.total = 15;
        manager.updateFromResponse(['a', 'b', 'c'], 15);

        const changed = manager.adjustAfterDeletion();
        expect(changed).toBe(false);
        expect(manager.pageIndex).toBe(1);
        expect(manager.total).toBe(14);
      });

      it('should stay on first page even when empty', () => {
        const manager = new TablePaginationManager([10, 25], 10);
        manager.pageIndex = 0;
        manager.total = 1;
        manager.updateFromResponse(['only-item'], 1);

        const changed = manager.adjustAfterDeletion();
        expect(changed).toBe(false);
        expect(manager.pageIndex).toBe(0);
        expect(manager.total).toBe(0);
      });
    });

    describe('shouldShowPaginator', () => {
      it('should return true when total exceeds smallest page size option', () => {
        const manager = new TablePaginationManager([5, 10, 25], 10);
        manager.total = 6;
        expect(manager.shouldShowPaginator()).toBe(true);
      });

      it('should return false when total fits in smallest page size option', () => {
        const manager = new TablePaginationManager([5, 10, 25], 10);
        manager.total = 5;
        expect(manager.shouldShowPaginator()).toBe(false);
      });

      it('should return false when total is 0', () => {
        const manager = new TablePaginationManager([5, 10, 25], 10);
        expect(manager.shouldShowPaginator()).toBe(false);
      });
    });

    describe('itemCount', () => {
      it('should return 0 before any response', () => {
        const manager = new TablePaginationManager();
        expect(manager.itemCount).toBe(0);
      });

      it('should reflect items from last response', () => {
        const manager = new TablePaginationManager();
        manager.updateFromResponse([1, 2, 3, 4, 5], 50);
        expect(manager.itemCount).toBe(5);
      });
    });
  });

  describe('createSubtablePagination', () => {
    it('should create manager with subtable defaults', () => {
      const manager = createSubtablePagination<string>();
      expect(manager.pageSize).toBe(DEFAULT_SUBTABLE_PAGE_SIZE);
      expect(manager.pageSizeOptions).toEqual(SUBTABLE_PAGE_SIZE_OPTIONS);
    });
  });
});
